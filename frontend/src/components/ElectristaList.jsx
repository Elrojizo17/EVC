import { useEffect, useState, useMemo } from "react";
import { getElectricistas, updateElectricista } from "../api/electricistas.api";
import { useNotification } from "../hooks/useNotification";
import ElectristaForm from "./ElectristaForm";
import OtpModal from "./OtpModal";

export default function ElectristaList() {
    const [electricistas, setElectricistas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [mostrarOtp, setMostrarOtp] = useState(false);
    const [electricistaEnEdicion, setElectricistaEnEdicion] = useState(null);
    const [nombreEditado, setNombreEditado] = useState("");
    const [documentoEditado, setDocumentoEditado] = useState("");
    const [telefonoEditado, setTelefonoEditado] = useState("");
    const [estadoEditadoActivo, setEstadoEditadoActivo] = useState(false);
    const [pendingCambio, setPendingCambio] = useState(null);
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

    const ejecutarActualizacionElectricista = async ({ electricistaOriginal, payload }) => {
        try {
            setUpdatingId(electricistaOriginal.id_electricista);
            const actualizado = await updateElectricista(electricistaOriginal.id_electricista, payload);

            setElectricistas((prev) =>
                prev.map((item) =>
                    item.id_electricista === electricistaOriginal.id_electricista
                        ? { ...item, ...actualizado }
                        : item
                )
            );

            success("Electricista actualizado correctamente");
        } catch (err) {
            console.error("Error actualizando electricista:", err);
            errorNotification("No se pudo actualizar el electricista");
        } finally {
            setUpdatingId(null);
        }
    };

    const abrirEditorElectricista = (electricista) => {
        setElectricistaEnEdicion(electricista);
        setNombreEditado(electricista.nombre || "");
        setDocumentoEditado(String(electricista.documento || ""));
        setTelefonoEditado(String(electricista.telefono || ""));
        setEstadoEditadoActivo(Boolean(electricista.activo));
    };

    const cerrarEditorElectricista = () => {
        setElectricistaEnEdicion(null);
        setNombreEditado("");
        setDocumentoEditado("");
        setTelefonoEditado("");
    };

    const solicitarOtpParaGuardar = () => {
        if (!electricistaEnEdicion) {
            return;
        }

        const nombreNormalizado = nombreEditado.trim();
        const documentoNormalizado = documentoEditado.trim();
        const telefonoNormalizado = telefonoEditado.trim();
        const estadoOriginal = Boolean(electricistaEnEdicion.activo);
        const hayCambios =
            nombreNormalizado !== String(electricistaEnEdicion.nombre || "") ||
            documentoNormalizado !== String(electricistaEnEdicion.documento || "") ||
            telefonoNormalizado !== String(electricistaEnEdicion.telefono || "") ||
            estadoOriginal !== estadoEditadoActivo;

        if (!nombreNormalizado || !documentoNormalizado) {
            errorNotification("Nombre y documento son obligatorios");
            return;
        }

        if (!hayCambios) {
            cerrarEditorElectricista();
            return;
        }

        setPendingCambio({
            electricistaOriginal: electricistaEnEdicion,
            payload: {
                nombre: nombreNormalizado,
                documento: documentoNormalizado,
                telefono: telefonoNormalizado || null,
                activo: estadoEditadoActivo
            }
        });
        setMostrarOtp(false);
        setMostrarOtp(true);
    };

    const handleOtpVerificado = async () => {
        if (!pendingCambio) {
            setMostrarOtp(false);
            return;
        }

        const cambio = pendingCambio;
        setMostrarOtp(false);
        setPendingCambio(null);
        cerrarEditorElectricista();
        await ejecutarActualizacionElectricista(cambio);
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
                                    onClick={() => abrirEditorElectricista(e)}
                                    disabled={updatingId === e.id_electricista}
                                    aria-label="Editar electricista"
                                    title="Editar electricista"
                                    style={{
                                        borderRadius: "8px",
                                        border: "1px solid #1e78bd",
                                        background: "white",
                                        color: "#1e78bd",
                                        padding: "8px 10px",
                                        cursor: updatingId === e.id_electricista ? "not-allowed" : "pointer",
                                        opacity: updatingId === e.id_electricista ? 0.65 : 1,
                                        fontWeight: "600",
                                        fontSize: "12px"
                                    }}
                                >
                                    Editar electricista
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <OtpModal
                isOpen={mostrarOtp}
                onClose={() => {
                    setMostrarOtp(false);
                    setPendingCambio(null);
                }}
                onVerificado={handleOtpVerificado}
            />

            {electricistaEnEdicion && (
                <div style={overlayStyle}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, color: "#0a5c6d" }}>Editar Electricista</h3>

                        <label style={{ display: "block", fontSize: "12px", color: "#334155", marginBottom: "6px", fontWeight: "600" }}>
                            Nombre
                        </label>
                        <input
                            type="text"
                            value={nombreEditado}
                            onChange={(e) => setNombreEditado(e.target.value)}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "14px", boxSizing: "border-box" }}
                        />

                        <label style={{ display: "block", fontSize: "12px", color: "#334155", marginBottom: "6px", fontWeight: "600" }}>
                            Documento
                        </label>
                        <input
                            type="text"
                            value={documentoEditado}
                            onChange={(e) => setDocumentoEditado(e.target.value)}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "14px", boxSizing: "border-box" }}
                        />

                        <label style={{ display: "block", fontSize: "12px", color: "#334155", marginBottom: "6px", fontWeight: "600" }}>
                            Telefono
                        </label>
                        <input
                            type="text"
                            value={telefonoEditado}
                            onChange={(e) => setTelefonoEditado(e.target.value)}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "14px", boxSizing: "border-box" }}
                        />

                        <label style={{ display: "block", fontSize: "12px", color: "#334155", marginBottom: "6px", fontWeight: "600" }}>
                            Disponibilidad
                        </label>
                        <select
                            value={estadoEditadoActivo ? "ON" : "OFF"}
                            onChange={(e) => setEstadoEditadoActivo(e.target.value === "ON")}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "14px" }}
                        >
                            <option value="ON">Disponible (ON)</option>
                            <option value="OFF">No disponible (OFF)</option>
                        </select>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button type="button" onClick={cerrarEditorElectricista} style={buttonSecondaryStyle}>Cerrar</button>
                            <button type="button" onClick={solicitarOtpParaGuardar} style={buttonPrimaryStyle}>Guardar cambios</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2200,
    padding: "16px"
};

const modalStyle = {
    width: "min(440px, 100%)",
    background: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 15px 30px rgba(0,0,0,0.2)"
};

const buttonPrimaryStyle = {
    border: "none",
    borderRadius: "8px",
    padding: "9px 14px",
    background: "#1e78bd",
    color: "white",
    cursor: "pointer",
    fontWeight: "600"
};

const buttonSecondaryStyle = {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "9px 14px",
    background: "white",
    color: "#334155",
    cursor: "pointer",
    fontWeight: "600"
};
