import axios from "axios";

const API_URL = "http://localhost:3000/api/electricistas";

// Get all electricians
export const getElectricistas = async () => {
    try {
        const response = await axios.get(API_URL);
        return response.data;
    } catch (error) {
        console.error("Error fetching electricians:", error);
        throw error;
    }
};

// Get single electrician with inventory
export const getElectricistaDetalle = async (id) => {
    try {
        const response = await axios.get(`${API_URL}/${id}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching electrician details:", error);
        throw error;
    }
};

// Create new electrician
export const createElectricista = async (data) => {
    try {
        const response = await axios.post(API_URL, data);
        return response.data;
    } catch (error) {
        console.error("Error creating electrician:", error);
        throw error;
    }
};

// Update electrician
export const updateElectricista = async (id, data) => {
    try {
        const response = await axios.put(`${API_URL}/${id}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating electrician:", error);
        throw error;
    }
};

// Assign product lot to electrician
export const asignarProductoElectricista = async (data) => {
    try {
        const response = await axios.post(`${API_URL}/inventario/asignar`, data);
        return response.data;
    } catch (error) {
        console.error("Error assigning product:", error);
        throw error;
    }
};

// Remove product from electrician inventory
export const removerProductoElectricista = async (id_registro) => {
    try {
        const response = await axios.delete(`${API_URL}/inventario/${id_registro}`);
        return response.data;
    } catch (error) {
        console.error("Error removing product:", error);
        throw error;
    }
};

// Get products
export const getProductos = async () => {
    try {
        const response = await axios.get(`${API_URL}/productos/lista`);
        return response.data;
    } catch (error) {
        console.error("Error fetching products:", error);
        throw error;
    }
};

// Get product lots
export const getLotes = async (id_producto = null) => {
    try {
        const params = id_producto ? `?id_producto=${id_producto}` : "";
        const response = await axios.get(`${API_URL}/lotes/lista${params}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching lots:", error);
        throw error;
    }
};
