const express = require("express");
const router = express.Router();
const {
    getAllElectricistas,
    getElectristaConInventario,
    createElectricista,
    updateElectricista,
    asignarProductoElectricista,
    removerProductoElectricista,
    getProductos,
    getLotes
} = require("../controllers/electricista.controller");

// Electrician routes
router.get("/", getAllElectricistas);
router.get("/:id", getElectristaConInventario);
router.post("/", createElectricista);
router.put("/:id", updateElectricista);

// Electrician inventory routes
router.post("/inventario/asignar", asignarProductoElectricista);
router.delete("/inventario/:id_registro", removerProductoElectricista);

// Products
router.get("/productos/lista", getProductos);
router.get("/lotes/lista", getLotes);

module.exports = router;
