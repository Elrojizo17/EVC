const pool = require("./db");

async function consultaDirectaAPI() {
    try {
        console.log("\n📊 CONSULTA DIRECTA DE BD (como lo hace el API)\n");

        const result = await pool.query(`
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
                (ARRAY_AGG(lp.id_lote ORDER BY lp.id_lote DESC))[1] as id_inventario,
                ARRAY_AGG(lp.id_lote ORDER BY lp.id_lote DESC) as id_lotes,
                p.codigo as id_producto,
                p.codigo as codigo_elemento,
                p.nombre as elemento,
                (ARRAY_AGG(lp.numero_orden ORDER BY lp.id_lote DESC))[1] as numero_orden,
                (ARRAY_AGG(lp.anio_compra ORDER BY lp.id_lote DESC))[1] as anio_compra,
                (ARRAY_AGG(lp.precio_unitario ORDER BY lp.id_lote DESC))[1] as costo_unitario,
                COALESCE(
                    SUM(CASE 
                        WHEN COALESCE(TRIM(lp.numero_orden), '') = '' THEN lp.cantidad 
                        ELSE 0 
                    END), 
                    0
                ) as cantidad,
                (ARRAY_AGG(lp.fecha_compra ORDER BY lp.id_lote DESC))[1] as fecha_compra,
                COALESCE(
                    SUM(CASE 
                        WHEN COALESCE(TRIM(lp.numero_orden), '') <> '' THEN COALESCE(mov.entrada_movimiento, 0)
                        ELSE 0
                    END), 
                    0
                ) as entrada,
                COALESCE(SUM(mov.devolucion), 0) as devolucion,
                COALESCE(SUM(mov.despachado), 0) as despachado,
                COALESCE(SUM(mov.material_excedente), 0) as material_excedente,
                COALESCE(SUM(mov.prestamo), 0) as prestamo,
                GREATEST(
                    COALESCE(SUM(mov.total_salidas), 0) - COALESCE(SUM(mov.total_devolucion), 0),
                    0
                ) as cantidad_gastada,
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
        `);

        console.log(`Total de elementos: ${result.rows.length}`);
        
        // Buscar el elemento 3
        const elemento3 = result.rows.find(x => String(x.codigo_elemento).trim() === "3");
        
        if (elemento3) {
            console.log("\n✅ ELEMENTO 3 ENCONTRADO EN QUERY:");
            console.log(JSON.stringify(elemento3, null, 2));
        } else {
            console.log("\n❌ ELEMENTO 3 NO ENCONTRADO EN QUERY");
        }

        // Mostrar tabla completa pero solo los campos importantes
        console.log("\n📋 TABLA COMPLETA (solo campos importantes):");
        const tabla = result.rows.map(x => ({
            codigo: x.codigo_elemento,
            nombre: x.elemento,
            inicial: x.cantidad,
            recibe: x.entrada,
            stock: x.stock_disponible
        }));
        console.table(tabla);

        pool.end();
    } catch (error) {
        console.error("Error:", error);
        pool.end();
    }
}

consultaDirectaAPI();
