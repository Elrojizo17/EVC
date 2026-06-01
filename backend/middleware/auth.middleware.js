const jwt = require("jsonwebtoken");

const getJwtSecret = () => {
    const secret = String(process.env.JWT_SECRET || "").trim();
    if (!secret) {
        throw new Error("JWT_SECRET no esta configurado");
    }
    return secret;
};

const authenticateToken = (req, res, next) => {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
        return res.status(401).json({ error: "Token requerido" });
    }

    try {
        const payload = jwt.verify(token, getJwtSecret());
        req.user = payload;
        return next();
    } catch (error) {
        return res.status(401).json({ error: "Token invalido o expirado" });
    }
};

const authorizeRoles = (...roles) => (req, res, next) => {
    const role = String(req.user?.rol || "").toUpperCase();
    if (!roles.includes(role)) {
        return res.status(403).json({ error: "No autorizado" });
    }
    return next();
};

module.exports = {
    authenticateToken,
    authorizeRoles
};
