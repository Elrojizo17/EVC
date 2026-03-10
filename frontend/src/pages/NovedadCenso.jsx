import { useEffect, useMemo, useState } from "react";
import BackButton from "../components/BackButton";
import MiniMapaLuminaria from "../components/MiniMapaLuminaria";
import { createNovedad, diagnosticarLampara } from "../api/novedades.api";
import { createGasto } from "../api/gastos.api";
import { getUiConfig } from "../api/config.api";
import { getInventario } from "../api/inventario.api";
import { getElectricistas } from "../api/electricistas.api";
import { useNotification } from "../hooks/useNotification";
import { useFormValidation, validationRules } from "../hooks/useFormValidation";
import { UMBRAL_STOCK_BAJO } from "../constants/inventario";

const validationsNovedad = {
    numero_lampara: [validationRules.required, validationRules.alphanumeric],
    tipo_novedad: [validationRules.required],
    tecnologia_anterior: [],
    tecnologia_nueva: [],
    fecha_novedad: [validationRules.required],
    observacion: []
};

const validationsGasto = {
    tipo_movimiento: [validationRules.required],
    id_electricista: [validationRules.required],
    codigo_pqr: [validationRules.required, validationRules.minLength(3)],
    observacion: []
};

export default function NovedadCenso() {
    const [novedadActual, setNovedadActual] = useState(null);
    const [inventario, setInventario] = useState([]);
    const [umbralStockBajo, setUmbralStockBajo] = useState(UMBRAL_STOCK_BAJO);
    const [electricistas, setElectricistas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitNovedadLoading, setSubmitNovedadLoading] = useState(false);
    const [submitGastoLoading, setSubmitGastoLoading] = useState(false);
    const [gastosPendientes, setGastosPendientes] = useState([]);
    const [busquedaInventario, setBusquedaInventario] = useState("");
    const [itemError, setItemError] = useState("");
    const [lamparaInfo, setLamparaInfo] = useState(null);
    const [lamparaInfoLoading, setLamparaInfoLoading] = useState(false);
    const [lamparaInfoError, setLamparaInfoError] = useState("");
    const { success, error: errorNotification } = useNotification();

    const {
        values: formNovedad,
        errors: errorsNovedad,
        touched: touchedNovedad,
        handleChange: handleChangeNovedad,
        handleBlur: handleBlurNovedad,
        validateAll: validateAllNovedad,
        setValues: setFormNovedad
    } = useFormValidation(
        {
            numero_lampara: "",
            tipo_novedad: "MANTENIMIENTO",
            tecnologia_anterior: "",
            tecnologia_nueva: "",
            id_elemento_reemplazo: "",
            fecha_novedad: new Date().toISOString().split("T")[0],
            observacion: ""
        },
        validationsNovedad
    );

    const {
        values: formGasto,
        errors: errorsGasto,
        touched: touchedGasto,
        handleChange: handleChangeGasto,
        handleBlur: handleBlurGasto,
        validateAll: validateAllGasto,
        resetForm: resetFormGasto,
        setValues: setFormGasto
    } = useFormValidation(
        {
            id_inventario: "",
            tipo_movimiento: "DESPACHADO",
            cantidad_usada: "",
            id_electricista: "",
            codigo_pqr: "",
            observacion: ""
        },
        validationsGasto
    );

    useEffect(() => {
        cargarDatos();
        cargarConfigUi();
    }, []);

    const cargarConfigUi = async () => {
        try {
            const config = await getUiConfig();
            const umbral = Number(config?.stock_bajo_umbral);
            if (Number.isFinite(umbral) && umbral > 0) {
                setUmbralStockBajo(Math.floor(umbral));
            }
        } catch (err) {
            console.warn("No se pudo cargar configuración UI, usando valor por defecto.", err);
        }
    };

    useEffect(() => {
        const numero = (formNovedad.numero_lampara || "").trim();

        if (!numero) {
            setLamparaInfo(null);
            setLamparaInfoError("");
            setLamparaInfoLoading(false);
            return;
        }

        let cancelado = false;
        setLamparaInfoLoading(true);
        setLamparaInfoError("");

        const handler = setTimeout(async () => {
            try {
                const data = await diagnosticarLampara(numero);
                if (cancelado) {
                    return;
                }

                if (data.encontrada && data.lampara) {
                    setLamparaInfo(data.lampara);
                    setLamparaInfoError("");
                } else {
                    setLamparaInfo(null);
                    setLamparaInfoError(data.mensaje || "Lámpara no encontrada");
                }
            } catch (err) {
                if (!cancelado) {
                    setLamparaInfo(null);
                    setLamparaInfoError(err.message || "Error consultando la lámpara");
                }
            } finally {
                if (!cancelado) {
                    setLamparaInfoLoading(false);
                }
            }
        }, 400);

        return () => {
            cancelado = true;
            clearTimeout(handler);
        };
    }, [formNovedad.numero_lampara]);

    useEffect(() => {
        if (formNovedad.tipo_novedad === "CAMBIO_TECNOLOGIA") {
            return;
        }

        if (formNovedad.tecnologia_anterior || formNovedad.tecnologia_nueva || formNovedad.id_elemento_reemplazo) {
            setFormNovedad((prev) => ({
                ...prev,
                tecnologia_anterior: "",
                tecnologia_nueva: "",
                id_elemento_reemplazo: ""
            }));
        }
    }, [
        formNovedad.tipo_novedad,
        formNovedad.tecnologia_anterior,
        formNovedad.tecnologia_nueva,
        formNovedad.id_elemento_reemplazo,
        setFormNovedad
    ]);

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const [inventarioData, electricistasData] = await Promise.all([
                getInventario(),
                getElectricistas()
            ]);
            setInventario(Array.isArray(inventarioData) ? inventarioData : []);
            setElectricistas(Array.isArray(electricistasData) ? electricistasData : []);
        } catch (err) {
            errorNotification(err.message || "Error cargando datos iniciales");
        } finally {
            setLoading(false);
        }
    };

    const normalizarTecnologia = (valor) => {
        if (valor === null || valor === undefined) {
            return null;
        }
        const texto = String(valor).trim();
        return texto === "" ? null : texto;
    };

    const inventarioFiltrado = useMemo(() => {
        const termino = busquedaInventario.trim().toLowerCase();
        if (!termino) {
            return inventario;
        }

        return inventario.filter((item) => {
            const elemento = String(item.elemento || "").toLowerCase();
            const codigo = String(item.codigo_elemento || "").toLowerCase();
            return elemento.includes(termino) || codigo.includes(termino);
        });
    }, [inventario, busquedaInventario]);

    const handleSubmitNovedad = async (event) => {
        event.preventDefault();
        if (!validateAllNovedad()) {
            return;
        }

        setSubmitNovedadLoading(true);
        try {
            const payload = {
                ...formNovedad,
                tecnologia_anterior: normalizarTecnologia(formNovedad.tecnologia_anterior),
                tecnologia_nueva: normalizarTecnologia(formNovedad.tecnologia_nueva),
                observacion: formNovedad.observacion || null,
                accion: null
            };

            const nuevaNovedad = await createNovedad(payload);
            setNovedadActual(nuevaNovedad);
            success("Novedad registrada correctamente");
        } catch (err) {
            errorNotification(err.message || "Error registrando la novedad");
        } finally {
            setSubmitNovedadLoading(false);
        }
    };

    const validarItemInventario = (idInventario, cantidad) => {
        if (!idInventario || !cantidad) {
            return { error: "Selecciona un elemento y una cantidad mayor a 0." };
        }

        const cantidadNum = parseInt(cantidad, 10);
        if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
            return { error: "La cantidad debe ser un número positivo." };
        }

        const elemento = inventario.find((i) => i.id_inventario === Number(idInventario));
        if (!elemento) {
            return { error: "Elemento de inventario inválido." };
        }

        if (["DESPACHADO", "PRESTADO", "MATERIAL_EXCEDENTE"].includes(formGasto.tipo_movimiento)) {
            const stockDisponible = Number(elemento.stock_disponible || 0);
            if (stockDisponible <= 0) {
                return { error: "Este elemento está agotado." };
            }
            if (cantidadNum > stockDisponible) {
                return { error: `Stock insuficiente. Disponible: ${stockDisponible}, solicitado: ${cantidadNum}` };
            }
        }

        return {
            item: {
                id_inventario: Number(elemento.id_inventario),
                cantidad_usada: cantidadNum,
                etiqueta: `${elemento.codigo_elemento} - ${elemento.elemento}`
            }
        };
    };

    const handleAddItemPendiente = () => {
        const { item, error } = validarItemInventario(formGasto.id_inventario, formGasto.cantidad_usada);
        if (error) {
            setItemError(error);
            return;
        }

        const yaExiste = gastosPendientes.some(
            (pendiente) => pendiente.id_inventario === item.id_inventario
        );
        if (yaExiste) {
            setItemError("Este elemento ya está en la lista pendiente.");
            return;
        }

        setGastosPendientes((prev) => [...prev, item]);
        setItemError("");
        setFormGasto((prev) => ({
            ...prev,
            id_inventario: "",
            cantidad_usada: ""
        }));
    };

    const handleRemovePendiente = (index) => {
        setGastosPendientes((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleSubmitGasto = async (event) => {
        event.preventDefault();

        if (!novedadActual || !novedadActual.id_novedad) {
            errorNotification("Registra una novedad antes de agregar gastos.");
            return;
        }

        if (!validateAllGasto()) {
            return;
        }

        const electricistaSeleccionado = electricistas.find(
            (e) => String(e.id_electricista) === String(formGasto.id_electricista)
        );

        if (!electricistaSeleccionado) {
            errorNotification("Selecciona un electricista válido");
            return;
        }

        if (!electricistaSeleccionado.activo) {
            errorNotification("El electricista seleccionado no está disponible");
            return;
        }

        let items = gastosPendientes;
        if (items.length === 0) {
            const { item, error } = validarItemInventario(
                formGasto.id_inventario,
                formGasto.cantidad_usada
            );
            if (error) {
                setItemError(error);
                return;
            }
            items = [item];
        }

        setSubmitGastoLoading(true);
        try {
            const fechaMovimiento = formNovedad.fecha_novedad || (novedadActual && novedadActual.fecha_novedad ? String(novedadActual.fecha_novedad).slice(0, 10) : null);
            for (const item of items) {
                const payload = {
                    id_lote: item.id_inventario,
                    tipo_movimiento: formGasto.tipo_movimiento,
                    cantidad: item.cantidad_usada,
                    id_novedad_luminaria: novedadActual.id_novedad,
                    id_electricista: Number(formGasto.id_electricista),
                    codigo_pqr: formGasto.codigo_pqr,
                    observacion: formGasto.observacion || null,
                    ...(fechaMovimiento ? { fecha: fechaMovimiento } : {})
                };
                await createGasto(payload);
            }

            const mensaje = items.length > 1
                ? "Gastos registrados correctamente"
                : "Gasto registrado correctamente";
            success(mensaje);
            setGastosPendientes([]);
            setItemError("");
            resetFormGasto();
            setFormGasto((prev) => ({
                ...prev,
                tipo_movimiento: "DESPACHADO"
            }));
            cargarDatos();
        } catch (err) {
            errorNotification(err.message || "Error registrando el gasto");
        } finally {
            setSubmitGastoLoading(false);
        }
    };

    return (
        <div style={{ padding: "20px 30px" }}>
            <BackButton />

            <h1 style={{ color: "#0a5c6d", marginBottom: "10px" }}>Registrar novedad y gastos</h1>
            <p style={{ color: "#64748b", marginBottom: "30px" }}>
                Registra una novedad (mantenimiento, reparación o cambio de tecnología) y, si lo necesitas, los movimientos de inventario asociados.
            </p>

            {loading && (
                <div style={{
                    marginBottom: "20px",
                    padding: "12px 16px",
                    background: "#f0f9ff",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#0f172a"
                }}>
                    Cargando información de inventario y electricistas...
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "0.9fr 1.4fr",
                    gap: "30px",
                    alignItems: "start"
                }}
            >
                <form
                    onSubmit={handleSubmitNovedad}
                    style={{
                        background: "white",
                        padding: "30px",
                        borderRadius: "12px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        height: "fit-content",
                        border: "1px solid #e2e8f0"
                    }}
                >
                    <h3 style={{ color: "#0f7c90", marginBottom: "20px" }}>1. Registrar novedad</h3>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                        <div>
                            <label style={labelStyle}>Número de lámpara *</label>
                            <input
                                type="text"
                                name="numero_lampara"
                                value={formNovedad.numero_lampara}
                                onChange={handleChangeNovedad}
                                onBlur={handleBlurNovedad}
                                required
                                style={inputStyle}
                                placeholder="1-2407"
                            />
                            {touchedNovedad.numero_lampara && errorsNovedad.numero_lampara && (
                                <div style={errorTextStyle}>{errorsNovedad.numero_lampara}</div>
                            )}
                            {formNovedad.numero_lampara && (
                                <div
                                    style={{
                                        marginTop: "6px",
                                        fontSize: "12px",
                                        color: lamparaInfoError ? "#dc2626" : "#64748b"
                                    }}
                                >
                                    {lamparaInfoLoading && "Buscando información de la lámpara..."}
                                    {!lamparaInfoLoading && lamparaInfoError && lamparaInfoError}
                                    {!lamparaInfoLoading && !lamparaInfoError && lamparaInfo && (
                                        <span>
                                            <strong>Lámpara encontrada:</strong> Tecnología {lamparaInfo.tecnologia || "N/D"} · Potencia {lamparaInfo.potencia_w ? `${lamparaInfo.potencia_w} W` : "N/D"} · Estado {lamparaInfo.estado || "N/D"}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label style={labelStyle}>Tipo de novedad *</label>
                            <select
                                name="tipo_novedad"
                                value={formNovedad.tipo_novedad}
                                onChange={handleChangeNovedad}
                                onBlur={handleBlurNovedad}
                                required
                                style={inputStyle}
                            >
                                <option value="MANTENIMIENTO">Mantenimiento</option>
                                <option value="CAMBIO_TECNOLOGIA">Cambio de tecnología</option>
                                <option value="REPARACION">Reparación</option>
                                <option value="INSTALACION">Instalación</option>
                            </select>
                        </div>

                        {formNovedad.tipo_novedad === "CAMBIO_TECNOLOGIA" && (
                            <>
                                <div>
                                    <label style={labelStyle}>Tecnología anterior *</label>
                                    <input
                                        type="text"
                                        name="tecnologia_anterior"
                                        value={formNovedad.tecnologia_anterior}
                                        onChange={handleChangeNovedad}
                                        onBlur={handleBlurNovedad}
                                        required
                                        style={inputStyle}
                                        placeholder="Sodio"
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>Tecnología nueva *</label>
                                    <input
                                        type="text"
                                        name="tecnologia_nueva"
                                        value={formNovedad.tecnologia_nueva}
                                        onChange={handleChangeNovedad}
                                        onBlur={handleBlurNovedad}
                                        required
                                        style={inputStyle}
                                        placeholder="LED"
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>Elemento de reemplazo *</label>
                                    <select
                                        name="id_elemento_reemplazo"
                                        value={formNovedad.id_elemento_reemplazo}
                                        onChange={handleChangeNovedad}
                                        onBlur={handleBlurNovedad}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">Seleccione lámpara del inventario</option>
                                        {inventario.map((i) => {
                                            const stockDisponible = Number(i.stock_disponible || 0);
                                            const stockBajo = stockDisponible > 0 && stockDisponible < umbralStockBajo;
                                            const stockTexto = stockDisponible > 0 ? ` (Stock: ${stockDisponible})` : " (AGOTADO)";
                                            const anioTexto = i.anio_compra ? ` - Año ${i.anio_compra}` : "";
                                            return (
                                                <option
                                                    key={i.id_inventario}
                                                    value={i.id_inventario}
                                                    disabled={stockDisponible <= 0}
                                                    style={{ color: stockBajo ? "#ef4444" : stockDisponible <= 0 ? "#b91c1c" : "#0f172a" }}
                                                >
                                                    {i.elemento} - {i.codigo_elemento}
                                                    {anioTexto}
                                                    {stockTexto}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </>
                        )}

                        <div>
                            <label style={labelStyle}>Fecha de novedad *</label>
                            <input
                                type="date"
                                name="fecha_novedad"
                                value={formNovedad.fecha_novedad}
                                onChange={handleChangeNovedad}
                                onBlur={handleBlurNovedad}
                                required
                                style={inputStyle}
                            />
                            {touchedNovedad.fecha_novedad && errorsNovedad.fecha_novedad && (
                                <div style={errorTextStyle}>{errorsNovedad.fecha_novedad}</div>
                            )}
                        </div>

                    </div>

                    <button
                        type="submit"
                        disabled={submitNovedadLoading}
                        style={{
                            marginTop: "20px",
                            width: "100%",
                            padding: "12px 24px",
                            background: "#0f7c90",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: submitNovedadLoading ? "not-allowed" : "pointer",
                            fontWeight: "bold",
                            fontSize: "14px",
                            opacity: submitNovedadLoading ? 0.6 : 1,
                            transition: "transform 0.2s ease"
                        }}
                    >
                        {submitNovedadLoading ? "Registrando..." : "Registrar novedad"}
                    </button>
                </form>

                {!novedadActual ? (
                    <div style={{ position: "sticky", top: "20px" }}>
                        <MiniMapaLuminaria numeroLampara={formNovedad.numero_lampara} />
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <form
                            onSubmit={handleSubmitGasto}
                            style={{
                                background: "white",
                                padding: "30px",
                                borderRadius: "12px",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                border: "1px solid #e2e8f0",
                                height: "fit-content"
                            }}
                        >
                            <h3 style={{ color: "#0f7c90", marginBottom: "20px" }}>2. Agregar gastos (opcional)</h3>

                            <div
                                style={{
                                    marginBottom: "20px",
                                    padding: "12px 14px",
                                    background: "#f0f9ff",
                                    borderRadius: "8px",
                                    borderLeft: "4px solid #0f7c90",
                                    fontSize: "12px",
                                    color: "#0f172a"
                                }}
                            >
                                <div>
                                    Novedad registrada: <strong>#{novedadActual.id_novedad}</strong>
                                </div>
                                <div style={{ marginTop: "6px" }}>
                                    Luminaria: <strong>{novedadActual.numero_lampara || formNovedad.numero_lampara || "-"}</strong>
                                    {lamparaInfo && (
                                        <span>
                                            {" "}· {lamparaInfo.tecnologia || ""}
                                            {lamparaInfo.potencia_w ? `, ${lamparaInfo.potencia_w} W` : ""}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                                <div>
                                    <label style={labelStyle}>Tipo de movimiento *</label>
                                    <select
                                        name="tipo_movimiento"
                                        value={formGasto.tipo_movimiento}
                                        onChange={handleChangeGasto}
                                        onBlur={handleBlurGasto}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="DESPACHADO">Despachado</option>
                                        <option value="PRESTADO">Prestado</option>
                                        <option value="MATERIAL_EXCEDENTE">Material excedente</option>
                                        <option value="DEVOLUCION">Devolución</option>
                                        <option value="ENTRADA">Entrada</option>
                                    </select>
                                    {touchedGasto.tipo_movimiento && errorsGasto.tipo_movimiento && (
                                        <div style={errorTextStyle}>{errorsGasto.tipo_movimiento}</div>
                                    )}
                                </div>

                                <div>
                                    <label style={labelStyle}>Elemento de inventario *</label>
                                    <input
                                        type="text"
                                        value={busquedaInventario}
                                        onChange={(e) => setBusquedaInventario(e.target.value)}
                                        placeholder="Buscar material por nombre o código..."
                                        style={{ ...inputStyle, marginBottom: "8px" }}
                                    />
                                    <select
                                        name="id_inventario"
                                        value={formGasto.id_inventario}
                                        onChange={handleChangeGasto}
                                        onBlur={handleBlurGasto}
                                        style={inputStyle}
                                    >
                                        <option value="">Seleccione un elemento</option>
                                        {inventarioFiltrado.map((i) => {
                                            const stockDisponible = Number(i.stock_disponible || 0);
                                            const stockBajo = stockDisponible > 0 && stockDisponible < umbralStockBajo;
                                            const stockTexto = stockDisponible > 0 ? ` (Disponible: ${stockDisponible})` : " (AGOTADO)";
                                            return (
                                                <option
                                                    key={i.id_inventario}
                                                    value={i.id_inventario}
                                                    disabled={stockDisponible <= 0}
                                                    style={{ color: stockBajo ? "#ef4444" : stockDisponible <= 0 ? "#b91c1c" : "#0f172a" }}
                                                >
                                                    {i.codigo_elemento} - {i.elemento}
                                                    {stockTexto}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {!inventarioFiltrado.length && (
                                        <div style={{ ...errorTextStyle, color: "#64748b" }}>
                                            No se encontraron materiales con ese criterio de búsqueda.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={labelStyle}>Cantidad usada *</label>
                                    <input
                                        type="number"
                                        name="cantidad_usada"
                                        value={formGasto.cantidad_usada}
                                        onChange={handleChangeGasto}
                                        onBlur={handleBlurGasto}
                                        min="1"
                                        style={inputStyle}
                                        placeholder="0"
                                    />
                                    {itemError && <div style={errorTextStyle}>{itemError}</div>}
                                </div>

                                <div>
                                    <button
                                        type="button"
                                        onClick={handleAddItemPendiente}
                                        style={{
                                            marginTop: "4px",
                                            padding: "10px 14px",
                                            background: "#e0f2fe",
                                            color: "#0f172a",
                                            borderRadius: "8px",
                                            border: "none",
                                            cursor: "pointer",
                                            fontSize: "13px",
                                            fontWeight: 500
                                        }}
                                    >
                                        + Agregar a la lista
                                    </button>
                                </div>

                                {gastosPendientes.length > 0 && (
                                    <div
                                        style={{
                                            marginTop: "4px",
                                            padding: "12px 14px",
                                            borderRadius: "8px",
                                            background: "#f9fafb",
                                            border: "1px solid #e5e7eb",
                                            fontSize: "12px"
                                        }}
                                    >
                                        <div style={{ marginBottom: "6px", color: "#0f172a", fontWeight: 600 }}>
                                            Elementos a registrar en esta novedad ({gastosPendientes.length})
                                        </div>
                                        <ul style={{ listStyle: "disc", paddingLeft: "18px", margin: 0 }}>
                                            {gastosPendientes.map((item, idx) => (
                                                <li
                                                    key={`${item.id_inventario}-${idx}`}
                                                    style={{
                                                        marginBottom: "6px",
                                                        color: "#475569",
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        gap: "12px"
                                                    }}
                                                >
                                                    <span>
                                                        {item.etiqueta} · Cantidad: {item.cantidad_usada}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePendiente(idx)}
                                                        style={{
                                                            background: "transparent",
                                                            border: "none",
                                                            color: "#ef4444",
                                                            cursor: "pointer",
                                                            fontSize: "12px"
                                                        }}
                                                    >
                                                        Quitar
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div>
                                    <label style={labelStyle}>Electricista responsable *</label>
                                    <select
                                        name="id_electricista"
                                        value={formGasto.id_electricista}
                                        onChange={handleChangeGasto}
                                        onBlur={handleBlurGasto}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">Seleccione electricista</option>
                                        {electricistas.map((e) => (
                                            <option
                                                key={e.id_electricista}
                                                value={e.id_electricista}
                                                style={{ color: e.activo ? "#0f172a" : "#9ca3af" }}
                                            >
                                                {e.nombre} (Doc: {e.documento})
                                                {!e.activo ? " • No disponible" : ""}
                                            </option>
                                        ))}
                                    </select>
                                    {touchedGasto.id_electricista && errorsGasto.id_electricista && (
                                        <div style={errorTextStyle}>{errorsGasto.id_electricista}</div>
                                    )}
                                    {formGasto.id_electricista && (() => {
                                        const seleccionado = electricistas.find(
                                            (e) => String(e.id_electricista) === String(formGasto.id_electricista)
                                        );

                                        if (!seleccionado || seleccionado.activo) {
                                            return null;
                                        }

                                        return (
                                            <div style={{ ...errorTextStyle, color: "#9ca3af" }}>
                                                Este electricista aparece en gris porque está marcado como no disponible.
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div>
                                    <label style={labelStyle}>Código PQR *</label>
                                    <input
                                        type="text"
                                        name="codigo_pqr"
                                        value={formGasto.codigo_pqr}
                                        onChange={handleChangeGasto}
                                        onBlur={handleBlurGasto}
                                        required
                                        style={inputStyle}
                                        placeholder="Ej: PQR-12345"
                                    />
                                    {touchedGasto.codigo_pqr && errorsGasto.codigo_pqr && (
                                        <div style={errorTextStyle}>{errorsGasto.codigo_pqr}</div>
                                    )}
                                </div>

                                <div>
                                    <label style={labelStyle}>Observación</label>
                                    <textarea
                                        name="observacion"
                                        value={formGasto.observacion}
                                        onChange={handleChangeGasto}
                                        style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                                        placeholder="Detalles adicionales..."
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitGastoLoading}
                                style={{
                                    marginTop: "20px",
                                    width: "100%",
                                    padding: "12px 24px",
                                    background: "#0f7c90",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    cursor: submitGastoLoading ? "not-allowed" : "pointer",
                                    fontWeight: "bold",
                                    fontSize: "14px",
                                    opacity: submitGastoLoading ? 0.6 : 1
                                }}
                            >
                                {submitGastoLoading ? "Registrando..." : "Agregar gasto"}
                            </button>
                        </form>
                    </div>
                )}
            </div>
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
    boxSizing: "border-box",
    background: "#ffffff"
};

const errorTextStyle = {
    marginTop: "4px",
    fontSize: "12px",
    color: "#dc2626"
};

