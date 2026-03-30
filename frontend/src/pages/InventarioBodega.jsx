import { useState, useEffect, useMemo } from "react";
import { createLote, getInventario, getHistorialElemento, updateElemento } from "../api/inventario.api";
import { getGastos } from "../api/gastos.api";
import { getUiConfig } from "../api/config.api";
import { useNotification } from "../hooks/useNotification";
import OtpModal from "../components/OtpModal";
import { UMBRAL_STOCK_BAJO } from "../constants/inventario";
import { getCostoTotalMovimiento } from "../utils/gastos";
import * as XLSX from "xlsx";

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

const getToday = () => new Date().toISOString().split("T")[0];

const createIngresoRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    codigo: "",
    material: "#N/D",
    cantidad: "",
    numero_orden: "",
    costo_unitario: ""
});

const normalizarOrden = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const sinPrefijo = raw.replace(/^orden\s*:\s*/i, "").trim();
    if (/^\d+$/.test(sinPrefijo)) {
        const padded = sinPrefijo.padStart(3, "0");
        return `ORDEN: ${padded}`;
    }
    return raw;
};

const normalizarOrdenParaComparar = (value) => {
    const normalizada = normalizarOrden(value);
    return String(normalizada || "").trim().toUpperCase();
};

const extraerNumeroOrden = (value) => {
    const normalizada = normalizarOrden(value);
    const contenido = String(normalizada || "").replace(/^ORDEN\s*:\s*/i, "").trim();
    if (!/^\d+$/.test(contenido)) {
        return null;
    }
    return Number.parseInt(contenido, 10);
};

const normalizarFechaInput = (value) => {
    const fecha = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return null;
    }

    const [year, month, day] = fecha.split("-").map((part) => Number.parseInt(part, 10));
    const fechaUtc = new Date(Date.UTC(year, month - 1, day));
    if (
        Number.isNaN(fechaUtc.getTime())
        || fechaUtc.getUTCFullYear() !== year
        || fechaUtc.getUTCMonth() !== month - 1
        || fechaUtc.getUTCDate() !== day
    ) {
        return null;
    }

    return fecha;
};

const extraerFechaIsoDesdeValor = (value) => {
    if (!value) {
        return null;
    }

    const texto = String(value).trim();
    const match = texto.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) {
        return null;
    }

    return normalizarFechaInput(match[1]);
};

const formatFechaSinDesfase = (value) => {
    const fecha = extraerFechaIsoDesdeValor(value);
    if (!fecha) {
        return "-";
    }

    const [year, month, day] = fecha.split("-").map((part) => Number.parseInt(part, 10));
    const fechaUtc = new Date(Date.UTC(year, month - 1, day));

    return new Intl.DateTimeFormat("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC"
    }).format(fechaUtc);
};

