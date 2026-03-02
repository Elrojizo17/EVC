const express = require("express");
const router = express.Router();
const {
    getProductosConLotes,
    getMovimientos,
    getLoteDetalle,
    crearMovimiento,
    createProducto,
    createLote,
    createElemento,
    getInventarioFlat
} = require("../controllers/inventario.controller");

// Flat inventory (main endpoint for frontend)
router.get("/todos", getInventarioFlat);

// Products and lots
router.get("/productos", getProductosConLotes);
router.post("/productos", createProducto);
router.post("/lotes", createLote);
router.post("/elemento", createElemento);
router.get("/lotes/:id_lote", getLoteDetalle);

// Movements
router.get("/movimientos", getMovimientos);
router.post("/movimientos", crearMovimiento);

module.exports = router;
