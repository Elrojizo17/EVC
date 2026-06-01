const pool = require("./db");
const axios = require("axios");

async function testFullFlow() {
    try {
        console.log("\nðŸ” TEST COMPLETO: BD â†’ API â†’ Frontend\n");

        // 1. Verificar directamente en BD
        console.log("=== PASO 1: Consulta directa a BD ===");
        const bdResult = await pool.query(`
            SELECT COUNT(*) as total FROM (
                WITH mov AS (
                    SELECT 
                        id_lote,
                        SUM(CASE WHEN tipo_movimiento IN ('DESPACHADO','PRESTADO','MATERIAL_EXCEDENTE') THEN cantidad ELSE 0 END) as salidas,
                        SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE 0 END) as entrada_movimiento,
                        SUM(CASE WHEN tipo_movimiento = 'DEVOLUCION' THEN cantidad ELSE 0 END) as devolucion
                    FROM movimiento_bodega
                    GROUP BY id_lote
                )
                SELECT 
                    p.codigo,
                    p.nombre,
                    COALESCE(
                        SUM(CASE WHEN COALESCE(TRIM(lp.numero_orden), '') = '' THEN lp.cantidad ELSE 0 END), 0
                    ) as cantidad
                FROM lote_producto lp
                JOIN producto p ON lp.codigo_producto = p.codigo
                LEFT JOIN mov ON mov.id_lote = lp.id_lote
                WHERE p.activo = TRUE
                GROUP BY p.codigo, p.nombre
            ) AS results;
        `);
        console.log(`BD: ${bdResult.rows[0].total} elementos`);

        // 2. Llamar al API
        console.log("\n=== PASO 2: Llamar API /todos ===");
        try {
            const apiResponse = await axios.get("https://luminariasevc.onrender.com/api/inventario/todos");
            const data = apiResponse.data;
            console.log(`API recibido: ${data.length} elementos`);
            
            if (data.length === 0) {
                console.log("âš ï¸ API devolviÃ³ 0 elementos!");
            } else {
                console.log(`âœ… API devolviÃ³ ${data.length} elementos`);
                console.log(`Primeros 5:`);
                data.slice(0, 5).forEach((item, i) => {
                    console.log(`  ${i+1}. ${item.codigo_elemento || item.codigo} - ${item.elemento || item.nombre}`);
                });
                console.log(`Ãšltimos 5:`);
                data.slice(-5).forEach((item, i) => {
                    console.log(`  ${data.length - 5 + i + 1}. ${item.codigo_elemento || item.codigo} - ${item.elemento || item.nombre}`);
                });
            }

            // 3. Verificar consolidaciÃ³n como lo hace el frontend
            console.log("\n=== PASO 3: ConsolidaciÃ³n (como lo hace frontend) ===");
            const mapa = new Map();

            data.forEach((item) => {
                const codigo = String(item.codigo_elemento || "").trim().toUpperCase();
                if (!codigo) {
                    console.log(`âš ï¸ Elemento sin cÃ³digo: ${item.elemento}`);
                    return;
                }

                if (!mapa.has(codigo)) {
                    mapa.set(codigo, item);
                } else {
                    const actual = mapa.get(codigo);
                    mapa.set(codigo, {
                        ...actual,
                        cantidad: (Number(actual.cantidad || 0) + Number(item.cantidad || 0)),
                    });
                }
            });

            const consolidado = Array.from(mapa.values());
            console.log(`DespuÃ©s de consolidaciÃ³n: ${consolidado.length} elementos`);

            // 4. Aplicar bÃºsqueda vacÃ­a (como lo hace el frontend)
            console.log("\n=== PASO 4: Filtrado con bÃºsqueda vacÃ­a ===");
            const filtrado = consolidado.filter((item) => {
                const termino = "".toLowerCase();
                return (
                    String(item.codigo_elemento || "").toLowerCase().includes(termino) ||
                    String(item.elemento || "").toLowerCase().includes(termino)
                );
            });

            console.log(`DespuÃ©s de filtrar: ${filtrado.length} elementos`);

            if (filtrado.length !== consolidado.length) {
                console.log("âŒ El filtro estÃ¡ eliminando elementos!");
            }

            // 5. Verificar duplicados de cÃ³digos
            console.log("\n=== PASO 5: Verificar duplicados ===");
            const codigosApi = data.map(x => String(x.codigo_elemento || "").trim().toUpperCase()).filter(Boolean);
            const codigosUnicos = new Set(codigosApi);
            if (codigosApi.length !== codigosUnicos.size) {
                console.log(`âš ï¸ Hay duplicados: ${codigosApi.length} total, ${codigosUnicos.size} Ãºnicos`);
            } else {
                console.log(`âœ… Sin duplicados`);
            }

            console.log("\n=== RESUMEN ===");
            console.log(`BD: ${bdResult.rows[0].total}`);
            console.log(`API: ${data.length}`);
            console.log(`Frontend (consolidado): ${consolidado.length}`);
            console.log(`Frontend (filtrado): ${filtrado.length}`);

        } catch (error) {
            console.error("âŒ Error llamando al API:", error.message);
            if (error.code === "ECONNREFUSED") {
                console.log("El servidor NO estÃ¡ corriendo en https://luminariasevc.onrender.com");
            }
        }

        pool.end();
    } catch (error) {
        console.error("Error:", error);
        pool.end();
    }
}

testFullFlow();