export default function InventarioBodega() {
    const [inventario, setInventario] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [umbralStockBajo, setUmbralStockBajo] = useState(UMBRAL_STOCK_BAJO);
    const [busqueda, setBusqueda] = useState("");
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [historialModal, setHistorialModal] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [ordenCodigo, setOrdenCodigo] = useState("asc");
    const [mostrarOtp, setMostrarOtp] = useState(false);
    const [mostrarEditorElemento, setMostrarEditorElemento] = useState(false);
    const [mostrarIngresoModal, setMostrarIngresoModal] = useState(false);
    const [busquedaEdicion, setBusquedaEdicion] = useState("");
    const [editandoElemento, setEditandoElemento] = useState(null);
    const [editData, setEditData] = useState({ elemento: "", costo_unitario: "" });
    const [filasIngreso, setFilasIngreso] = useState([createIngresoRow()]);
    const [fechaIngresoGlobal, setFechaIngresoGlobal] = useState(getToday());
    const [pendingEditPayload, setPendingEditPayload] = useState(null);
    const [saveEditLoading, setSaveEditLoading] = useState(false);
    const { success, error: errorNotification } = useNotification();

    const inventarioConsolidado = useMemo(() => {
        const mapa = new Map();

        (inventario || []).forEach((item) => {
            const codigo = String(item.codigo_elemento || "").trim().toUpperCase();
            if (!codigo) {
                return;
            }

            if (!mapa.has(codigo)) {
                const lotes = Array.isArray(item.id_lotes) && item.id_lotes.length > 0
                    ? item.id_lotes
                    : [item.id_lote];

                mapa.set(codigo, {
                    ...item,
                    codigo_elemento: codigo,
                    id_lotes: lotes,
                    cantidad: Number(item.cantidad || 0),
                    entrada: Number(item.entrada || 0),
                    devolucion: Number(item.devolucion || 0),
                    despachado: Number(item.despachado || 0),
                    prestamo: Number(item.prestamo || 0),
                    cantidad_gastada: Number(item.cantidad_gastada || 0),
                    stock_disponible: Number(item.stock_disponible || 0),
                });
                return;
            }

            const actual = mapa.get(codigo);
            const idLoteActual = Number(actual.id_lote || 0);
            const idLoteNuevo = Number(item.id_lote || 0);
            const representativo = idLoteNuevo > idLoteActual ? item : actual;
            const lotesActuales = Array.isArray(actual.id_lotes) ? actual.id_lotes : [actual.id_lote];
            const lotesNuevos = Array.isArray(item.id_lotes) ? item.id_lotes : [item.id_lote];

            mapa.set(codigo, {
                ...actual,
                ...representativo,
                codigo_elemento: codigo,
                id_lotes: [...lotesActuales, ...lotesNuevos],
                cantidad: Number(actual.cantidad || 0) + Number(item.cantidad || 0),
                entrada: Number(actual.entrada || 0) + Number(item.entrada || 0),
                devolucion: Number(actual.devolucion || 0) + Number(item.devolucion || 0),
                despachado: Number(actual.despachado || 0) + Number(item.despachado || 0),
                prestamo: Number(actual.prestamo || 0) + Number(item.prestamo || 0),
                cantidad_gastada: Number(actual.cantidad_gastada || 0) + Number(item.cantidad_gastada || 0),
                stock_disponible: Number(actual.stock_disponible || 0) + Number(item.stock_disponible || 0),
            });
        });

        return Array.from(mapa.values());
    }, [inventario]);

    const catalogoPorCodigo = useMemo(() => {
        const mapa = new Map();
        (inventario || []).forEach((item) => {
            const codigo = String(item.codigo_elemento || "").trim().toUpperCase();
            if (!codigo) {
                return;
            }

            const existente = mapa.get(codigo);
            if (!existente || Number(item.id_lote || 0) > Number(existente.id_lote || 0)) {
                mapa.set(codigo, item);
            }
        });
        return mapa;
    }, [inventario]);

    const ordenesExistentes = useMemo(() => {
        const set = new Set();
        (gastos || []).forEach((gasto) => {
            if (String(gasto.tipo_movimiento || "").toUpperCase() !== "ENTRADA") {
                return;
            }
            const orden = normalizarOrdenParaComparar(gasto.numero_orden);
            if (orden) {
                set.add(orden);
            }
        });
        return set;
    }, [gastos]);

    const ultimoNumeroOrdenGuardado = useMemo(() => {
        let ultimo = null;
        ordenesExistentes.forEach((orden) => {
            const numero = extraerNumeroOrden(orden);
            if (Number.isInteger(numero) && numero >= 0) {
                if (ultimo === null || numero > ultimo) {
                    ultimo = numero;
                }
            }
        });
        return ultimo;
    }, [ordenesExistentes]);

    useEffect(() => {
        cargarInventario();
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

    const cargarInventario = async () => {
        try {
            const [dataInventario, dataGastos] = await Promise.all([
                getInventario(),
                getGastos()
            ]);

            const inventarioSeguro = Array.isArray(dataInventario) ? dataInventario : [];
            const gastosSeguro = Array.isArray(dataGastos) ? dataGastos : [];

            setInventario(inventarioSeguro);
            setGastos(gastosSeguro);
            console.log(`📊 Inventario cargado: ${inventarioSeguro.length} elementos | Gastos: ${gastosSeguro.length}`);
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
            
            // En el nuevo modelo simplificado, usamos directamente el codigo_elemento (codigo_producto)
            const codigoProducto = item.codigo_elemento;
            
            const historialData = await getHistorialElemento(codigoProducto);

            const data = Array.isArray(historialData) ? 
                historialData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) 
                : [];

            setHistorial(data);
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

    const abrirIngresoModal = () => {
        const hoy = getToday();
        const siguienteOrden = normalizarOrden(String((ultimoNumeroOrdenGuardado ?? -1) + 1));
        setFechaIngresoGlobal(hoy);
        setFilasIngreso([{ ...createIngresoRow(), numero_orden: siguienteOrden }]);
        setMostrarIngresoModal(true);
    };

    const cerrarIngresoModal = () => {
        if (formLoading) {
            return;
        }
        setMostrarIngresoModal(false);
    };

    const agregarFilaIngreso = () => {
        setFilasIngreso((prev) => {
            const ordenGlobal = prev[0]?.numero_orden || "";
            return [...prev, { ...createIngresoRow(), numero_orden: ordenGlobal }];
        });
    };

    const eliminarFilaIngreso = (rowId) => {
        setFilasIngreso((prev) => {
            if (prev.length === 1) {
                return prev;
            }
            return prev.filter((row) => row.id !== rowId);
        });
    };

    const actualizarFilaIngreso = (rowId, field, rawValue) => {
        if (field === "numero_orden") {
            const value = String(rawValue || "");
            setFilasIngreso((prev) => prev.map((row) => ({ ...row, numero_orden: value })));
            return;
        }

        setFilasIngreso((prev) => prev.map((row) => {
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
            if (field === "costo_unitario") {
                value = String(rawValue || "").replace(/[^0-9.,]/g, "");
            }

            const nextRow = { ...row, [field]: value };

            if (field === "codigo") {
                const encontrado = catalogoPorCodigo.get(value);
                if (encontrado) {
                    nextRow.material = String(encontrado.elemento || "").trim() || "#N/D";
                    if (!String(nextRow.costo_unitario || "").trim()) {
                        const costo = Number(encontrado.costo_unitario || 0);
                        nextRow.costo_unitario = Number.isFinite(costo)
                            ? costo.toFixed(2).replace(".", ",")
                            : "";
                    }
                } else {
                    nextRow.material = "#N/D";
                }
            }

            return nextRow;
        }));
    };

    const normalizarOrdenFila = (rowId) => {
        setFilasIngreso((prev) => {
            const fila = prev.find((row) => row.id === rowId);
            const ordenNormalizada = normalizarOrden(fila?.numero_orden || "");
            return prev.map((row) => ({ ...row, numero_orden: ordenNormalizada }));
        });
    };

    const handleFechaIngresoGlobalChange = (e) => {
        setFechaIngresoGlobal(e.target.value);
    };

    const guardarIngresos = async () => {
        if (!Array.isArray(filasIngreso) || filasIngreso.length === 0) {
            errorNotification("Agrega al menos una fila para guardar");
            return;
        }

        if (!String(fechaIngresoGlobal || "").trim()) {
            errorNotification("Debes seleccionar una fecha de compra para guardar");
            return;
        }

        const fechaCompraNormalizada = normalizarFechaInput(fechaIngresoGlobal);
        if (!fechaCompraNormalizada) {
            errorNotification("La fecha de compra no es válida");
            return;
        }

        const filasNormalizadas = filasIngreso.map((row) => ({
            ...row,
            codigo: String(row.codigo || "").trim().toUpperCase(),
            numero_orden: normalizarOrden(row.numero_orden)
        }));

        for (let i = 0; i < filasNormalizadas.length; i += 1) {
            const row = filasNormalizadas[i];
            const fila = i + 1;

            if (!row.codigo) {
                errorNotification(`Fila ${fila}: el código es obligatorio`);
                return;
            }

            const codigoValido = catalogoPorCodigo.has(row.codigo);
            if (!codigoValido) {
                errorNotification(`Fila ${fila}: el código no existe en el inventario`);
                return;
            }

            if (!String(row.material || "").trim() || row.material === "#N/D") {
                errorNotification(`Fila ${fila}: el material no es válido`);
                return;
            }

            if (!String(row.cantidad || "").trim()) {
                errorNotification(`Fila ${fila}: la cantidad es obligatoria`);
                return;
            }

            if (Number.parseInt(row.cantidad, 10) <= 0) {
                errorNotification(`Fila ${fila}: la cantidad debe ser mayor a 0`);
                return;
            }

            if (!String(row.numero_orden || "").trim()) {
                errorNotification(`Fila ${fila}: el número de orden es obligatorio`);
                return;
            }

            if (!String(row.costo_unitario || "").trim()) {
                errorNotification(`Fila ${fila}: el costo unitario es obligatorio`);
                return;
            }

            if (parseCurrency(row.costo_unitario) <= 0) {
                errorNotification(`Fila ${fila}: el costo unitario debe ser mayor a 0`);
                return;
            }
        }

        const ordenGlobal = normalizarOrdenParaComparar(filasNormalizadas[0]?.numero_orden || "");
        const ordenGlobalNumero = extraerNumeroOrden(ordenGlobal);

        const filaConOrdenDiferente = filasNormalizadas.find(
            (row) => normalizarOrdenParaComparar(row.numero_orden) !== ordenGlobal
        );
        if (filaConOrdenDiferente) {
            errorNotification("Todas las filas deben tener el mismo número de orden");
            return;
        }

        if (!Number.isInteger(ordenGlobalNumero) || ordenGlobalNumero < 0) {
            errorNotification("El número de orden no es válido");
            return;
        }

        if (ordenesExistentes.has(ordenGlobal)) {
            errorNotification(`La orden ${ordenGlobal} ya existe en el inventario`);
            return;
        }

        // Primera orden debe ser 0 (Orden: 000), luego consecutivas
        const esperado = (ultimoNumeroOrdenGuardado ?? -1) + 1;
        if (ordenGlobalNumero !== esperado) {
            errorNotification(`La orden debe ser consecutiva. Debe ser ORDEN: ${String(esperado).padStart(3, "0")}`);
            return;
        }

        try {
            setFormLoading(true);
            const fechaCompra = fechaCompraNormalizada;
            const anioCompra = Number.parseInt(String(fechaCompra).slice(0, 4), 10) || new Date().getFullYear();

            for (let i = 0; i < filasNormalizadas.length; i += 1) {
                const row = filasNormalizadas[i];
                await createLote({
                    codigo_producto: row.codigo,
                    numero_orden: ordenGlobal,
                    anio_compra: anioCompra,
                    precio_unitario: parseCurrency(row.costo_unitario),
                    cantidad: Number.parseInt(row.cantidad, 10),
                    fecha_compra: fechaCompra
                });
            }

            success(`Se registraron ${filasNormalizadas.length} ingresos correctamente`);
            setMostrarIngresoModal(false);
            setFilasIngreso([createIngresoRow()]);
            await cargarInventario();
        } catch (err) {
            console.error("Error registrando ingresos:", err);
            errorNotification(err?.error || err?.message || "No se pudieron registrar los ingresos");
        } finally {
            setFormLoading(false);
        }
    };

    const calcularCostoTotal = () => {
        return (inventarioConsolidado || []).reduce((total, item) => {
        return total + (item.cantidad * item.costo_unitario);
        }, 0);
    };

    const calcularTotalGastado = () => {
        return (inventarioConsolidado || []).reduce((total, item) => {
            const cantidadGastada = Number(item.cantidad_gastada || 0);
            const costoUnitario = Number(item.costo_unitario || 0);
            return total + (cantidadGastada * costoUnitario);
        }, 0);
    };

    const inventarioFiltrado = useMemo(() => {
        const termino = busqueda.toLowerCase();
        const filtrado = (inventarioConsolidado || []).filter((item) => {
            return (
                item.codigo_elemento?.toLowerCase().includes(termino) ||
                item.elemento?.toLowerCase().includes(termino)
            );
        });

        console.log(`🔍 Consolidado: ${(inventarioConsolidado || []).length} | Búsqueda: "${busqueda}" | Filtrado: ${filtrado.length}`);

        return filtrado.sort((a, b) => {
            const codigoA = String(a.codigo_elemento || "").toLowerCase();
            const codigoB = String(b.codigo_elemento || "").toLowerCase();
            const comparacion = codigoA.localeCompare(codigoB, "es", { numeric: true, sensitivity: "base" });
            return ordenCodigo === "asc" ? comparacion : -comparacion;
        });
    }, [inventarioConsolidado, busqueda, ordenCodigo]);

    const exportarInventarioExcel = () => {
        if (inventarioFiltrado.length === 0) {
            errorNotification("No hay datos para exportar con los filtros actuales");
            return;
        }

        const dataExcel = inventarioFiltrado.map((item) => {
            const stockDisponible = Number(item.stock_disponible || 0);
            return {
                "Código": item.codigo_elemento || "",
                "Material": item.elemento || "",
                "Número de orden": item.numero_orden || "",
                "Inicial": Number(item.cantidad || 0),
                "Recibe": Number(item.entrada || 0),
                "Devolución": Number(item.devolucion || 0),
                "Gastado PQR": Number(item.despachado || 0),
                "Préstamo": Number(item.prestamo || 0),
                "Unid. existentes inventario": stockDisponible,
                "Costo unitario": Number(item.costo_unitario || 0),
                "Valor final": stockDisponible * Number(item.costo_unitario || 0)
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataExcel);

        const formatoMoneda = '"$" #,##0.00';
        for (let rowIndex = 0; rowIndex < dataExcel.length; rowIndex += 1) {
            const rowExcel = rowIndex + 1;
            const cellCostoUnitario = XLSX.utils.encode_cell({ r: rowExcel, c: 9 });
            const cellValorFinal = XLSX.utils.encode_cell({ r: rowExcel, c: 10 });

            if (ws[cellCostoUnitario]) {
                ws[cellCostoUnitario].t = "n";
                ws[cellCostoUnitario].z = formatoMoneda;
            }

            if (ws[cellValorFinal]) {
                ws[cellValorFinal].t = "n";
                ws[cellValorFinal].z = formatoMoneda;
            }
        }

        ws["!cols"] = [
            { wch: 16 },
            { wch: 40 },
            { wch: 18 },
            { wch: 10 },
            { wch: 10 },
            { wch: 12 },
            { wch: 12 },
            { wch: 10 },
            { wch: 24 },
            { wch: 14 },
            { wch: 14 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");

        const fecha = new Date().toISOString().split("T")[0];
        XLSX.writeFile(wb, `inventario_${fecha}.xlsx`);
        success("Inventario exportado a Excel");
    };

    const abrirEdicionElemento = (item) => {
        setEditandoElemento(item);
        setEditData({
            elemento: String(item.elemento || ""),
            costo_unitario: String(Number(item.costo_unitario || 0))
        });
    };

    const abrirEditorGlobal = () => {
        setMostrarEditorElemento(true);
        setBusquedaEdicion("");
        setEditandoElemento(null);
        setEditData({ elemento: "", costo_unitario: "" });
    };

    const cerrarEditorGlobal = () => {
        if (saveEditLoading) {
            return;
        }
        setMostrarEditorElemento(false);
        setBusquedaEdicion("");
        setEditandoElemento(null);
        setEditData({ elemento: "", costo_unitario: "" });
    };

    const itemsParaEdicion = useMemo(() => {
        const termino = String(busquedaEdicion || "").toLowerCase().trim();
        const lista = Array.isArray(inventarioConsolidado) ? inventarioConsolidado : [];
        if (!termino) {
            return lista;
        }
        return lista.filter((item) =>
            String(item.codigo_elemento || "").toLowerCase().includes(termino) ||
            String(item.elemento || "").toLowerCase().includes(termino)
        );
    }, [inventarioConsolidado, busquedaEdicion]);

    const solicitarOtpEdicion = () => {
        if (!editandoElemento) {
            return;
        }

        const nombre = String(editData.elemento || "").trim();
        const costo = parseCurrency(editData.costo_unitario);

        if (!nombre) {
            errorNotification("El nombre del elemento es obligatorio");
            return;
        }

        if (!Number.isFinite(costo) || costo < 0) {
            errorNotification("El costo unitario debe ser mayor o igual a 0");
            return;
        }

        setPendingEditPayload({
            id_lote: editandoElemento.id_lote,
            elemento: nombre,
            costo_unitario: costo
        });
        setMostrarOtp(true);
    };

    const handleEditCostoUnitarioChange = (e) => {
        // Permitir separadores decimales por coma o punto durante la edición.
        const value = String(e.target.value || "").replace(/[^0-9.,]/g, "");
        setEditData((prev) => ({ ...prev, costo_unitario: value }));
    };

    const confirmarEdicionConOtp = async () => {
        if (!pendingEditPayload) {
            setMostrarOtp(false);
            return;
        }

        try {
            setSaveEditLoading(true);
            await updateElemento(pendingEditPayload.id_lote, {
                elemento: pendingEditPayload.elemento,
                costo_unitario: pendingEditPayload.costo_unitario
            });

            success("Elemento actualizado correctamente");
            setMostrarEditorElemento(false);
            setEditandoElemento(null);
            setPendingEditPayload(null);
            setMostrarOtp(false);
            await cargarInventario();
        } catch (err) {
            errorNotification(err.message || "No se pudo actualizar el elemento");
        } finally {
            setSaveEditLoading(false);
        }
    };

    return (
        <div style={{ padding: "8px 4px", width: "100%", maxWidth: "none", margin: 0, boxSizing: "border-box" }}>
            <h1 style={{ color: "#1d3554", marginBottom: "10px" }}>Ingrese inventario bodega</h1>
            <p style={{ color: "#64748b", marginBottom: "14px" }}>
                Registra ingresos por código en una tabla y mantén el historial de inventario actualizado.
            </p>

            <div style={{
                marginBottom: "20px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "12px",
                maxWidth: "760px"
            }}>
                <div style={{
                    padding: "16px",
                    background: "#f0f9ff",
                    borderRadius: "10px",
                    borderLeft: "4px solid #0f7c90"
                }}>
                    <div style={{ fontSize: "13px", color: "#475569", marginBottom: "6px" }}>
                        Costo total del inventario
                    </div>
                    <div style={{ fontSize: "23px", fontWeight: "700", color: "#0f7c90" }}>
                        ${formatCurrency(calcularCostoTotal())}
                    </div>
                </div>

                <div style={{
                    padding: "16px",
                    background: "#fef3c7",
                    borderRadius: "10px",
                    borderLeft: "4px solid #f59e0b"
                }}>
                    <div style={{ fontSize: "13px", color: "#78350f", marginBottom: "6px" }}>
                        Total gastado en reparaciones
                    </div>
                    <div style={{ fontSize: "23px", fontWeight: "700", color: "#b45309" }}>
                        ${formatCurrency(calcularTotalGastado())}
                    </div>
                </div>
            </div>

            <div style={{
                background: "white",
                padding: "30px",
                borderRadius: "12px",
                boxShadow: "0 6px 16px rgba(16, 55, 86, 0.08)",
                border: "1px solid #d9e3ee",
                minWidth: 0
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
                    <h3 style={{ color: "#0f7c90", margin: 0 }}>
                        Inventario actual ({(inventarioConsolidado || []).length} elementos)
                    </h3>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            onClick={abrirIngresoModal}
                            style={{
                                padding: "10px 14px",
                                background: "#1e78bd",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: "600",
                                fontSize: "12px",
                                whiteSpace: "nowrap"
                            }}
                        >
                            Ingresar inventario
                        </button>
                        <button
                            type="button"
                            onClick={abrirEditorGlobal}
                            style={{
                                padding: "10px 14px",
                                background: "#1e78bd",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: "600",
                                fontSize: "12px",
                                whiteSpace: "nowrap"
                            }}
                        >
                            Editar elemento
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: "16px", display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
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
                    <button
                        type="button"
                        onClick={exportarInventarioExcel}
                        style={{
                            padding: "10px 14px",
                            background: "#1e78bd",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "600",
                            fontSize: "12px",
                            whiteSpace: "nowrap"
                        }}
                    >
                        Exportar Excel
                    </button>
                </div>

                {loading ? (
                    <p style={{ color: "#64748b" }}>Cargando inventario...</p>
                ) : (inventarioConsolidado || []).length === 0 ? (
                    <p style={{ color: "#94a3b8" }}>No hay elementos en el inventario</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                            <thead>
                                <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                                    <th style={headerStyle}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                            Código
                                            <button
                                                type="button"
                                                title={ordenCodigo === "asc" ? "Orden actual: ascendente" : "Orden actual: descendente"}
                                                onClick={() => setOrdenCodigo((prev) => (prev === "asc" ? "desc" : "asc"))}
                                                style={{
                                                    width: "24px",
                                                    height: "24px",
                                                    border: "1px solid #cbd5e1",
                                                    borderRadius: "6px",
                                                    background: "white",
                                                    color: "#0f172a",
                                                    cursor: "pointer",
                                                    padding: 0,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center"
                                                }}
                                            >
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "1px", fontSize: "9px", lineHeight: 1 }}>
                                                    <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 0.8 }}>
                                                        <span>A</span>
                                                        <span>Z</span>
                                                    </span>
                                                    <span style={{ fontSize: "10px" }}>{ordenCodigo === "asc" ? "↓" : "↑"}</span>
                                                </span>
                                            </button>
                                        </span>
                                    </th>
                                    <th style={headerStyle}>Material</th>
                                    <th style={headerStyle}>Inicial</th>
                                    <th style={headerStyle}>Recibe</th>
                                    <th style={headerStyle}>Devolución</th>
                                    <th style={headerStyle}>Gastado PQR</th>
                                    <th style={headerStyle}>Préstamo</th>
                                    <th style={headerStyle}>Unid. existentes inventario</th>
                                    <th style={headerStyle}>Costo unitario</th>
                                    <th style={headerStyle}>Valor final</th>
                                    <th style={headerStyle}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventarioFiltrado.map((item) => {
                                    const stockDisponible = Number(item.stock_disponible || 0);
                                    const stockBajo = stockDisponible < umbralStockBajo;
                                    const stockAgotado = stockDisponible <= 0;

                                    return (
                                        <tr key={item.id_inventario} style={{
                                            borderBottom: "1px solid #e2e8f0",
                                            background: stockAgotado ? "#fecaca" : stockBajo ? "#fff7ed" : "transparent"
                                        }}>
                                            <td style={cellStyle}>{item.codigo_elemento}</td>
                                            <td style={cellStyle}>{item.elemento}</td>
                                            <td style={cellStyle}>{Number(item.cantidad || 0)}</td>
                                            <td style={cellStyle}>{Number(item.entrada || 0)}</td>
                                            <td style={cellStyle}>{Number(item.devolucion || 0)}</td>
                                            <td style={cellStyle}>{Number(item.despachado || 0)}</td>
                                            <td style={cellStyle}>{Number(item.prestamo || 0)}</td>
                                            <td style={{ ...cellStyle, fontWeight: "bold", fontSize: "15px" }}>
                                                <span style={{
                                                    color: stockAgotado ? "#b91c1c" : stockBajo ? "#c2410c" : "#059669",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px"
                                                }}>
                                                    {stockDisponible}
                                                    {stockAgotado && <span style={{ fontSize: "10px" }}>⚠️ AGOTADO</span>}
                                                    {stockBajo && !stockAgotado && <span style={{ fontSize: "10px" }}>⚠️ AGOTÁNDOSE</span>}
                                                </span>
                                            </td>
                                            <td style={cellStyle}>${formatCurrency(item.costo_unitario)}</td>
                                            <td style={cellStyle}>${formatCurrency(stockDisponible * item.costo_unitario)}</td>
                                            <td style={cellStyle}>
                                                <button
                                                    onClick={() => verHistorial(item)}
                                                    style={{
                                                        padding: "6px 12px",
                                                        background: "#1e78bd",
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
                )}
            </div>

            {mostrarIngresoModal && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2300,
                    padding: "16px"
                }} onClick={cerrarIngresoModal}>
                    <div style={{
                        width: "1120px",
                        height: "640px",
                        maxWidth: "calc(100vw - 32px)",
                        maxHeight: "calc(100vh - 32px)",
                        background: "white",
                        borderRadius: "12px",
                        padding: "20px",
                        boxShadow: "0 15px 30px rgba(0,0,0,0.2)",
                        overflow: "auto"
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <h3 style={{ margin: 0, color: "#0a5c6d" }}>Registro de ingresos de inventario</h3>
                            <button
                                type="button"
                                onClick={agregarFilaIngreso}
                                style={{
                                    padding: "8px 12px",
                                    background: "#1e78bd",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: "12px"
                                }}
                                disabled={formLoading}
                            >
                                Agregar fila
                            </button>
                        </div>

                        <p style={{ color: "#64748b", fontSize: "13px", marginTop: "8px", marginBottom: "12px" }}>
                            Al escribir el código, el material se autocompleta. El número de orden se normaliza a 3 dígitos (ejemplo: 1 a ORDEN: 001).
                        </p>

                        <p style={{ color: "#475569", fontSize: "12px", marginTop: "-4px", marginBottom: "10px" }}>
                            Última orden guardada: {ultimoNumeroOrdenGuardado === null ? "Ninguna" : `ORDEN: ${String(ultimoNumeroOrdenGuardado).padStart(3, "0")}`}. Siguiente obligatoria: ORDEN: {String((ultimoNumeroOrdenGuardado ?? -1) + 1).padStart(3, "0")}.
                        </p>

                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "12px",
                            flexWrap: "wrap"
                        }}>
                            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                                Fecha compra para todas las filas
                            </label>
                            <input
                                type="date"
                                value={fechaIngresoGlobal}
                                onChange={handleFechaIngresoGlobalChange}
                                style={{ ...modalInputStyle, width: "190px" }}
                                disabled={formLoading}
                            />
                        </div>

                        <div style={{ overflowX: "auto", border: "1px solid #dbe5ef", borderRadius: "10px" }}>
                            <table style={{ width: "100%", minWidth: "980px", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
                                <colgroup>
                                    <col style={{ width: "16%" }} />
                                    <col style={{ width: "34%" }} />
                                    <col style={{ width: "10%" }} />
                                    <col style={{ width: "16%" }} />
                                    <col style={{ width: "14%" }} />
                                    <col style={{ width: "10%" }} />
                                </colgroup>
                                <thead>
                                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #dbe5ef" }}>
                                        <th style={headerStyle}>CÓDIGO</th>
                                        <th style={headerStyle}>MATERIAL</th>
                                        <th style={headerStyle}>CANTIDAD</th>
                                        <th style={headerStyle}>NÚMERO ORDEN</th>
                                        <th style={headerStyle}>COSTO UNITARIO</th>
                                        <th style={headerStyle}>ACCIÓN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filasIngreso.map((row) => (
                                        <tr key={row.id} style={{ borderBottom: "1px solid #eef2f7" }}>
                                            <td style={cellStyle}>
                                                <input
                                                    value={row.codigo}
                                                    onChange={(e) => actualizarFilaIngreso(row.id, "codigo", e.target.value)}
                                                    style={modalInputStyle}
                                                    placeholder="Código"
                                                    disabled={formLoading}
                                                />
                                            </td>
                                            <td style={cellStyle}>
                                                <input
                                                    value={row.material}
                                                    readOnly
                                                    style={{ ...modalInputStyle, background: "#f8fafc", color: row.material === "#N/D" ? "#b91c1c" : "#334155" }}
                                                />
                                            </td>
                                            <td style={cellStyle}>
                                                <input
                                                    value={row.cantidad}
                                                    onChange={(e) => actualizarFilaIngreso(row.id, "cantidad", e.target.value)}
                                                    style={modalInputStyle}
                                                    placeholder="0"
                                                    inputMode="numeric"
                                                    disabled={formLoading}
                                                />
                                            </td>
                                            <td style={cellStyle}>
                                                <input
                                                    value={row.numero_orden}
                                                    onChange={(e) => actualizarFilaIngreso(row.id, "numero_orden", e.target.value)}
                                                    onBlur={() => normalizarOrdenFila(row.id)}
                                                    style={modalInputStyle}
                                                    placeholder="001"
                                                    disabled={formLoading}
                                                />
                                            </td>
                                            <td style={cellStyle}>
                                                <input
                                                    value={row.costo_unitario}
                                                    onChange={(e) => actualizarFilaIngreso(row.id, "costo_unitario", e.target.value)}
                                                    style={modalInputStyle}
                                                    placeholder="0,00"
                                                    inputMode="decimal"
                                                    disabled={formLoading}
                                                />
                                            </td>
                                            <td style={cellStyle}>
                                                <button
                                                    type="button"
                                                    onClick={() => eliminarFilaIngreso(row.id)}
                                                    style={{
                                                        border: "1px solid #fecaca",
                                                        color: "#b91c1c",
                                                        background: "#fff1f2",
                                                        borderRadius: "6px",
                                                        padding: "8px 10px",
                                                        fontWeight: 600,
                                                        cursor: filasIngreso.length === 1 ? "not-allowed" : "pointer",
                                                        opacity: filasIngreso.length === 1 ? 0.5 : 1
                                                    }}
                                                    disabled={formLoading || filasIngreso.length === 1}
                                                >
                                                    Quitar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
                            <button
                                type="button"
                                onClick={cerrarIngresoModal}
                                style={{
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "8px",
                                    padding: "9px 14px",
                                    background: "white",
                                    color: "#334155",
                                    cursor: "pointer",
                                    fontWeight: "600"
                                }}
                                disabled={formLoading}
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={guardarIngresos}
                                style={{
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "9px 14px",
                                    background: "#1e78bd",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: "600"
                                }}
                                disabled={formLoading}
                            >
                                {formLoading ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                        <th style={headerStyle}>Novedad</th>
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
                                    {historial.map((h) => {
                                        const costoTotalMovimiento = getCostoTotalMovimiento(h);
                                        const devolucionHeredada = h.tipo_movimiento === "DEVOLUCION" && h.asociacion_heredada;
                                        return (
                                        <tr
                                            key={h.id_gasto}
                                            style={{
                                                borderBottom: "1px solid #e2e8f0",
                                                background: devolucionHeredada ? "#fff7ed" : "transparent"
                                            }}
                                        >
                                            <td style={cellStyle}>
                                                {formatFechaSinDesfase(h.fecha)}
                                            </td>
                                            <td style={{ ...cellStyle, fontWeight: devolucionHeredada ? 600 : 400 }}>{h.id_novedad ? `#${h.id_novedad}` : "Sin novedad"}</td>
                                            <td style={{ ...cellStyle, fontWeight: devolucionHeredada ? 600 : 400 }}>{h.numero_lampara ? `#${h.numero_lampara}` : "Sin lámpara asociada"}</td>
                                            <td style={cellStyle}>{h.nombre_electricista || (h.id_electricista ? `ID ${h.id_electricista}` : "-")}</td>
                                            <td style={cellStyle}>{h.tipo_movimiento}</td>
                                            <td style={cellStyle}>{h.cantidad_usada}</td>
                                            <td style={cellStyle}>${formatCurrency(h.costo_unitario)}</td>
                                            <td style={{ ...cellStyle, color: costoTotalMovimiento < 0 ? "#b91c1c" : "#475569" }}>${formatCurrency(costoTotalMovimiento)}</td>
                                            <td style={cellStyle}>{h.codigo_pqr || "-"}</td>
                                            <td style={cellStyle}>{h.observacion || "-"}</td>
                                        </tr>
                                    );
                                    })}
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
                                        return sum + getCostoTotalMovimiento(h);
                                    }, 0))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        <OtpModal
            isOpen={mostrarOtp}
            onClose={() => {
                setMostrarOtp(false);
                setPendingEditPayload(null);
            }}
            onVerificado={confirmarEdicionConOtp}
        />

        {editandoElemento && (
            <div style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2100,
                padding: "16px"
            }} onClick={cerrarEditorGlobal}>
                <div style={{
                    width: "min(480px, 100%)",
                    background: "white",
                    borderRadius: "12px",
                    padding: "20px",
                    boxShadow: "0 15px 30px rgba(0,0,0,0.2)"
                }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ marginTop: 0, color: "#0a5c6d" }}>Editar Elemento</h3>
                    <p style={{ color: "#64748b", fontSize: "13px", marginTop: "6px" }}>
                        {editandoElemento.codigo_elemento}
                    </p>

                    <label style={{ ...labelStyle, marginTop: "8px" }}>Nombre del elemento</label>
                    <input
                        type="text"
                        value={editData.elemento}
                        onChange={(e) => setEditData((prev) => ({ ...prev, elemento: e.target.value }))}
                        style={inputStyle}
                        disabled={saveEditLoading}
                    />

                    <label style={{ ...labelStyle, marginTop: "12px" }}>Costo unitario</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={editData.costo_unitario}
                        onChange={handleEditCostoUnitarioChange}
                        style={inputStyle}
                        disabled={saveEditLoading}
                    />

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                        <button
                            type="button"
                            onClick={cerrarEditorGlobal}
                            style={{
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                padding: "9px 14px",
                                background: "white",
                                color: "#334155",
                                cursor: "pointer",
                                fontWeight: "600"
                            }}
                            disabled={saveEditLoading}
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            onClick={solicitarOtpEdicion}
                            style={{
                                border: "none",
                                borderRadius: "8px",
                                padding: "9px 14px",
                                background: "#1e78bd",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: "600"
                            }}
                            disabled={saveEditLoading}
                        >
                            Guardar cambios
                        </button>
                    </div>
                </div>
            </div>
        )}

        {mostrarEditorElemento && !editandoElemento && (
            <div style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2100,
                padding: "16px"
            }} onClick={cerrarEditorGlobal}>
                <div style={{
                    width: "min(560px, 100%)",
                    background: "white",
                    borderRadius: "12px",
                    padding: "20px",
                    boxShadow: "0 15px 30px rgba(0,0,0,0.2)"
                }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ marginTop: 0, color: "#0a5c6d" }}>Buscar elemento para editar</h3>

                    <input
                        type="text"
                        placeholder="Busca por codigo o nombre..."
                        value={busquedaEdicion}
                        onChange={(e) => setBusquedaEdicion(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "14px",
                            boxSizing: "border-box",
                            marginBottom: "12px"
                        }}
                    />

                    <div style={{
                        maxHeight: "300px",
                        overflowY: "auto",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px"
                    }}>
                        {itemsParaEdicion.length === 0 ? (
                            <div style={{ padding: "12px", color: "#64748b", fontSize: "13px" }}>
                                No se encontraron elementos con ese criterio.
                            </div>
                        ) : (
                            itemsParaEdicion.map((item) => (
                                <button
                                    key={item.id_inventario}
                                    type="button"
                                    onClick={() => abrirEdicionElemento(item)}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "10px 12px",
                                        border: "none",
                                        borderBottom: "1px solid #f1f5f9",
                                        background: "white",
                                        cursor: "pointer"
                                    }}
                                >
                                    <div style={{ fontSize: "12px", color: "#0f7c90", fontWeight: "700" }}>
                                        {item.codigo_elemento}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "#334155" }}>
                                        {item.elemento}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
                        <button
                            type="button"
                            onClick={cerrarEditorGlobal}
                            style={{
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                padding: "9px 14px",
                                background: "white",
                                color: "#334155",
                                cursor: "pointer",
                                fontWeight: "600"
                            }}
                        >
                            Cerrar
                        </button>
                    </div>
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
    minHeight: "42px",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    fontSize: "14px",
    boxSizing: "border-box"
};

const modalInputStyle = {
    width: "100%",
    minHeight: "38px",
    padding: "8px 10px",
    border: "1px solid #dbe5ef",
    borderRadius: "6px",
    fontSize: "13px",
    boxSizing: "border-box",
    background: "white",
    color: "#334155"
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


