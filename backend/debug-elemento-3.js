const pool = require("./db");

async function debugElemento3() {
    try {
        console.log("\n🔍 INVESTIGACIÓN: Elemento código '3'\n");

        // 1. Buscar el producto con código 3
        const producto = await pool.query(`
            SELECT codigo, nombre, activo FROM producto WHERE codigo = '3';
        `);
        console.log("1️⃣ PRODUCTO:");
        console.table(producto.rows);

        if (producto.rows.length === 0) {
            console.log("❌ No existe producto con código '3'");
            pool.end();
            return;
        }

        // 2. Buscar lotes del producto 3
        const lotes = await pool.query(`
            SELECT 
                id_lote, 
                codigo_producto, 
                numero_orden,
                cantidad,
                fecha_compra
            FROM lote_producto 
            WHERE codigo_producto = '3';
        `);
        console.log("\n2️⃣ LOTES del producto 3:");
        console.table(lotes.rows);

        if (lotes.rows.length === 0) {
            console.log("⚠️ No hay lotes para el producto 3");
        }

        // 3. Para cada lote, ver movimientos
        for (const lote of lotes.rows) {
            const movimientos = await pool.query(`
                SELECT 
                    id_movimiento,
                    tipo_movimiento,
                    cantidad,
                    fecha
                FROM movimiento_bodega
                WHERE id_lote = $1
                ORDER BY fecha DESC;
            `, [lote.id_lote]);

            console.log(`\n3️⃣ MOVIMIENTOS del lote ${lote.id_lote}:`);
            console.table(movimientos.rows);
        }

        // 4. Ver directamente en la consulta del API
        const apiQuery = await pool.query(`
            SELECT 
                p.codigo as codigo_elemento,
                p.nombre as elemento,
                p.activo,
                COUNT(lp.id_lote) as cantidad_lotes,
                COALESCE(
                    SUM(CASE 
                        WHEN COALESCE(TRIM(lp.numero_orden), '') = '' THEN lp.cantidad 
                        ELSE 0 
                    END), 
                    0
                ) as inicial,
                COALESCE(
                    SUM(CASE 
                        WHEN COALESCE(TRIM(lp.numero_orden), '') <> '' THEN 1
                        ELSE 0
                    END), 
                    0
                ) as lotes_con_orden
            FROM lote_producto lp
            JOIN producto p ON lp.codigo_producto = p.codigo
            WHERE p.codigo = '3'
            GROUP BY p.codigo, p.nombre, p.activo;
        `);

        console.log("\n4️⃣ RESULTADO EN QUERY DEL API:");
        console.table(apiQuery.rows);

        // 5. Comparar con otro elemento que SÍ aparece (ej: código "7")
        console.log("\n\n=== COMPARACIÓN CON ELEMENTO '7' (que SÍ aparece) ===\n");
        
        const elemento7 = await pool.query(`
            SELECT 
                p.codigo,
                p.nombre,
                p.activo,
                COUNT(lp.id_lote) as cantidad_lotes
            FROM lote_producto lp
            JOIN producto p ON lp.codigo_producto = p.codigo
            WHERE p.codigo = '7'
            GROUP BY p.codigo, p.nombre, p.activo;
        `);

        console.log("Elemento 7:");
        console.table(elemento7.rows);

        pool.end();
    } catch (error) {
        console.error("Error:", error);
        pool.end();
    }
}

debugElemento3();
