import { useEffect, useMemo, useState } from "react";
import { getNovedades } from "../api/novedades.api";
import { getGastos, createGasto } from "../api/gastos.api";
import { getInventario } from "../api/inventario.api";
import { getElectricistas } from "../api/electricistas.api";
import { getUiConfig } from "../api/config.api";
import { getCostoTotalMovimiento } from "../utils/gastos";
import { useNotification } from "../hooks/useNotification";
import { UMBRAL_STOCK_BAJO } from "../constants/inventario";

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
    const [umbralStockBajo, setUmbralStockBajo] = useState(UMBRAL_STOCK_BAJO);
    const [electricistas, setElectricistas] = useState([]);
    const [busquedaInventario, setBusquedaInventario] = useState("");
    const [submitMovimientoLoading, setSubmitMovimientoLoading] = useState(false);
    const [itemError, setItemError] = useState("");
    const [formMovimiento, setFormMovimiento] = useState({
        id_inventario: "",
        tipo_movimiento: "DESPACHADO",
        cantidad_usada: "",
        id_electricista: "",
        codigo_pqr: "",
        observacion: ""
    });
    const [ordenNovedades, setOrdenNovedades] = useState("asc");
    const [ordenCodigoMovimientos, setOrdenCodigoMovimientos] = useState("asc");
    const { success, error: errorNotification } = useNotification();

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

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const [novedadesData, gastosData] = await Promise.all([
                getNovedades(),
                getGastos()
            ]);
            setNovedades(Array.isArray(novedadesData) ? novedadesData : []);
            setGastos(Array.isArray(gastosData) ? gastosData : []);

            const [inventarioData, electricistasData] = await Promise.all([
                getInventario(),
                getElectricistas()
            ]);

            setInventario(Array.isArray(inventarioData) ? inventarioData : []);
            setElectricistas(Array.isArray(electricistasData) ? electricistasData : []);
        } catch (err) {
            console.error("Error cargando reporte de novedades:", err);
            setError("No se pudo cargar el reporte de novedades.");
        } finally {
            setLoading(false);
        }
    };

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

    const abrirEditorMovimientos = (novedad) => {
        const movimientos = movimientosPorNovedad.get(Number(novedad.id_novedad)) || [];
        if (movimientos.length > 0) {
            errorNotification("Solo puedes usar este formulario en novedades sin movimientos registrados");
            return;
        }

        setNovedadMovimientos(novedad);
        setItemError("");
        setFormMovimiento({
            id_inventario: "",
            tipo_movimiento: "DESPACHADO",
            cantidad_usada: "",
            id_electricista: "",
            codigo_pqr: "",
            observacion: ""
        });
    };

    const cerrarEditorMovimientos = () => {
        if (submitMovimientoLoading) {
            return;
        }
        setNovedadMovimientos(null);
    };

    const handleChangeMovimiento = (event) => {
        const { name, value } = event.target;
        setFormMovimiento((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const validarMovimiento = () => {
        if (!formMovimiento.id_inventario) {
            return "Selecciona un elemento de inventario";
        }

        const cantidad = Number(formMovimiento.cantidad_usada);
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            return "La cantidad debe ser mayor a 0";
        }

        if (!formMovimiento.id_electricista) {
            return "Selecciona un electricista";
        }

        if (!String(formMovimiento.codigo_pqr || "").trim()) {
            return "El código PQR es obligatorio";
        }

        const elemento = inventario.find((i) => Number(i.id_inventario) === Number(formMovimiento.id_inventario));
        if (!elemento) {
            return "Elemento de inventario inválido";
        }

        const tiposSalida = ["DESPACHADO", "PRESTADO", "MATERIAL_EXCEDENTE"];
        if (tiposSalida.includes(formMovimiento.tipo_movimiento)) {
            const stockDisponible = Number(elemento.stock_disponible || 0);
            if (cantidad > stockDisponible) {
                return `Stock insuficiente. Disponible: ${stockDisponible}, solicitado: ${cantidad}`;
            }
        }

        return "";
    };

    const limpiarFormularioMovimiento = () => {
        setItemError("");
        setFormMovimiento({
            id_inventario: "",
            tipo_movimiento: "DESPACHADO",
            cantidad_usada: "",
            id_electricista: "",
            codigo_pqr: "",
            observacion: ""
        });
    };

    const handleSubmitMovimiento = async (event) => {
        event.preventDefault();

        if (!novedadMovimientos) {
            return;
        }

        const validacionError = validarMovimiento();
        if (validacionError) {
            setItemError(validacionError);
            return;
        }

        const payload = {
            id_lote: Number(formMovimiento.id_inventario),
            tipo_movimiento: formMovimiento.tipo_movimiento,
            cantidad: Number(formMovimiento.cantidad_usada),
            id_novedad_luminaria: Number(novedadMovimientos.id_novedad),
            id_electricista: String(formMovimiento.id_electricista),
            codigo_pqr: String(formMovimiento.codigo_pqr).trim(),
            observacion: formMovimiento.observacion || null
        };

        try {
            setSubmitMovimientoLoading(true);

            await createGasto({
                ...payload,
                fecha: formatDateForInput(novedadMovimientos.fecha_novedad)
            });
            success("Gasto asociado agregado correctamente");

            limpiarFormularioMovimiento();
            await cargarDatos();
        } catch (err) {
            errorNotification(err.message || "No se pudo guardar el movimiento");
        } finally {
            setSubmitMovimientoLoading(false);
        }
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
                                                    {movimientos.length === 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => abrirEditorMovimientos(n)}
                                                            style={buttonEditStyle}
                                                        >
                                                            Editar gastos
                                                        </button>
                                                    )}
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
                            <div><strong>Tecnología anterior:</strong> {novedadDetalle.tecnologia_anterior || "-"}</div>
                            <div><strong>Tecnología nueva:</strong> {novedadDetalle.tecnologia_nueva || "-"}</div>
                            <div><strong>Observación:</strong> {novedadDetalle.observacion || "-"}</div>
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
                                <h2 style={{ margin: 0, color: "#0a5c6d" }}>Editar gastos de la novedad #{novedadMovimientos.id_novedad}</h2>
                                <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                                    Lámpara {novedadMovimientos.numero_lampara || "Sin lámpara"} · Usa este formulario para asociar los gastos iniciales de la novedad.
                                </p>
                            </div>
                            <button type="button" onClick={cerrarEditorMovimientos} style={closeStyle} disabled={submitMovimientoLoading}>×</button>
                        </div>

                        <form onSubmit={handleSubmitMovimiento}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
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
                                    <label style={labelStyle}>Cantidad *</label>
                                    <input
                                        type="number"
                                        name="cantidad_usada"
                                        value={formMovimiento.cantidad_usada}
                                        onChange={handleChangeMovimiento}
                                        style={inputStyle}
                                        disabled={submitMovimientoLoading}
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: "12px" }}>
                                <label style={labelStyle}>Elemento de inventario *</label>
                                <input
                                    type="text"
                                    value={busquedaInventario}
                                    onChange={(e) => setBusquedaInventario(e.target.value)}
                                    placeholder="Buscar material por nombre o código..."
                                    style={{ ...inputStyle, marginBottom: "8px" }}
                                    disabled={submitMovimientoLoading}
                                />
                                <select
                                    name="id_inventario"
                                    value={formMovimiento.id_inventario}
                                    onChange={handleChangeMovimiento}
                                    style={inputStyle}
                                    disabled={submitMovimientoLoading}
                                    required
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
                                                {i.codigo_elemento} - {i.elemento}{stockTexto}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                                <div>
                                    <label style={labelStyle}>Electricista responsable *</label>
                                    <select
                                        name="id_electricista"
                                        value={formMovimiento.id_electricista}
                                        onChange={handleChangeMovimiento}
                                        style={inputStyle}
                                        disabled={submitMovimientoLoading}
                                        required
                                    >
                                        <option value="">Seleccione electricista</option>
                                        {electricistas.map((e) => (
                                            <option key={e.id_electricista} value={e.documento || e.id_electricista}>
                                                {e.nombre} (Doc: {e.documento})
                                            </option>
                                        ))}
                                    </select>
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
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: "12px" }}>
                                <label style={labelStyle}>Observación</label>
                                <textarea
                                    name="observacion"
                                    value={formMovimiento.observacion}
                                    onChange={handleChangeMovimiento}
                                    style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
                                    disabled={submitMovimientoLoading}
                                />
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

function formatDateForInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
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
