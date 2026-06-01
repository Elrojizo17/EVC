const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const getJwtSecret = () => {
    const secret = String(process.env.JWT_SECRET || "").trim();
    if (!secret) {
        throw new Error("JWT_SECRET no esta configurado");
    }
    return secret;
};

const getJwtExpiry = () => {
    const expiry = String(process.env.JWT_EXPIRES_IN || "8h").trim();
    return expiry || "8h";
};

const buildTokenPayload = (usuario, rol) => ({
    sub: usuario,
    rol
});

router.post("/login", (req, res) => {
    try {
        const requestedRole = String(req.body?.rol || req.body?.role || "").trim().toUpperCase();

        if (requestedRole === "INVITADO") {
            const token = jwt.sign(
                buildTokenPayload("Invitado", "INVITADO"),
                getJwtSecret(),
                { expiresIn: getJwtExpiry() }
            );

            return res.json({
                token,
                usuario: {
                    nombre: "Invitado",
                    rol: "INVITADO"
                }
            });
        }

        const usuario = String(req.body?.usuario || req.body?.username || "").trim();
        const password = String(req.body?.password || "");
        const adminUser = String(process.env.ADMIN_USER || "").trim();
        const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();

        if (!usuario || !password) {
            return res.status(400).json({ error: "Usuario y contrasena son obligatorios" });
        }

        if (!adminUser || !adminPassword) {
            return res.status(500).json({ error: "Credenciales de administrador no configuradas" });
        }

        if (usuario !== adminUser || password !== adminPassword) {
            return res.status(401).json({ error: "Credenciales invalidas" });
        }

        const token = jwt.sign(
            buildTokenPayload(usuario, "ADMIN"),
            getJwtSecret(),
            { expiresIn: getJwtExpiry() }
        );

        return res.json({
            token,
            usuario: {
                nombre: usuario,
                rol: "ADMIN"
            }
        });
    } catch (error) {
        console.error("Error en login:", error);
        return res.status(500).json({ error: "No se pudo iniciar sesion" });
    }
});

module.exports = router;
