import { useCallback, useEffect, useMemo, useState } from "react";
import { getNovedades, updateNovedad } from "../api/novedades.api";
import { getGastos, createGasto, deleteGasto } from "../api/gastos.api";
import { getInventario } from "../api/inventario.api";
import { getElectricistas } from "../api/electricistas.api";
import { getCostoTotalMovimiento } from "../utils/gastos";
import { calcularSiguienteCodigoPqr } from "../utils/pqr";
import { useNotification } from "../hooks/useNotification";
import OtpModal from "../components/OtpModal";

const OPCIONES_TIPO_NOVEDAD = ["MANTENIMIENTO", "CAMBIO_TECNOLOGIA", "REPARACION", "INSTALACION"];
const OPCIONES_TECNOLOGIA = [
    { value: "led", label: "Led" },
    { value: "sodio", label: "Sodio" },
    { value: "metal_halide", label: "Metal Halide" }
];

const createGastoRow = () => ({
    id: `gasto-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    codigo: "",
    material: "#N/D",
    cantidad: ""
});

export default function ReporteNovedades() {
    const [novedades, setNovedades] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [tipoFiltro, setTipoFiltro] = useState("todas");
    const [novedadDetalle, setNovedadDetalle] = useState(null);
    const [novedadMovimientos, setNovedadMovimientos] = useState(null);
    const [inventario, setInventario] = useState([]);
    const [electricistas, setElectricistas] = useState([]);
    const [submitNovedadLoading, setSubmitNovedadLoading] = useState(false);
    const [submitMovimientoLoading, setSubmitMovimientoLoading] = useState(false);
    const [deleteMovimientoLoadingId, setDeleteMovimientoLoadingId] = useState(null);
    const [itemError, setItemError] = useState("");
    const [novedadError, setNovedadError] = useState("");
    const [formNovedad, setFormNovedad] = useState({
        numero_lampara: "",
        tipo_novedad: "MANTENIMIENTO",
        tecnologia_anterior: "",
        tecnologia_nueva: "",
        fecha_novedad: "",
        id_electricista: "",
        codigo_pqr: "",
        observacion: ""
    });
    const [formMovimiento, setFormMovimiento] = useState({
        tipo_movimiento: "DESPACHADO",
        id_electricista: "",
        codigo_pqr: "",
        observacion: ""
    });
    const [filasGasto, setFilasGasto] = useState([createGastoRow()]);
    const [permitirGastoVacio, setPermitirGastoVacio] = useState(false);
    const [ordenNovedades, setOrdenNovedades] = useState("asc");
    const [ordenCodigoMovimientos, setOrdenCodigoMovimientos] = useState("asc");
    const [mostrarOtp, setMostrarOtp] = useState(false);
    const [pendingOtpAction, setPendingOtpAction] = useState(null);
    const { success, error: errorNotification } = useNotification();

    const cargarDatos = useCallback(async ({ silencioso = false } = {}) => {
        try {
            if (!silencioso) {
                setLoading(true);
            }

            const [novedadesData, gastosData, inventarioData, electricistasData] = await Promise.all([
                getNovedades(),
                getGastos(),
                getInventario(),
                getElectricistas()
            ]);

            const novedadesNormalizadas = Array.isArray(novedadesData) ? novedadesData : [];
            const gastosNormalizados = Array.isArray(gastosData) ? gastosData : [];
            const inventarioNormalizado = Array.isArray(inventarioData) ? inventarioData : [];
            const electricistasNormalizados = Array.isArray(electricistasData) ? electricistasData : [];

            setNovedades(novedadesNormalizadas);
            setGastos(gastosNormalizados);
            setInventario(inventarioNormalizado);
            setElectricistas(electricistasNormalizados);
            setError("");

            setNovedadDetalle((prev) => {
                if (!prev) {
                    return prev;
                }

                const actualizada = novedadesNormalizadas.find(
                    (n) => Number(n.id_novedad) === Number(prev.id_novedad)
                );

                return actualizada || null;
            });

            setNovedadMovimientos((prev) => {
                if (!prev) {
                    return prev;
                }

                const actualizada = novedadesNormalizadas.find(
                    (n) => Number(n.id_novedad) === Number(prev.id_novedad)
                );

                return actualizada || null;
            });
        } catch (err) {
            console.error("Error cargando reporte de novedades:", err);
            setError("No se pudo cargar el reporte de novedades.");
        } finally {
            if (!silencioso) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    useEffect(() => {
        const handleOtpAccionConfirmada = () => {
            cargarDatos({ silencioso: true });
        };

        window.addEventListener("otp-accion-confirmada", handleOtpAccionConfirmada);
        return () => {
            window.removeEventListener("otp-accion-confirmada", handleOtpAccionConfirmada);
        };
    }, [cargarDatos]);

    useEffect(() => {
        const recargarSiVisible = () => {
            if (!document.hidden) {
                cargarDatos({ silencioso: true });
            }
        };

        window.addEventListener("focus", recargarSiVisible);
        document.addEventListener("visibilitychange", recargarSiVisible);

        return () => {
            window.removeEventListener("focus", recargarSiVisible);
            document.removeEventListener("visibilitychange", recargarSiVisible);
        };
    }, [cargarDatos]);

    const novedadesFiltradas = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();

        return (novedades || []).filter((n) => {
            const matchBusqueda =
                !termino ||
                String(n.numero_lampara || "").toLowerCase().includes(termino) ||
                String(n.id_novedad || "").toLowerCase().includes(termino) ||
                String(n.observacion || "").toLowerCase().includes(termino);

            if (!matchBusqueda) {
                return false;
            }

            if (tipoFiltro === "todas") {
                return true;
            }

            return String(n.tipo_novedad || "") === tipoFiltro;
        });
    }, [novedades, busqueda, tipoFiltro]);

    const movimientosPorNovedad = useMemo(() => {
        const mapa = new Map();

        (gastos || []).forEach((g) => {
            const idNovedad = Number(g.id_novedad || 0);
            if (!idNovedad) {
                return;
            }

            if (!mapa.has(idNovedad)) {
                mapa.set(idNovedad, []);
            }

            mapa.get(idNovedad).push(g);
        });

        return mapa;
    }, [gastos]);

    const resumenTipos = useMemo(() => {
        const base = { MANTENIMIENTO: 0, CAMBIO_TECNOLOGIA: 0, REPARACION: 0, INSTALACION: 0 };
        (novedades || []).forEach((n) => {
            const tipo = String(n.tipo_novedad || "");
            if (base[tipo] !== undefined) {
                base[tipo] += 1;
            }
        });
        return base;
    }, [novedades]);

    const siguienteCodigoPqr = useMemo(() => calcularSiguienteCodigoPqr(gastos), [gastos]);

    const movimientosDetalle = useMemo(() => {
        if (!novedadDetalle) {
            return [];
        }

        const lista = movimientosPorNovedad.get(Number(novedadDetalle.id_novedad)) || [];
        return [...lista].sort((a, b) => {
            const codigoA = String(a.codigo || a.codigo_elemento || a.elemento || "").toLowerCase();
            const codigoB = String(b.codigo || b.codigo_elemento || b.elemento || "").toLowerCase();
            const comparacion = codigoA.localeCompare(codigoB, "es", { numeric: true, sensitivity: "base" });
            return ordenCodigoMovimientos === "asc" ? comparacion : -comparacion;
        });
    }, [movimientosPorNovedad, novedadDetalle, ordenCodigoMovimientos]);

    const contextoDetalleNovedad = useMemo(() => {
        if (!novedadDetalle) {
            return { pqr: "-", electricista: "-", observacion: "-" };
        }

        const movimientosAsociados = movimientosPorNovedad.get(Number(novedadDetalle.id_novedad)) || [];
        const movimientoReciente = [...movimientosAsociados]
            .sort((a, b) => Number(b.id_gasto || 0) - Number(a.id_gasto || 0))[0];

        const pqr = String(
            novedadDetalle.codigo_pqr
            || movimientoReciente?.codigo_pqr
            || novedadDetalle.codigo_pqr_reciente
            || ""
        ).trim() || "-";

        const electricista = String(
            novedadDetalle.nombre_electricista
            || novedadDetalle.id_electricista
            || movimientoReciente?.nombre_electricista
            || movimientoReciente?.id_electricista
            || novedadDetalle.nombre_electricista_reciente
            || novedadDetalle.id_electricista_reciente
            || ""
        ).trim() || "-";

        const observacion = String(
            novedadDetalle.observacion
            || movimientoReciente?.observacion
            || ""
        ).trim() || "-";

        return { pqr, electricista, observacion };
    }, [novedadDetalle, movimientosPorNovedad]);

    const novedadesOrdenadas = useMemo(() => {
        return [...novedadesFiltradas].sort((a, b) => {
            const idA = Number(a.id_novedad || 0);
            const idB = Number(b.id_novedad || 0);
            return ordenNovedades === "asc" ? idA - idB : idB - idA;
        });
    }, [novedadesFiltradas, ordenNovedades]);

    const totalDetalle = useMemo(() => {
        return movimientosDetalle.reduce((sum, g) => sum + getCostoTotalMovimiento(g), 0);
    }, [movimientosDetalle]);

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

    const hayDatosEnFilas = useMemo(() => {
        return filasGasto.some((row) => {
            const codigo = String(row.codigo || "").trim();
            const cantidad = String(row.cantidad || "").trim();
            return Boolean(codigo || cantidad);
        });
    }, [filasGasto]);

    const movimientosEdicion = useMemo(() => {
        if (!novedadMovimientos) {
            return [];
        }

        const lista = movimientosPorNovedad.get(Number(novedadMovimientos.id_novedad)) || [];
        return [...lista].sort((a, b) => Number(b.id_gasto || 0) - Number(a.id_gasto || 0));
    }, [movimientosPorNovedad, novedadMovimientos]);

    const obtenerContextoMovimientoNovedad = (novedad) => {
        const movimientosAsociados = [...(movimientosPorNovedad.get(Number(novedad?.id_novedad)) || [])]
            .sort((a, b) => Number(b.id_gasto || 0) - Number(a.id_gasto || 0));

        const valorNoVacio = (extractor) => {
            for (const mov of movimientosAsociados) {
                const valor = String(extractor(mov) || "").trim();
                if (valor) {
                    return valor;
                }
            }
            return "";
        };

        const tipoMovimientoSugerido = (() => {
            const tipo = valorNoVacio((mov) => mov.tipo_movimiento).toUpperCase();
            const tiposValidos = ["DESPACHADO", "PRESTADO", "MATERIAL_EXCEDENTE", "DEVOLUCION", "ENTRADA"];
            return tiposValidos.includes(tipo) ? tipo : "DESPACHADO";
        })();

        return {
            tipo_movimiento: tipoMovimientoSugerido,
            id_electricista: valorNoVacio((mov) => mov.id_electricista),
            codigo_pqr: valorNoVacio((mov) => mov.codigo_pqr) || siguienteCodigoPqr,
            observacion: valorNoVacio((mov) => mov.observacion) || String(novedad?.observacion || "").trim()
        };
    };

    const abrirEditorMovimientos = (novedad) => {
        const contextoMovimiento = obtenerContextoMovimientoNovedad(novedad);

        setNovedadMovimientos(novedad);
        setItemError("");
        setNovedadError("");
        setFormNovedad({
            numero_lampara: novedad.numero_lampara || "",
            tipo_novedad: novedad.tipo_novedad || "MANTENIMIENTO",
            tecnologia_anterior: novedad.tecnologia_anterior || "",
            tecnologia_nueva: novedad.tecnologia_nueva || "",
            fecha_novedad: formatDateForInput(novedad.fecha_novedad),
            id_electricista: novedad.id_electricista || novedad.id_electricista_reciente || contextoMovimiento.id_electricista || "",
            codigo_pqr: novedad.codigo_pqr || novedad.codigo_pqr_reciente || contextoMovimiento.codigo_pqr || siguienteCodigoPqr,
            observacion: novedad.observacion || ""
        });
        setFormMovimiento({
            tipo_movimiento: contextoMovimiento.tipo_movimiento,
            id_electricista: contextoMovimiento.id_electricista,
            codigo_pqr: contextoMovimiento.codigo_pqr,
            observacion: contextoMovimiento.observacion
        });
        setFilasGasto([createGastoRow()]);
        setPermitirGastoVacio(false);
    };

    const cerrarEditorMovimientos = () => {
        if (submitMovimientoLoading || submitNovedadLoading || deleteMovimientoLoadingId !== null) {
            return;
        }
        setNovedadMovimientos(null);
    };

    const handleChangeNovedad = (event) => {
        const { name, value } = event.target;
        setFormNovedad((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const validarNovedad = () => {
        if (!String(formNovedad.numero_lampara || "").trim()) {
            return "El número de lámpara es obligatorio";
        }
        if (!String(formNovedad.fecha_novedad || "").trim()) {
            return "La fecha de novedad es obligatoria";
        }
        if (!String(formNovedad.id_electricista || "").trim()) {
            return "Selecciona un electricista responsable";
        }
        if (!String(formNovedad.codigo_pqr || "").trim()) {
            return "El código PQR es obligatorio";
        }
        if (formNovedad.tipo_novedad === "CAMBIO_TECNOLOGIA") {
            if (!String(formNovedad.tecnologia_anterior || "").trim()) {
                return "Selecciona la tecnología anterior";
            }
            if (!String(formNovedad.tecnologia_nueva || "").trim()) {
                return "Selecciona la tecnología nueva";
            }
        }
        return "";
    };

    const ejecutarActualizacionNovedad = async (payload) => {
        if (!novedadMovimientos) {
            return;
        }

        try {
            setSubmitNovedadLoading(true);
            const actualizada = await updateNovedad(Number(novedadMovimientos.id_novedad), payload);
            success("Novedad actualizada correctamente");
            setNovedadMovimientos((prev) => (prev ? { ...prev, ...actualizada } : prev));
            await cargarDatos();
        } catch (err) {
            errorNotification(err.message || "No se pudo actualizar la novedad");
        } finally {
            setSubmitNovedadLoading(false);
        }
    };

    const ejecutarGuardadoMovimiento = async (payload) => {
        try {
            setSubmitMovimientoLoading(true);

            const items = Array.isArray(payload.items) ? payload.items : [];
            const fechaMovimiento = formatDateForInput(novedadMovimientos.fecha_novedad);

            for (const item of items) {
                await createGasto({
                    codigo_producto: item.codigo_producto,
                    tipo_movimiento: payload.tipo_movimiento,
                    cantidad: item.cantidad_usada,
                    id_novedad_luminaria: payload.id_novedad_luminaria,
                    id_electricista: payload.id_electricista,
                    codigo_pqr: payload.codigo_pqr,
                    observacion: payload.observacion,
                    ...(fechaMovimiento ? { fecha: fechaMovimiento } : {})
                });
            }

            success(items.length > 1 ? "Gastos asociados agregados correctamente" : "Gasto asociado agregado correctamente");

            limpiarFormularioMovimiento();
            await cargarDatos();
            setNovedadMovimientos(null);
        } catch (err) {
            errorNotification(err.message || "No se pudo guardar el movimiento");
        } finally {
            setSubmitMovimientoLoading(false);
        }
    };

    const ejecutarEliminacionMovimiento = async (payload) => {
        const idGasto = Number(payload?.id_gasto);
        if (!Number.isInteger(idGasto) || idGasto <= 0) {
            errorNotification("No se pudo identificar el gasto a eliminar");
            return;
        }

        try {
            setDeleteMovimientoLoadingId(idGasto);
            await deleteGasto(idGasto);
            success("Gasto eliminado correctamente");
            await cargarDatos();
        } catch (err) {
            errorNotification(err.message || "No se pudo eliminar el gasto");
        } finally {
            setDeleteMovimientoLoadingId(null);
        }
    };

    const handleChangeMovimiento = (event) => {
        const { name, value } = event.target;
        setFormMovimiento((prev) => ({
            ...prev,
            [name]: value
        }));
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

    const validarMovimiento = () => {
        if (permitirGastoVacio && !hayDatosEnFilas) {
            return { error: "", items: [], sinGastos: true };
        }

        if (!formMovimiento.id_electricista) {
            return { error: "Selecciona un electricista", items: [] };
        }

        const electricistaSeleccionado = electricistas.find(
            (e) => String(e.id_electricista) === String(formMovimiento.id_electricista)
        );

        if (!electricistaSeleccionado) {
            return { error: "Selecciona un electricista válido", items: [] };
        }

        if (!electricistaSeleccionado.activo) {
            return { error: "El electricista seleccionado no está disponible", items: [] };
        }

        if (!String(formMovimiento.codigo_pqr || "").trim()) {
            return { error: "El código PQR es obligatorio", items: [] };
        }

        const codigosRegistrados = new Set();
        const items = [];

        for (let i = 0; i < filasGasto.length; i += 1) {
            const row = filasGasto[i];
            const fila = i + 1;
            const codigo = String(row.codigo || "").trim().toUpperCase();

            if (!codigo) {
                return { error: `Fila ${fila}: el código es obligatorio.`, items: [] };
            }

            const elemento = inventarioPorCodigo.get(codigo);
            if (!elemento) {
                return { error: `Fila ${fila}: el código no existe en inventario.`, items: [] };
            }

            if (!String(row.material || "").trim() || row.material === "#N/D") {
                return { error: `Fila ${fila}: el material no es válido.`, items: [] };
            }

            if (!String(row.cantidad || "").trim()) {
                return { error: `Fila ${fila}: la cantidad es obligatoria.`, items: [] };
            }

            const cantidadNum = Number.parseInt(row.cantidad, 10);
            if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
                return { error: `Fila ${fila}: la cantidad debe ser mayor a 0.`, items: [] };
            }

            if (codigosRegistrados.has(codigo)) {
                return { error: `Fila ${fila}: el código ${codigo} está repetido.`, items: [] };
            }

            codigosRegistrados.add(codigo);
            items.push({
                codigo_producto: codigo,
                cantidad_usada: cantidadNum,
                etiqueta: `${codigo} - ${elemento.elemento}`
            });
        }

        if (items.length === 0) {
            return { error: "Agrega al menos una fila de gasto.", items: [] };
        }

        return { error: "", items };
    };

    const limpiarFormularioMovimiento = () => {
        setItemError("");

        const contextoMovimiento = novedadMovimientos
            ? obtenerContextoMovimientoNovedad(novedadMovimientos)
            : null;

        setFormMovimiento({
            tipo_movimiento: contextoMovimiento?.tipo_movimiento || "DESPACHADO",
            id_electricista: contextoMovimiento?.id_electricista || "",
            codigo_pqr: contextoMovimiento?.codigo_pqr || siguienteCodigoPqr,
            observacion: contextoMovimiento?.observacion || ""
        });
        setFilasGasto([createGastoRow()]);
        setPermitirGastoVacio(false);
    };

    const handleSubmitMovimiento = async (event) => {
        event.preventDefault();

        if (!novedadMovimientos) {
            return;
        }

        const { error: validacionError, items, sinGastos } = validarMovimiento();
        if (validacionError) {
            setItemError(validacionError);
            return;
        }

        setItemError("");

        if (sinGastos) {
            setPendingOtpAction({
                tipo: "movimiento_sin_gasto",
                payload: { id_novedad: Number(novedadMovimientos.id_novedad) }
            });
            setMostrarOtp(true);
            return;
        }

        const payload = {
            tipo_movimiento: formMovimiento.tipo_movimiento,
            id_novedad_luminaria: Number(novedadMovimientos.id_novedad),
            id_electricista: String(formMovimiento.id_electricista).trim(),
            codigo_pqr: String(formMovimiento.codigo_pqr).trim(),
            observacion: formMovimiento.observacion || null,
            items
        };

        setPendingOtpAction({ tipo: "movimiento", payload });
        setMostrarOtp(true);
    };

    const handleSubmitNovedad = async (event) => {
        event.preventDefault();

        if (!novedadMovimientos) {
            return;
        }

        const validacionError = validarNovedad();
        if (validacionError) {
            setNovedadError(validacionError);
            return;
        }

        setNovedadError("");

        const payload = {
            numero_lampara: String(formNovedad.numero_lampara).trim(),
            tipo_novedad: formNovedad.tipo_novedad,
            tecnologia_anterior:
                formNovedad.tipo_novedad === "CAMBIO_TECNOLOGIA"
                    ? String(formNovedad.tecnologia_anterior || "").trim().toLowerCase()
                    : null,
            tecnologia_nueva:
                formNovedad.tipo_novedad === "CAMBIO_TECNOLOGIA"
                    ? String(formNovedad.tecnologia_nueva || "").trim().toLowerCase()
                    : null,
            fecha_novedad: formNovedad.fecha_novedad,
            id_electricista: String(formNovedad.id_electricista || "").trim() || null,
            codigo_pqr: String(formNovedad.codigo_pqr || "").trim() || null,
            observacion: String(formNovedad.observacion || "").trim() || null
        };

        setPendingOtpAction({ tipo: "novedad", payload });
        setMostrarOtp(true);
    };

    const solicitarEliminarMovimientoConOtp = (movimiento) => {
        const idGasto = Number(movimiento?.id_gasto);
        if (!Number.isInteger(idGasto) || idGasto <= 0) {
            errorNotification("No se pudo identificar el gasto a eliminar");
            return;
        }

        setPendingOtpAction({
            tipo: "eliminar_movimiento",
            payload: { id_gasto: idGasto }
        });
        setMostrarOtp(true);
    };

    const handleOtpVerificado = async () => {
        if (!pendingOtpAction) {
            setMostrarOtp(false);
            return;
        }

        setMostrarOtp(false);
        const accion = pendingOtpAction;
        setPendingOtpAction(null);

        if (accion.tipo === "novedad") {
            await ejecutarActualizacionNovedad(accion.payload);
            return;
        }

        if (accion.tipo === "eliminar_movimiento") {
            await ejecutarEliminacionMovimiento(accion.payload);
            return;
        }

        if (accion.tipo === "movimiento_sin_gasto") {
            success("Registro guardado sin gastos para esta novedad");
            limpiarFormularioMovimiento();
            setNovedadMovimientos(null);
            return;
        }

        await ejecutarGuardadoMovimiento(accion.payload);
    };

    return (
        <div style={{ padding: "8px 10px", maxWidth: "1200px", margin: "0 auto" }}>

            <h1 style={{ color: "#1d3554", marginBottom: "8px" }}>Reporte de novedades</h1>
            <p style={{ color: "#64748b", marginBottom: "24px" }}>
                Consulta novedades registradas y revisa sus movimientos asociados en detalle.
            </p>

            {error && (
                <div style={{ marginBottom: "16px", padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px" }}>
                    {error}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                <Card title="Total novedades" value={novedades.length} />
                <Card title="Mantenimiento" value={resumenTipos.MANTENIMIENTO} />
                <Card title="Reparación" value={resumenTipos.REPARACION} />
                <Card title="Cambio tecnología" value={resumenTipos.CAMBIO_TECNOLOGIA} />
            </div>

            <section style={panelStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "12px", marginBottom: "14px" }}>
                    <input
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por lámpara, id u observación..."
                        style={inputStyle}
                    />

                    <select
                        value={tipoFiltro}
                        onChange={(e) => setTipoFiltro(e.target.value)}
                        style={inputStyle}
                    >
                        <option value="todas">Todos los tipos</option>
                        <option value="MANTENIMIENTO">Mantenimiento</option>
                        <option value="REPARACION">Reparación</option>
                        <option value="CAMBIO_TECNOLOGIA">Cambio de tecnología</option>
                        <option value="INSTALACION">Instalación</option>
                    </select>
                </div>

                {loading ? (
                    <p style={mutedText}>Cargando novedades...</p>
                ) : novedadesFiltradas.length === 0 ? (
                    <p style={mutedText}>No hay novedades para los filtros seleccionados.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr style={tableHeaderRowStyle}>
                                    <th style={thStyle}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                            ID
                                            <button
                                                type="button"
                                                title={ordenNovedades === "asc" ? "Orden actual: ascendente" : "Orden actual: descendente"}
                                                onClick={() => setOrdenNovedades((prev) => (prev === "asc" ? "desc" : "asc"))}
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
                                                    <span style={{ fontSize: "9px" }}>{ordenNovedades === "asc" ? "↓" : "↑"}</span>
                                                </span>
                                            </button>
                                        </span>
                                    </th>
                                    <th style={thStyle}>Lámpara</th>
                                    <th style={thStyle}>Tipo</th>
                                    <th style={thStyle}>Fecha</th>
                                    <th style={thStyle}>Movimientos</th>
                                    <th style={thStyle}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {novedadesOrdenadas.map((n) => {
                                    const movimientos = movimientosPorNovedad.get(Number(n.id_novedad)) || [];
                                    const lamparaLabel = n.numero_lampara || "Sin lámpara asociada";
                                    return (
                                        <tr key={n.id_novedad} style={tableRowStyle}>
                                            <td style={tdStyle}>#{n.id_novedad}</td>
                                            <td style={tdStyle}>{lamparaLabel}</td>
                                            <td style={tdStyle}>{n.tipo_novedad || "-"}</td>
                                            <td style={tdStyle}>{formatDate(n.fecha_novedad)}</td>
                                            <td style={tdStyle}>{movimientos.length}</td>
                                            <td style={tdStyle}>
                                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setNovedadDetalle(n)}
                                                        style={buttonDetailStyle}
                                                    >
                                                        Ver detalle
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => abrirEditorMovimientos(n)}
                                                        title="Abrir formulario protegido con OTP"
                                                        style={buttonEditStyle}
                                                    >
                                                        Modificar con OTP
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {novedadDetalle && (
                <div style={overlayStyle} onClick={() => setNovedadDetalle(null)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
                            <div>
                                <h2 style={{ margin: 0, color: "#0a5c6d" }}>Detalle novedad #{novedadDetalle.id_novedad}</h2>
                                <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                                    Lámpara {novedadDetalle.numero_lampara || "Sin lámpara asociada"} · {novedadDetalle.tipo_novedad || "-"}
                                </p>
                            </div>
                            <button type="button" onClick={() => setNovedadDetalle(null)} style={closeStyle}>×</button>
                        </div>

                        <div style={{ marginBottom: "16px", fontSize: "13px", color: "#334155" }}>
                            <div><strong>Fecha:</strong> {formatDate(novedadDetalle.fecha_novedad)}</div>
                            <div><strong>PQR:</strong> {contextoDetalleNovedad.pqr}</div>
                            <div><strong>Electricista:</strong> {contextoDetalleNovedad.electricista}</div>
                            <div><strong>Observación:</strong> {contextoDetalleNovedad.observacion}</div>
                        </div>

                        <h3 style={{ color: "#0f7c90", marginBottom: "10px" }}>Movimientos asociados ({movimientosDetalle.length})</h3>

                        {movimientosDetalle.length === 0 ? (
                            <p style={mutedText}>Esta novedad no tiene movimientos de inventario asociados.</p>
                        ) : (
                            <>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={tableStyle}>
                                        <thead>
                                            <tr style={tableHeaderRowStyle}>
                                                <th style={thStyle}>Fecha</th>
                                                <th style={thStyle}>
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
                                                <th style={thStyle}>Tipo mov.</th>
                                                <th style={thStyle}>Cantidad</th>
                                                <th style={thStyle}>Electricista</th>
                                                <th style={thStyle}>Costo unit.</th>
                                                <th style={thStyle}>Costo total</th>
                                                <th style={thStyle}>PQR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {movimientosDetalle.map((g) => (
                                                <tr key={g.id_gasto} style={tableRowStyle}>
                                                    <td style={tdStyle}>{formatDate(g.fecha || g.fecha_registro)}</td>
                                                    <td style={tdStyle}>{g.elemento || "-"}</td>
                                                    <td style={tdStyle}>{g.tipo_movimiento || "-"}</td>
                                                    <td style={tdStyle}>{g.cantidad_usada || 0}</td>
                                                    <td style={tdStyle}>{g.nombre_electricista || g.id_electricista || "-"}</td>
                                                    <td style={tdStyle}>${formatCurrency(g.costo_unitario)}</td>
                                                    <td style={{ ...tdStyle, color: getCostoTotalMovimiento(g) < 0 ? "#b91c1c" : "#0f172a" }}>
                                                        ${formatCurrency(getCostoTotalMovimiento(g))}
                                                    </td>
                                                    <td style={tdStyle}>{g.codigo_pqr || "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ marginTop: "12px", padding: "12px", borderRadius: "8px", background: "#f0f9ff", borderLeft: "4px solid #0f7c90" }}>
                                    <div style={{ fontSize: "12px", color: "#475569" }}>Costo neto de movimientos de esta novedad</div>
                                    <div style={{ fontSize: "18px", color: "#0f7c90", fontWeight: "bold" }}>${formatCurrency(totalDetalle)}</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {novedadMovimientos && (
                <div style={overlayStyle} onClick={cerrarEditorMovimientos}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
                            <div>
                                <h2 style={{ margin: 0, color: "#0a5c6d" }}>Modificar novedad #{novedadMovimientos.id_novedad}</h2>
                                <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                                    Lámpara {novedadMovimientos.numero_lampara || "Sin lámpara"} · La información de esta novedad se cargó en el formulario para que la modifiques con OTP.
                                </p>
                            </div>
                            <button type="button" onClick={cerrarEditorMovimientos} style={closeStyle} disabled={submitMovimientoLoading || submitNovedadLoading || deleteMovimientoLoadingId !== null}>×</button>
                        </div>

                        <form onSubmit={handleSubmitNovedad} style={{ marginBottom: "16px", padding: "12px", border: "1px solid #dbeafe", borderRadius: "10px", background: "#f8fbff" }}>
                            <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#0f7c90" }}>Datos de la novedad</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                                <div>
                                    <label style={labelStyle}>Número de lámpara *</label>
                                    <input
                                        type="text"
                                        name="numero_lampara"
                                        value={formNovedad.numero_lampara}
                                        onChange={handleChangeNovedad}
                                        style={inputStyle}
                                        disabled={submitNovedadLoading}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Fecha de novedad *</label>
                                    <input
                                        type="date"
                                        name="fecha_novedad"
                                        value={formNovedad.fecha_novedad}
                                        onChange={handleChangeNovedad}
                                        style={inputStyle}
                                        disabled={submitNovedadLoading}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                                <div>
                                    <label style={labelStyle}>Tipo de novedad *</label>
                                    <select
                                        name="tipo_novedad"
                                        value={formNovedad.tipo_novedad}
                                        onChange={handleChangeNovedad}
                                        style={inputStyle}
                                        disabled={submitNovedadLoading}
                                        required
                                    >
                                        {OPCIONES_TIPO_NOVEDAD.map((tipo) => (
                                            <option key={tipo} value={tipo}>{tipo.replace("_", " ")}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Electricista responsable *</label>
                                    <select
                                        name="id_electricista"
                                        value={formNovedad.id_electricista}
                                        onChange={handleChangeNovedad}
                                        style={inputStyle}
                                        disabled={submitNovedadLoading}
                                        required
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
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                                <div>
                                    <label style={labelStyle}>Código PQR *</label>
                                    <input
                                        type="text"
                                        name="codigo_pqr"
                                        value={formNovedad.codigo_pqr}
                                        onChange={handleChangeNovedad}
                                        style={inputStyle}
                                        disabled={submitNovedadLoading}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Observación</label>
                                    <input
                                        type="text"
                                        name="observacion"
                                        value={formNovedad.observacion}
                                        onChange={handleChangeNovedad}
                                        style={inputStyle}
                                        disabled={submitNovedadLoading}
                                    />
                                </div>
                            </div>

                            {formNovedad.tipo_novedad === "CAMBIO_TECNOLOGIA" && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                                    <div>
                                        <label style={labelStyle}>Tecnología anterior *</label>
                                        <select
                                            name="tecnologia_anterior"
                                            value={formNovedad.tecnologia_anterior}
                                            onChange={handleChangeNovedad}
                                            style={inputStyle}
                                            disabled={submitNovedadLoading}
                                            required
                                        >
                                            <option value="">Seleccione</option>
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
                                            style={inputStyle}
                                            disabled={submitNovedadLoading}
                                            required
                                        >
                                            <option value="">Seleccione</option>
                                            {OPCIONES_TECNOLOGIA.map((opcion) => (
                                                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {novedadError && <div style={errorTextStyle}>{novedadError}</div>}

                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button type="submit" style={buttonSaveStyle} disabled={submitNovedadLoading}>
                                    {submitNovedadLoading ? "Guardando..." : "Guardar cambios con OTP"}
                                </button>
                            </div>
                        </form>

                        <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f7c90" }}>Gastos registrados en esta novedad</h3>
                        {movimientosEdicion.length === 0 ? (
                            <p style={{ ...mutedText, marginTop: 0, marginBottom: "16px" }}>Esta novedad no tiene gastos registrados.</p>
                        ) : (
                            <div style={{ overflowX: "auto", marginBottom: "16px" }}>
                                <table style={tableStyle}>
                                    <thead>
                                        <tr style={tableHeaderRowStyle}>
                                            <th style={thStyle}>Fecha</th>
                                            <th style={thStyle}>Elemento</th>
                                            <th style={thStyle}>Tipo</th>
                                            <th style={thStyle}>Cantidad</th>
                                            <th style={thStyle}>PQR</th>
                                            <th style={thStyle}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movimientosEdicion.map((mov) => (
                                            <tr key={mov.id_gasto} style={tableRowStyle}>
                                                <td style={tdStyle}>{formatDate(mov.fecha || mov.fecha_registro)}</td>
                                                <td style={tdStyle}>{mov.elemento || "-"}</td>
                                                <td style={tdStyle}>{mov.tipo_movimiento || "-"}</td>
                                                <td style={tdStyle}>{mov.cantidad_usada || 0}</td>
                                                <td style={tdStyle}>{mov.codigo_pqr || "-"}</td>
                                                <td style={tdStyle}>
                                                    <button
                                                        type="button"
                                                        onClick={() => solicitarEliminarMovimientoConOtp(mov)}
                                                        disabled={submitMovimientoLoading || submitNovedadLoading || deleteMovimientoLoadingId !== null}
                                                        style={{
                                                            ...buttonDeleteStyle,
                                                            opacity: deleteMovimientoLoadingId === Number(mov.id_gasto) ? 0.7 : 1,
                                                            cursor: submitMovimientoLoading || submitNovedadLoading || deleteMovimientoLoadingId !== null ? "not-allowed" : "pointer"
                                                        }}
                                                    >
                                                        {deleteMovimientoLoadingId === Number(mov.id_gasto) ? "Eliminando..." : "Eliminar con OTP"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f7c90" }}>Agregar gasto inicial (opcional)</h3>

                        <form onSubmit={handleSubmitMovimiento}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <label style={labelStyle}>Tipo de movimiento *</label>
                                        <select
                                            name="tipo_movimiento"
                                            value={formMovimiento.tipo_movimiento}
                                            onChange={handleChangeMovimiento}
                                            style={inputStyle}
                                            disabled={submitMovimientoLoading}
                                            required
                                        >
                                            <option value="DESPACHADO">Despachado</option>
                                            <option value="PRESTADO">Prestado</option>
                                            <option value="MATERIAL_EXCEDENTE">Material excedente</option>
                                            <option value="DEVOLUCION">Devolución</option>
                                            <option value="ENTRADA">Entrada</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Electricista responsable *</label>
                                        <select
                                            name="id_electricista"
                                            value={formMovimiento.id_electricista}
                                            onChange={handleChangeMovimiento}
                                            style={inputStyle}
                                            disabled={submitMovimientoLoading}
                                            required={!permitirGastoVacio || hayDatosEnFilas}
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
                                        {formMovimiento.id_electricista && (() => {
                                            const seleccionado = electricistas.find(
                                                (e) => String(e.id_electricista) === String(formMovimiento.id_electricista)
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
                                        value={formMovimiento.codigo_pqr}
                                        onChange={handleChangeMovimiento}
                                        style={inputStyle}
                                        disabled={submitMovimientoLoading}
                                        placeholder="Ej: PQR-12345"
                                        required={!permitirGastoVacio || hayDatosEnFilas}
                                    />
                                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#64748b" }}>
                                        Sugerido: {siguienteCodigoPqr}. Este consecutivo se calcula con movimientos reales, no con el ID de novedad.
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>Observación</label>
                                    <textarea
                                        name="observacion"
                                        value={formMovimiento.observacion}
                                        onChange={handleChangeMovimiento}
                                        style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                                        disabled={submitMovimientoLoading}
                                        placeholder="Detalles adicionales..."
                                    />
                                </div>
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                                        <label style={{ ...labelStyle, marginBottom: 0 }}>Elementos de inventario *</label>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPermitirGastoVacio((prev) => !prev);
                                                    setItemError("");
                                                }}
                                                disabled={submitMovimientoLoading}
                                                title="Desactiva la validación de gastos vacíos para este registro"
                                                style={{
                                                    borderRadius: "8px",
                                                    border: "1px solid #1e78bd",
                                                    background: permitirGastoVacio ? "#1e78bd" : "white",
                                                    color: permitirGastoVacio ? "white" : "#1e78bd",
                                                    padding: "8px 10px",
                                                    cursor: submitMovimientoLoading ? "not-allowed" : "pointer",
                                                    opacity: submitMovimientoLoading ? 0.6 : 1,
                                                    fontWeight: 600,
                                                    fontSize: "11px"
                                                }}
                                            >
                                                {permitirGastoVacio ? "Sin gasto: activo" : "Sin gasto"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={agregarFilaGasto}
                                                disabled={submitMovimientoLoading}
                                                style={{
                                                    padding: "8px 12px",
                                                    background: "#1e78bd",
                                                    color: "white",
                                                    border: "none",
                                                    borderRadius: "8px",
                                                    cursor: submitMovimientoLoading ? "not-allowed" : "pointer",
                                                    fontWeight: 600,
                                                    fontSize: "12px",
                                                    opacity: submitMovimientoLoading ? 0.6 : 1
                                                }}
                                            >
                                                Agregar fila
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ overflowX: "auto", border: "1px solid #dbe5ef", borderRadius: "10px" }}>
                                        <table style={{ width: "100%", minWidth: "700px", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
                                            <colgroup>
                                                <col style={{ width: "24%" }} />
                                                <col style={{ width: "44%" }} />
                                                <col style={{ width: "14%" }} />
                                                <col style={{ width: "18%" }} />
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
                                                                disabled={submitMovimientoLoading}
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
                                                                disabled={submitMovimientoLoading}
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
                                                                disabled={submitMovimientoLoading || filasGasto.length === 1}
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
                                    {permitirGastoVacio && !hayDatosEnFilas && (
                                        <div style={{ marginTop: "6px", fontSize: "12px", color: "#0f7c90" }}>
                                            Validación de gastos vacíos desactivada para este registro.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {itemError && (
                                <div style={errorTextStyle}>{itemError}</div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                                <button type="button" onClick={cerrarEditorMovimientos} style={buttonCancelStyle} disabled={submitMovimientoLoading}>
                                    Cerrar
                                </button>
                                <button type="submit" style={buttonSaveStyle} disabled={submitMovimientoLoading}>
                                    {submitMovimientoLoading ? "Guardando..." : "Agregar gasto"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <OtpModal
                isOpen={mostrarOtp}
                onClose={() => {
                    setMostrarOtp(false);
                    setPendingOtpAction(null);
                }}
                onVerificado={handleOtpVerificado}
            />
        </div>
    );
}

function Card({ title, value }) {
    return (
        <div style={{
            background: "white",
            padding: "14px",
            borderRadius: "10px",
            boxShadow: "0 6px 16px rgba(16, 55, 86, 0.08)",
            border: "1px solid #d9e3ee"
        }}>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>{title}</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0f7c90" }}>{value}</div>
        </div>
    );
}

function formatDate(value) {
    const isoDate = toIsoDateString(value);
    if (!isoDate) return "";

    const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
    const dateUtc = new Date(Date.UTC(year, month - 1, day));

    return new Intl.DateTimeFormat("es-CO", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC"
    }).format(dateUtc);
}

function formatCurrency(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}

function formatDateForInput(value) {
    return toIsoDateString(value);
}

function toIsoDateString(value) {
    if (!value) return "";

    const texto = String(value).trim();
    const match = texto.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
        return match[1];
    }

    const parsed = new Date(texto);
    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const panelStyle = {
    background: "white",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 6px 16px rgba(16, 55, 86, 0.08)",
    border: "1px solid #d9e3ee"
};

const mutedText = { color: "#94a3b8" };

const inputStyle = {
    width: "100%",
    padding: "9px 10px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "13px",
    boxSizing: "border-box"
};

const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "13px" };
const tableHeaderRowStyle = { borderBottom: "2px solid #e2e8f0", background: "#f8fafc" };
const tableRowStyle = { borderBottom: "1px solid #e2e8f0" };
const thStyle = { padding: "8px 10px", textAlign: "left", color: "#0a5c6d" };
const tdStyle = { padding: "8px 10px", color: "#475569" };
const labelStyle = { display: "block", marginBottom: "6px", fontSize: "12px", color: "#334155", fontWeight: "600" };
const errorTextStyle = { marginTop: "6px", fontSize: "12px", color: "#dc2626" };
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

const buttonDetailStyle = {
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    background: "#1e78bd",
    color: "white",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600"
};

const buttonEditStyle = {
    border: "1px solid #1e78bd",
    borderRadius: "6px",
    padding: "6px 10px",
    background: "white",
    color: "#1e78bd",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600"
};

const buttonDeleteStyle = {
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "6px 10px",
    background: "#fff1f2",
    color: "#b91c1c",
    fontSize: "12px",
    fontWeight: "600"
};

const buttonCancelStyle = {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "8px 12px",
    background: "white",
    color: "#334155",
    cursor: "pointer",
    fontSize: "13px"
};

const buttonSaveStyle = {
    border: "none",
    borderRadius: "8px",
    padding: "8px 12px",
    background: "#1e78bd",
    color: "white",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600"
};

const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: "16px"
};

const modalStyle = {
    width: "min(980px, 100%)",
    maxHeight: "88vh",
    overflow: "auto",
    background: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 15px 30px rgba(0,0,0,0.2)"
};

const closeStyle = {
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: "28px",
    lineHeight: 1,
    cursor: "pointer"
};
