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

// Lotes (actualizado para nuevo modelo sin lotes - crea movimiento ENTRADA)
export const createLote = async (data) => {
    try {
        // Para el nuevo modelo, createLote crea un movimiento ENTRADA para un producto existente
        const response = await axios.post(`${API_URL}/movimientos`, {
            codigo_producto: data.codigo_producto,
            tipo_movimiento: 'ENTRADA',
            cantidad: data.cantidad,
            numero_orden: data.numero_orden,
            observacion: `Entrada de orden ${data.numero_orden}`,
            fecha: data.fecha_compra
        });
        return response.data;
    } catch (error) {
        console.error("Error creating lot:", error);
        throw error.response?.data || error;
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

export const updateElemento = async (id_lote, data) => {
    try {
        const response = await axios.put(`${API_URL}/elemento/${id_lote}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating element:", error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// Alias para compatibilidad con código anterior
export const getHistorialElemento = async (codigoProducto) => {
    try {
        // En el nuevo modelo, el historial se obtiene por codigo_producto
        const gastos = await getGastos();
        return (gastos || []).filter((g) => g.codigo_producto === codigoProducto);
    } catch (error) {
        console.error("Error fetching element history:", error);
        throw error;
    }
};
