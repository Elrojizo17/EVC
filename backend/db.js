const { Pool } = require("pg");
require("dotenv").config();

const requiredEnvVars = ["DATABASE_URL"];
const missingEnv = requiredEnvVars.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");

if (missingEnv.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missingEnv.join(", ")}`);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    family: 4,
    ssl: {
        rejectUnauthorized: false,
    },
});

// SOLO LOG, NO connect()
pool.on("connect", () => {
    console.log("🟢 Pool PostgreSQL listo");
});

pool.on("error", (err) => {
    console.error("❌ Error inesperado en PostgreSQL:", err);
});

module.exports = pool;
