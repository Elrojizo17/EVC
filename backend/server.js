const express = require("express");
const cors = require("cors");
require("dotenv").config();
const errorHandler = require("./middleware/error.middleware");
const pool = require("./db");

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

// 👉 IMPORTANTE: SOLO ESTAS RUTAS
const luminariaRoutes = require("./routes/luminaria.routes");
const novedadRoutes = require("./routes/novedad.routes");
const inventarioRoutes = require("./routes/inventario.routes");
const gastoRoutes = require("./routes/gasto.routes");
const electricistaRoutes = require("./routes/electricista.routes");
const configRoutes = require("./routes/config.routes");

app.use("/api/luminarias", luminariaRoutes);
app.use("/api/novedades", novedadRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/gastos", gastoRoutes);
app.use("/api/electricistas", electricistaRoutes);
app.use("/api/config", configRoutes);

// ruta raíz
app.get("/", (req, res) => {
    res.json({ mensaje: "API Gestión de Luminarias activa" });
});

// Respuesta uniforme para rutas inexistentes
app.use((req, res) => {
    res.status(404).json({ error: "Recurso no encontrado" });
});

// Manejo centralizado de errores
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function ensureDatabaseCompatibility() {
    await pool.query(`
        ALTER TABLE IF EXISTS movimiento_bodega
            ADD COLUMN IF NOT EXISTS id_electricista VARCHAR(50) REFERENCES electricista(documento),
            ADD COLUMN IF NOT EXISTS codigo_pqr TEXT;
    `);

    await pool.query(`
        DROP FUNCTION IF EXISTS movimiento_bodega_ai() CASCADE;
        DROP FUNCTION IF EXISTS lote_adjust_stock(bigint, integer) CASCADE;
    `);
}

async function startServer() {
    try {
        await ensureDatabaseCompatibility();
        console.log("✅ Compatibilidad de BD verificada (movimiento_bodega)");

        const server = app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        });

        server.on('error', (err) => {
            console.error('❌ Error del servidor:', err);
        });
    } catch (err) {
        console.error("❌ Error preparando compatibilidad de BD:", err);
        process.exit(1);
    }
}

startServer();

process.on('uncaughtException', (err) => {
    console.error('❌ Excepción no capturada:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promesa rechazada no manejada:', err);
});
