const fs = require("fs");
const path = require("path");
const pool = require("./db");
require("dotenv").config();

// Function to initialize database with schema
async function initializeDatabase() {
    try {
        console.log("🔧 Iniciando creación de tablas en la base de datos...");

        const sqlPath = path.join(__dirname, "init.sql");
        const sql = fs.readFileSync(sqlPath, "utf8");

        // Execute the SQL file
        await pool.query(sql);

        console.log("✅ Tablas creadas exitosamente");
        
        // Give a brief moment and close the pool
        setTimeout(() => {
            pool.end();
            process.exit(0);
        }, 500);
    } catch (error) {
        console.error("❌ Error al crear las tablas:", error);
        pool.end();
        process.exit(1);
    }
}

// Run on demand or from command line
if (require.main === module) {
    initializeDatabase();
}

module.exports = initializeDatabase;
