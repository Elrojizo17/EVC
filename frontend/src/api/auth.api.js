const API_BASE_URL = "https://luminariasevc.onrender.com";

export const loginAdmin = async (usuario, password) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ usuario, password })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo iniciar sesion");
    }

    return data;
};

export const loginInvitado = async () => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ rol: "INVITADO" })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo iniciar sesion");
    }

    return data;
};

export const pingHealth = async () => {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    if (!res.ok) {
        throw new Error("Health check fallo");
    }
    return res.json();
};
