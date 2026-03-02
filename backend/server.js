const express = require("express");
const cors = require("cors");
require("dotenv").config();
const errorHandler = require("./middleware/error.middleware");

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

app.use("/api/luminarias", luminariaRoutes);
app.use("/api/novedades", novedadRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/gastos", gastoRoutes);
app.use("/api/electricistas", electricistaRoutes);

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

const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// Evitar que el servidor se cierre inesperadamente
server.on('error', (err) => {
    console.error('❌ Error del servidor:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Excepción no capturada:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promesa rechazada no manejada:', err);
});
