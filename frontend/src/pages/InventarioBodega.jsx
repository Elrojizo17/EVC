import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";
import { createElemento, getInventario, getHistorialElemento } from "../api/inventario.api";
import { useNotification } from "../hooks/useNotification";
import { useFormValidation, validationRules } from "../hooks/useFormValidation";
import FormInput from "../components/FormInput";

// Funciones de utilidad para manejo de moneda
const formatCurrency = (value) => {
    const number = Number(value || 0);
    return new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};

const parseCurrency = (value) => {
    if (value === null || value === undefined) return 0;
    const normalized = String(value)
        .replace(/\./g, "")
        .replace(",", ".")
        .trim();
    const number = parseFloat(normalized);
    return Number.isNaN(number) ? 0 : number;
};

const validations = {
    codigo_elemento: [
        validationRules.required,
        validationRules.maxLength(30)
    ],
    elemento: [
        validationRules.required,
        validationRules.minLength(3),
        validationRules.maxLength(100)
    ],
    cantidad: [
        validationRules.required,
        validationRules.number,
        validationRules.min(0)
    ],
    costo_unitario: [
        validationRules.required,
        (value) => {
            const num = parseCurrency(value);
            if (isNaN(num) || num < 0) {
                return 'Debe ser un costo válido mayor o igual a 0';
            }
            return '';
        }
    ],
    fecha_compra: [
        validationRules.required
    ]
};

