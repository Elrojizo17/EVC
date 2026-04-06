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

        if (!Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0) {
            throw new Error("La cantidad debe ser mayor a 0");
        }

        // Calcular stock disponible real de inventario (sin descontar material excedente)
        const stockResult = await client.query(
            `SELECT 
                (
                $1::INT
                + COALESCE(SUM(CASE WHEN tipo_movimiento = 'ENTRADA' AND numero_orden IS NOT NULL THEN cantidad ELSE 0 END), 0)
                + COALESCE(SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' THEN cantidad ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN tipo_movimiento = 'DESPACHADO' THEN cantidad ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN tipo_movimiento = 'PRESTADO' THEN cantidad ELSE 0 END), 0)
                )
                AS stock_disponible
            FROM movimiento_bodega
            WHERE codigo_producto = $2`,
            [producto.cantidad_inicial, prodCode]
        );

        const stockDisponible = stockResult.rows.length > 0
            ? Math.max(0, Number(stockResult.rows[0].stock_disponible || 0))
            : Math.max(0, producto.cantidad_inicial);

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

        const registrarMovimiento = async (tipo, cantidadMovimiento, idNovedadMovimiento = (id_novedad_luminaria || null), observacionMovimiento = (observacion || null)) => {
            const movimientoValues = [
                prodCode,
                tipo,
                Number(cantidadMovimiento),
                numero_orden || null,
                idNovedadMovimiento,
                observacionMovimiento,
                fechaMovimiento,
                electricistaDocumento || null,
                codigo_pqr || null
            ];

            const movimientoResult = await client.query(query, movimientoValues);
            return movimientoResult.rows[0];
        };

        let responsePayload;

        if (["DESPACHADO", "PRESTADO"].includes(tipo_movimiento) && cantidadSolicitada > stockDisponible) {
            const cantidadDesdeInventario = Math.max(0, Math.min(cantidadSolicitada, stockDisponible));
            const cantidadExcedente = Math.max(0, cantidadSolicitada - cantidadDesdeInventario);
            const movimientosRegistrados = [];

            if (cantidadDesdeInventario > 0) {
                const movimientoPrincipal = await registrarMovimiento(tipo_movimiento, cantidadDesdeInventario);
                movimientosRegistrados.push(movimientoPrincipal);
            }

            if (cantidadExcedente > 0) {
                const observacionExcedente = [
                    observacion || "",
                    `Ajuste automático por stock insuficiente (${cantidadExcedente})`
                ].filter(Boolean).join(" | ");
                const movimientoExcedente = await registrarMovimiento("MATERIAL_EXCEDENTE", cantidadExcedente, null, observacionExcedente || null);
                movimientosRegistrados.push(movimientoExcedente);
            }

            responsePayload = {
                message: "Movimiento registrado con ajuste automático a material excedente",
                codigo_producto: prodCode,
                tipo_movimiento_solicitado: tipo_movimiento,
                cantidad_solicitada: cantidadSolicitada,
                stock_disponible: stockDisponible,
                cantidad_desde_inventario: cantidadDesdeInventario,
                cantidad_material_excedente: cantidadExcedente,
                movimientos_generados: movimientosRegistrados
            };
        } else {
            const result = await client.query(query, values);
            responsePayload = result.rows[0];
        }

        await client.query('COMMIT');
        
        res.status(201).json(responsePayload);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creando movimiento:", error);
        res.status(500).json({ error: error.message || "Error creando movimiento" });
    } finally {
        client.release();
    }
});

// DELETE eliminar gasto (movimiento asociado a novedad)
router.delete("/:id_gasto", async (req, res) => {
    const idMovimiento = Number(req.params.id_gasto);

    if (!Number.isInteger(idMovimiento) || idMovimiento <= 0) {
        return res.status(400).json({ error: "ID de gasto inválido" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const movimientoResult = await client.query(
            `SELECT id_movimiento, id_novedad_luminaria, tipo_movimiento, codigo_producto, cantidad
             FROM movimiento_bodega
             WHERE id_movimiento = $1
             FOR UPDATE`,
            [idMovimiento]
        );

        if (movimientoResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Gasto no encontrado" });
        }

        const movimiento = movimientoResult.rows[0];

        if (!movimiento.id_novedad_luminaria) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Solo se pueden eliminar gastos asociados a novedades" });
        }

        await client.query("SET LOCAL app.allow_movimiento_delete = 'on'");

        await client.query(
            "DELETE FROM movimiento_bodega WHERE id_movimiento = $1",
            [idMovimiento]
        );

        await client.query("COMMIT");
        return res.json({
            message: "Gasto eliminado correctamente",
            id_gasto: idMovimiento,
            id_novedad_luminaria: movimiento.id_novedad_luminaria,
            tipo_movimiento: movimiento.tipo_movimiento,
            codigo_producto: movimiento.codigo_producto,
            cantidad: movimiento.cantidad
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error eliminando gasto:", error);
        return res.status(500).json({ error: error.message || "Error eliminando gasto" });
    } finally {
        client.release();
    }
});

module.exports = router;
