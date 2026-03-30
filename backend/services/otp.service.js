const otpStore = new Map();

function getOtpDigits() {
    const digits = Number(process.env.OTP_DIGITS || 6);
    return Number.isInteger(digits) && digits > 0 ? digits : 6;
}

function getOtpExpiryMinutes() {
    const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 5;
}

function generateOtpCode() {
    const digits = getOtpDigits();
    const max = 10 ** digits;
    return String(Math.floor(Math.random() * max)).padStart(digits, "0");
}

function generateOtp(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
        throw new Error("Correo inválido para generar OTP");
    }

    const code = generateOtpCode();
    const expiresAt = Date.now() + getOtpExpiryMinutes() * 60 * 1000;

    otpStore.set(normalizedEmail, { code, expiresAt });
    return code;
}

function validateOtp(email, code) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").trim();

    if (!normalizedEmail || !normalizedCode) {
        return false;
    }

    const record = otpStore.get(normalizedEmail);
    if (!record) {
        return false;
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(normalizedEmail);
        return false;
    }

    const isValid = record.code === normalizedCode;
    if (isValid) {
        otpStore.delete(normalizedEmail);
    }

    return isValid;
}

module.exports = {
    generateOtp,
    validateOtp
};
