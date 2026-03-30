const pool = require("../db");

// GET all inventory in flat format (new model without lots)
exports.getInventarioFlat = async (req, res) => {
    try {
        const result = await pool.query(
            `WITH movimientos_normalizados AS (
                SELECT
                    mb.codigo_producto,
                    mb.tipo_movimiento,
                    mb.id_novedad_luminaria,
                    mb.cantidad,
                    mb.numero_orden,
                    CASE
                        WHEN regexp_replace(COALESCE(mb.numero_orden, ''), '[^0-9]', '', 'g') ~ '^[0-9]+$'
                            THEN regexp_replace(COALESCE(mb.numero_orden, ''), '[^0-9]', '', 'g')::INT
                        ELSE NULL
                    END AS numero_orden_int
                FROM movimiento_bodega mb
            ),
            resumen_movimientos AS (
                SELECT
                    mn.codigo_producto,
                    -- Inicial: ORDEN:000 y entradas legacy sin orden
                    COALESCE(SUM(CASE
                        WHEN mn.tipo_movimiento = 'ENTRADA'
                             AND mn.id_novedad_luminaria IS NULL
                             AND (
                                mn.numero_orden_int = 0
                                OR (mn.numero_orden_int IS NULL AND COALESCE(TRIM(mn.numero_orden), '') = '')
                             )
                        THEN mn.cantidad ELSE 0
                    END), 0) AS cantidad_inicial_movimientos,
                    -- Recibe: desde ORDEN:001 en adelante
                    COALESCE(SUM(CASE
                        WHEN mn.tipo_movimiento = 'ENTRADA'
                             AND mn.id_novedad_luminaria IS NULL
                             AND mn.numero_orden_int >= 1
                        THEN mn.cantidad ELSE 0
                    END), 0) AS cantidad_recibe_movimientos,
                    COALESCE(SUM(CASE
                        WHEN mn.tipo_movimiento = 'DEVOLUCION'
                             AND mn.id_novedad_luminaria IS NULL
                        THEN mn.cantidad ELSE 0
                    END), 0) AS devolucion,
                    COALESCE(SUM(CASE
                        WHEN mn.tipo_movimiento = 'DESPACHADO'
                             AND mn.id_novedad_luminaria IS NULL
                        THEN mn.cantidad ELSE 0
                    END), 0) AS despachado,
                    COALESCE(SUM(CASE
                        WHEN mn.tipo_movimiento = 'PRESTADO'
                             AND mn.id_novedad_luminaria IS NULL
                        THEN mn.cantidad ELSE 0
                    END), 0) AS prestamo,
                    COALESCE(SUM(CASE
                        WHEN mn.tipo_movimiento = 'MATERIAL_EXCEDENTE'
                             AND mn.id_novedad_luminaria IS NULL
                        THEN mn.cantidad ELSE 0
                    END), 0) AS material_excedente
                FROM movimientos_normalizados mn
                GROUP BY mn.codigo_producto
            )
            SELECT
                p.codigo AS id_producto,
                p.codigo AS codigo_elemento,
                p.nombre AS elemento,
                CASE
                    WHEN COALESCE(rm.cantidad_inicial_movimientos, 0) > 0
                        THEN COALESCE(rm.cantidad_inicial_movimientos, 0)
                    ELSE COALESCE(p.cantidad_inicial, 0)
                END AS cantidad,
                COALESCE(rm.cantidad_recibe_movimientos, 0) AS entrada,
                COALESCE(rm.devolucion, 0) AS devolucion,
                COALESCE(rm.despachado, 0) AS despachado,
                COALESCE(rm.prestamo, 0) AS prestamo,
                COALESCE(rm.material_excedente, 0) AS material_excedente,
                p.precio_unitario AS costo_unitario,
                p.fecha_compra,
                -- Stock disponible: Inicial + Recibe + Devolucion - Despachado - Prestado - Material excedente
                GREATEST(
                    (
                        CASE
                            WHEN COALESCE(rm.cantidad_inicial_movimientos, 0) > 0
                                THEN COALESCE(rm.cantidad_inicial_movimientos, 0)
                            ELSE COALESCE(p.cantidad_inicial, 0)
                        END
                    )
                    + COALESCE(rm.cantidad_recibe_movimientos, 0)
                    + COALESCE(rm.devolucion, 0)
                    - COALESCE(rm.despachado, 0)
                    - COALESCE(rm.prestamo, 0)
                    - COALESCE(rm.material_excedente, 0),
                    0
                ) AS stock_disponible,
                GREATEST(
                    COALESCE(rm.despachado, 0)
                    + COALESCE(rm.prestamo, 0)
                    + COALESCE(rm.material_excedente, 0)
                    - COALESCE(rm.devolucion, 0),
                    0
                ) AS cantidad_gastada
            FROM producto p
            LEFT JOIN resumen_movimientos rm ON p.codigo = rm.codigo_producto
            WHERE p.activo = TRUE
            ORDER BY p.nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching flat inventory:", error);
        res.status(500).json({ error: "Error fetching inventory" });
    }
};

// GET all products
exports.getProductos = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                p.codigo,
                p.nombre,
                p.cantidad_inicial,
                p.precio_unitario,
                p.fecha_compra,
                p.activo
            FROM producto p
            WHERE p.activo = TRUE
            ORDER BY p.nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Error fetching products" });
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
                mb.numero_orden,
                p.codigo,
                p.nombre,
                p.precio_unitario,
                mb.id_electricista,
                e.nombre as nombre_electricista,
                mb.codigo_pqr,
                mb.id_novedad_luminaria,
                nl.numero_lampara
            FROM movimiento_bodega mb
            JOIN producto p ON mb.codigo_producto = p.codigo
            LEFT JOIN electricista e ON e.documento = mb.id_electricista
            LEFT JOIN novedad_luminaria nl ON nl.id_novedad = mb.id_novedad_luminaria
            ORDER BY mb.fecha DESC
            LIMIT 100`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching movements:", error);
        res.status(500).json({ error: "Error fetching movements" });
    }
};

// POST create new product (with entrada movement if quantity > 0)
exports.createProducto = async (req, res) => {
    const { codigo_elemento, elemento, cantidad, precio_unitario, fecha_compra, numero_orden } = req.body;

    if (!codigo_elemento || !elemento || cantidad === null || cantidad === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    if (cantidad < 0 || precio_unitario < 0) {
        return res.status(400).json({ error: "Quantity and price must be >= 0" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if product already exists
        const prodCheck = await client.query(
            "SELECT codigo FROM producto WHERE codigo = $1",
            [codigo_elemento]
        );

        if (prodCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Product code already exists" });
        }

        // Create product
        const prodResult = await client.query(
            `INSERT INTO producto (codigo, nombre, cantidad_inicial, precio_unitario, fecha_compra, activo)
            VALUES ($1, $2, $3, $4, $5, TRUE)
            RETURNING codigo, nombre, cantidad_inicial, precio_unitario, fecha_compra`,
            [codigo_elemento, elemento, cantidad, precio_unitario || 0, fecha_compra || null]
        );

        // If quantity > 0 and numero_orden provided, create ENTRADA movement
        if (Number(cantidad) > 0 && numero_orden) {
            await client.query(
                `INSERT INTO movimiento_bodega (codigo_producto, tipo_movimiento, cantidad, numero_orden, observacion, fecha)
                 VALUES ($1, 'ENTRADA', $2, $3, $4, $5)`,
                [
                    codigo_elemento,
                    Number(cantidad),
                    numero_orden,
                    "Ingreso inicial",
                    fecha_compra || new Date().toISOString().slice(0, 10)
                ]
            );
        }

        await client.query('COMMIT');

        res.status(201).json(prodResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creating product:", error);
        res.status(500).json({ error: "Error creating product" });
    } finally {
        client.release();
    }
};

// POST record inventory movement
exports.crearMovimiento = async (req, res) => {
    const { codigo_producto, tipo_movimiento, cantidad, numero_orden, id_novedad_luminaria, observacion, fecha } = req.body;

    if (!codigo_producto || !tipo_movimiento || !cantidad) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const tiposValidos = ['ENTRADA', 'DESPACHADO', 'DEVOLUCION', 'MATERIAL_EXCEDENTE', 'PRESTADO'];
    if (!tiposValidos.includes(tipo_movimiento)) {
        return res.status(400).json({ error: "Invalid movement type" });
    }

    if (cantidad <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    let numeroOrdenNormalizado = numero_orden || null;
    if (tipo_movimiento === 'ENTRADA') {
        const ordenTexto = String(numero_orden || "").trim();
        if (!ordenTexto) {
            return res.status(400).json({ error: "Order number is required for ENTRADA" });
        }

        const sinPrefijo = ordenTexto.replace(/^orden\s*:\s*/i, "").trim();
        if (!/^\d+$/.test(sinPrefijo)) {
            return res.status(400).json({ error: "Invalid order number format" });
        }

        numeroOrdenNormalizado = `ORDEN: ${sinPrefijo.padStart(3, "0")}`;
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
            return res.status(400).json({ error: "Invalid movement date" });
        }

        fechaMovimiento = fechaParseada.toISOString().slice(0, 10);
    } else {
        fechaMovimiento = new Date().toISOString().slice(0, 10);
    }

    try {
        // Verify product exists
        const prodCheck = await pool.query(
            "SELECT codigo FROM producto WHERE codigo = $1",
            [codigo_producto]
        );

        if (prodCheck.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        const result = await pool.query(
            `INSERT INTO movimiento_bodega (codigo_producto, tipo_movimiento, cantidad, numero_orden, id_novedad_luminaria, observacion, fecha)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id_movimiento, codigo_producto, tipo_movimiento, cantidad, fecha, observacion, numero_orden`,
            [codigo_producto, tipo_movimiento, cantidad, numeroOrdenNormalizado, id_novedad_luminaria || null, observacion || null, fechaMovimiento]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating movement:", error);
        res.status(500).json({ error: "Error recording movement" });
    }
};

// PUT update product
exports.updateProducto = async (req, res) => {
    const { codigo } = req.params;
    const { nombre, precio_unitario } = req.body;

    if (!nombre && !precio_unitario) {
        return res.status(400).json({ error: "At least one field to update is required" });
    }

    try {
        const query = `UPDATE producto SET
            ${nombre ? 'nombre = $1,' : ''}
            ${precio_unitario ? `precio_unitario = ${nombre ? '$2' : '$1'},` : ''}
            updated_at = CURRENT_TIMESTAMP
            WHERE codigo = ${nombre && precio_unitario ? '$3' : (nombre ? '$2' : '$2')}
            RETURNING codigo, nombre, cantidad_inicial, precio_unitario, fecha_compra`;

        const values = [];
        if (nombre) values.push(nombre);
        if (precio_unitario) values.push(precio_unitario);
        values.push(codigo);

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ error: "Error updating product" });
    }
};