export default function InventarioBodega() {
    const [inventario, setInventario] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [historialModal, setHistorialModal] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const { success, error: errorNotification } = useNotification();

    const {
        values: formData,
        errors,
        touched,
        handleChange: handleFieldChange,
        handleBlur,
        validateAll,
        resetForm,
        setValues: setFormData
    } = useFormValidation({
        codigo_elemento: "",
        elemento: "",
        cantidad: "",
        costo_unitario: "",
        fecha_compra: new Date().toISOString().split("T")[0]
    }, validations);

    useEffect(() => {
        cargarInventario();
    }, []);

    const cargarInventario = async () => {
        try {
            const data = await getInventario();
            setInventario(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error cargando inventario:", err);
            errorNotification("Error al cargar el inventario");
        } finally {
            setLoading(false);
        }
    };

    const verHistorial = async (item) => {
        try {
            setLoadingHistorial(true);
            setHistorialModal(item);
            const data = await getHistorialElemento(item.id_inventario);
            setHistorial(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error cargando historial:", err);
            errorNotification("Error al cargar el historial");
        } finally {
            setLoadingHistorial(false);
        }
    };

    const cerrarModal = () => {
        setHistorialModal(null);
        setHistorial([]);
    };

    const handleChange = (e) => {
        handleFieldChange(e);
    };

    const handleCostoChange = (e) => {
        // Solo permitir números, comas y puntos durante la edición
        const value = e.target.value.replace(/[^0-9.,]/g, "");
        const syntheticEvent = {
            target: {
                name: 'costo_unitario',
                value: value
            }
        };
        handleFieldChange(syntheticEvent);
    };

    const handleCostoBlur = (e) => {
        handleBlur(e);
        if (String(formData.costo_unitario || "").trim() === "") {
            return;
        }
        const parsed = parseCurrency(formData.costo_unitario);
        if (!Number.isNaN(parsed) && parsed > 0) {
            // Formatear solo cuando el usuario sale del campo
            setFormData({
                ...formData,
                costo_unitario: formatCurrency(parsed)
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateAll()) {
            errorNotification("Por favor corrige los errores en el formulario");
            return;
        }

        try {
            setFormLoading(true);
            const datosEnvio = {
                codigo_elemento: formData.codigo_elemento,
                elemento: formData.elemento,
                cantidad: parseInt(formData.cantidad),
                costo_unitario: parseCurrency(formData.costo_unitario),
                fecha_compra: formData.fecha_compra
            };

            await createElemento(datosEnvio);
            success("Elemento registrado exitosamente");
            resetForm();
            setFormData({
                codigo_elemento: "",
                elemento: "",
                cantidad: "",
                costo_unitario: "",
                fecha_compra: new Date().toISOString().split("T")[0]
            });
            cargarInventario();
        } catch (err) {
            errorNotification(err.message || "Error al registrar el elemento. Verifica que el código sea único.");
            console.error(err);
        } finally {
            setFormLoading(false);
        }
    };

    const calcularCostoTotal = () => {
        return (inventario || []).reduce((total, item) => {
        return total + (item.cantidad * item.costo_unitario);
        }, 0);
    };

    const calcularTotalGastado = () => {
        return (inventario || []).reduce((total, item) => {
            const cantidadGastada = Number(item.cantidad_gastada || 0);
            const costoUnitario = Number(item.costo_unitario || 0);
            return total + (cantidadGastada * costoUnitario);
        }, 0);
    };

    const inventarioFiltrado = (inventario || []).filter((item) => {
        const termino = busqueda.toLowerCase();
        return (
        item.codigo_elemento?.toLowerCase().includes(termino) ||
        item.elemento?.toLowerCase().includes(termino)
        );
    });

        return (
		<div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ marginBottom: "20px" }}>
            <BackButton />
        </div>
        
        <h1 style={{ color: "#0a5c6d", marginBottom: "10px" }}>Ingrese inventario bodega</h1>
        <p style={{ color: "#64748b", marginBottom: "30px" }}>
            Registra nuevos elementos en la bodega con información de código, cantidad y costos.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.6fr", gap: "30px", alignItems: "start" }}>
            {/* Formulario */}
            <form onSubmit={handleSubmit} style={{
                background: "white",
                padding: "30px",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                height: "fit-content"
            }}>
                <h3 style={{ color: "#0f7c90", marginBottom: "20px" }}>Nuevo elemento</h3>

                <FormInput
                    label="Código del elemento"
                    name="codigo_elemento"
                    value={formData.codigo_elemento}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.codigo_elemento}
                    touched={touched.codigo_elemento}
                    placeholder="ej: LAMP-LED-50W"
                    disabled={formLoading}
                    required
                />

                <FormInput
                    label="Nombre del elemento"
                    name="elemento"
                    value={formData.elemento}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.elemento}
                    touched={touched.elemento}
                    placeholder="ej: Lámpara LED 50W"
                    disabled={formLoading}
                    required
                />

                <FormInput
                    label="Cantidad"
                    name="cantidad"
                    type="number"
                    value={formData.cantidad}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.cantidad}
                    touched={touched.cantidad}
                    placeholder="0"
                    min="0"
                    disabled={formLoading}
                    required
                />

                <FormInput
                    label="Costo unitario ($)"
                    name="costo_unitario"
                    value={formData.costo_unitario}
                    onChange={handleCostoChange}
                    onBlur={handleCostoBlur}
                    error={errors.costo_unitario}
                    touched={touched.costo_unitario}
                    placeholder="0,00"
                    inputMode="decimal"
                    disabled={formLoading}
                    required
                />

                <FormInput
                    label="Fecha de compra"
                    name="fecha_compra"
                    type="date"
                    value={formData.fecha_compra}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.fecha_compra}
                    touched={touched.fecha_compra}
                    disabled={formLoading}
                    required
                />

                <button
                    disabled={formLoading}
                    type="submit"
                    style={{
                    marginTop: "20px",
                    width: "100%",
                    padding: "12px 24px",
                    background: "#0f7c90",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: formLoading ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    fontSize: "14px",
                    opacity: formLoading ? 0.6 : 1
                    }}
                >
                    {formLoading ? "Registrando..." : "Registrar elemento"}
                </button>
            </form>

            {/* Tabla de inventario */}
            <div style={{
            background: "white",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
            <h3 style={{ color: "#0f7c90", marginBottom: "20px" }}>
                Inventario actual ({(inventario || []).length} elementos)
            </h3>

            <div style={{ marginBottom: "16px" }}>
                <input
                type="text"
                placeholder="Buscar por código o elemento..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "13px",
                    boxSizing: "border-box"
                }}
                />
            </div>

            {loading ? (
                <p style={{ color: "#64748b" }}>Cargando inventario...</p>
            ) : (inventario || []).length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No hay elementos en el inventario</p>
            ) : (
                <>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                            <th style={headerStyle}>Código</th>
                            <th style={headerStyle}>Material</th>
                            <th style={headerStyle}>Inicial</th>
                            <th style={headerStyle}>Entrada</th>
                            <th style={headerStyle}>Devolución</th>
                            <th style={headerStyle}>Despachado</th>
                            <th style={headerStyle}>Material excedente</th>
                            <th style={headerStyle}>Préstamo</th>
                            <th style={headerStyle}>Unid. existentes inventario</th>
                            <th style={headerStyle}>Valor final</th>
                            <th style={headerStyle}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventarioFiltrado.map((item) => {
                            const stockDisponible = Number(item.stock_disponible || 0);
                            const stockBajo = stockDisponible < 10;
                            const stockAgotado = stockDisponible <= 0;
                            
                            return (
                                <tr key={item.id_inventario} style={{ 
                                    borderBottom: "1px solid #e2e8f0",
                                    background: stockAgotado ? "#fff1f2" : stockBajo ? "#fff7ed" : "transparent"
                                }}>
                                    <td style={cellStyle}>{item.codigo_elemento}</td>
                                    <td style={cellStyle}>{item.elemento}</td>
                                    <td style={cellStyle}>{Number(item.cantidad || 0)}</td>
                                    <td style={cellStyle}>{Number(item.entrada || 0)}</td>
                                    <td style={cellStyle}>{Number(item.devolucion || 0)}</td>
                                    <td style={cellStyle}>{Number(item.despachado || 0)}</td>
                                    <td style={cellStyle}>{Number(item.material_excedente || 0)}</td>
                                    <td style={cellStyle}>{Number(item.prestamo || 0)}</td>
                                    <td style={{...cellStyle, fontWeight: "bold", fontSize: "15px"}}>
                                        <span style={{
                                            color: stockAgotado ? "#dc2626" : stockBajo ? "#ea580c" : "#059669",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px"
                                        }}>
                                            {stockDisponible}
                                            {stockAgotado && <span style={{ fontSize: "10px" }}>⚠️ AGOTADO</span>}
                                            {stockBajo && !stockAgotado && <span style={{ fontSize: "10px" }}>⚠️ BAJO</span>}
                                        </span>
                                    </td>
                                    <td style={cellStyle}>${formatCurrency(item.costo_unitario)}</td>
                                    <td style={cellStyle}>${formatCurrency(stockDisponible * item.costo_unitario)}</td>
                                    <td style={cellStyle}>
                                        <button
                                            onClick={() => verHistorial(item)}
                                            style={{
                                                padding: "6px 12px",
                                                background: "#0f7c90",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "6px",
                                                cursor: "pointer",
                                                fontSize: "11px",
                                                fontWeight: "500"
                                            }}
                                        >
                                            Ver historial
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    </table>
                </div>

                <div style={{
                    marginTop: "20px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px"
                }}>
                    {/* Costo total del inventario */}
                    <div style={{
                        padding: "15px",
                        background: "#f0f9ff",
                        borderRadius: "8px",
                        borderLeft: "4px solid #0f7c90"
                    }}>
                        <div style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>
                            Costo total del inventario:
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0f7c90" }}>
                            ${formatCurrency(calcularCostoTotal())}
                        </div>
                    </div>

                    {/* Total gastado */}
                    <div style={{
                        padding: "15px",
                        background: "#fef3c7",
                        borderRadius: "8px",
                        borderLeft: "4px solid #f59e0b"
                    }}>
                        <div style={{ fontSize: "13px", color: "#78350f", marginBottom: "8px" }}>
                            Total gastado en mantenimientos:
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#f59e0b" }}>
                            ${formatCurrency(calcularTotalGastado())}
                        </div>
                    </div>
                </div>
                </>
            )}
            </div>
        </div>

        {/* Modal de historial */}
        {historialModal && (
            <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000
            }} onClick={cerrarModal}>
                <div style={{
                    background: "white",
                    borderRadius: "12px",
                    padding: "30px",
                    maxWidth: "900px",
                    width: "90%",
                    maxHeight: "80vh",
                    overflow: "auto",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
                }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "20px" }}>
                        <div>
                            <h2 style={{ color: "#0a5c6d", margin: 0, marginBottom: "5px" }}>
                                Historial de Movimientos
                            </h2>
                            <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
                                {historialModal.elemento} ({historialModal.codigo_elemento})
                            </p>
                        </div>
                        <button
                            onClick={cerrarModal}
                            style={{
                                background: "transparent",
                                border: "none",
                                fontSize: "24px",
                                cursor: "pointer",
                                color: "#64748b",
                                padding: "0",
                                width: "30px",
                                height: "30px"
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Resumen */}
                    <div style={{
                        background: "#f8fafc",
                        padding: "20px",
                        borderRadius: "8px",
                        marginBottom: "20px",
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "15px"
                    }}>
                        <div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Stock Disponible</div>
                            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#059669" }}>
                                {Number(historialModal.stock_disponible || 0)}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Total Gastado</div>
                            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#dc2626" }}>
                                {Number(historialModal.cantidad_gastada || 0)}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Movimientos</div>
                            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0f7c90" }}>
                                {historial.length}
                            </div>
                        </div>
                    </div>

                    {/* Tabla de historial - reporte detallado de gastos de este elemento */}
                    {loadingHistorial ? (
                        <p style={{ textAlign: "center", color: "#64748b" }}>Cargando historial...</p>
                    ) : historial.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#94a3b8" }}>
                            Este elemento aún no ha sido utilizado
                        </p>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                <thead>
                                    <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                                        <th style={headerStyle}>Fecha</th>
                                        <th style={headerStyle}>Lámpara</th>
                                        <th style={headerStyle}>Electricista</th>
                                        <th style={headerStyle}>Tipo mov.</th>
                                        <th style={headerStyle}>Cantidad</th>
                                        <th style={headerStyle}>Costo unit.</th>
                                        <th style={headerStyle}>Costo total</th>
                                        <th style={headerStyle}>PQR</th>
                                        <th style={headerStyle}>Observación</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historial.map((h) => (
                                        <tr key={h.id_gasto} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                            <td style={cellStyle}>
                                                {new Date(h.fecha).toLocaleDateString('es-ES', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td style={cellStyle}>{h.numero_lampara ? `#${h.numero_lampara}` : "-"}</td>
                                            <td style={cellStyle}>{h.nombre_electricista || (h.id_electricista ? `ID ${h.id_electricista}` : "-")}</td>
                                            <td style={cellStyle}>{h.tipo_movimiento}</td>
                                            <td style={cellStyle}>{h.cantidad_usada}</td>
                                            <td style={cellStyle}>${formatCurrency(h.costo_unitario)}</td>
                                            <td style={cellStyle}>${formatCurrency(Number(h.cantidad_usada || 0) * Number(h.costo_unitario || 0))}</td>
                                            <td style={cellStyle}>{h.codigo_pqr || "-"}</td>
                                            <td style={cellStyle}>{h.observacion || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Total gastado */}
                            <div style={{
                                marginTop: "20px",
                                padding: "15px",
                                background: "#f0f9ff",
                                borderRadius: "8px",
                                borderLeft: "4px solid #0f7c90",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}>
                                <div style={{ fontSize: "13px", color: "#475569" }}>
                                    Total invertido en estos movimientos:
                                </div>
                                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0f7c90" }}>
                                    ${formatCurrency(historial.reduce((sum, h) => {
                                        const cant = Number(h.cantidad_usada || 0);
                                        const costo = Number(h.costo_unitario || 0);
                                        return sum + (cant * costo);
                                    }, 0))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
        </div>
    );
}

const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#475569",
    marginBottom: "6px"
};

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box"
};

const headerStyle = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: "600",
    color: "#0a5c6d"
};

const cellStyle = {
    padding: "10px 12px",
    color: "#475569"
};


