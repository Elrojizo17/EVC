const pool = require("./db");

async function checkTables() {
    try {
        console.log("🔍 Verificando estructura de tablas...\n");

        // Verificar tabla producto
        console.log("📋 Tabla: producto");
        const prodResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'producto'
            ORDER BY ordinal_position
        `);
        console.table(prodResult.rows);

        // Verificar tabla lote_producto
        console.log("\n📋 Tabla: lote_producto");
        const loteResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'lote_producto'
            ORDER BY ordinal_position
        `);
        console.table(loteResult.rows);

        // Verificar tabla movimiento_bodega
        console.log("\n📋 Tabla: movimiento_bodega");
        const movResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'movimiento_bodega'
            ORDER BY ordinal_position
        `);
        console.table(movResult.rows);

        // Contar registros
        console.log("\n📊 Conteo de registros:");
        const countProd = await pool.query("SELECT COUNT(*) as count FROM producto");
        const countLote = await pool.query("SELECT COUNT(*) as count FROM lote_producto");
        const countMov = await pool.query("SELECT COUNT(*) as count FROM movimiento_bodega");
        
        console.log(`- Productos: ${countProd.rows[0].count}`);
        console.log(`- Lotes: ${countLote.rows[0].count}`);
        console.log(`- Movimientos: ${countMov.rows[0].count}`);

        // Listar todos los lotes con sus productos
        console.log("\n📦 Lotes registrados:");
        const lotes = await pool.query(`
            SELECT lp.id_lote, p.codigo, p.nombre, lp.cantidad, lp.precio_unitario, lp.fecha_compra
            FROM lote_producto lp
            JOIN producto p ON lp.codigo_producto = p.codigo
        `);
        console.table(lotes.rows);

        pool.end();
    } catch (error) {
        console.error("❌ Error en diagnóstico:", error);
        pool.end();
        process.exit(1);
    }
}

checkTables();
