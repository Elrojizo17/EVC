const API_URL = "http://localhost:3000/api/novedades";

export const getNovedades = async () => {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || 'Error consultando novedades');
    }
    return data;
};

export const createNovedad = async (data) => {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok || result.error) {
        throw new Error(result.error || 'Error creando novedad');
    }
    return result;
};

export const updateNovedad = async (id, data) => {
    const res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await res.json();
    if (!res.ok || result.error) {
        throw new Error(result.error || "Error actualizando novedad");
    }
    return result;
};

export const diagnosticarLampara = async (numeroLampara) => {
    const url = `${API_URL}/diagnostico/${encodeURIComponent(numeroLampara)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || "Error consultando información de la lámpara");
    }
    return data;
};
