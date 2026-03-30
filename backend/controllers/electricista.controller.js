const pool = require("../db");

// GET all electricians
exports.getAllElectricistas = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                documento as id_electricista,
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

// GET single electrician with inventory (actualizado para modelo sin lotes)
exports.getElectristaConInventario = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT 
                e.documento as id_electricista,
                e.nombre,
                e.documento,
                e.telefono,
                e.activo,
                e.fecha_registro,
                json_agg(
                    json_build_object(
                        'id_registro', ie.id_registro,
                        'codigo_producto', ie.codigo_producto,
                        'cantidad', ie.cantidad,
                        'nombre_producto', p.nombre,
                        'precio_unitario', p.precio_unitario,
                        'fecha_compra', p.fecha_compra
                    )
                ) FILTER (WHERE ie.id_registro IS NOT NULL) as inventario
            FROM electricista e
            LEFT JOIN inventario_electricista ie ON e.documento = ie.documento_electricista
            LEFT JOIN producto p ON ie.codigo_producto = p.codigo
            WHERE e.documento = $1
            GROUP BY e.documento, e.nombre, e.documento, e.telefono, e.activo, e.fecha_registro`,
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
            RETURNING documento as id_electricista, nombre, documento, telefono, activo, fecha_registro`,
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

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const documentoNormalizado = typeof documento === "string" ? documento.trim() : null;
        const cambiaDocumento = Boolean(documentoNormalizado && documentoNormalizado !== id);

        if (!cambiaDocumento) {
            const result = await client.query(
                `UPDATE electricista 
                SET nombre = COALESCE($2, nombre),
                    telefono = COALESCE($3, telefono),
                    activo = COALESCE($4, activo)
                WHERE documento = $1
                RETURNING documento as id_electricista, nombre, documento, telefono, activo, fecha_registro`,
                [id, nombre, telefono, activo]
            );

            if (result.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Electrician not found" });
            }

            await client.query("COMMIT");
            return res.json(result.rows[0]);
        }

        const currentResult = await client.query(
            `SELECT documento, nombre, telefono, activo, fecha_registro, created_at
             FROM electricista
             WHERE documento = $1`,
            [id]
        );

        if (currentResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Electrician not found" });
        }

        const current = currentResult.rows[0];

        const insertResult = await client.query(
            `INSERT INTO electricista (documento, nombre, telefono, activo, fecha_registro, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
             RETURNING documento as id_electricista, nombre, documento, telefono, activo, fecha_registro`,
            [
                documentoNormalizado,
                nombre ?? current.nombre,
                telefono ?? current.telefono,
                activo ?? current.activo,
                current.fecha_registro,
                current.created_at
            ]
        );

        await client.query(
            `UPDATE inventario_electricista
             SET documento_electricista = $2
             WHERE documento_electricista = $1`,
            [id, documentoNormalizado]
        );

        await client.query(
            `UPDATE movimiento_bodega
             SET id_electricista = $2
             WHERE id_electricista = $1`,
            [id, documentoNormalizado]
        );

        await client.query("DELETE FROM electricista WHERE documento = $1", [id]);
        await client.query("COMMIT");

        return res.json(insertResult.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") {
            return res.status(400).json({ error: "Document already exists" });
        }
        console.error("Error updating electrician:", error);
        res.status(500).json({ error: "Error updating electrician" });
    } finally {
        client.release();
    }
};

// POST assign product to electrician (actualizado para modelo sin lotes)
exports.asignarProductoElectricista = async (req, res) => {
    const { id_electricista, codigo_producto, cantidad } = req.body;

    if (!id_electricista || !codigo_producto || !cantidad) {
        return res.status(400).json({ error: "Missing required fields: id_electricista, codigo_producto, cantidad" });
    }

    if (cantidad <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    try {
        // Check if electrician exists
        const electCheck = await pool.query(
            "SELECT documento FROM electricista WHERE documento = $1",
            [id_electricista]
        );
        if (electCheck.rows.length === 0) {
            return res.status(404).json({ error: "Electrician not found" });
        }

        // Check if product exists
        const prodCheck = await pool.query(
            "SELECT codigo FROM producto WHERE codigo = $1",
            [codigo_producto]
        );
        if (prodCheck.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Insert or update
        const result = await pool.query(
            `INSERT INTO inventario_electricista (documento_electricista, codigo_producto, cantidad)
            VALUES ($1, $2, $3)
            ON CONFLICT (documento_electricista, codigo_producto) 
            DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = CURRENT_TIMESTAMP
            RETURNING id_registro, documento_electricista as id_electricista, codigo_producto, cantidad`,
            [id_electricista, codigo_producto, cantidad]
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
                codigo as id_producto,
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

// GET products (lista para asignar a electricistas - actualizado para modelo sin lotes)
// Esta función ahora retorna productos individuales, no lotes
exports.getLotes = async (req, res) => {
    const { codigo_producto } = req.query;
    try {
        let query = `SELECT 
                        p.codigo,
                        p.codigo as codigo_producto,
                        p.nombre,
                        p.cantidad_inicial,
                        p.precio_unitario,
                        p.fecha_compra
                    FROM producto p
                    WHERE p.activo = TRUE`;
        const params = [];

        if (codigo_producto) {
            query += " AND p.codigo = $1";
            params.push(codigo_producto);
        }

        query += " ORDER BY p.nombre ASC";

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Error fetching products" });
    }
};
