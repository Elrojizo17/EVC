function normalizePqr(value) {
    return String(value || "").trim().toUpperCase();
}

export function extractPqrNumber(value) {
    const normalized = normalizePqr(value);
    if (!normalized) {
        return null;
    }

    const match = normalized.match(/(\d+)(?!.*\d)/);
    if (!match) {
        return null;
    }

    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
}

export function calcularSiguienteCodigoPqr(movimientos = []) {
    const maxNumber = (Array.isArray(movimientos) ? movimientos : []).reduce((max, mov) => {
        const number = extractPqrNumber(mov?.codigo_pqr);
        if (!Number.isFinite(number)) {
            return max;
        }
        return Math.max(max, number);
    }, 0);

    return `PQR-${String(maxNumber + 1).padStart(3, "0")}`;
}
