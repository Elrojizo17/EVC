const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET todas las luminarias (solo lectura)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                *,
                coord_x AS latitud,
                coord_y AS longitud
            FROM luminaria
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("Error consultando luminarias:", error);
        res.status(500).json({
        error: "Error consultando luminarias"
        });
    }
});

module.exports = router;
