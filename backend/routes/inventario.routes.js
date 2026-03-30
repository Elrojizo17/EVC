const express = require("express");
const router = express.Router();
const {
    getMovimientos,
    crearMovimiento,
    createProducto,
    getInventarioFlat,
    getProductos,
    updateProducto
} = require("../controllers/inventario.controller");

// Flat inventory (main endpoint for frontend)
router.get("/todos", getInventarioFlat);

// Products
router.get("/productos", getProductos);
router.post("/productos", createProducto);
router.put("/productos/:codigo", updateProducto);

// Movements
router.get("/movimientos", getMovimientos);
router.post("/movimientos", crearMovimiento);

// Alias for compatibility with frontend (POST /elemento creates a product with entrada)
router.post("/elemento", createProducto);

module.exports = router;
