function errorHandler(err, req, res, next) {
    // Centraliza errores para entregar respuestas consistentes
    const status = Number(err.status || err.statusCode || 500);
    const isClientError = status >= 400 && status < 500;
    const baseMessage = err.message || "Error interno del servidor";
    const safeMessage = isClientError ? baseMessage : "Error interno del servidor";

    const payload = { error: safeMessage };

    if (process.env.NODE_ENV === "development" && !isClientError) {
        payload.details = err.stack;
    }

    console.error("❌", err);
    res.status(status).json(payload);
}

module.exports = errorHandler;
