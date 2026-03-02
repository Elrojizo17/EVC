import { useEffect, useState } from "react";
import axios from "axios";
import { getNovedades } from "../api/novedades.api";
import { getGastos } from "../api/gastos.api";

const getLuminarias = async () => {
    try {
        const response = await axios.get("http://localhost:3000/api/luminarias");
        return response.data;
    } catch (error) {
        console.error("Error fetching luminarias:", error);
        throw error;
    }
};

export default function StatsCards() {
    const [stats, setStats] = useState({
        totalLuminarias: 0,
        novedadesMes: 0,
        gastoTotal: 0,
        led: 0,
        sodio: 0,
        metalHalide: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargarEstadisticas();
    }, []);

    const cargarEstadisticas = async () => {
        try {
            setLoading(true);
            const [luminarias, novedades, gastos] = await Promise.all([
                getLuminarias(),
                getNovedades(),
                getGastos()
            ]);

            // Total de luminarias
            const total = Array.isArray(luminarias) ? luminarias.length : 0;

            // Distribución por tecnología
            const led = luminarias.filter(l => String(l.tecnologia || "").toLowerCase().includes("led")).length;
            const sodio = luminarias.filter(l => String(l.tecnologia || "").toLowerCase().includes("sodio")).length;
            const metalHalide = luminarias.filter(l => String(l.tecnologia || "").toLowerCase().includes("metal_halide")).length;

            // Novedades del mes actual
            const fechaActual = new Date();
            const mesActual = fechaActual.getMonth();
            const añoActual = fechaActual.getFullYear();
            const novedadesMes = Array.isArray(novedades) 
                ? novedades.filter(n => {
                    const fechaNovedad = new Date(n.fecha_novedad);
                    return fechaNovedad.getMonth() === mesActual && fechaNovedad.getFullYear() === añoActual;
                }).length 
                : 0;

            // Gasto total (suma de cantidad * costo_unitario)
            const gastoTotal = Array.isArray(gastos)
                ? gastos.reduce((total, g) => {
                    const cantidad = Number(g.cantidad_usada || 0);
                    const costo = Number(g.costo_unitario || 0);
                    return total + (cantidad * costo);
                }, 0)
                : 0;

            setStats({
                totalLuminarias: total,
                novedadesMes,
                gastoTotal,
                led,
                sodio,
                metalHalide
            });
        } catch (err) {
            console.error("Error cargando estadísticas:", err);
        } finally {
            setLoading(false);
        }
    };

    const cardStyle = {
        background: "white",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
        transition: "transform 0.2s, box-shadow 0.2s"
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value);
    };

    if (loading) {
        return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", marginBottom: "20px" }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ ...cardStyle, height: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ color: "#94a3b8", fontSize: "14px" }}>Cargando...</div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", marginBottom: "20px" }}>
            {/* Total de luminarias */}
            <div style={cardStyle}>
                <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px", fontWeight: "500" }}>
                    TOTAL LUMINARIAS
                </div>
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "#0a5c6d", marginBottom: "5px" }}>
                    {stats.totalLuminarias}
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    Registradas en el sistema
                </div>
            </div>

            {/* Novedades del mes */}
            <div style={cardStyle}>
                <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px", fontWeight: "500" }}>
                    NOVEDADES DEL MES
                </div>
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "#0f7c90", marginBottom: "5px" }}>
                    {stats.novedadesMes}
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </div>
            </div>

            {/* Gasto total */}
            <div style={cardStyle}>
                <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px", fontWeight: "500" }}>
                    GASTO TOTAL
                </div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "#059669", marginBottom: "5px" }}>
                    {formatCurrency(stats.gastoTotal)}
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    En mantenimiento
                </div>
            </div>

            {/* Distribución por tecnología */}
            <div style={cardStyle}>
                <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px", fontWeight: "500" }}>
                    DISTRIBUCIÓN
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#0066ff" }}></div>
                            <span style={{ fontSize: "12px", color: "#475569" }}>LED</span>
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: "bold", color: "#1e293b" }}>{stats.led}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ff0033" }}></div>
                            <span style={{ fontSize: "12px", color: "#475569" }}>Sodio</span>
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: "bold", color: "#1e293b" }}>{stats.sodio}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#00cc44" }}></div>
                            <span style={{ fontSize: "12px", color: "#475569" }}>Metal H.</span>
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: "bold", color: "#1e293b" }}>{stats.metalHalide}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
