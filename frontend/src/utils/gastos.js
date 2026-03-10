export const getCantidadConSigno = (gasto) => {
    const cantidad = Number(gasto?.cantidad_usada || 0);
    if (String(gasto?.tipo_movimiento || "").toUpperCase() === "DEVOLUCION") {
        return -cantidad;
    }
    return cantidad;
};

export const getCostoTotalMovimiento = (gasto) => {
    const costo = Number(gasto?.costo_unitario || 0);
    return getCantidadConSigno(gasto) * costo;
};
