const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET gastos de inventario (movimientos de bodega)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                mb.id_movimiento AS id_gasto,
                mb.id_lote,
                mb.tipo_movimiento,
                mb.cantidad AS cantidad_usada,
                mb.id_novedad_luminaria AS id_novedad,
                mb.fecha,
                mb.observacion,
                mb.id_electricista,
                e.nombre AS nombre_electricista,
                mb.codigo_pqr,
                p.codigo,
                p.nombre AS elemento,
                lp.precio_unitario AS costo_unitario,
                lp.anio_compra,
                nl.numero_lampara
            FROM movimiento_bodega mb
            JOIN lote_producto lp ON lp.id_lote = mb.id_lote
            JOIN producto p ON p.codigo = lp.codigo_producto
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
        tipo_movimiento,
        cantidad,
        id_novedad_luminaria,
        observacion,
        id_electricista,
        codigo_pqr,
        fecha
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Validaciones básicas
        if (!id_lote || !tipo_movimiento || !cantidad) {
            throw new Error('Campos obligatorios: id_lote, tipo_movimiento, cantidad');
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

                if (!Number.isNaN(fechaParseada.getTime())) {
                    const baseCoincide = fechaTexto.match(/^(\d{4}-\d{2}-\d{2})/);
                    const esMedianocheUTC = fechaParseada.getUTCHours() === 0 && fechaParseada.getUTCMinutes() === 0 && fechaParseada.getUTCSeconds() === 0;
                    if (baseCoincide && esMedianocheUTC) {
                        fechaParseada = new Date(`${baseCoincide[1]}T12:00:00`);
                    }
                }
            }

            if (Number.isNaN(fechaParseada.getTime())) {
                throw new Error('Fecha del movimiento inválida');
            }

            fechaMovimiento = fechaParseada;
        } else {
            fechaMovimiento = new Date();
        }

        // Verificar que el lote existe
        const loteCheck = await client.query(
            `SELECT
                p.nombre,
                lp.cantidad,
                lp.precio_unitario
            FROM lote_producto lp
            JOIN producto p ON p.codigo = lp.codigo_producto
            WHERE lp.id_lote = $1`,
            [id_lote]
        );

        if (loteCheck.rows.length === 0) {
            throw new Error('Lote de producto no encontrado');
        }

        const cantidadSolicitada = Number(cantidad);

        const stockResult = await client.query(
            `SELECT 
                lp.cantidad
                - COALESCE(SUM(CASE WHEN mb.tipo_movimiento IN ('DESPACHADO', 'PRESTADO', 'MATERIAL_EXCEDENTE') THEN mb.cantidad ELSE 0 END), 0)
                + COALESCE(SUM(CASE WHEN mb.tipo_movimiento IN ('ENTRADA', 'DEVOLUCION') THEN mb.cantidad ELSE 0 END), 0)
                AS stock_disponible
            FROM lote_producto lp
            LEFT JOIN movimiento_bodega mb ON mb.id_lote = lp.id_lote
            WHERE lp.id_lote = $1
            GROUP BY lp.cantidad`,
            [id_lote]
        );

        const stockDisponible = stockResult.rows.length > 0
            ? Number(stockResult.rows[0].stock_disponible || 0)
            : 0;

        // Validar cantidad para movimientos de DESPACHADO o similar
        if (['DESPACHADO', 'PRESTADO', 'MATERIAL_EXCEDENTE'].includes(tipo_movimiento)) {
            if (stockDisponible < cantidadSolicitada) {
                throw new Error(`Stock insuficiente. Disponible: ${stockDisponible}, Solicitado: ${cantidadSolicitada}`);
            }
        }

        const electricistaDocumento = id_electricista ? String(id_electricista).trim() : "";
        if (!electricistaDocumento) {
            throw new Error("Debes seleccionar un electricista responsable");
        }

        const electricistaCheck = await client.query(
            `SELECT documento, nombre, activo
             FROM electricista
             WHERE documento = $1`,
            [electricistaDocumento]
        );

        if (electricistaCheck.rows.length === 0) {
            throw new Error("Electricista no encontrado");
        }

        if (!electricistaCheck.rows[0].activo) {
            throw new Error("El electricista seleccionado no está disponible");
        }

        // Registrar el movimiento
        const query = `
            INSERT INTO movimiento_bodega (
                id_lote,
                tipo_movimiento,
                cantidad,
                id_novedad_luminaria,
                observacion,
                fecha,
                id_electricista,
                codigo_pqr
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const values = [
            id_lote,
            tipo_movimiento,
            cantidadSolicitada,
            id_novedad_luminaria || null,
            observacion || null,
            fechaMovimiento,
            electricistaDocumento,
            codigo_pqr || null
        ];

        const result = await client.query(query, values);

        // No actualizamos directamente lp.cantidad aquí.
        // El stock disponible se calcula en tiempo real a partir de los movimientos
        // (ver inventario.controller.getInventarioFlat).

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
