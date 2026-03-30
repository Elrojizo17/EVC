const pool = require("./db");

async function diagnose() {
    try {
        console.log("\n🔍 DIAGNÓSTICO: Elementos que no aparecen\n");

        // 1. Ver TODOS los productos (activos e inactivos)
        const productos = await pool.query(`
            SELECT 
                codigo,
                nombre,
                activo,
                COUNT(lp.id_lote) as cantidad_lotes
            FROM producto p
            LEFT JOIN lote_producto lp ON p.codigo = lp.codigo_producto
            GROUP BY p.codigo, p.nombre, p.activo
            ORDER BY p.nombre ASC;
        `);

        console.log("📦 PRODUCTOS EN BD:");
        console.table(productos.rows);

        // 2. Contar activos vs inactivos
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN activo = TRUE THEN 1 END) as activos,
                COUNT(CASE WHEN activo = FALSE THEN 1 END) as inactivos
            FROM producto;
        `);
        console.log("\n📊 ESTADÍSTICAS:");
        console.table(stats.rows[0]);

        // 3. Ver TODOS los elementos desde getInventarioFlat (con filtro)
        const inventarioConFiltro = await pool.query(`
            SELECT 
                codigo_elemento,
                elemento,
                cantidad,
                entrada,
                stock_disponible
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
            ) inventario;
        `);

        console.log("\n✅ ELEMENTOS MOSTRADOS EN FRONTEND (activos=TRUE):");
        console.log(`Total: ${inventarioConFiltro.rows.length}`);
        console.table(inventarioConFiltro.rows);

        // 4. Ver TODOS los elementos SIN filtro de activo
        const inventarioSinFiltro = await pool.query(`
            SELECT 
                codigo_elemento,
                elemento,
                cantidad,
                entrada,
                stock_disponible
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
                GROUP BY p.codigo, p.nombre
                ORDER BY p.nombre ASC
            ) inventario;
        `);

        console.log("\n❌ ELEMENTOS NO MOSTRADOS (activo=FALSE o sin lotes):");
        const faltantes = inventarioSinFiltro.rows.filter(
            item => !inventarioConFiltro.rows.find(x => x.codigo_elemento === item.codigo_elemento)
        );
        console.log(`Total que falta: ${faltantes.length}`);
        console.table(faltantes);

        // 5. Verificar productos inactivos
        const inactivos = await pool.query(`
            SELECT codigo, nombre, activo FROM producto WHERE activo = FALSE;
        `);
        console.log("\n🔴 PRODUCTOS INACTIVOS:");
        console.table(inactivos.rows);

        // 6. Verificar productos sin lotes
        const sinLotes = await pool.query(`
            SELECT p.codigo, p.nombre, p.activo, COUNT(lp.id_lote) as lotes
            FROM producto p
            LEFT JOIN lote_producto lp ON p.codigo = lp.codigo_producto
            GROUP BY p.codigo, p.nombre, p.activo
            HAVING COUNT(lp.id_lote) = 0
            ORDER BY p.nombre;
        `);
        console.log("\n⚠️ PRODUCTOS SIN LOTES:");
        console.table(sinLotes.rows);

        pool.end();
    } catch (error) {
        console.error("Error:", error);
        pool.end();
    }
}

diagnose();
