const express = require("express");
const cors = require("cors");
require("dotenv").config();
const errorHandler = require("./middleware/error.middleware");
const { authenticateToken, authorizeRoles } = require("./middleware/auth.middleware");
const pool = require("./db");
const runMigrations = require("./runMigrations");

const app = express();

// middlewares
app.use(cors());
app.use(express.json());


app.listen(3000, () => {
    console.log('Servidor iniciado');
});


app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok'
    });
});

app.listen(3000, () => {
    console.log('Servidor iniciado');
});


// 👉 IMPORTANTE: SOLO ESTAS RUTAS
const luminariaRoutes = require("./routes/luminaria.routes");
const novedadRoutes = require("./routes/novedad.routes");
const inventarioRoutes = require("./routes/inventario.routes");
const gastoRoutes = require("./routes/gasto.routes");
const electricistaRoutes = require("./routes/electricista.routes");
const configRoutes = require("./routes/config.routes");
const otpRoutes = require("./routes/otp.routes");
const authRoutes = require("./routes/auth.routes");

app.use("/api/auth", authRoutes);
app.use("/api/luminarias", authenticateToken, authorizeRoles("ADMIN", "INVITADO"), luminariaRoutes);
app.use("/api/novedades", authenticateToken, authorizeRoles("ADMIN"), novedadRoutes);
app.use("/api/inventario", authenticateToken, authorizeRoles("ADMIN"), inventarioRoutes);
app.use("/api/gastos", authenticateToken, authorizeRoles("ADMIN"), gastoRoutes);
app.use("/api/electricistas", authenticateToken, authorizeRoles("ADMIN"), electricistaRoutes);
app.use("/api/config", authenticateToken, authorizeRoles("ADMIN"), configRoutes);
app.use("/api/otp", authenticateToken, authorizeRoles("ADMIN"), otpRoutes);

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
        ALTER TABLE IF EXISTS novedad_luminaria
            ADD COLUMN IF NOT EXISTS id_electricista VARCHAR(50),
            ADD COLUMN IF NOT EXISTS codigo_pqr TEXT;
    `);

    await pool.query(`
        ALTER TABLE IF EXISTS lote_producto
            ADD COLUMN IF NOT EXISTS numero_orden VARCHAR(80);
    `);

    await pool.query(`
        DROP FUNCTION IF EXISTS movimiento_bodega_ai() CASCADE;
        DROP FUNCTION IF EXISTS lote_adjust_stock(bigint, integer) CASCADE;
    `);

    await pool.query(`
        CREATE OR REPLACE FUNCTION public.bloquear_modificacion_movimiento()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'DELETE' AND current_setting('app.allow_movimiento_delete', true) = 'on' THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'No se permite modificar ni eliminar movimientos de bodega';
        END;
        $$ LANGUAGE plpgsql;
    `);
}

async function startServer() {
    try {
        // Ejecutar migraciones primero
        console.log("🔄 Ejecutando migraciones de base de datos...");
        await runMigrations();
        console.log("✅ Migraciones completadas");

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
