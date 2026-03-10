import { useEffect, useState, useMemo } from "react";
import { getElectricistas, updateElectricista } from "../api/electricistas.api";
import { useNotification } from "../hooks/useNotification";
import ElectristaForm from "./ElectristaForm";

export default function ElectristaList() {
    const [electricistas, setElectricistas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showForm, setShowForm] = useState(false);
    const { success, error: errorNotification } = useNotification();

    useEffect(() => {
        cargarElectricistas();
    }, []);

    const cargarElectricistas = async () => {
        try {
            setLoading(true);
            const data = await getElectricistas();
            setElectricistas(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error cargando electricistas:", err);
            errorNotification("Error al cargar los electricistas");
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return electricistas;
        return electricistas.filter((e) =>
            e.nombre?.toLowerCase().includes(term) ||
            String(e.documento || "").toLowerCase().includes(term)
        );
    }, [electricistas, searchTerm]);

    const handleCreated = (nuevo) => {
        setElectricistas((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setShowForm(false);
    };

    const handleToggleActivo = async (electricista) => {
        const siguienteEstado = !Boolean(electricista.activo);
        try {
            setUpdatingId(electricista.id_electricista);
            const actualizado = await updateElectricista(electricista.id_electricista, {
                activo: siguienteEstado
            });

            setElectricistas((prev) =>
                prev.map((item) =>
                    item.id_electricista === electricista.id_electricista
                        ? { ...item, activo: Boolean(actualizado?.activo) }
                        : item
                )
            );

            success(
                siguienteEstado
                    ? `${electricista.nombre} quedó disponible`
                    : `${electricista.nombre} quedó no disponible`
            );
        } catch (err) {
            console.error("Error actualizando estado del electricista:", err);
            errorNotification("No se pudo actualizar la disponibilidad");
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
            }}>
                <h2 style={{
                    fontSize: "24px",
                    fontWeight: "bold"
                }}>Electricistas</h2>
                <button
                    style={{
                        background: "#10b981",
                        color: "white",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "bold"
                    }}
                    onMouseOver={(e) => e.target.style.background = "#059669"}
                    onMouseOut={(e) => e.target.style.background = "#10b981"}
                    onClick={() => setShowForm((prev) => !prev)}
                >
                    {showForm ? "Cerrar formulario" : "+ Nuevo Electricista"}
                </button>
            </div>

            {showForm && (
                <ElectristaForm
                    onSuccess={handleCreated}
                    onCancel={() => setShowForm(false)}
                />
            )}

            <input
                type="text"
                placeholder="Buscar por nombre o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box"
                }}
            />

            <div style={{
                background: "white",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                padding: "16px",
                minHeight: "120px"
            }}>
                {loading ? (
                    <div style={{ textAlign: "center", color: "#6b7280", padding: "24px" }}>
                        Cargando electricistas...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#9ca3af", padding: "24px" }}>
                        No hay electricistas registrados.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {filtered.map((e) => (
                            <div
                                key={e.id_electricista}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px 12px",
                                    borderRadius: "8px",
                                    border: "1px solid #e5e7eb",
                                    background: e.activo ? "#f9fafb" : "#fef2f2",
                                    fontSize: "14px"
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: "600", color: "#111827" }}>{e.nombre}</div>
                                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                                        Doc: {e.documento}{" "}
                                        {e.telefono && (
                                            <span style={{ marginLeft: "8px" }}>
                                                • Tel: {e.telefono}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleToggleActivo(e)}
                                    disabled={updatingId === e.id_electricista}
                                    aria-label={e.activo ? "Marcar como no disponible" : "Marcar como disponible"}
                                    title={e.activo ? "Disponible" : "No disponible"}
                                    style={{
                                        width: "80px",
                                        height: "36px",
                                        borderRadius: "999px",
                                        border: "none",
                                        background: e.activo ? "linear-gradient(90deg, #34d399 0%, #22c55e 100%)" : "#d1d5db",
                                        position: "relative",
                                        cursor: updatingId === e.id_electricista ? "not-allowed" : "pointer",
                                        transition: "background 0.25s ease, opacity 0.2s ease",
                                        opacity: updatingId === e.id_electricista ? 0.65 : 1,
                                        padding: "0 10px",
                                        textAlign: "left"
                                    }}
                                >
                                    <span
                                        style={{
                                            position: "absolute",
                                            top: "4px",
                                            left: e.activo ? "46px" : "4px",
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "50%",
                                            background: "#ffffff",
                                            boxShadow: "0 2px 6px rgba(0,0,0,0.24)",
                                            transition: "left 0.25s ease"
                                        }}
                                    />
                                    <span style={{
                                        fontSize: "11px",
                                        fontWeight: "700",
                                        color: e.activo ? "#ecfdf5" : "#475569",
                                        letterSpacing: "0.03em"
                                    }}>
                                        {updatingId === e.id_electricista ? "..." : e.activo ? "ON" : "OFF"}
                                    </span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
