const API_URL = "http://localhost:3000/api/gastos";

export const getGastos = async () => {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || 'Error consultando gastos');
    }
    return data;
};

export const createGasto = async (data) => {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok || result.error) {
        throw new Error(result.error || 'Error creando gasto');
    }
    return result;
};
