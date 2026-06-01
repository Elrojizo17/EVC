import httpClient from "./httpClient";

const API_URL = "https://luminariasevc.onrender.com/api/inventario";

// Productos
export const getProductosConLotes = async () => {
    try {
        const response = await httpClient.get(`${API_URL}/productos`);
        return response.data;
    } catch (error) {
        console.error("Error fetching products:", error);
        throw error;
    }
};

export const createProducto = async (data) => {
    try {
        const response = await httpClient.post(`${API_URL}/productos`, data);
        return response.data;
    } catch (error) {
        console.error("Error creating product:", error);
        throw error;
    }
};

// Lotes
export const createLote = async (data) => {
    try {
        const response = await httpClient.post(`${API_URL}/lotes`, data);
        return response.data;
    } catch (error) {
        console.error("Error creating lot:", error);
        throw error;
    }
};

export const getLoteDetalle = async (id_lote) => {
    try {
        const response = await httpClient.get(`${API_URL}/lotes/${id_lote}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching lot details:", error);
        throw error;
    }
};

// Movimientos
export const getMovimientos = async () => {
    try {
        const response = await httpClient.get(`${API_URL}/movimientos`);
        return response.data;
    } catch (error) {
        console.error("Error fetching movements:", error);
        throw error;
    }
};

export const crearMovimiento = async (data) => {
    try {
        const response = await httpClient.post(`${API_URL}/movimientos`, data);
        return response.data;
    } catch (error) {
        console.error("Error creating movement:", error);
        throw error;
    }
};
