const axios = require("axios");

async function simularFrontend() {
    try {
        console.log("\nSIMULACION DEL FRONTEND\n");

        // 1. Traer datos del API
        const response = await axios.get("https://luminariasevc.onrender.com/api/inventario/todos");
        const inventario = response.data;
        console.log(`1) API devolvio: ${inventario.length} elementos`);

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
        console.log(`2) Consolidado: ${inventarioConsolidado.length} elementos`);

        // 3. Buscar especificamente el elemento 3
        const elemento3 = inventarioConsolidado.find(x => x.codigo_elemento === "3");
        console.log("\n3) ELEMENTO '3':");
        if (elemento3) {
            console.log(`   Codigo: ${elemento3.codigo_elemento}`);
            console.log(`   Nombre: ${elemento3.elemento}`);
            console.log(`   Cantidad (inicial): ${elemento3.cantidad}`);
            console.log(`   Stock disponible: ${elemento3.stock_disponible}`);
            console.log("   SI ESTA EN CONSOLIDADO");
        } else {
            console.log("   NO ESTA EN CONSOLIDADO");
        }

        // 4. Filtrar (busqueda vacia como cuando abre la pagina)
        const busqueda = "";
        const termino = busqueda.toLowerCase();
        const inventarioFiltrado = inventarioConsolidado.filter((item) => {
            return (
                String(item.codigo_elemento || "").toLowerCase().includes(termino) ||
                String(item.elemento || "").toLowerCase().includes(termino)
            );
        });

        console.log(`\n4) Despues de filtrar con busqueda vacia: ${inventarioFiltrado.length} elementos`);

        // 5. Verificar si el 3 esta en el filtrado
        const elemento3Filtrado = inventarioFiltrado.find(x => x.codigo_elemento === "3");
        if (elemento3Filtrado) {
            console.log("   ELEMENTO 3 SI APARECE EN TABLA");
        } else {
            console.log("   ELEMENTO 3 NO APARECE EN TABLA");
        }

        // 6. Ver todos los elementos que si aparecen (solo codigos)
        console.log("\n5) ELEMENTOS QUE DEBEN APARECER:");
        console.log(inventarioFiltrado.map(x => x.codigo_elemento).join(", "));

        // 7. Ver cual falta
        console.log("\n6) BUSQUEDA ESPECIFICA: '3'");
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
            console.log("El servidor no esta corriendo. Falta iniciar: npm start (en backend)");
        }
    }
}

simularFrontend();
