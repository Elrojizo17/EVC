import ElectristaList from "../components/ElectristaList";

export default function Electricistas() {
    return (
        <div style={{ padding: "8px 10px", maxWidth: "1200px", margin: "0 auto" }}>
            <h1 style={{ color: "#1d3554", marginBottom: "10px" }}>Gestión de electricistas</h1>
            <p style={{ color: "#64748b", marginBottom: "20px" }}>
                Administra los registros de electricistas activos y disponibles en el sistema.
            </p>
            <div>
                <ElectristaList />
            </div>
        </div>
    );
}
