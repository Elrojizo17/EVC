const fs = require("fs");
const path = require("path");
const pool = require("./db");
require("dotenv").config();

// Function to run all migrations from the migrations directory
async function runMigrations() {
    try {
        console.log("🔄 Ejecutando migraciones...");
        
        const migrationsDir = path.join(__dirname, "migrations");
        
        // Read all migration files
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith(".sql"))
            .sort(); // Sort by filename (date prefix ensures proper order)
        
        if (migrationFiles.length === 0) {
            console.log("✅ No hay migraciones pendientes");
            return;
        }
        
        // Create migrations log table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS migrations_log (
                id SERIAL PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Execute each migration file
        for (const file of migrationFiles) {
            const migrationName = file;
            
            // Check if migration already executed
            const result = await pool.query(
                "SELECT * FROM migrations_log WHERE migration_name = $1",
                [migrationName]
            );
            
            if (result.rows.length > 0) {
                console.log(`⏭️  Saltando: ${migrationName} (ya executada)`);
                continue;
            }
            
            // Execute migration
            try {
                const filePath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(filePath, "utf8");
                
                console.log(`🔨 Ejecutando: ${migrationName}`);
                await pool.query(sql);
                
                // Log migration as executed
                await pool.query(
                    "INSERT INTO migrations_log (migration_name) VALUES ($1)",
                    [migrationName]
                );
                
                console.log(`✅ Completada: ${migrationName}`);
            } catch (error) {
                console.error(`❌ Error en migracion ${migrationName}:`, error.message);
                throw error;
            }
        }
        
        console.log("✅ Todas las migraciones completadas");
    } catch (error) {
        console.error("❌ Error en el proceso de migraciones:", error);
        throw error;
    }
}

// Run on demand or from command line
if (require.main === module) {
    runMigrations()
        .then(() => {
            pool.end();
            process.exit(0);
        })
        .catch(error => {
            pool.end();
            process.exit(1);
        });
}

module.exports = runMigrations;
