import { useEffect, useMemo, useState } from "react";
import BackButton from "../components/BackButton";
import * as XLSX from "xlsx";
import { getGastos } from "../api/gastos.api";
import { getNovedades } from "../api/novedades.api";

const getCantidadConSigno = (gasto) => {
    const cantidad = Number(gasto?.cantidad_usada || 0);
    if (String(gasto?.tipo_movimiento || "").toUpperCase() === "DEVOLUCION") {
        return -cantidad;
    }
    return cantidad;
};

export default function ReporteNovedades() {
    const [gastos, setGastos] = useState([]);
    const [novedades, setNovedades] = useState([]);
    const [busquedaGasto, setBusquedaGasto] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    
    // Filtros avanzados
    const [filtros, setFiltros] = useState({
        fechaDesde: "",
        fechaHasta: "",
        costoMin: "",
        costoMax: "",
        tipoElemento: "",
        numeroLampara: "",
        tipoNovedad: "todas"
    });

    useEffect(() => {
        cargarReportes();
    }, []);

    const cargarReportes = async () => {
        try {
        const [gastosData, novedadesData] = await Promise.all([
            getGastos(),
            getNovedades()
        ]);
        setGastos(Array.isArray(gastosData) ? gastosData : []);
        setNovedades(Array.isArray(novedadesData) ? novedadesData : []);
        } catch (err) {
        console.error("Error cargando reportes:", err);
        setError("No se pudieron cargar los reportes.");
        } finally {
        setLoading(false);
        }
    };

    const totalGastos = useMemo(() => {
        return (gastos || []).reduce((total, g) => {
            const cantidad = getCantidadConSigno(g);
            const costo = Number(g.costo_unitario || 0);
            return total + (cantidad * costo);
        }, 0);
    }, [gastos]);

    const totalNovedades = useMemo(() => (novedades || []).length, [novedades]);
    const totalGastosCount = useMemo(() => (gastos || []).length, [gastos]);

    const novedadesPorTipo = useMemo(() => {
        const contador = { MANTENIMIENTO: 0, CAMBIO_TECNOLOGIA: 0, REPARACION: 0, INSTALACION: 0 };
        (novedades || []).forEach((n) => {
        const tipo = n.tipo_novedad;
        if (contador[tipo] !== undefined) {
            contador[tipo] += 1;
        }
        });
        return contador;
    }, [novedades]);

    const gastosFiltrados = useMemo(() => {
        const termino = busquedaGasto.toLowerCase().trim();
        
        return (gastos || []).filter((g) => {
            // Filtro de búsqueda por texto
            const matchBusqueda = termino === "" || 
                String(g.elemento || "").toLowerCase().includes(termino) ||
                String(g.codigo_elemento || "").toLowerCase().includes(termino) ||
                String(g.numero_lampara || "").toLowerCase().includes(termino);
            
            if (!matchBusqueda) return false;
            
            // Filtro por rango de fechas
            if (filtros.fechaDesde) {
                const fechaGasto = new Date(g.fecha || g.fecha_registro);
                const fechaDesde = new Date(filtros.fechaDesde);
                if (fechaGasto < fechaDesde) return false;
            }
            
            if (filtros.fechaHasta) {
                const fechaGasto = new Date(g.fecha || g.fecha_registro);
                const fechaHasta = new Date(filtros.fechaHasta);
                fechaHasta.setHours(23, 59, 59, 999); // Incluir todo el día
                if (fechaGasto > fechaHasta) return false;
            }
            
            // Filtro por rango de costo
            const costoTotal = getCantidadConSigno(g) * Number(g.costo_unitario || 0);
            
            if (filtros.costoMin !== "" && costoTotal < Number(filtros.costoMin)) {
                return false;
            }
            
            if (filtros.costoMax !== "" && costoTotal > Number(filtros.costoMax)) {
                return false;
            }
            
            // Filtro por tipo de elemento
            if (filtros.tipoElemento.trim() !== "") {
                const matchElemento = String(g.elemento || "").toLowerCase().includes(filtros.tipoElemento.toLowerCase());
                if (!matchElemento) return false;
            }
            
            // Filtro por número de lámpara
            if (filtros.numeroLampara.trim() !== "") {
                const matchLampara = String(g.numero_lampara || "").includes(filtros.numeroLampara);
                if (!matchLampara) return false;
            }
            
            return true;
        });
    }, [gastos, busquedaGasto, filtros]);

    const totalGastosFiltrados = useMemo(() => {
        return (gastosFiltrados || []).reduce((total, g) => {
            const cantidad = getCantidadConSigno(g);
            const costo = Number(g.costo_unitario || 0);
            return total + (cantidad * costo);
        }, 0);
    }, [gastosFiltrados]);

    const exportarExcel = () => {
        const gastosData = (gastos || []).map((g) => ({
        "ID Gasto": g.id_gasto,
        "ID Novedad": g.id_novedad,
        "Fecha gasto": formatDate(g.fecha || g.fecha_registro),
        "Número Lámpara": g.numero_lampara,
        "Elemento": g.elemento,
        "Código Elemento": g.codigo_elemento,
        "Cantidad": g.cantidad_usada,
        "Costo Unitario": Number(g.costo_unitario || 0),
        "Costo Total": getCantidadConSigno(g) * Number(g.costo_unitario || 0),
        "Electricista": g.nombre_electricista || "",
        "Tipo Movimiento": g.tipo_movimiento || "",
        "Código PQR": g.codigo_pqr || "",
        "Observación": g.observacion || ""
        }));

        const novedadesData = (novedades || []).map((n) => ({
        "ID Novedad": n.id_novedad,
        "Número Lámpara": n.numero_lampara,
        "Tipo Novedad": n.tipo_novedad,
        "Tecnología Anterior": n.tecnologia_anterior || "",
        "Tecnología Nueva": n.tecnologia_nueva || "",
        "Acción": n.accion || "",
        "Fecha Novedad": formatDate(n.fecha_novedad),
        "Observación": n.observacion || ""
        }));

        const resumenData = [
        { Indicador: "Total novedades", Valor: totalNovedades },
        { Indicador: "Total gastos", Valor: totalGastosCount },
        { Indicador: "Costo total gastos", Valor: Number(totalGastos) },
        { Indicador: "Mantenimiento", Valor: novedadesPorTipo.MANTENIMIENTO },
        { Indicador: "Reparación", Valor: novedadesPorTipo.REPARACION },
        { Indicador: "Cambio tecnología", Valor: novedadesPorTipo.CAMBIO_TECNOLOGIA }
        ];

        const wb = XLSX.utils.book_new();
        const wsResumen = XLSX.utils.json_to_sheet(resumenData);
        const wsGastos = XLSX.utils.json_to_sheet(gastosData);
        const wsNovedades = XLSX.utils.json_to_sheet(novedadesData);

        const setHeaderStyle = (sheet) => {
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
        for (let C = range.s.c; C <= range.e.c; C += 1) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            const cell = sheet[cellAddress];
            if (cell) {
            cell.s = {
                font: { bold: true, color: { rgb: "0A5C6D" } },
                fill: { fgColor: { rgb: "F8FAFC" } }
            };
            }
        }
    };

    const setColWidths = (sheet, widths) => {
        sheet["!cols"] = widths.map((wch) => ({ wch }));
    };

    setHeaderStyle(wsResumen);
    setHeaderStyle(wsGastos);
    setHeaderStyle(wsNovedades);

    setColWidths(wsResumen, [22, 18]);
    setColWidths(wsGastos, [10, 10, 14, 18, 22, 18, 10, 14, 14, 22, 16, 14, 30]);
    setColWidths(wsNovedades, [10, 18, 18, 20, 20, 22, 14, 30]);

    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");
    XLSX.utils.book_append_sheet(wb, wsNovedades, "Novedades");

    const fecha = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `reportes_${fecha}.xlsx`);
    };

    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "20px" }}>
            <BackButton />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <h1 style={{ color: "#0a5c6d", marginBottom: "8px" }}>Dashboard de reportes</h1>
            <button
            type="button"
            onClick={exportarExcel}
            style={{
                padding: "10px 14px",
                background: "#0f7c90",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "13px"
            }}
            >
            Exportar Excel
            </button>
        </div>
        <p style={{ color: "#64748b", marginBottom: "24px" }}>
            Resumen general de gastos de inventario y novedades registradas.
        </p>

        {error && (
            <div style={{ marginBottom: "16px", padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px" }}>
            {error}
            </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            <Card title="Total novedades" value={totalNovedades} />
            <Card title="Total gastos" value={totalGastosCount} />
            <Card title="Costo total gastos" value={`$${formatCurrency(totalGastos)}`} />
            <Card title="Cambios de tecnología" value={novedadesPorTipo.CAMBIO_TECNOLOGIA} />
        </div>

        {/* Panel de filtros avanzados */}
        <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "20px"
        }}>
            <h3 style={{ color: "#0f7c90", fontSize: "15px", marginBottom: "15px", fontWeight: "600" }}>
                🔍 Filtros Avanzados
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {/* Fecha desde */}
                <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "5px", fontWeight: "500" }}>
                        Fecha desde
                    </label>
                    <input
                        type="date"
                        value={filtros.fechaDesde}
                        onChange={(e) => setFiltros({...filtros, fechaDesde: e.target.value})}
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                {/* Fecha hasta */}
                <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "5px", fontWeight: "500" }}>
                        Fecha hasta
                    </label>
                    <input
                        type="date"
                        value={filtros.fechaHasta}
                        onChange={(e) => setFiltros({...filtros, fechaHasta: e.target.value})}
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                {/* Costo mínimo */}
                <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "5px", fontWeight: "500" }}>
                        Costo mínimo ($)
                    </label>
                    <input
                        type="number"
                        value={filtros.costoMin}
                        onChange={(e) => setFiltros({...filtros, costoMin: e.target.value})}
                        placeholder="0"
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                {/* Costo máximo */}
                <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "5px", fontWeight: "500" }}>
                        Costo máximo ($)
                    </label>
                    <input
                        type="number"
                        value={filtros.costoMax}
                        onChange={(e) => setFiltros({...filtros, costoMax: e.target.value})}
                        placeholder="∞"
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                {/* Tipo de elemento */}
                <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "5px", fontWeight: "500" }}>
                        Tipo de elemento
                    </label>
                    <input
                        type="text"
                        value={filtros.tipoElemento}
                        onChange={(e) => setFiltros({...filtros, tipoElemento: e.target.value})}
                        placeholder="LED, Sodio, etc."
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                {/* Número de lámpara */}
                <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#475569", marginBottom: "5px", fontWeight: "500" }}>
                        Nº Lámpara
                    </label>
                    <input
                        type="text"
                        value={filtros.numeroLampara}
                        onChange={(e) => setFiltros({...filtros, numeroLampara: e.target.value})}
                        placeholder="1-2407"
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                {/* Botón de limpiar filtros */}
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button
                        onClick={() => setFiltros({
                            fechaDesde: "",
                            fechaHasta: "",
                            costoMin: "",
                            costoMax: "",
                            tipoElemento: "",
                            numeroLampara: "",
                            tipoNovedad: "todas"
                        })}
                        style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: "#f1f5f9",
                            color: "#475569",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "500"
                        }}
                    >
                        Limpiar filtros
                    </button>
                </div>

                {/* Contador de resultados */}
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <div style={{
                        width: "100%",
                        padding: "8px 10px",
                        background: "#f0f9ff",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#0f7c90",
                        fontWeight: "600",
                        textAlign: "center"
                    }}>
                        {gastosFiltrados.length} resultado{gastosFiltrados.length !== 1 ? "s" : ""}
                    </div>
                </div>
            </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px" }}>
            <section style={panelStyle}>
            <h3 style={panelTitle}>Reporte de gastos de inventario</h3>
            <div style={{ marginBottom: "12px" }}>
                <input
                type="text"
                placeholder="Buscar por elemento, código o lámpara..."
                value={busquedaGasto}
                onChange={(e) => setBusquedaGasto(e.target.value)}
                style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    background: "#f8fafc",
                    boxSizing: "border-box"
                }}
                />
            </div>
            {loading ? (
                <p style={mutedText}>Cargando gastos...</p>
            ) : gastosFiltrados.length === 0 ? (
                <p style={mutedText}>No hay gastos registrados.</p>
            ) : (
                <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                    <thead>
                    <tr style={tableHeaderRowStyle}>
                        <th style={thStyle}>Fecha</th>
                        <th style={thStyle}>Novedad</th>
                        <th style={thStyle}>Lámpara</th>
                        <th style={thStyle}>Elemento</th>
                        <th style={thStyle}>Electricista</th>
                        <th style={thStyle}>Tipo mov.</th>
                        <th style={thStyle}>Cantidad</th>
                        <th style={thStyle}>Costo unit.</th>
                        <th style={thStyle}>Costo total</th>
                        <th style={thStyle}>PQR</th>
                        <th style={thStyle}>Observación</th>
                    </tr>
                    </thead>
                    <tbody>
                    {gastosFiltrados.slice(0, 8).map((g) => (
                        <tr key={g.id_gasto} style={tableRowStyle}>
                        <td style={tdStyle}>{formatDate(g.fecha || g.fecha_registro)}</td>
                        <td style={tdStyle}>#{g.id_novedad}</td>
                        <td style={tdStyle}>{g.numero_lampara}</td>
                        <td style={tdStyle}>{g.elemento}</td>
                        <td style={tdStyle}>{g.nombre_electricista || (g.id_electricista ? `ID ${g.id_electricista}` : "-")}</td>
                        <td style={tdStyle}>{g.tipo_movimiento}</td>
                        <td style={tdStyle}>{g.cantidad_usada}</td>
                        <td style={tdStyle}>${formatCurrency(g.costo_unitario)}</td>
                        <td style={tdStyle}>${formatCurrency(getCantidadConSigno(g) * Number(g.costo_unitario || 0))}</td>
                        <td style={tdStyle}>{g.codigo_pqr || "-"}</td>
                        <td style={tdStyle}>{g.observacion || "-"}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                {gastosFiltrados.length > 8 && (
                    <p style={{ marginTop: "10px", color: "#64748b", fontSize: "12px" }}>
                    Mostrando 8 de {gastosFiltrados.length} registros.
                    </p>
                )}
                <div style={{
                    marginTop: "14px",
                    padding: "12px",
                    background: "#f0f9ff",
                    borderRadius: "8px",
                    borderLeft: "4px solid #0f7c90"
                }}>
                    <div style={{ fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                    Total gastado:
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: "bold", color: "#0f7c90" }}>
                    ${formatCurrency(totalGastosFiltrados)}
                    </div>
                </div>
                </div>
            )}
            </section>

            <section style={panelStyle}>
            <h3 style={panelTitle}>Reporte de novedades</h3>
            {loading ? (
                <p style={mutedText}>Cargando novedades...</p>
            ) : novedades.length === 0 ? (
                <p style={mutedText}>No hay novedades registradas.</p>
            ) : (
                <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                    <SmallStat label="Mantenimiento" value={novedadesPorTipo.MANTENIMIENTO} />
                    <SmallStat label="Reparación" value={novedadesPorTipo.REPARACION} />
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle}>
                    <thead>
                        <tr style={tableHeaderRowStyle}>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Lámpara</th>
                        <th style={thStyle}>Tipo</th>
                        <th style={thStyle}>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {novedades.slice(0, 8).map((n) => (
                        <tr key={n.id_novedad} style={tableRowStyle}>
                            <td style={tdStyle}>#{n.id_novedad}</td>
                            <td style={tdStyle}>{n.numero_lampara}</td>
                            <td style={tdStyle}>{n.tipo_novedad}</td>
                            <td style={tdStyle}>{new Date(n.fecha_novedad).toLocaleDateString()}</td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                    {novedades.length > 8 && (
                    <p style={{ marginTop: "10px", color: "#64748b", fontSize: "12px" }}>
                        Mostrando 8 de {novedades.length} registros.
                    </p>
                    )}
                </div>
                </>
            )}
            </section>
        </div>
        </div>
    );
}

function Card({ title, value }) {
    return (
        <div style={{
        background: "white",
        padding: "14px",
        borderRadius: "10px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
        }}>
        <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>{title}</div>
        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0f7c90" }}>{value}</div>
        </div>
    );
}

function SmallStat({ label, value }) {
    return (
        <div style={{
        padding: "10px",
        borderRadius: "8px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0"
        }}>
        <div style={{ fontSize: "12px", color: "#64748b" }}>{label}</div>
        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#0f7c90" }}>{value}</div>
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
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
};

const panelTitle = {
    color: "#0f7c90",
    marginBottom: "16px"
};

const mutedText = { color: "#94a3b8" };

const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "13px" };
const tableHeaderRowStyle = { borderBottom: "2px solid #e2e8f0", background: "#f8fafc" };
const tableRowStyle = { borderBottom: "1px solid #e2e8f0" };
const thStyle = { padding: "8px 10px", textAlign: "left", color: "#0a5c6d" };
const tdStyle = { padding: "8px 10px", color: "#475569" };
