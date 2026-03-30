const express = require("express");
const router = express.Router();
const pool = require("../db");


// GET gastos de inventario (movimientos de bodega)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                mb.id_movimiento AS id_gasto,
                mb.codigo_producto,
                mb.tipo_movimiento,
                mb.cantidad AS cantidad_usada,
                mb.numero_orden,
                mb.id_novedad_luminaria AS id_novedad,
                TO_CHAR(mb.fecha, 'YYYY-MM-DD') AS fecha,
                mb.observacion,
                mb.id_electricista,
                e.nombre AS nombre_electricista,
                mb.codigo_pqr,
                p.codigo,
                p.nombre AS elemento,
                p.precio_unitario AS costo_unitario,
                nl.numero_lampara,
                nl.tipo_novedad
            FROM movimiento_bodega mb
            JOIN producto p ON p.codigo = mb.codigo_producto
            LEFT JOIN electricista e ON e.documento = mb.id_electricista
            LEFT JOIN novedad_luminaria nl ON nl.id_novedad = mb.id_novedad_luminaria
            ORDER BY mb.fecha DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("Error consultando gastos:", error);
        res.status(500).json({ error: "Error consultando gastos" });
    }
});

// POST crear gasto (movimiento de bodega)
router.post("/", async (req, res) => {
    const {
        id_lote,
        codigo_producto,
        tipo_movimiento,
        cantidad,
        id_novedad_luminaria,
        observacion,
        id_electricista,
        codigo_pqr,
        fecha,
        numero_orden
    } = req.body;

    const prodCode = codigo_producto || id_lote; // Para compatibilidad

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Validaciones básicas
        if (!prodCode || !tipo_movimiento || !cantidad) {
            throw new Error('Campos obligatorios: codigo_producto, tipo_movimiento, cantidad');
        }

        const tiposValidos = ['ENTRADA', 'DESPACHADO', 'DEVOLUCION', 'MATERIAL_EXCEDENTE', 'PRESTADO'];
        if (!tiposValidos.includes(tipo_movimiento)) {
            throw new Error('Tipo de movimiento inválido');
        }

        let fechaMovimiento;
        if (fecha) {
            const fechaTexto = String(fecha).trim();
            let fechaParseada;

            if (/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
                fechaParseada = new Date(`${fechaTexto}T12:00:00`);
            } else {
                fechaParseada = new Date(fechaTexto);
            }

            if (Number.isNaN(fechaParseada.getTime())) {
                throw new Error('Fecha del movimiento inválida');
            }

            fechaMovimiento = fechaParseada.toISOString().slice(0, 10);
        } else {
            fechaMovimiento = new Date().toISOString().slice(0, 10);
        }

        // Verificar que el producto existe
        const prodCheck = await client.query(
            `SELECT codigo, nombre, cantidad_inicial, precio_unitario FROM producto WHERE codigo = $1`,
            [prodCode]
        );

        if (prodCheck.rows.length === 0) {
            throw new Error('Producto no encontrado');
        }

        const producto = prodCheck.rows[0];
        const cantidadSolicitada = Number(cantidad);

        // Calcular stock disponible (SOLO movimientos SIN NOVEDAD)
        const stockResult = await client.query(
            `SELECT 
                $1::INT as cantidad_inicial
                + COALESCE(SUM(CASE WHEN tipo_movimiento = 'ENTRADA' AND numero_orden IS NOT NULL AND id_novedad_luminaria IS NULL THEN cantidad ELSE 0 END), 0)
                + COALESCE(SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' AND id_novedad_luminaria IS NULL THEN cantidad ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN tipo_movimiento = 'DESPACHADO' AND id_novedad_luminaria IS NULL THEN cantidad ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN tipo_movimiento = 'PRESTADO' AND id_novedad_luminaria IS NULL THEN cantidad ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN tipo_movimiento = 'MATERIAL_EXCEDENTE' AND id_novedad_luminaria IS NULL THEN cantidad ELSE 0 END), 0)
                AS stock_disponible
            FROM movimiento_bodega
            WHERE codigo_producto = $2`,
            [producto.cantidad_inicial, prodCode]
        );

        const stockDisponible = stockResult.rows.length > 0
            ? Math.max(0, Number(stockResult.rows[0].stock_disponible || 0))
            : Math.max(0, producto.cantidad_inicial);

        // Validar cantidad para movimientos de DESPACHADO o similar
        if (['DESPACHADO', 'PRESTADO', 'MATERIAL_EXCEDENTE'].includes(tipo_movimiento)) {
            if (stockDisponible < cantidadSolicitada) {
                throw new Error(`Stock insuficiente. Disponible: ${stockDisponible}, Solicitado: ${cantidadSolicitada}`);
            }
        }

        const electricistaDocumento = id_electricista ? String(id_electricista).trim() : "";
        if (!electricistaDocumento && tipo_movimiento !== 'ENTRADA') {
            throw new Error("Debes seleccionar un electricista responsable");
        }

        if (electricistaDocumento) {
            const electricistaCheck = await client.query(
                `SELECT documento, nombre, activo FROM electricista WHERE documento = $1`,
                [electricistaDocumento]
            );

            if (electricistaCheck.rows.length === 0) {
                throw new Error("Electricista no encontrado");
            }

            if (!electricistaCheck.rows[0].activo) {
                throw new Error("El electricista seleccionado no está disponible");
            }
        }

        // Validaciones adicionales para DEVOLUCION
        if (tipo_movimiento === 'DEVOLUCION' && id_novedad_luminaria) {
            const novedadCheck = await client.query(
                `SELECT id_novedad, numero_lampara FROM novedad_luminaria WHERE id_novedad = $1`,
                [id_novedad_luminaria]
            );

            if (novedadCheck.rows.length === 0) {
                throw new Error(`Novedad #${id_novedad_luminaria} no encontrada`);
            }

            const movimientoOriginal = await client.query(
                `SELECT mb.id_movimiento, mb.cantidad AS cantidad_despachada
                FROM movimiento_bodega mb
                WHERE mb.codigo_producto = $1 
                  AND mb.tipo_movimiento = 'DESPACHADO'
                  AND mb.id_novedad_luminaria = $2
                ORDER BY mb.fecha DESC
                LIMIT 1`,
                [prodCode, id_novedad_luminaria]
            );

            if (movimientoOriginal.rows.length === 0) {
                throw new Error(`No existe un despacho previo para esta novedad #${id_novedad_luminaria}`);
            }

            const despacho = movimientoOriginal.rows[0];
            if (cantidadSolicitada > despacho.cantidad_despachada) {
                throw new Error(`La cantidad a devolver (${cantidadSolicitada}) no puede exceder lo despachado (${despacho.cantidad_despachada})`);
            }
        }

        // Registrar el movimiento
        const query = `
            INSERT INTO movimiento_bodega (
                codigo_producto,
                tipo_movimiento,
                cantidad,
                numero_orden,
                id_novedad_luminaria,
                observacion,
                fecha,
                id_electricista,
                codigo_pqr
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::DATE, $8, $9)
            RETURNING *
        `;

        const values = [
            prodCode,
            tipo_movimiento,
            cantidadSolicitada,
            numero_orden || null,
            id_novedad_luminaria || null,
            observacion || null,
            fechaMovimiento,
            electricistaDocumento || null,
            codigo_pqr || null
        ];

        const result = await client.query(query, values);

        await client.query('COMMIT');
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creando movimiento:", error);
        res.status(500).json({ error: error.message || "Error creando movimiento" });
    } finally {
        client.release();
    }
});

module.exports = router;
