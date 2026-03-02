const pool = require("./db");

async function testInventarioFlat() {
    try {
        console.log("🧪 Probando consulta de inventario flat...\n");

        const result = await pool.query(
            `SELECT 
                lp.id_lote,
                lp.id_lote as id_inventario,
                p.id_producto,
                p.codigo as codigo_elemento,
                p.nombre as elemento,
                lp.anio_compra,
                lp.precio_unitario as costo_unitario,
                lp.cantidad,
                lp.cantidad as stock_disponible,
                lp.fecha_compra,
                0 as cantidad_gastada
            FROM lote_producto lp
            JOIN producto p ON lp.id_producto = p.id_producto
            WHERE p.activo = TRUE
            ORDER BY p.nombre ASC`
        );

        console.log(`✅ Consulta exitosa. Filas retornadas: ${result.rows.length}\n`);
        console.table(result.rows);

        pool.end();
    } catch (error) {
        console.error("❌ Error en consulta:", error.message);
        pool.end();
        process.exit(1);
    }
}

testInventarioFlat();
