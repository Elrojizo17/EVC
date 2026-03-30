const pool = require("../db");

// GET all lots in flat format (for frontend compatibility)
exports.getInventarioFlat = async (req, res) => {
    try {
        const result = await pool.query(
            `WITH mov AS (
                SELECT 
                    id_lote,
                    SUM(CASE WHEN tipo_movimiento IN ('DESPACHADO','PRESTADO','MATERIAL_EXCEDENTE') THEN cantidad ELSE 0 END) as total_salidas,
                    SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' THEN cantidad ELSE 0 END) as total_devolucion,
                    SUM(CASE WHEN tipo_movimiento IN ('DESPACHADO','PRESTADO','MATERIAL_EXCEDENTE') THEN cantidad ELSE 0 END) as salidas,
                    SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE 0 END) as entrada_movimiento,
                    SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' THEN cantidad ELSE 0 END) as devolucion,
                    SUM(CASE WHEN tipo_movimiento = 'DESPACHADO' THEN cantidad ELSE 0 END) as despachado,
                    SUM(CASE WHEN tipo_movimiento = 'MATERIAL_EXCEDENTE' THEN cantidad ELSE 0 END) as material_excedente,
                    SUM(CASE WHEN tipo_movimiento = 'PRESTADO' THEN cantidad ELSE 0 END) as prestamo
                FROM movimiento_bodega
                GROUP BY id_lote
            )
            SELECT 
                (ARRAY_AGG(lp.id_lote ORDER BY lp.id_lote DESC))[1] as id_lote,
                (ARRAY_AGG(lp.id_lote ORDER BY lp.id_lote DESC))[1] as id_inventario,
                ARRAY_AGG(lp.id_lote ORDER BY lp.id_lote DESC) as id_lotes,
                p.codigo as id_producto,
                p.codigo as codigo_elemento,
                p.nombre as elemento,
                (ARRAY_AGG(lp.numero_orden ORDER BY lp.id_lote DESC))[1] as numero_orden,
                (ARRAY_AGG(lp.anio_compra ORDER BY lp.id_lote DESC))[1] as anio_compra,
                (ARRAY_AGG(lp.precio_unitario ORDER BY lp.id_lote DESC))[1] as costo_unitario,
                -- INICIAL: suma de lotes SIN número de orden (cantidad fija)
                COALESCE(
                    SUM(CASE 
                        WHEN COALESCE(TRIM(lp.numero_orden), '') = '' THEN lp.cantidad 
                        ELSE 0 
                    END), 
                    0
                ) as cantidad,
                (ARRAY_AGG(lp.fecha_compra ORDER BY lp.id_lote DESC))[1] as fecha_compra,
                -- RECIBE: TODOS los movimientos ENTRADA (sin importar número de orden)
                COALESCE(SUM(mov.entrada_movimiento), 0) as entrada,
                COALESCE(SUM(mov.devolucion), 0) as devolucion,
                COALESCE(SUM(mov.despachado), 0) as despachado,
                COALESCE(SUM(mov.material_excedente), 0) as material_excedente,
                COALESCE(SUM(mov.prestamo), 0) as prestamo,
                -- cantidad gastada neta: salidas - devoluciones
                GREATEST(
                    COALESCE(SUM(mov.total_salidas), 0) - COALESCE(SUM(mov.total_devolucion), 0),
                    0
                ) as cantidad_gastada,
                -- stock disponible: inicial + recibe + devoluciones - salidas
                GREATEST(
                    COALESCE(
                        SUM(CASE 
                            WHEN COALESCE(TRIM(lp.numero_orden), '') = '' THEN lp.cantidad 
                            ELSE 0 
                        END), 
                        0
                    )
                    + COALESCE(SUM(mov.entrada_movimiento), 0)
                    + COALESCE(SUM(mov.devolucion), 0)
                    - COALESCE(SUM(mov.salidas), 0),
                    0
                ) as stock_disponible
            FROM lote_producto lp
            JOIN producto p ON lp.codigo_producto = p.codigo
            LEFT JOIN mov ON mov.id_lote = lp.id_lote
            WHERE p.activo = TRUE
            GROUP BY p.codigo, p.nombre
            ORDER BY p.nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching flat inventory:", error);
        res.status(500).json({ error: "Error fetching inventory" });
    }
};

// GET all products with their lots
exports.getProductosConLotes = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                p.codigo as id_producto,
                p.codigo,
                p.nombre,
                p.activo,
                json_agg(
                    json_build_object(
                        'id_lote', lp.id_lote,
                        'codigo_producto', lp.codigo_producto,
                        'numero_orden', lp.numero_orden,
                        'anio_compra', lp.anio_compra,
                        'precio_unitario', lp.precio_unitario,
                        'cantidad', lp.cantidad,
                        'fecha_compra', lp.fecha_compra
                    ) ORDER BY lp.fecha_compra DESC
                ) FILTER (WHERE lp.id_lote IS NOT NULL) as lotes
            FROM producto p
            LEFT JOIN lote_producto lp ON p.codigo = lp.codigo_producto
            WHERE p.activo = TRUE
            GROUP BY p.codigo, p.nombre, p.activo
            ORDER BY p.nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching products with lots:", error);
        res.status(500).json({ error: "Error fetching inventory" });
    }
};

// GET inventory movements history
exports.getMovimientos = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                mb.id_movimiento,
                mb.tipo_movimiento,
                mb.cantidad,
                mb.fecha,
                mb.observacion,
                lp.id_lote,
                p.codigo,
                p.nombre,
                lp.anio_compra,
                lp.precio_unitario,
                n.id_novedad,
                n.numero_lampara
            FROM movimiento_bodega mb
            JOIN lote_producto lp ON mb.id_lote = lp.id_lote
            JOIN producto p ON lp.codigo_producto = p.codigo
            LEFT JOIN novedad_luminaria n ON mb.id_novedad_luminaria = n.id_novedad
            ORDER BY mb.fecha DESC
            LIMIT 100`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching movements:", error);
        res.status(500).json({ error: "Error fetching movements" });
    }
};

// GET single lot details
exports.getLoteDetalle = async (req, res) => {
    const { id_lote } = req.params;
    try {
        const result = await pool.query(
            `SELECT 
                lp.id_lote,
                lp.numero_orden,
                lp.anio_compra,
                lp.precio_unitario,
                lp.cantidad,
                lp.fecha_compra,
                p.codigo as id_producto,
                p.codigo,
                p.nombre,
                COALESCE(
                    (SELECT SUM(cantidad) FROM movimiento_bodega WHERE id_lote = $1),
                    0
                ) as cantidad_movida
            FROM lote_producto lp
            JOIN producto p ON lp.codigo_producto = p.codigo
            WHERE lp.id_lote = $1`,
            [id_lote]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Lot not found" });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching lot details:", error);
        res.status(500).json({ error: "Error fetching lot details" });
    }
};

// POST record inventory movement
exports.crearMovimiento = async (req, res) => {
    const { id_lote, tipo_movimiento, cantidad, id_novedad_luminaria, observacion } = req.body;

    if (!id_lote || !tipo_movimiento || !cantidad) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const tiposValidos = ['ENTRADA', 'DESPACHADO', 'DEVOLUCION', 'MATERIAL_EXCEDENTE', 'PRESTADO'];
    if (!tiposValidos.includes(tipo_movimiento)) {
        return res.status(400).json({ error: "Invalid movement type" });
    }

    if (cantidad <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    try {
        // Verify lot exists
        const lotCheck = await pool.query(
            "SELECT id_lote, cantidad FROM lote_producto WHERE id_lote = $1",
            [id_lote]
        );

        if (lotCheck.rows.length === 0) {
            return res.status(404).json({ error: "Lot not found" });
        }

        const result = await pool.query(
            `INSERT INTO movimiento_bodega (id_lote, tipo_movimiento, cantidad, id_novedad_luminaria, observacion)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_movimiento, id_lote, tipo_movimiento, cantidad, fecha, observacion`,
            [id_lote, tipo_movimiento, cantidad, id_novedad_luminaria || null, observacion || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating movement:", error);
        res.status(500).json({ error: "Error recording movement" });
    }
};

// POST create new product
exports.createProducto = async (req, res) => {
    const { codigo, nombre } = req.body;

    if (!codigo || !nombre) {
        return res.status(400).json({ error: "Code and name are required" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO producto (codigo, nombre, activo)
            VALUES ($1, $2, TRUE)
            RETURNING codigo as id_producto, codigo, nombre, activo`,
            [codigo, nombre]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: "Product code already exists" });
        }
        console.error("Error creating product:", error);
        res.status(500).json({ error: "Error creating product" });
    }
};

// POST create new lot
exports.createLote = async (req, res) => {
    const { id_producto, codigo_producto, numero_orden, anio_compra, precio_unitario, cantidad, fecha_compra } = req.body;
    const codigoProducto = (codigo_producto ?? id_producto ?? "").toString().trim();
    const numeroOrden = (numero_orden ?? "").toString().trim();

    if (!codigoProducto || !anio_compra || !precio_unitario || !cantidad || !fecha_compra) {
        return res.status(400).json({ error: "All fields are required" });
    }

    if (cantidad <= 0 || precio_unitario <= 0) {
        return res.status(400).json({ error: "Quantity and price must be greater than 0" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Verify product exists
        const prodCheck = await client.query(
            "SELECT codigo FROM producto WHERE codigo = $1",
            [codigoProducto]
        );

        if (prodCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Product not found" });
        }

        const result = await client.query(
            `INSERT INTO lote_producto (codigo_producto, numero_orden, anio_compra, precio_unitario, cantidad, fecha_compra)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id_lote, codigo_producto as id_producto, codigo_producto, numero_orden, anio_compra, precio_unitario, cantidad, fecha_compra`,
            [codigoProducto, numeroOrden || null, anio_compra, precio_unitario, cantidad, fecha_compra]
        );

        const loteCreado = result.rows[0];

        await client.query(
            `INSERT INTO movimiento_bodega (id_lote, tipo_movimiento, cantidad, observacion, fecha)
             VALUES ($1, 'ENTRADA', $2, $3, $4::DATE)`,
            [
                loteCreado.id_lote,
                loteCreado.cantidad,
                "Ingreso inicial",
                fecha_compra
            ]
        );

        await client.query("COMMIT");
        res.status(201).json(loteCreado);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating lot:", error);
        res.status(500).json({ error: "Error creating lot" });
    } finally {
        client.release();
    }
};
// POST create product + lot in one call (for compatibility with frontend)
exports.createElemento = async (req, res) => {
    const { codigo_elemento, elemento, numero_orden, cantidad, costo_unitario, fecha_compra } = req.body;

    // Validation
    const codigoTrim = (codigo_elemento ?? "").toString().trim();
    const elementoTrim = (elemento ?? "").toString().trim();
    const numeroOrdenTrim = (numero_orden ?? "").toString().trim();

    if (!codigoTrim || !elementoTrim || cantidad === null || cantidad === undefined ||
        costo_unitario === null || costo_unitario === undefined || !fecha_compra) {
        return res.status(400).json({ error: "All fields are required: codigo_elemento, elemento, cantidad, costo_unitario, fecha_compra" });
    }

    if (cantidad < 0) {
        return res.status(400).json({ error: "Quantity must be greater or equal to 0" });
    }

    if (costo_unitario < 0) {
        return res.status(400).json({ error: "Unit cost must be greater or equal to 0" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Validate product code uniqueness
        const prodCheck = await client.query(
            "SELECT codigo FROM producto WHERE codigo = $1",
            [codigoTrim]
        );

        if (prodCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "El código del elemento ya existe" });
        }

        // Step 2: Create product
        const prodResult = await client.query(
            `INSERT INTO producto (codigo, nombre, activo)
            VALUES ($1, $2, TRUE)
            RETURNING codigo`,
            [codigoTrim, elementoTrim]
        );
        const codigoProducto = prodResult.rows[0].codigo;

        // Get purchase year from fecha_compra (string "YYYY-MM-DD")
        let anioCompra;
        if (fecha_compra) {
            const yearStr = String(fecha_compra).slice(0, 4);
            const parsed = parseInt(yearStr, 10);
            anioCompra = Number.isFinite(parsed) ? parsed : new Date().getFullYear();
        } else {
            anioCompra = new Date().getFullYear();
        }

        // Step 3: Create lot
        const loteResult = await client.query(
            `INSERT INTO lote_producto (codigo_producto, numero_orden, anio_compra, precio_unitario, cantidad, fecha_compra)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id_lote, codigo_producto as id_producto, codigo_producto, numero_orden, anio_compra, precio_unitario, cantidad, fecha_compra`,
            [codigoProducto, numeroOrdenTrim || null, anioCompra, costo_unitario, cantidad, fecha_compra]
        );

        if (Number(cantidad) > 0) {
            await client.query(
                `INSERT INTO movimiento_bodega (id_lote, tipo_movimiento, cantidad, observacion, fecha)
                 VALUES ($1, 'ENTRADA', $2, $3, $4::DATE)`,
                [
                    loteResult.rows[0].id_lote,
                    Number(cantidad),
                    "Ingreso inicial",
                    fecha_compra
                ]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            id_lote: loteResult.rows[0].id_lote,
            id_producto: codigoProducto,
            codigo_producto: codigoProducto,
            numero_orden: numeroOrdenTrim || null,
            codigo: codigo_elemento,
            nombre: elemento,
            anio_compra: anioCompra,
            precio_unitario: costo_unitario,
            cantidad: cantidad,
            fecha_compra: fecha_compra
        });

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(400).json({ error: "Producto con este código ya existe" });
        }
        console.error("Error creating elemento:", error);
        res.status(500).json({ error: "Error registrando elemento" });
    } finally {
        client.release();
    }
};

// PUT update existing element fields (name and unit cost)
exports.updateElemento = async (req, res) => {
    const idLote = Number(req.params.id_lote);
    const { elemento, costo_unitario } = req.body;

    if (!Number.isInteger(idLote) || idLote <= 0) {
        return res.status(400).json({ error: "ID de lote inválido" });
    }

    const nuevoNombre = elemento !== undefined ? String(elemento || "").trim() : undefined;
    const nuevoCosto = costo_unitario !== undefined ? Number(costo_unitario) : undefined;

    if (nuevoNombre !== undefined && !nuevoNombre) {
        return res.status(400).json({ error: "El nombre del elemento no puede estar vacío" });
    }

    if (nuevoCosto !== undefined && (!Number.isFinite(nuevoCosto) || nuevoCosto < 0)) {
        return res.status(400).json({ error: "El costo unitario debe ser mayor o igual a 0" });
    }

    if (nuevoNombre === undefined && nuevoCosto === undefined) {
        return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const loteActual = await client.query(
            `SELECT lp.id_lote, lp.codigo_producto
             FROM lote_producto lp
             WHERE lp.id_lote = $1`,
            [idLote]
        );

        if (loteActual.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Elemento no encontrado" });
        }

        const codigoProducto = loteActual.rows[0].codigo_producto;

        if (nuevoNombre !== undefined) {
            await client.query(
                `UPDATE producto
                 SET nombre = $1
                 WHERE codigo = $2`,
                [nuevoNombre, codigoProducto]
            );
        }

        if (nuevoCosto !== undefined) {
            await client.query(
                `UPDATE lote_producto
                 SET precio_unitario = $1
                 WHERE id_lote = $2`,
                [nuevoCosto, idLote]
            );
        }

        const actualizado = await client.query(
            `SELECT
                lp.id_lote,
                lp.id_lote as id_inventario,
                p.codigo as codigo_elemento,
                p.nombre as elemento,
                lp.precio_unitario as costo_unitario
             FROM lote_producto lp
             JOIN producto p ON p.codigo = lp.codigo_producto
             WHERE lp.id_lote = $1`,
            [idLote]
        );

        await client.query("COMMIT");
        return res.json(actualizado.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error actualizando elemento:", error);
        return res.status(500).json({ error: "Error actualizando elemento" });
    } finally {
        client.release();
    }
};