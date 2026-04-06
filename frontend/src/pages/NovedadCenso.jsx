import { useEffect, useMemo, useState } from "react";
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
    potencia_nueva_w: [],
    fecha_novedad: [validationRules.required],
    observacion: []
};

const validationsGasto = {
    tipo_movimiento: [validationRules.required],
    id_electricista: [validationRules.required],
    codigo_pqr: [validationRules.required, validationRules.minLength(3)],
    observacion: []
};

const OPCIONES_TECNOLOGIA = [
    { value: "LED", label: "Led" },
    { value: "SODIO", label: "Sodio" },
    { value: "METAL_HALIDE", label: "Metal Halide" }
];

const createGastoRow = () => ({
    id: `gasto-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    codigo: "",
    material: "#N/D",
    cantidad: ""
});

export default function NovedadCenso() {
    const [novedadActual, setNovedadActual] = useState(null);
    const [inventario, setInventario] = useState([]);
    const [umbralStockBajo, setUmbralStockBajo] = useState(UMBRAL_STOCK_BAJO);
    const [electricistas, setElectricistas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitNovedadLoading, setSubmitNovedadLoading] = useState(false);
    const [submitGastoLoading, setSubmitGastoLoading] = useState(false);
    const [filasGasto, setFilasGasto] = useState([createGastoRow()]);
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
            potencia_nueva_w: "",
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
            tipo_movimiento: "DESPACHADO",
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

        if (formNovedad.tecnologia_anterior || formNovedad.tecnologia_nueva || formNovedad.potencia_nueva_w || formNovedad.id_elemento_reemplazo) {
            setFormNovedad((prev) => ({
                ...prev,
                tecnologia_anterior: "",
                tecnologia_nueva: "",
                potencia_nueva_w: "",
                id_elemento_reemplazo: ""
            }));
        }
    }, [
        formNovedad.tipo_novedad,
        formNovedad.tecnologia_anterior,
        formNovedad.tecnologia_nueva,
        formNovedad.potencia_nueva_w,
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

    const inventarioPorCodigo = useMemo(() => {
        const mapa = new Map();
        (inventario || []).forEach((item) => {
            const codigo = String(item.codigo_elemento || "").trim().toUpperCase();
            if (!codigo) {
                return;
            }
            mapa.set(codigo, item);
        });
        return mapa;
    }, [inventario]);

    const handleSubmitNovedad = async (event) => {
        event.preventDefault();
        if (!validateAllNovedad()) {
            return;
        }

        if (formNovedad.tipo_novedad === "CAMBIO_TECNOLOGIA") {
            const tecnologiaAnterior = String(formNovedad.tecnologia_anterior || "").trim().toUpperCase();
            const tecnologiaNueva = String(formNovedad.tecnologia_nueva || "").trim().toUpperCase();
            const potenciaNueva = Number(formNovedad.potencia_nueva_w);

            if (!tecnologiaAnterior || !tecnologiaNueva) {
                errorNotification("Selecciona la tecnología anterior y la nueva.");
                return;
            }

            if (formNovedad.potencia_nueva_w && (!Number.isFinite(potenciaNueva) || potenciaNueva <= 0)) {
                errorNotification("La potencia nueva debe ser un número mayor a 0.");
                return;
            }

            if (tecnologiaAnterior === tecnologiaNueva && (!Number.isFinite(potenciaNueva) || potenciaNueva <= 0)) {
                errorNotification("Si la tecnología es la misma, debes indicar la nueva potencia (W).");
                return;
            }
        }

        setSubmitNovedadLoading(true);
        try {
            const payload = {
                ...formNovedad,
                tecnologia_anterior: normalizarTecnologia(formNovedad.tecnologia_anterior),
                tecnologia_nueva: normalizarTecnologia(formNovedad.tecnologia_nueva),
                potencia_nueva_w: (() => {
                    const potencia = Number(formNovedad.potencia_nueva_w);
                    return Number.isFinite(potencia) && potencia > 0 ? Math.floor(potencia) : null;
                })(),
                observacion: formNovedad.observacion || null,
                accion: null
            };

            const nuevaNovedad = await createNovedad(payload);
            setNovedadActual(nuevaNovedad);
            setFilasGasto([createGastoRow()]);
            setItemError("");
            success("Novedad registrada correctamente");
        } catch (err) {
            errorNotification(err.message || "Error registrando la novedad");
        } finally {
            setSubmitNovedadLoading(false);
        }
    };

    const agregarFilaGasto = () => {
        setFilasGasto((prev) => [...prev, createGastoRow()]);
    };

    const eliminarFilaGasto = (rowId) => {
        setFilasGasto((prev) => {
            if (prev.length === 1) {
                return prev;
            }
            return prev.filter((row) => row.id !== rowId);
        });
    };

    const actualizarFilaGasto = (rowId, field, rawValue) => {
        setFilasGasto((prev) => prev.map((row) => {
            if (row.id !== rowId) {
                return row;
            }

            let value = rawValue;
            if (field === "codigo") {
                value = String(rawValue || "").toUpperCase().replace(/\s+/g, "");
            }
            if (field === "cantidad") {
                value = String(rawValue || "").replace(/\D/g, "");
            }

            const nextRow = { ...row, [field]: value };

            if (field === "codigo") {
                const encontrado = inventarioPorCodigo.get(value);
                nextRow.material = encontrado
                    ? String(encontrado.elemento || "").trim() || "#N/D"
                    : "#N/D";
            }

            return nextRow;
        }));
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

        const tiposSalida = new Set(["DESPACHADO", "PRESTADO", "MATERIAL_EXCEDENTE"]);
        const codigosRegistrados = new Set();
        const items = [];

        for (let i = 0; i < filasGasto.length; i += 1) {
            const row = filasGasto[i];
            const fila = i + 1;
            const codigo = String(row.codigo || "").trim().toUpperCase();

            if (!codigo) {
                setItemError(`Fila ${fila}: el código es obligatorio.`);
                return;
            }

            const elemento = inventarioPorCodigo.get(codigo);
            if (!elemento) {
                setItemError(`Fila ${fila}: el código no existe en inventario.`);
                return;
            }

            if (!String(row.material || "").trim() || row.material === "#N/D") {
                setItemError(`Fila ${fila}: el material no es válido.`);
                return;
            }

            if (!String(row.cantidad || "").trim()) {
                setItemError(`Fila ${fila}: la cantidad es obligatoria.`);
                return;
            }

            const cantidadNum = Number.parseInt(row.cantidad, 10);
            if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
                setItemError(`Fila ${fila}: la cantidad debe ser mayor a 0.`);
                return;
            }

            if (codigosRegistrados.has(codigo)) {
                setItemError(`Fila ${fila}: el código ${codigo} está repetido.`);
                return;
            }

            if (tiposSalida.has(formGasto.tipo_movimiento)) {
                const stockDisponible = Number(elemento.stock_disponible || 0);
                if (stockDisponible <= 0) {
                    setItemError(`Fila ${fila}: este elemento está agotado.`);
                    return;
                }
                if (cantidadNum > stockDisponible) {
                    setItemError(`Fila ${fila}: stock insuficiente. Disponible: ${stockDisponible}, solicitado: ${cantidadNum}`);
                    return;
                }
            }

            codigosRegistrados.add(codigo);
            items.push({
                codigo_producto: codigo,
                cantidad_usada: cantidadNum,
                etiqueta: `${codigo} - ${elemento.elemento}`
            });
        }

        if (items.length === 0) {
            setItemError("Agrega al menos una fila de gasto.");
            return;
        }

        setItemError("");

        setSubmitGastoLoading(true);
        try {
            const fechaMovimiento = formNovedad.fecha_novedad || (novedadActual && novedadActual.fecha_novedad ? String(novedadActual.fecha_novedad).slice(0, 10) : null);
            for (const item of items) {
                const payload = {
                    codigo_producto: item.codigo_producto,
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
            setFilasGasto([createGastoRow()]);
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
        <div style={{ padding: "8px 10px" }}>

            <h1 style={{ color: "#1d3554", marginBottom: "10px" }}>Registrar novedad y gastos</h1>
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
                        boxShadow: "0 6px 16px rgba(16, 55, 86, 0.08)",
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
                                <div
                                    style={{
                                        gridColumn: "1 / -1",
                                        background: "#eff6ff",
                                        border: "1px solid #bfdbfe",
                                        borderRadius: "8px",
                                        padding: "10px 12px",
                                        fontSize: "12px",
                                        color: "#1e3a8a"
                                    }}
                                >
                                    Puedes registrar cambio de potencia con la misma tecnologia. Si "Tecnologia anterior" y "Tecnologia nueva" son iguales, debes completar "Potencia nueva (W)".
                                </div>

                                <div>
                                    <label style={labelStyle}>Tecnología anterior *</label>
                                    <select
                                        name="tecnologia_anterior"
                                        value={formNovedad.tecnologia_anterior}
                                        onChange={handleChangeNovedad}
                                        onBlur={handleBlurNovedad}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">Seleccione tecnología</option>
                                        {OPCIONES_TECNOLOGIA.map((opcion) => (
                                            <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={labelStyle}>Tecnología nueva *</label>
                                    <select
                                        name="tecnologia_nueva"
                                        value={formNovedad.tecnologia_nueva}
                                        onChange={handleChangeNovedad}
                                        onBlur={handleBlurNovedad}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">Seleccione tecnología</option>
                                        {OPCIONES_TECNOLOGIA.map((opcion) => (
                                            <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                                        ))}
                                    </select>
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
                                                    style={{ color: stockBajo ? "#c2410c" : stockDisponible <= 0 ? "#b91c1c" : "#0f172a" }}
                                                >
                                                    {i.elemento} - {i.codigo_elemento}
                                                    {anioTexto}
                                                    {stockTexto}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div>
                                    <label style={labelStyle}>Potencia nueva (W)</label>
                                    <input
                                        type="number"
                                        name="potencia_nueva_w"
                                        value={formNovedad.potencia_nueva_w}
                                        onChange={handleChangeNovedad}
                                        onBlur={handleBlurNovedad}
                                        min="1"
                                        step="1"
                                        style={inputStyle}
                                        placeholder="Ej: 100"
                                    />
                                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#64748b" }}>
                                        Obligatoria cuando la tecnología anterior y nueva sean iguales.
                                    </div>
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
                            background: "#1e78bd",
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
                                boxShadow: "0 6px 16px rgba(16, 55, 86, 0.08)",
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
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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

                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                                        <label style={{ ...labelStyle, marginBottom: 0 }}>Elementos de inventario *</label>
                                        <button
                                            type="button"
                                            onClick={agregarFilaGasto}
                                            disabled={submitGastoLoading}
                                            style={{
                                                padding: "8px 12px",
                                                background: "#1e78bd",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "8px",
                                                cursor: submitGastoLoading ? "not-allowed" : "pointer",
                                                fontWeight: 600,
                                                fontSize: "12px",
                                                opacity: submitGastoLoading ? 0.6 : 1
                                            }}
                                        >
                                            Agregar fila
                                        </button>
                                    </div>

                                    <div style={{ overflowX: "auto", border: "1px solid #dbe5ef", borderRadius: "10px" }}>
                                        <table style={{ width: "100%", minWidth: "700px", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
                                            <colgroup>
                                                <col style={{ width: "20%" }} />
                                                <col style={{ width: "46%" }} />
                                                <col style={{ width: "14%" }} />
                                                <col style={{ width: "20%" }} />
                                            </colgroup>
                                            <thead>
                                                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #dbe5ef" }}>
                                                    <th style={gastoHeaderStyle}>CÓDIGO</th>
                                                    <th style={gastoHeaderStyle}>MATERIAL</th>
                                                    <th style={gastoHeaderStyle}>CANTIDAD</th>
                                                    <th style={gastoHeaderStyle}>ACCIÓN</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filasGasto.map((row) => (
                                                    <tr key={row.id} style={{ borderBottom: "1px solid #eef2f7" }}>
                                                        <td style={gastoCellStyle}>
                                                            <input
                                                                value={row.codigo}
                                                                onChange={(e) => actualizarFilaGasto(row.id, "codigo", e.target.value)}
                                                                style={inputStyle}
                                                                placeholder="Código"
                                                                disabled={submitGastoLoading}
                                                            />
                                                        </td>
                                                        <td style={gastoCellStyle}>
                                                            <input
                                                                value={row.material}
                                                                readOnly
                                                                style={{ ...inputStyle, background: "#f8fafc", color: row.material === "#N/D" ? "#b91c1c" : "#334155" }}
                                                            />
                                                        </td>
                                                        <td style={gastoCellStyle}>
                                                            <input
                                                                value={row.cantidad}
                                                                onChange={(e) => actualizarFilaGasto(row.id, "cantidad", e.target.value)}
                                                                style={inputStyle}
                                                                placeholder="0"
                                                                inputMode="numeric"
                                                                disabled={submitGastoLoading}
                                                            />
                                                        </td>
                                                        <td style={gastoCellStyle}>
                                                            <button
                                                                type="button"
                                                                onClick={() => eliminarFilaGasto(row.id)}
                                                                style={{
                                                                    border: "1px solid #fecaca",
                                                                    color: "#b91c1c",
                                                                    background: "#fff1f2",
                                                                    borderRadius: "6px",
                                                                    padding: "8px 10px",
                                                                    fontWeight: 600,
                                                                    cursor: filasGasto.length === 1 ? "not-allowed" : "pointer",
                                                                    opacity: filasGasto.length === 1 ? 0.5 : 1
                                                                }}
                                                                disabled={submitGastoLoading || filasGasto.length === 1}
                                                            >
                                                                Quitar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div style={{ marginTop: "6px", fontSize: "12px", color: "#64748b" }}>
                                        Escribe el código del material y la cantidad a registrar. Se valida el stock automáticamente según el tipo de movimiento.
                                    </div>
                                </div>

                                {itemError && <div style={errorTextStyle}>{itemError}</div>}
                            </div>

                            <button
                                type="submit"
                                disabled={submitGastoLoading}
                                style={{
                                    marginTop: "20px",
                                    width: "100%",
                                    padding: "12px 24px",
                                    background: "#1e78bd",
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
    minHeight: "42px",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#ffffff"
};

const errorTextStyle = {
    marginTop: "4px",
    fontSize: "12px",
    color: "#dc2626"
};

const gastoHeaderStyle = {
    textAlign: "left",
    padding: "10px 12px",
    color: "#0a5c6d",
    fontSize: "12px",
    fontWeight: 700
};

const gastoCellStyle = {
    padding: "10px 12px",
    verticalAlign: "top"
};

