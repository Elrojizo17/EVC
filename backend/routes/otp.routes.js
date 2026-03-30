const express = require("express");
const router = express.Router();
const { generateOtp, validateOtp } = require("../services/otp.service");
const { sendOtpEmail } = require("../services/mail.service");

function getOtpExpirySeconds() {
    const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 5;
    return Math.floor(safeMinutes * 60);
}

function hasValidMailConfig() {
    const user = String(process.env.GMAIL_USER || "").trim();
    const pass = String(process.env.GMAIL_APP_PASSWORD || "").trim();
    const isPlaceholder = /tu_contrasena_de_aplicacion|app_password|changeme/i.test(pass);
    return Boolean(user) && Boolean(pass) && !isPlaceholder;
}

router.post("/solicitar", async (req, res) => {
    try {
        const email = String(req.body?.email || process.env.GMAIL_USER || "").trim(); // CAMBIAR CORREO AQUI
        const nombre = String(req.body?.nombre || "usuario").trim();
        if (!email) {
            return res.status(400).json({ error: "No hay correo configurado para OTP" });
        }

        if (!hasValidMailConfig()) {
            return res.status(400).json({
                error: "Configuracion de correo incompleta. Actualiza GMAIL_USER y GMAIL_APP_PASSWORD en backend/.env"
            });
        }

        const code = generateOtp(email);
        const expiresInSeconds = getOtpExpirySeconds();

        await sendOtpEmail(email, code, { nombre });
        return res.json({
            mensaje: "OTP enviado",
            expiresInSeconds
        });
    } catch (error) {
        console.error("Error solicitando OTP:", error);
        return res.status(500).json({ error: "No se pudo solicitar OTP", detalle: error.message });
    }
});

router.post("/verificar", (req, res) => {
    try {
        const email = String(req.body?.email || process.env.GMAIL_USER || "").trim();
        const code = String(req.body?.code || "").trim();

        const valido = validateOtp(email, code);
        return res.json({ valido });
    } catch (error) {
        console.error("Error verificando OTP:", error);
        return res.status(500).json({ error: "No se pudo verificar OTP" });
    }
});

module.exports = router;
