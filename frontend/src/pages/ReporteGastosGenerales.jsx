import { useEffect, useMemo, useState } from "react";
import { getGastos } from "../api/gastos.api";
import { getCantidadConSigno, getCostoTotalMovimiento } from "../utils/gastos";

export default function ReporteGastosGenerales() {
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [tipoMovimiento, setTipoMovimiento] = useState("todos");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [ordenCodigo, setOrdenCodigo] = useState("asc");

    useEffect(() => {
        cargarGastos();
    }, []);

    const cargarGastos = async () => {
        try {
            setLoading(true);
            const data = await getGastos();
            setGastos(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error cargando gastos generales:", err);
            setError("No se pudo cargar el reporte general de gastos.");
        } finally {
            setLoading(false);
        }
    };

    const gastosFiltrados = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();

        return (gastos || []).filter((g) => {
            // Excluir movimientos tipo ENTRADA
            if (g.tipo_movimiento === 'ENTRADA') {
                return false;
            }

            const matchBusqueda =
                !termino ||
                String(g.elemento || "").toLowerCase().includes(termino) ||
                String(g.codigo || "").toLowerCase().includes(termino) ||
                String(g.numero_lampara || "").toLowerCase().includes(termino) ||
                String(g.codigo_pqr || "").toLowerCase().includes(termino);

            if (!matchBusqueda) {
                return false;
            }

            if (tipoMovimiento !== "todos" && String(g.tipo_movimiento || "") !== tipoMovimiento) {
                return false;
            }

            const fecha = new Date(g.fecha || g.fecha_registro);
            if (fechaDesde) {
                const desde = new Date(fechaDesde);
                if (fecha < desde) {
                    return false;
                }
            }

            if (fechaHasta) {
                const hasta = new Date(fechaHasta);
                hasta.setHours(23, 59, 59, 999);
                if (fecha > hasta) {
                    return false;
                }
            }

            return true;
        });
    }, [gastos, busqueda, tipoMovimiento, fechaDesde, fechaHasta]);

    const totalNeto = useMemo(() => {
        return gastosFiltrados.reduce((sum, g) => sum + getCostoTotalMovimiento(g), 0);
    }, [gastosFiltrados]);

    const gastosOrdenados = useMemo(() => {
        return [...gastosFiltrados].sort((a, b) => {
            const codigoA = String(a.codigo || a.codigo_elemento || a.elemento || "").toLowerCase();
            const codigoB = String(b.codigo || b.codigo_elemento || b.elemento || "").toLowerCase();
            const comparacion = codigoA.localeCompare(codigoB, "es", { numeric: true, sensitivity: "base" });
            return ordenCodigo === "asc" ? comparacion : -comparacion;
        });
    }, [gastosFiltrados, ordenCodigo]);

    return (
        <div style={{ padding: "8px 10px", maxWidth: "1250px", margin: "0 auto" }}>

            <h1 style={{ color: "#1d3554", marginBottom: "8px" }}>Reporte general de gastos</h1>
            <p style={{ color: "#64748b", marginBottom: "24px" }}>
                Consulta todos los movimientos de bodega con su costo neto. Las devoluciones se restan del total.
            </p>

            {error && (
                <div style={{ marginBottom: "16px", padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px" }}>
                    {error}
                </div>
            )}

            <section style={panelStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                    <input
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por elemento, lámpara, PQR o código..."
                        style={inputStyle}
                    />

                    <select value={tipoMovimiento} onChange={(e) => setTipoMovimiento(e.target.value)} style={inputStyle}>
                        <option value="todos">Todos los movimientos</option>
                        <option value="DESPACHADO">Despachado</option>
                        <option value="PRESTADO">Prestado</option>
                        <option value="MATERIAL_EXCEDENTE">Material excedente</option>
                        <option value="DEVOLUCION">Devolución</option>
                        <option value="ENTRADA">Entrada</option>
                    </select>

                    <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={inputStyle} />
                    <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={inputStyle} />
                </div>

                {loading ? (
                    <p style={mutedText}>Cargando gastos...</p>
                ) : gastosFiltrados.length === 0 ? (
                    <p style={mutedText}>No hay movimientos para los filtros seleccionados.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr style={tableHeaderRowStyle}>
                                    <th style={thStyle}>Fecha</th>
                                    <th style={thStyle}>Novedad</th>
                                    <th style={thStyle}>Lámpara</th>
                                    <th style={thStyle}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                            Elemento
                                            <button
                                                type="button"
                                                title={ordenCodigo === "asc" ? "Orden actual: ascendente" : "Orden actual: descendente"}
                                                onClick={() => setOrdenCodigo((prev) => (prev === "asc" ? "desc" : "asc"))}
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
                                                    <span style={{ fontSize: "9px" }}>{ordenCodigo === "asc" ? "↓" : "↑"}</span>
                                                </span>
                                            </button>
                                        </span>
                                    </th>
                                    <th style={thStyle}>Tipo mov.</th>
                                    <th style={thStyle}>Cantidad</th>
                                    <th style={thStyle}>Costo unit.</th>
                                    <th style={thStyle}>Costo total</th>
                                    <th style={thStyle}>Electricista</th>
                                    <th style={thStyle}>PQR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gastosOrdenados.map((g) => {
                                    const costoTotal = getCostoTotalMovimiento(g);
                                    const novedadLabel = g.id_novedad ? `#${g.id_novedad}` : "Sin novedad";
                                    const lamparaLabel = g.numero_lampara || (g.id_novedad ? "Sin número" : "Sin lámpara asociada");
                                    const devolucionHeredada = g.tipo_movimiento === "DEVOLUCION" && g.asociacion_heredada;
                                    return (
                                        <tr
                                            key={g.id_gasto}
                                            style={{
                                                ...tableRowStyle,
                                                background: devolucionHeredada ? "#fff7ed" : "transparent"
                                            }}
                                        >
                                            <td style={tdStyle}>{formatDate(g.fecha || g.fecha_registro)}</td>
                                            <td style={{ ...tdStyle, fontWeight: devolucionHeredada ? 600 : 400 }}>{novedadLabel}</td>
                                            <td style={{ ...tdStyle, fontWeight: devolucionHeredada ? 600 : 400 }}>{lamparaLabel}</td>
                                            <td style={tdStyle}>{g.elemento || "-"}</td>
                                            <td style={tdStyle}>{g.tipo_movimiento || "-"}</td>
                                            <td style={tdStyle}>{getCantidadConSigno(g)}</td>
                                            <td style={tdStyle}>${formatCurrency(g.costo_unitario)}</td>
                                            <td style={{ ...tdStyle, color: costoTotal < 0 ? "#b91c1c" : "#0f172a", fontWeight: 600 }}>
                                                ${formatCurrency(costoTotal)}
                                            </td>
                                            <td style={tdStyle}>{g.nombre_electricista || (g.id_electricista ? `ID ${g.id_electricista}` : "-")}</td>
                                            <td style={tdStyle}>{g.codigo_pqr || "-"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div style={{ marginTop: "14px", padding: "12px", background: "#f0f9ff", borderRadius: "8px", borderLeft: "4px solid #0f7c90" }}>
                    <div style={{ fontSize: "12px", color: "#475569" }}>Total neto</div>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0f7c90" }}>${formatCurrency(totalNeto)}</div>
                </div>
            </section>
        </div>
    );
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
}

function formatCurrency(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
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
