import { useEffect, useMemo, useState } from "react";
import BackButton from "../components/BackButton";
import { getInventario } from "../api/inventario.api";
import { getElectricistas } from "../api/electricistas.api";
import { getGastos, createGasto } from "../api/gastos.api";
import { useNotification } from "../hooks/useNotification";
import { useFormValidation, validationRules } from "../hooks/useFormValidation";
import FormInput from "../components/FormInput";
import FormSelect from "../components/FormSelect";

const validationsMovimiento = {
    id_inventario: [
        validationRules.required
    ],
    tipo_movimiento: [
        validationRules.required
    ],
    cantidad: [
        validationRules.required,
        validationRules.number,
        validationRules.positiveNumber,
        validationRules.min(1)
    ],
    id_electricista: [
        validationRules.required
    ],
    codigo_pqr: [
        validationRules.required,
        validationRules.minLength(3)
    ],
    observacion: []
};

export default function DevolucionesPrestamos() {
    const [inventario, setInventario] = useState([]);
    const [electricistas, setElectricistas] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [despachos, setDespachos] = useState([]);
    const [busquedaDespacho, setBusquedaDespacho] = useState("");
    const [despachoSeleccionadoId, setDespachoSeleccionadoId] = useState("");
    const [despachoSeleccionado, setDespachoSeleccionado] = useState(null);
    const [ordenCodigoDespachos, setOrdenCodigoDespachos] = useState("asc");
    const [ordenCodigoMovimientos, setOrdenCodigoMovimientos] = useState("asc");
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const { success, error: errorNotification } = useNotification();

    const {
        values: formMovimiento,
        errors,
        touched,
        handleChange,
        handleBlur,
        validateAll,
        resetForm,
        setValues
    } = useFormValidation({
        tipo_movimiento: "PRESTADO",
        id_inventario: "",
        cantidad: "",
        id_electricista: "",
        codigo_pqr: "",
        observacion: ""
    }, validationsMovimiento);

    useEffect(() => {
        cargarDatosIniciales();
    }, []);

    const cargarDatosIniciales = async () => {
        setLoading(true);
        try {
            const [inv, els, gastos] = await Promise.all([
                getInventario(),
                getElectricistas(),
                getGastos()
            ]);

            setInventario(Array.isArray(inv) ? inv : []);
            setElectricistas(Array.isArray(els) ? els : []);

            const movimientosFiltrados = (gastos || []).filter((g) =>
                ["PRESTADO", "DEVOLUCION"].includes(g.tipo_movimiento)
            );
            const despachosRegistrados = (gastos || []).filter((g) => g.tipo_movimiento === "DESPACHADO");
            setMovimientos(movimientosFiltrados);
            setDespachos(despachosRegistrados);
            if (despachoSeleccionadoId) {
                const updated = despachosRegistrados.find((d) => String(d.id_gasto) === String(despachoSeleccionadoId));
                setDespachoSeleccionado(updated || null);
                if (!updated) {
                    setDespachoSeleccionadoId("");
                }
            }
        } catch (err) {
            console.error("Error cargando datos de devoluciones/préstamos:", err);
            errorNotification("Error al cargar datos de devoluciones/préstamos");
        } finally {
            setLoading(false);
        }
    };

    const handleTipoMovimientoChange = (event) => {
        handleChange(event);
        const { value } = event.target;

        if (value !== "DEVOLUCION") {
            setBusquedaDespacho("");
            setDespachoSeleccionadoId("");
            setDespachoSeleccionado(null);
            return;
        }

        setBusquedaDespacho("");
        setDespachoSeleccionadoId("");
        setDespachoSeleccionado(null);
        setValues((prev) => ({
            ...prev,
            id_inventario: "",
            cantidad: ""
        }));
    };

    const seleccionarDespacho = (value) => {
        setDespachoSeleccionadoId(value);
        if (!value) {
            setDespachoSeleccionado(null);
            setValues((prev) => ({
                ...prev,
                id_inventario: "",
                cantidad: "",
                codigo_pqr: ""
            }));
            return;
        }

        const registro = despachos.find((d) => String(d.id_gasto) === String(value));
        setDespachoSeleccionado(registro || null);

        if (registro) {
            setValues((prev) => ({
                ...prev,
                id_inventario: registro.id_lote ? String(registro.id_lote) : "",
                cantidad: registro.cantidad_usada ? String(registro.cantidad_usada) : "",
                codigo_pqr: registro.codigo_pqr ? String(registro.codigo_pqr) : "",
                id_electricista: registro.id_electricista ? String(registro.id_electricista) : prev.id_electricista
            }));
        }
    };

    const recargarMovimientos = async () => {
        try {
            const gastos = await getGastos();
            const movimientosFiltrados = (gastos || []).filter((g) =>
                ["PRESTADO", "DEVOLUCION"].includes(g.tipo_movimiento)
            );
            const despachosRegistrados = (gastos || []).filter((g) => g.tipo_movimiento === "DESPACHADO");
            setMovimientos(movimientosFiltrados);
            setDespachos(despachosRegistrados);
            if (despachoSeleccionadoId) {
                const updated = despachosRegistrados.find((d) => String(d.id_gasto) === String(despachoSeleccionadoId));
                setDespachoSeleccionado(updated || null);
                if (!updated) {
                    setDespachoSeleccionadoId("");
                }
            }
        } catch (err) {
            console.error("Error recargando movimientos:", err);
            errorNotification("Error al recargar los movimientos");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const tipoSeleccionado = formMovimiento.tipo_movimiento;

        if (!validateAll()) {
            errorNotification("Por favor corrige los errores en el formulario");
            return;
        }

        if (formMovimiento.tipo_movimiento === "DEVOLUCION" && !despachoSeleccionado) {
            errorNotification("Selecciona el despacho que estás devolviendo");
            return;
        }

        const elementoSeleccionado = inventario.find(
            (i) => i.id_inventario === parseInt(formMovimiento.id_inventario)
        );

        const tiposSalida = ["PRESTADO"];

        if (elementoSeleccionado && tiposSalida.includes(formMovimiento.tipo_movimiento)) {
            const stockDisponible = Number(elementoSeleccionado.stock_disponible || 0);
            const cantidadSolicitada = parseInt(formMovimiento.cantidad);

            if (cantidadSolicitada > stockDisponible) {
                errorNotification(`Stock insuficiente. Disponible: ${stockDisponible}, Solicitado: ${cantidadSolicitada}`);
                return;
            }

            if (stockDisponible <= 0) {
                errorNotification("Este elemento está agotado. No puedes registrar más salidas.");
                return;
            }
        }

        if (formMovimiento.tipo_movimiento === "DEVOLUCION" && despachoSeleccionado) {
            const cantidadDespacho = Number(despachoSeleccionado.cantidad_usada || 0);
            const cantidadDevuelta = parseInt(formMovimiento.cantidad, 10);
            if (cantidadDevuelta > cantidadDespacho) {
                errorNotification(`La devolución no puede exceder lo despachado (${cantidadDespacho}).`);
                return;
            }
        }

        try {
            setSubmitLoading(true);

            const idLoteMovimiento = formMovimiento.tipo_movimiento === "DEVOLUCION" && despachoSeleccionado
                ? Number(despachoSeleccionado.id_lote)
                : parseInt(formMovimiento.id_inventario);

            const datosEnvio = {
                id_lote: idLoteMovimiento,
                tipo_movimiento: formMovimiento.tipo_movimiento,
                cantidad: parseInt(formMovimiento.cantidad),
                id_novedad_luminaria: null,
                id_electricista: parseInt(formMovimiento.id_electricista),
                codigo_pqr: formMovimiento.codigo_pqr?.trim(),
                observacion: formMovimiento.observacion || null
            };

            await createGasto(datosEnvio);
            success("Movimiento registrado exitosamente");

            resetForm();
            setValues({
                tipo_movimiento: tipoSeleccionado,
                id_inventario: "",
                cantidad: "",
                id_electricista: "",
                codigo_pqr: "",
                observacion: ""
            });
            setDespachoSeleccionadoId("");
            setDespachoSeleccionado(null);

            await Promise.all([
                cargarDatosInventarioSolo(),
                recargarMovimientos()
            ]);
        } catch (err) {
            console.error(err);
            errorNotification(err.message || "Error al registrar el movimiento");
        } finally {
            setSubmitLoading(false);
        }
    };

    const cargarDatosInventarioSolo = async () => {
        try {
            const inv = await getInventario();
            setInventario(Array.isArray(inv) ? inv : []);
        } catch (err) {
            console.error("Error recargando inventario:", err);
        }
    };

    const movimientosOrdenados = useMemo(() => {
        const lista = [...movimientos];
        return lista.sort((a, b) => {
            const codigoA = String(a.codigo || a.codigo_elemento || a.elemento || "").toLowerCase();
            const codigoB = String(b.codigo || b.codigo_elemento || b.elemento || "").toLowerCase();
            const comparacion = codigoA.localeCompare(codigoB, "es", { numeric: true, sensitivity: "base" });
            return ordenCodigoMovimientos === "asc" ? comparacion : -comparacion;
        });
    }, [movimientos, ordenCodigoMovimientos]);

    const despachosFiltrados = useMemo(() => {
        const termino = (busquedaDespacho || "").toLowerCase().trim();
        const filtrados = !termino ? despachos : despachos.filter((d) => {
            const texto = [
                d.elemento,
                d.codigo,
                d.codigo_pqr,
                d.numero_lampara,
                d.nombre_electricista,
                d.id_gasto
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return texto.includes(termino);
        });

        return [...filtrados].sort((a, b) => {
            const codigoA = String(a.codigo || a.codigo_elemento || a.elemento || "").toLowerCase();
            const codigoB = String(b.codigo || b.codigo_elemento || b.elemento || "").toLowerCase();
            const comparacion = codigoA.localeCompare(codigoB, "es", { numeric: true, sensitivity: "base" });
            return ordenCodigoDespachos === "asc" ? comparacion : -comparacion;
        });
    }, [despachos, busquedaDespacho, ordenCodigoDespachos]);

    // Saldos de préstamo por lote (PRESTADO - DEVOLUCION)
    const saldoPrestamoPorLote = movimientos.reduce((mapa, m) => {
        const idLote = m.id_lote;
        if (!idLote) return mapa;

        const actual = mapa.get(idLote) || 0;
        const cantidad = Number(m.cantidad_usada || m.cantidad || 0);

        if (m.tipo_movimiento === "PRESTADO") {
            mapa.set(idLote, actual + cantidad);
        } else if (m.tipo_movimiento === "DEVOLUCION") {
            mapa.set(idLote, actual - cantidad);
        }

        return mapa;
    }, new Map());

    // Lotes que actualmente tienen saldo PRESTADO > DEVOLUCION
    const lotesConPrestamoVigente = new Set(
        Array.from(saldoPrestamoPorLote.entries())
            .filter(([, saldo]) => saldo > 0)
            .map(([idLote]) => idLote)
    );

    return (
        <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
            <div style={{ marginBottom: "20px" }}>
                <BackButton />
            </div>

            <h1 style={{ color: "#0a5c6d", marginBottom: "10px" }}>Devoluciones y préstamos de bodega</h1>
            <p style={{ color: "#64748b", marginBottom: "30px" }}>
                Registra movimientos de tipo <strong>PRESTADO</strong> o <strong>DEVOLUCION</strong> directamente sobre el inventario de bodega.
            </p>

            {loading ? (
                <p style={{ color: "#94a3b8" }}>Cargando datos...</p>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.6fr", gap: "30px", alignItems: "start" }}>
                    {/* Formulario */}
                    <form onSubmit={handleSubmit} style={{
                        background: "white",
                        padding: "30px",
                        borderRadius: "12px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        height: "fit-content"
                    }}>
                        <h3 style={{ color: "#0f7c90", marginBottom: "20px" }}>Nuevo movimiento</h3>

                        <FormSelect
                            label="Tipo de movimiento"
                            name="tipo_movimiento"
                            value={formMovimiento.tipo_movimiento}
                            onChange={handleTipoMovimientoChange}
                            onBlur={handleBlur}
                            error={errors.tipo_movimiento}
                            touched={touched.tipo_movimiento}
                            disabled={submitLoading}
                            required
                        >
                            <option value="PRESTADO">Préstamo</option>
                            <option value="DEVOLUCION">Devolución</option>
                        </FormSelect>

                        {formMovimiento.tipo_movimiento === "DEVOLUCION" && (
                            <div style={{ marginBottom: "15px" }}>
                                <label style={labelStyle}>Despacho a devolver *</label>
                                <div style={{ marginBottom: "8px" }}>
                                    <input
                                        type="text"
                                        value={busquedaDespacho}
                                        onChange={(e) => setBusquedaDespacho(e.target.value)}
                                        placeholder="Buscar despacho por elemento, PQR, lámpara o electricista..."
                                        style={inputStyle}
                                        disabled={submitLoading}
                                    />
                                </div>
                                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                                    <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                            <thead>
                                                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                                    <th style={{ ...headerStyle, padding: "6px 8px" }}>Fecha</th>
                                                    <th style={{ ...headerStyle, padding: "6px 8px" }}>
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                            Elemento
                                                            <button
                                                                type="button"
                                                                title={ordenCodigoDespachos === "asc" ? "Orden actual: ascendente" : "Orden actual: descendente"}
                                                                onClick={() => setOrdenCodigoDespachos((prev) => (prev === "asc" ? "desc" : "asc"))}
                                                                disabled={submitLoading}
                                                                style={{
                                                                    width: "20px",
                                                                    height: "20px",
                                                                    border: "1px solid #cbd5e1",
                                                                    borderRadius: "5px",
                                                                    background: "white",
                                                                    color: "#0f172a",
                                                                    cursor: submitLoading ? "not-allowed" : "pointer",
                                                                    opacity: submitLoading ? 0.6 : 1,
                                                                    padding: 0,
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center"
                                                                }}
                                                            >
                                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "1px", fontSize: "8px", lineHeight: 1 }}>
                                                                    <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 0.8 }}>
                                                                        <span>A</span>
                                                                        <span>Z</span>
                                                                    </span>
                                                                    <span style={{ fontSize: "9px" }}>{ordenCodigoDespachos === "asc" ? "↓" : "↑"}</span>
                                                                </span>
                                                            </button>
                                                        </span>
                                                    </th>
                                                    <th style={{ ...headerStyle, padding: "6px 8px" }}>Cant.</th>
                                                    <th style={{ ...headerStyle, padding: "6px 8px" }}>PQR</th>
                                                    <th style={{ ...headerStyle, padding: "6px 8px" }}>Seleccionar</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {despachosFiltrados.length === 0 ? (
                                                    <tr>
                                                        <td style={{ ...cellStyle, padding: "8px", color: "#94a3b8" }} colSpan={5}>
                                                            No se encontraron despachos con ese criterio.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    despachosFiltrados.map((d) => {
                                                        const seleccionado = String(despachoSeleccionadoId) === String(d.id_gasto);
                                                        return (
                                                            <tr
                                                                key={d.id_gasto}
                                                                style={{
                                                                    borderBottom: "1px solid #e2e8f0",
                                                                    background: seleccionado ? "#f0f9ff" : "white"
                                                                }}
                                                            >
                                                                <td style={{ ...cellStyle, padding: "6px 8px" }}>{new Date(d.fecha).toLocaleDateString()}</td>
                                                                <td style={{ ...cellStyle, padding: "6px 8px" }}>{d.elemento}</td>
                                                                <td style={{ ...cellStyle, padding: "6px 8px" }}>{d.cantidad_usada}</td>
                                                                <td style={{ ...cellStyle, padding: "6px 8px" }}>{d.codigo_pqr || "-"}</td>
                                                                <td style={{ ...cellStyle, padding: "6px 8px" }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => seleccionarDespacho(String(d.id_gasto))}
                                                                        disabled={submitLoading}
                                                                        style={{
                                                                            border: "none",
                                                                            borderRadius: "6px",
                                                                            padding: "6px 10px",
                                                                            cursor: submitLoading ? "not-allowed" : "pointer",
                                                                            background: seleccionado ? "#0f7c90" : "#e2e8f0",
                                                                            color: seleccionado ? "white" : "#0f172a",
                                                                            fontSize: "11px",
                                                                            fontWeight: "600"
                                                                        }}
                                                                    >
                                                                        {seleccionado ? "Seleccionado" : "Seleccionar"}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {despachoSeleccionado && (
                                    <div style={{
                                        marginTop: "10px",
                                        padding: "10px 12px",
                                        background: "#f8fafc",
                                        borderRadius: "8px",
                                        border: "1px solid #e2e8f0",
                                        fontSize: "12px",
                                        color: "#0f172a"
                                    }}>
                                        <div><strong>Elemento:</strong> {despachoSeleccionado.elemento}</div>
                                        <div><strong>Electricista:</strong> {despachoSeleccionado.nombre_electricista || `ID ${despachoSeleccionado.id_electricista}`}</div>
                                        <div><strong>Cantidad despachada:</strong> {despachoSeleccionado.cantidad_usada}</div>
                                        <div><strong>PQR:</strong> {despachoSeleccionado.codigo_pqr || "-"}</div>
                                    </div>
                                )}
                                <p style={{ marginTop: "6px", fontSize: "12px", color: "#64748b" }}>
                                    Selecciona el despacho original para sugerir el elemento y la cantidad devuelta.
                                </p>
                            </div>
                        )}

                        <div style={{ marginBottom: "15px" }}>
                            <label style={labelStyle}>Elemento de inventario *</label>
                            <select
                                name="id_inventario"
                                value={formMovimiento.id_inventario}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                required
                                style={inputStyle}
                                disabled={submitLoading || formMovimiento.tipo_movimiento === "DEVOLUCION"}
                            >
                                <option value="">Seleccione un elemento</option>
                                {inventario
                                    .filter((i) => {
                                        const idInv = i.id_inventario;

                                        if (formMovimiento.tipo_movimiento === "DEVOLUCION") {
                                            if (despachoSeleccionado) {
                                                return Number(despachoSeleccionado.id_lote) === Number(idInv);
                                            }
                                            return despachos.some((d) => Number(d.id_lote) === Number(idInv));
                                        }

                                        return true;
                                    })
                                    .map((i) => {
                                        const stockDisponible = Number(i.stock_disponible || 0);
                                        const stockTexto = stockDisponible > 0 ? ` (Disponible: ${stockDisponible})` : " (AGOTADO)";
                                        const tiposSalida = ["DESPACHADO", "PRESTADO", "MATERIAL_EXCEDENTE"];
                                        const disabled = tiposSalida.includes(formMovimiento.tipo_movimiento) && stockDisponible <= 0;

                                        return (
                                            <option
                                                key={i.id_inventario}
                                                value={i.id_inventario}
                                                disabled={disabled}
                                            >
                                                {i.codigo_elemento} - {i.elemento}{stockTexto}
                                            </option>
                                        );
                                    })}
                            </select>
                            {touched.id_inventario && errors.id_inventario && (
                                <div style={errorTextStyle}>{errors.id_inventario}</div>
                            )}
                        </div>

                        <FormInput
                            label="Cantidad *"
                            name="cantidad"
                            type="number"
                            value={formMovimiento.cantidad}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.cantidad}
                            touched={touched.cantidad}
                            placeholder="0"
                            min="1"
                            disabled={submitLoading}
                            required
                        />

                        <div style={{ marginBottom: "15px" }}>
                            <label style={labelStyle}>Electricista responsable *</label>
                            <select
                                name="id_electricista"
                                value={formMovimiento.id_electricista}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                required
                                style={inputStyle}
                                disabled={submitLoading}
                            >
                                <option value="">Seleccione electricista</option>
                                {electricistas.map((e) => (
                                    <option key={e.id_electricista} value={e.id_electricista}>
                                        {e.nombre} (Doc: {e.documento})
                                    </option>
                                ))}
                            </select>
                            {touched.id_electricista && errors.id_electricista && (
                                <div style={errorTextStyle}>{errors.id_electricista}</div>
                            )}
                        </div>

                        <FormInput
                            label="Código PQR *"
                            name="codigo_pqr"
                            value={formMovimiento.codigo_pqr}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.codigo_pqr}
                            touched={touched.codigo_pqr}
                            placeholder="Ej: PQR-12345"
                            disabled={submitLoading}
                            required
                        />

                        <div style={{ marginBottom: "15px" }}>
                            <label style={labelStyle}>Observación</label>
                            <textarea
                                name="observacion"
                                value={formMovimiento.observacion}
                                onChange={handleChange}
                                style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                                placeholder="Detalles adicionales..."
                                disabled={submitLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitLoading}
                            style={{
                                marginTop: "20px",
                                width: "100%",
                                padding: "12px 24px",
                                background: "#0f7c90",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                cursor: submitLoading ? "not-allowed" : "pointer",
                                fontWeight: "bold",
                                fontSize: "14px",
                                opacity: submitLoading ? 0.6 : 1
                            }}
                        >
                            {submitLoading ? "Registrando..." : "Registrar movimiento"}
                        </button>
                    </form>

                    {/* Tabla de movimientos */}
                    <div style={{
                        background: "white",
                        padding: "30px",
                        borderRadius: "12px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                    }}>
                        <h3 style={{ color: "#0f7c90", marginBottom: "20px" }}>
                            Historial de devoluciones y préstamos ({movimientosOrdenados.length})
                        </h3>

                        {movimientosOrdenados.length === 0 ? (
                            <p style={{ color: "#94a3b8" }}>
                                No hay movimientos de tipo PRESTADO o DEVOLUCION registrados.
                            </p>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                                            <th style={headerStyle}>Fecha</th>
                                            <th style={headerStyle}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                    Elemento
                                                    <button
                                                        type="button"
                                                        title={ordenCodigoMovimientos === "asc" ? "Orden actual: ascendente" : "Orden actual: descendente"}
                                                        onClick={() => setOrdenCodigoMovimientos((prev) => (prev === "asc" ? "desc" : "asc"))}
                                                        style={{
                                                            width: "20px",
                                                            height: "20px",
                                                            border: "1px solid #cbd5e1",
                                                            borderRadius: "5px",
                                                            background: "white",
                                                            color: "#0f172a",
                                                            cursor: "pointer",
                                                            padding: 0,
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            justifyContent: "center"
                                                        }}
                                                    >
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "1px", fontSize: "8px", lineHeight: 1 }}>
                                                            <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 0.8 }}>
                                                                <span>A</span>
                                                                <span>Z</span>
                                                            </span>
                                                            <span style={{ fontSize: "9px" }}>{ordenCodigoMovimientos === "asc" ? "↓" : "↑"}</span>
                                                        </span>
                                                    </button>
                                                </span>
                                            </th>
                                            <th style={headerStyle}>Movimiento</th>
                                            <th style={headerStyle}>Cantidad</th>
                                            <th style={headerStyle}>Electricista</th>
                                            <th style={headerStyle}>PQR</th>
                                            <th style={headerStyle}>Observación</th>
                                            <th style={headerStyle}>Saldo préstamo lote</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movimientosOrdenados.map((m) => (
                                            <tr key={m.id_gasto} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                                <td style={cellStyle}>{new Date(m.fecha).toLocaleString()}</td>
                                                <td style={cellStyle}>{m.elemento}</td>
                                                <td style={cellStyle}>{m.tipo_movimiento}</td>
                                                <td style={cellStyle}>{m.cantidad_usada}</td>
                                                <td style={cellStyle}>{m.nombre_electricista || `ID ${m.id_electricista || "-"}`}</td>
                                                <td style={cellStyle}>{m.codigo_pqr || "-"}</td>
                                                <td style={cellStyle}>{m.observacion || "-"}</td>
                                                <td style={cellStyle}>
                                                    {(() => {
                                                        const saldo = saldoPrestamoPorLote.get(m.id_lote) || 0;
                                                        return saldo > 0 ? `${saldo} pendiente` : "-";
                                                    })()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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

const headerStyle = { padding: "8px 10px", textAlign: "left", color: "#0a5c6d", fontWeight: "bold" };
const cellStyle = { padding: "8px 10px", color: "#475569" };
