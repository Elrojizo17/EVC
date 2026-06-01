import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { getGastos } from "../api/gastos.api";
import { getCantidadConSigno, getCostoTotalMovimiento } from "../utils/gastos";
import { useNotification } from "../hooks/useNotification";

const REGISTROS_POR_PAGINA = 20;

export default function ReporteGastosGenerales() {
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [tipoMovimiento, setTipoMovimiento] = useState("todos");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [ordenTabla, setOrdenTabla] = useState({ columna: "fecha", direccion: "desc" });
    const [paginaActual, setPaginaActual] = useState(1);
    const { success, error: errorNotification } = useNotification();

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

    const cambiarOrden = (columna) => {
        setOrdenTabla((prev) => {
            if (prev.columna === columna) {
                return {
                    ...prev,
                    direccion: prev.direccion === "asc" ? "desc" : "asc"
                };
            }

            return { columna, direccion: "asc" };
        });
    };

    const obtenerIndicadorOrden = (columna) => {
        if (ordenTabla.columna !== columna) {
            return "↕";
        }

        return ordenTabla.direccion === "asc" ? "↑" : "↓";
    };

    const obtenerTituloOrden = (columna, etiqueta) => {
        if (ordenTabla.columna !== columna) {
            return `Ordenar por ${etiqueta.toLowerCase()}`;
        }

        return ordenTabla.direccion === "asc"
            ? `Orden actual en ${etiqueta.toLowerCase()}: ascendente`
            : `Orden actual en ${etiqueta.toLowerCase()}: descendente`;
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
                String(g.id_novedad || "").toLowerCase().includes(termino) ||
                String(g.codigo_pqr || "").toLowerCase().includes(termino);

            if (!matchBusqueda) {
                return false;
            }

            if (tipoMovimiento !== "todos" && String(g.tipo_movimiento || "") !== tipoMovimiento) {
                return false;
            }

            const fechaIso = toIsoDateString(g.fecha || g.fecha_registro);
            if (!fechaIso) {
                return false;
            }

            if (fechaDesde) {
                if (fechaIso < fechaDesde) {
                    return false;
                }
            }

            if (fechaHasta) {
                if (fechaIso > fechaHasta) {
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
            let comparacion = 0;

            if (ordenTabla.columna === "fecha") {
                const fechaA = toIsoDateString(a.fecha || a.fecha_registro);
                const fechaB = toIsoDateString(b.fecha || b.fecha_registro);
                comparacion = fechaA.localeCompare(fechaB, "es", { numeric: true, sensitivity: "base" });
            } else if (ordenTabla.columna === "novedad") {
                const novedadA = Number.parseInt(a.id_novedad, 10);
                const novedadB = Number.parseInt(b.id_novedad, 10);
                const tieneA = Number.isFinite(novedadA);
                const tieneB = Number.isFinite(novedadB);

                if (tieneA && tieneB) {
                    comparacion = novedadA - novedadB;
                } else if (tieneA) {
                    comparacion = -1;
                } else if (tieneB) {
                    comparacion = 1;
                }
            } else if (ordenTabla.columna === "pqr") {
                const pqrA = String(a.codigo_pqr || "").toLowerCase();
                const pqrB = String(b.codigo_pqr || "").toLowerCase();
                comparacion = pqrA.localeCompare(pqrB, "es", { numeric: true, sensitivity: "base" });
            }

            if (comparacion === 0) {
                comparacion = Number(a.id_gasto || 0) - Number(b.id_gasto || 0);
            }

            return ordenTabla.direccion === "asc" ? comparacion : -comparacion;
        });
    }, [gastosFiltrados, ordenTabla]);

    const totalRegistros = gastosOrdenados.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / REGISTROS_POR_PAGINA));

    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda, tipoMovimiento, fechaDesde, fechaHasta]);

    useEffect(() => {
        setPaginaActual((prev) => Math.min(prev, totalPaginas));
    }, [totalPaginas]);

    const gastosPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * REGISTROS_POR_PAGINA;
        return gastosOrdenados.slice(inicio, inicio + REGISTROS_POR_PAGINA);
    }, [gastosOrdenados, paginaActual]);

    const rangoInicio = totalRegistros === 0 ? 0 : ((paginaActual - 1) * REGISTROS_POR_PAGINA) + 1;
    const rangoFin = totalRegistros === 0 ? 0 : Math.min(paginaActual * REGISTROS_POR_PAGINA, totalRegistros);

    const paginasVisibles = useMemo(() => {
        return buildPaginationItems(totalPaginas, paginaActual);
    }, [totalPaginas, paginaActual]);

    const exportarGastosExcel = () => {
        if (gastosOrdenados.length === 0) {
            errorNotification("No hay movimientos para exportar con los filtros actuales");
            return;
        }

        const dataExcel = gastosOrdenados.map((g) => {
            const costoTotal = getCostoTotalMovimiento(g);
            const novedadLabel = g.id_novedad ? `#${g.id_novedad}` : "Sin novedad";
            const lamparaLabel = g.numero_lampara || (g.id_novedad ? "Sin número" : "Sin lámpara asociada");
            return {
                Fecha: formatDate(g.fecha || g.fecha_registro),
                Novedad: novedadLabel,
                "Lámpara": lamparaLabel,
                Elemento: g.elemento || "-",
                "Tipo mov.": g.tipo_movimiento || "-",
                Cantidad: Number(getCantidadConSigno(g) || 0),
                "Costo unit.": Number(g.costo_unitario || 0),
                "Costo total": Number(costoTotal || 0),
                Electricista: g.nombre_electricista || (g.id_electricista ? `ID ${g.id_electricista}` : "-"),
                PQR: g.codigo_pqr || "-"
            };
        });

        const headers = [
            "Fecha",
            "Novedad",
            "Lámpara",
            "Elemento",
            "Tipo mov.",
            "Cantidad",
            "Costo unit.",
            "Costo total",
            "Electricista",
            "PQR"
        ];

        const ws = XLSX.utils.json_to_sheet(dataExcel, { header: headers });
        const excelBorder = {
            top: { style: "thin", color: { rgb: "D9E3EE" } },
            bottom: { style: "thin", color: { rgb: "D9E3EE" } },
            left: { style: "thin", color: { rgb: "D9E3EE" } },
            right: { style: "thin", color: { rgb: "D9E3EE" } }
        };
        const headerStyle = {
            font: { name: "Calibri", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "0D70B4" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: excelBorder
        };
        const textCellStyle = {
            font: { name: "Calibri", sz: 11, color: { rgb: "334155" } },
            alignment: { vertical: "center" },
            border: excelBorder
        };
        const numberCellStyle = {
            font: { name: "Calibri", sz: 11, color: { rgb: "0F172A" } },
            alignment: { horizontal: "right", vertical: "center" },
            border: excelBorder
        };
        const formatoMoneda = '"$" #,##0.00';

        for (let col = 0; col < headers.length; col += 1) {
            const headerCell = XLSX.utils.encode_cell({ r: 0, c: col });
            if (ws[headerCell]) {
                ws[headerCell].s = headerStyle;
            }
        }

        for (let row = 0; row < dataExcel.length; row += 1) {
            const rowExcel = row + 1;
            for (let col = 0; col < headers.length; col += 1) {
                const cellRef = XLSX.utils.encode_cell({ r: rowExcel, c: col });
                if (!ws[cellRef]) {
                    continue;
                }

                if (col === 5) {
                    ws[cellRef].t = "n";
                    ws[cellRef].z = "#,##0";
                    ws[cellRef].s = numberCellStyle;
                    continue;
                }

                if (col === 6 || col === 7) {
                    ws[cellRef].t = "n";
                    ws[cellRef].z = formatoMoneda;
                    ws[cellRef].s = numberCellStyle;
                    continue;
                }

                ws[cellRef].s = textCellStyle;
            }
        }

        ws["!cols"] = [
            { wch: 13 },
            { wch: 13 },
            { wch: 20 },
            { wch: 30 },
            { wch: 16 },
            { wch: 10 },
            { wch: 14 },
            { wch: 14 },
            { wch: 24 },
            { wch: 16 }
        ];
        ws["!rows"] = [{ hpx: 30 }, ...Array.from({ length: dataExcel.length }, () => ({ hpx: 22 }))];
        ws["!autofilter"] = {
            ref: `A1:${XLSX.utils.encode_cell({ r: 0, c: headers.length - 1 })}`
        };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Gastos");

        const fecha = new Date().toISOString().split("T")[0];
        XLSX.writeFile(wb, `reporte_gastos_${fecha}.xlsx`);
        success("Reporte de gastos exportado a Excel");
    };

    return (
        <div style={{ padding: "8px 10px", maxWidth: "1250px", margin: "0 auto" }}>

            <h1 style={{ color: "#1d3554", marginBottom: "8px" }}>Reporte general de gastos</h1>
            <p style={{ color: "#64748b", marginBottom: "24px" }}>
                Consulta todos los movimientos de bodega con su costo neto. Las devoluciones se restan del total.
            </p>

            <div style={{ marginBottom: "14px", padding: "12px", background: "#f0f9ff", borderRadius: "8px", borderLeft: "4px solid #0f7c90" }}>
                <div style={{ fontSize: "12px", color: "#475569" }}>Total neto de gastos</div>
                <div
                    style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: totalNeto < 0 ? "#b91c1c" : "#0f7c90"
                    }}
                >
                    {loading ? "Calculando..." : `$${formatCurrency(totalNeto)}`}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Se actualiza automáticamente con los filtros aplicados.
                </div>
            </div>

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
                        placeholder="Buscar por elemento, lámpara, novedad, PQR o código..."
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

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
                    <button type="button" onClick={exportarGastosExcel} style={buttonExportStyle}>
                        Exportar Excel
                    </button>
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
                                    <th style={thStyle}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                            Fecha
                                            <button
                                                type="button"
                                                title={obtenerTituloOrden("fecha", "Fecha")}
                                                onClick={() => cambiarOrden("fecha")}
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
                                                    justifyContent: "center",
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    lineHeight: 1
                                                }}
                                            >
                                                {obtenerIndicadorOrden("fecha")}
                                            </button>
                                        </span>
                                    </th>
                                    <th style={thStyle}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                            Novedad
                                            <button
                                                type="button"
                                                title={obtenerTituloOrden("novedad", "Novedad")}
                                                onClick={() => cambiarOrden("novedad")}
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
                                                    justifyContent: "center",
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    lineHeight: 1
                                                }}
                                            >
                                                {obtenerIndicadorOrden("novedad")}
                                            </button>
                                        </span>
                                    </th>
                                    <th style={thStyle}>Lámpara</th>
                                    <th style={thStyle}>Elemento</th>
                                    <th style={thStyle}>Tipo mov.</th>
                                    <th style={thStyle}>Cantidad</th>
                                    <th style={thStyle}>Costo unit.</th>
                                    <th style={thStyle}>Costo total</th>
                                    <th style={thStyle}>Electricista</th>
                                    <th style={thStyle}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                            PQR
                                            <button
                                                type="button"
                                                title={obtenerTituloOrden("pqr", "PQR")}
                                                onClick={() => cambiarOrden("pqr")}
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
                                                    justifyContent: "center",
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    lineHeight: 1
                                                }}
                                            >
                                                {obtenerIndicadorOrden("pqr")}
                                            </button>
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {gastosPaginados.map((g) => {
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

                        <div style={paginationBarStyle}>
                            <div style={paginationInfoStyle}>
                                Mostrando {rangoInicio}-{rangoFin} de {totalRegistros} registros
                            </div>

                            <div style={paginationControlsStyle}>
                                <button
                                    type="button"
                                    onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                                    disabled={paginaActual === 1}
                                    style={{
                                        ...paginationButtonStyle,
                                        ...(paginaActual === 1 ? paginationButtonDisabledStyle : null)
                                    }}
                                >
                                    Anterior
                                </button>

                                {paginasVisibles.map((item) => {
                                    if (typeof item !== "number") {
                                        return <span key={item} style={paginationEllipsisStyle}>...</span>;
                                    }

                                    const activa = item === paginaActual;
                                    return (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => setPaginaActual(item)}
                                            style={{
                                                ...paginationButtonStyle,
                                                ...(activa ? paginationButtonActiveStyle : null)
                                            }}
                                        >
                                            {item}
                                        </button>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                                    disabled={paginaActual === totalPaginas}
                                    style={{
                                        ...paginationButtonStyle,
                                        ...(paginaActual === totalPaginas ? paginationButtonDisabledStyle : null)
                                    }}
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </section>
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

function formatCurrency(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}

function buildPaginationItems(totalPaginas, paginaActual) {
    if (totalPaginas <= 7) {
        return Array.from({ length: totalPaginas }, (_, index) => index + 1);
    }

    const paginasClave = [1, totalPaginas, paginaActual - 1, paginaActual, paginaActual + 1]
        .filter((page) => page >= 1 && page <= totalPaginas)
        .sort((a, b) => a - b);

    const unicas = [...new Set(paginasClave)];
    const resultado = [];

    for (let i = 0; i < unicas.length; i += 1) {
        const page = unicas[i];
        const anterior = unicas[i - 1];

        if (typeof anterior === "number" && page - anterior > 1) {
            resultado.push(`ellipsis-${anterior}-${page}`);
        }

        resultado.push(page);
    }

    return resultado;
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
const paginationBarStyle = {
    marginTop: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap"
};
const paginationInfoStyle = {
    fontSize: "12px",
    color: "#64748b"
};
const paginationControlsStyle = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap"
};
const paginationButtonStyle = {
    minWidth: "34px",
    height: "32px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer"
};
const paginationButtonActiveStyle = {
    background: "#1e78bd",
    borderColor: "#1e78bd",
    color: "white"
};
const paginationButtonDisabledStyle = {
    opacity: 0.45,
    cursor: "not-allowed"
};
const paginationEllipsisStyle = {
    color: "#64748b",
    padding: "0 4px",
    fontSize: "12px",
    userSelect: "none"
};

const buttonExportStyle = {
    border: "none",
    borderRadius: "8px",
    padding: "8px 12px",
    background: "#0D70B4",
    color: "white",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600
};
