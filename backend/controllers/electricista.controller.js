const pool = require("../db");

// GET all electricians
exports.getAllElectricistas = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                id_electricista,
                nombre,
                documento,
                telefono,
                activo,
                fecha_registro
            FROM electricista
            ORDER BY nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching electricians:", error);
        res.status(500).json({ error: "Error fetching electricians" });
    }
};

// GET single electrician with inventory
exports.getElectristaConInventario = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT 
                e.id_electricista,
                e.nombre,
                e.documento,
                e.telefono,
                e.activo,
                e.fecha_registro,
                json_agg(
                    json_build_object(
                        'id_registro', ie.id_registro,
                        'id_lote', ie.id_lote,
                        'cantidad', ie.cantidad,
                        'codigo_producto', p.codigo,
                        'nombre_producto', p.nombre,
                        'anio_compra', lp.anio_compra,
                        'precio_unitario', lp.precio_unitario
                    )
                ) FILTER (WHERE ie.id_registro IS NOT NULL) as inventario
            FROM electricista e
            LEFT JOIN inventario_electricista ie ON e.id_electricista = ie.id_electricista
            LEFT JOIN lote_producto lp ON ie.id_lote = lp.id_lote
            LEFT JOIN producto p ON lp.id_producto = p.id_producto
            WHERE e.id_electricista = $1
            GROUP BY e.id_electricista`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Electrician not found" });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching electrician:", error);
        res.status(500).json({ error: "Error fetching electrician details" });
    }
};

// POST create new electrician
exports.createElectricista = async (req, res) => {
    const { nombre, documento, telefono } = req.body;

    if (!nombre || !documento) {
        return res.status(400).json({ error: "Name and document are required" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO electricista (nombre, documento, telefono, activo, fecha_registro)
            VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
            RETURNING id_electricista, nombre, documento, telefono, activo, fecha_registro`,
            [nombre, documento, telefono || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            // Unique constraint violation
            return res.status(400).json({ error: "Document already exists" });
        }
        console.error("Error creating electrician:", error);
        res.status(500).json({ error: "Error creating electrician" });
    }
};

// PUT update electrician
exports.updateElectricista = async (req, res) => {
    const { id } = req.params;
    const { nombre, documento, telefono, activo } = req.body;

    try {
        const result = await pool.query(
            `UPDATE electricista 
            SET nombre = COALESCE($2, nombre),
                documento = COALESCE($3, documento),
                telefono = COALESCE($4, telefono),
                activo = COALESCE($5, activo)
            WHERE id_electricista = $1
            RETURNING id_electricista, nombre, documento, telefono, activo, fecha_registro`,
            [id, nombre, documento, telefono, activo]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Electrician not found" });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating electrician:", error);
        res.status(500).json({ error: "Error updating electrician" });
    }
};

// POST assign product lot to electrician
exports.asignarProductoElectricista = async (req, res) => {
    const { id_electricista, id_lote, cantidad } = req.body;

    if (!id_electricista || !id_lote || !cantidad) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    if (cantidad <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    try {
        // Check if electrician exists
        const electCheck = await pool.query(
            "SELECT id_electricista FROM electricista WHERE id_electricista = $1",
            [id_electricista]
        );
        if (electCheck.rows.length === 0) {
            return res.status(404).json({ error: "Electrician not found" });
        }

        // Check if lot exists
        const lotCheck = await pool.query(
            "SELECT id_lote FROM lote_producto WHERE id_lote = $1",
            [id_lote]
        );
        if (lotCheck.rows.length === 0) {
            return res.status(404).json({ error: "Product lot not found" });
        }

        // Insert or update
        const result = await pool.query(
            `INSERT INTO inventario_electricista (id_electricista, id_lote, cantidad)
            VALUES ($1, $2, $3)
            ON CONFLICT (id_electricista, id_lote) 
            DO UPDATE SET cantidad = $3
            RETURNING id_registro, id_electricista, id_lote, cantidad`,
            [id_electricista, id_lote, cantidad]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error assigning product:", error);
        res.status(500).json({ error: "Error assigning product to electrician" });
    }
};

// DELETE remove product from electrician inventory
exports.removerProductoElectricista = async (req, res) => {
    const { id_registro } = req.params;

    try {
        const result = await pool.query(
            "DELETE FROM inventario_electricista WHERE id_registro = $1 RETURNING id_registro",
            [id_registro]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Inventory record not found" });
        }

        res.json({ message: "Product removed from electrician inventory" });
    } catch (error) {
        console.error("Error removing product:", error);
        res.status(500).json({ error: "Error removing product from inventory" });
    }
};

// GET active products
exports.getProductos = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                id_producto,
                codigo,
                nombre,
                activo
            FROM producto
            WHERE activo = TRUE
            ORDER BY nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Error fetching products" });
    }
};

// GET product lots
exports.getLotes = async (req, res) => {
    const { id_producto } = req.query;
    try {
        let query = `SELECT 
                        id_lote,
                        id_producto,
                        anio_compra,
                        precio_unitario,
                        cantidad,
                        fecha_compra
                    FROM lote_producto
                    WHERE cantidad > 0`;
        const params = [];

        if (id_producto) {
            query += " AND id_producto = $1";
            params.push(id_producto);
        }

        query += " ORDER BY fecha_compra DESC";

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching lots:", error);
        res.status(500).json({ error: "Error fetching product lots" });
    }
};
