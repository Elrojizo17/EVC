const pool = require("./db");

async function checkData() {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN numero_orden IS NULL OR TRIM(numero_orden) = '' THEN 1 END) as sin_orden,
                COUNT(CASE WHEN numero_orden IS NOT NULL AND TRIM(numero_orden) <> '' THEN 1 END) as con_orden
            FROM lote_producto;
        `);
        console.log("Distribución de lotes:");
        console.log(JSON.stringify(result.rows[0], null, 2));

        // Ver lotes sin orden
        const sinOrden = await pool.query(`
            SELECT id_lote, codigo_producto, cantidad, fecha_compra
            FROM lote_producto
            WHERE numero_orden IS NULL OR TRIM(numero_orden) = ''
            LIMIT 10;
        `);
        console.log("\nLotes SIN número de orden:");
        console.log(JSON.stringify(sinOrden.rows, null, 2));

        // Ver movimientos ENTRADA
        const entradas = await pool.query(`
            SELECT mb.id_movimiento, mb.id_lote, mb.cantidad, mb.fecha, lp.numero_orden
            FROM movimiento_bodega mb
            JOIN lote_producto lp ON mb.id_lote = lp.id_lote
            WHERE mb.tipo_movimiento = 'ENTRADA'
            LIMIT 20;
        `);
        console.log("\nÚltimos 20 movimientos ENTRADA:");
        console.log(JSON.stringify(entradas.rows, null, 2));

        pool.end();
    } catch (error) {
        console.error("Error:", error);
        pool.end();
    }
}

checkData();
