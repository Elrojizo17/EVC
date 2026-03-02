const { Pool } = require("pg");
require("dotenv").config();

const requiredEnvVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingEnv = requiredEnvVars.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");

if (missingEnv.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missingEnv.join(", ")}`);
}

const dbPort = Number(process.env.DB_PORT);

if (Number.isNaN(dbPort)) {
    throw new Error("DB_PORT debe ser un número válido");
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: dbPort,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// SOLO LOG, NO connect()
pool.on("connect", () => {
    console.log("🟢 Pool PostgreSQL listo");
});

pool.on("error", (err) => {
    console.error("❌ Error inesperado en PostgreSQL:", err);
});

module.exports = pool;
