const pool = require("../db");

// GET all lots in flat format (for frontend compatibility)
exports.getInventarioFlat = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                lp.id_lote,
                lp.id_lote as id_inventario,
                p.codigo as id_producto,
                p.codigo as codigo_elemento,
                p.nombre as elemento,
                lp.anio_compra,
                lp.precio_unitario as costo_unitario,
                lp.cantidad,
                lp.fecha_compra,
                -- desgloses de movimientos por tipo
                COALESCE(mov.entrada, 0)   as entrada,
                COALESCE(mov.devolucion, 0) as devolucion,
                COALESCE(mov.despachado, 0) as despachado,
                COALESCE(mov.material_excedente, 0) as material_excedente,
                COALESCE(mov.prestamo, 0)  as prestamo,
                -- cantidad gastada neta: salidas - devoluciones
                GREATEST(
                    COALESCE(mov.total_salidas, 0) - COALESCE(mov.total_devolucion, 0),
                    0
                ) as cantidad_gastada,
                -- stock disponible: inicial - salidas + entradas
                GREATEST(
                    lp.cantidad - COALESCE(mov.salidas, 0) + COALESCE(mov.entradas, 0),
                    0
                ) as stock_disponible
            FROM lote_producto lp
            JOIN producto p ON lp.codigo_producto = p.codigo
            LEFT JOIN (
                SELECT 
                    id_lote,
                    SUM(CASE WHEN tipo_movimiento IN ('DESPACHADO','PRESTADO','MATERIAL_EXCEDENTE') THEN cantidad ELSE 0 END) as total_salidas,
                    SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' THEN cantidad ELSE 0 END) as total_devolucion,
                    SUM(CASE WHEN tipo_movimiento IN ('DESPACHADO','PRESTADO','MATERIAL_EXCEDENTE') THEN cantidad ELSE 0 END) as salidas,
                    SUM(CASE WHEN tipo_movimiento IN ('ENTRADA','DEVOLUCION') THEN cantidad ELSE 0 END) as entradas,
                    SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE 0 END) as entrada,
                    SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' THEN cantidad ELSE 0 END) as devolucion,
                    SUM(CASE WHEN tipo_movimiento = 'DESPACHADO' THEN cantidad ELSE 0 END) as despachado,
                    SUM(CASE WHEN tipo_movimiento = 'MATERIAL_EXCEDENTE' THEN cantidad ELSE 0 END) as material_excedente,
                    SUM(CASE WHEN tipo_movimiento = 'PRESTADO' THEN cantidad ELSE 0 END) as prestamo
                FROM movimiento_bodega
                GROUP BY id_lote
            ) mov ON mov.id_lote = lp.id_lote
            WHERE p.activo = TRUE
            ORDER BY p.nombre ASC, lp.anio_compra ASC, lp.fecha_compra ASC`
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
    const { id_producto, codigo_producto, anio_compra, precio_unitario, cantidad, fecha_compra } = req.body;
    const codigoProducto = (codigo_producto ?? id_producto ?? "").toString().trim();

    if (!codigoProducto || !anio_compra || !precio_unitario || !cantidad || !fecha_compra) {
        return res.status(400).json({ error: "All fields are required" });
    }

    if (cantidad <= 0 || precio_unitario <= 0) {
        return res.status(400).json({ error: "Quantity and price must be greater than 0" });
    }

    try {
        // Verify product exists
        const prodCheck = await pool.query(
            "SELECT codigo FROM producto WHERE codigo = $1",
            [codigoProducto]
        );

        if (prodCheck.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        const result = await pool.query(
            `INSERT INTO lote_producto (codigo_producto, anio_compra, precio_unitario, cantidad, fecha_compra)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_lote, codigo_producto as id_producto, codigo_producto, anio_compra, precio_unitario, cantidad, fecha_compra`,
            [codigoProducto, anio_compra, precio_unitario, cantidad, fecha_compra]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating lot:", error);
        res.status(500).json({ error: "Error creating lot" });
    }
};
// POST create product + lot in one call (for compatibility with frontend)
exports.createElemento = async (req, res) => {
    const { codigo_elemento, elemento, cantidad, costo_unitario, fecha_compra } = req.body;

    // Validation
    const codigoTrim = (codigo_elemento ?? "").toString().trim();
    const elementoTrim = (elemento ?? "").toString().trim();

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
            `INSERT INTO lote_producto (codigo_producto, anio_compra, precio_unitario, cantidad, fecha_compra)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_lote, codigo_producto as id_producto, codigo_producto, anio_compra, precio_unitario, cantidad, fecha_compra`,
            [codigoProducto, anioCompra, costo_unitario, cantidad, fecha_compra]
        );

        await client.query('COMMIT');

        res.status(201).json({
            id_lote: loteResult.rows[0].id_lote,
            id_producto: codigoProducto,
            codigo_producto: codigoProducto,
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