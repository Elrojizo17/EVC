import axios from "axios";
import { getGastos } from "./gastos.api";

const API_URL = "http://localhost:3000/api/inventario";

// Alias para compatibilidad - usa el nuevo endpoint plano
export const getInventario = async () => {
    try {
        const response = await axios.get(`${API_URL}/todos`);
        return response.data;
    } catch (error) {
        console.error("Error fetching inventory:", error);
        throw error;
    }
};

// Productos
export const getProductosConLotes = async () => {
    try {
        const response = await axios.get(`${API_URL}/productos`);
        return response.data;
    } catch (error) {
        console.error("Error fetching products:", error);
        throw error;
    }
};

export const createProducto = async (data) => {
    try {
        const response = await axios.post(`${API_URL}/productos`, data);
        return response.data;
    } catch (error) {
        console.error("Error creating product:", error);
        throw error;
    }
};

// Lotes
export const createLote = async (data) => {
    try {
        const response = await axios.post(`${API_URL}/lotes`, data);
        return response.data;
    } catch (error) {
        console.error("Error creating lot:", error);
        throw error;
    }
};

export const getLoteDetalle = async (id_lote) => {
    try {
        const response = await axios.get(`${API_URL}/lotes/${id_lote}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching lot details:", error);
        throw error;
    }
};

// Movimientos
export const getMovimientos = async () => {
    try {
        const response = await axios.get(`${API_URL}/movimientos`);
        return response.data;
    } catch (error) {
        console.error("Error fetching movements:", error);
        throw error;
    }
};

export const crearMovimiento = async (data) => {
    try {
        const response = await axios.post(`${API_URL}/movimientos`, data);
        return response.data;
    } catch (error) {
        console.error("Error creating movement:", error);
        throw error;
    }
};

// Alias para compatibilidad
export const createElemento = async (data) => {
    try {
        const response = await axios.post(`${API_URL}/elemento`, {
            codigo_elemento: data.codigo_elemento,
            elemento: data.elemento,
            cantidad: data.cantidad,
            costo_unitario: data.costo_unitario,
            fecha_compra: data.fecha_compra
        });
        return response.data;
    } catch (error) {
        console.error("Error creating element:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// Alias para compatibilidad con código anterior
export const getHistorialElemento = async (id_inventario) => {
    try {
        // Usar los gastos de inventario (movimiento_bodega) y filtrar
        // por el lote correspondiente a este elemento (id_inventario === id_lote)
        const gastos = await getGastos();
        return (gastos || []).filter((g) => g.id_lote === id_inventario);
    } catch (error) {
        console.error("Error fetching element history:", error);
        throw error;
    }
};
