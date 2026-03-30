const axios = require("axios");

async function simularFrontend() {
    try {
        console.log("\n🎭 SIMULACIÓN DEL FRONTEND\n");

        // 1. Traer datos del API
        const response = await axios.get("http://localhost:3000/api/inventario/todos");
        const inventario = response.data;
        console.log(`1️⃣ API devolvió: ${inventario.length} elementos`);

        // 2. Consolidar (exacto como lo hace el frontend)
        const mapa = new Map();
        inventario.forEach((item) => {
            const codigo = String(item.codigo_elemento || "").trim().toUpperCase();
            if (!codigo) return;
            
            if (!mapa.has(codigo)) {
                mapa.set(codigo, {
                    ...item,
                    codigo_elemento: codigo,
                    cantidad: Number(item.cantidad || 0),
                });
            } else {
                const actual = mapa.get(codigo);
                mapa.set(codigo, {
                    ...actual,
                    cantidad: Number(actual.cantidad || 0) + Number(item.cantidad || 0),
                });
            }
        });

        const inventarioConsolidado = Array.from(mapa.values());
        console.log(`2️⃣ Consolidado: ${inventarioConsolidado.length} elementos`);

        // 3. Buscar específicamente el elemento 3
        const elemento3 = inventarioConsolidado.find(x => x.codigo_elemento === "3");
        console.log("\n3️⃣ ELEMENTO '3':");
        if (elemento3) {
            console.log(`   Código: ${elemento3.codigo_elemento}`);
            console.log(`   Nombre: ${elemento3.elemento}`);
            console.log(`   Cantidad (inicial): ${elemento3.cantidad}`);
            console.log(`   Stock disponible: ${elemento3.stock_disponible}`);
            console.log(`   ✅ SISTE EN CONSOLIDADO`);
        } else {
            console.log(`   ❌ NO ESTÁ EN CONSOLIDADO`);
        }

        // 4. Filtrar (búsqueda vacía como cuando abre la página)
        const busqueda = "";
        const termino = busqueda.toLowerCase();
        const inventarioFiltrado = inventarioConsolidado.filter((item) => {
            return (
                String(item.codigo_elemento || "").toLowerCase().includes(termino) ||
                String(item.elemento || "").toLowerCase().includes(termino)
            );
        });

        console.log(`\n4️⃣ Después de filtrar con búsqueda vacía: ${inventarioFiltrado.length} elementos`);

        // 5. Verificar si el 3 está en el filtrado
        const elemento3Filtrado = inventarioFiltrado.find(x => x.codigo_elemento === "3");
        if (elemento3Filtrado) {
            console.log(`   ✅ ELEMENTO 3 SÍ APARECE EN TABLA`);
        } else {
            console.log(`   ❌ ELEMENTO 3 NO APARECE EN TABLA`);
        }

        // 6. Ver todos los elementos que sí aparecen (solo códigos)
        console.log("\n5️⃣ ELEMENTOS QUE SISTEN APARECER:");
        console.log(inventarioFiltrado.map(x => x.codigo_elemento).join(", "));

        // 7. Ver cuál falta
        console.log("\n6️⃣ BÚSQUEDA ESPECÍFICA: '3'");
        const busqueda3 = "3";
        const termino3 = busqueda3.toLowerCase();
        const filtrado3 = inventarioConsolidado.filter((item) => {
            const match = (
                String(item.codigo_elemento || "").toLowerCase().includes(termino3) ||
                String(item.elemento || "").toLowerCase().includes(termino3)
            );
            return match;
        });
        console.log(`   Resultados: ${filtrado3.length}`);
        filtrado3.forEach(x => {
            console.log(`   - ${x.codigo_elemento}: ${x.elemento}`);
        });

    } catch (error) {
        console.error("Error:", error.message);
        if (error.code === "ECONNREFUSED") {
            console.log("❌ El servidor no está corriendo. Falta iniciar: npm start (en backend)");
        }
    }
}

simularFrontend();
