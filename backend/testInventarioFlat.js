const pool = require("./db");

async function testInventarioFlat() {
    try {
        console.log("\n📊 Prueba del inventario con lógica corregida:\n");

        const result = await pool.query(`
            SELECT 
                codigo_elemento,
                elemento,
                cantidad as inicial,
                entrada as recibe,
                despachado,
                devolucion,
                stock_disponible,
                (COALESCE(cantidad, 0) + COALESCE(entrada, 0) + COALESCE(devolucion, 0) - COALESCE(despachado, 0)) as stock_calculado
            FROM (
                WITH mov AS (
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
                    p.codigo as codigo_elemento,
                    p.nombre as elemento,
                    COALESCE(
                        SUM(CASE 
                            WHEN COALESCE(TRIM(lp.numero_orden), '') = '' THEN lp.cantidad 
                            ELSE 0 
                        END), 
                        0
                    ) as cantidad,
                    COALESCE(
                        SUM(CASE 
                            WHEN COALESCE(TRIM(lp.numero_orden), '') <> '' THEN COALESCE(mov.entrada_movimiento, 0)
                            ELSE 0
                        END), 
                        0
                    ) as entrada,
                    COALESCE(SUM(mov.devolucion), 0) as devolucion,
                    COALESCE(SUM(mov.despachado), 0) as despachado,
                    GREATEST(
                        COALESCE(
                            SUM(CASE 
                                WHEN COALESCE(TRIM(lp.numero_orden), '') = '' THEN lp.cantidad 
                                ELSE 0 
                            END), 
                            0
                        )
                        + COALESCE(
                            SUM(CASE 
                                WHEN COALESCE(TRIM(lp.numero_orden), '') <> '' THEN COALESCE(mov.entrada_movimiento, 0)
                                ELSE 0
                            END), 
                            0
                        )
                        + COALESCE(SUM(mov.devolucion), 0)
                        - COALESCE(SUM(mov.salidas), 0),
                        0
                    ) as stock_disponible
                FROM lote_producto lp
                JOIN producto p ON lp.codigo_producto = p.codigo
                LEFT JOIN mov ON mov.id_lote = lp.id_lote
                WHERE p.activo = TRUE
                GROUP BY p.codigo, p.nombre
                ORDER BY p.nombre ASC
            ) inventario
            LIMIT 15;
        `);

        console.log("Muestra del inventario:");
        console.table(result.rows);

        // Verificar que stock coincida con el cálculo manual
        console.log("\n✅ Validación de stock disponible:");
        result.rows.forEach(row => {
            const calculado = (parseFloat(row.inicial) || 0) 
                            + (parseFloat(row.recibe) || 0) 
                            + (parseFloat(row.devolucion) || 0) 
                            - (parseFloat(row.despachado) || 0);
            const enBd = parseFloat(row.stock_disponible) || 0;
            const match = Math.abs(calculado - enBd) < 0.01 ? "✅" : "❌";
            console.log(`${match} ${row.elemento}: BD=${enBd}, Calculado=${calculado}`);
        });

        pool.end();
    } catch (error) {
        console.error("Error:", error);
        pool.end();
    }
}

testInventarioFlat();
