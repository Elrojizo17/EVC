const API_URL = "http://localhost:3000/api/otp";

export const solicitarOtp = async (email) => {
    const res = await fetch(`${API_URL}/solicitar`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(email ? { email } : {})
    });

    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo solicitar OTP");
    }

    return data;
};

export const verificarOtp = async (codigo, email) => {
    const res = await fetch(`${API_URL}/verificar`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ code: codigo, ...(email ? { email } : {}) })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo verificar OTP");
    }

    return data;
};
