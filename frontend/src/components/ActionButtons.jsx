import { Link } from "react-router-dom";

const actions = [
    { label: "Registrar Novedad", path: "/novedad-censo", category: "registro" },
    { label: "Ingresar al Inventario", path: "/inventario-bodega", category: "inventario" },
    { label: "Devoluciones / Préstamos", path: "/devoluciones-prestamos", category: "inventario" },
    { label: "Gestionar Electricistas", path: "/electricistas", category: "gestion" },
    { label: "Ver Reportes", path: "/reporte-novedades", category: "reportes" }
];

const getCategoryColor = (category) => {
    const colors = {
        registro: "#0f7c90",
        inventario: "#10b981",
        gestion: "#8b5cf6",
        reportes: "#f59e0b"
    };
    return colors[category] || "#0f7c90";
};

export default function ActionButtons() {
    return (
        <div>
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "15px",
                marginBottom: "20px"
            }}>
                {actions.map((action) => (
                    <Link
                        key={action.path}
                        to={action.path}
                        style={{ textDecoration: "none" }}
                    >
                        <button
                            style={{
                                width: "100%",
                                padding: "15px",
                                background: getCategoryColor(action.category),
                                color: "white",
                                border: "none",
                                borderRadius: "10px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                transition: "opacity 0.2s"
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = "0.9"}
                            onMouseLeave={(e) => e.target.style.opacity = "1"}
                        >
                            {action.label}
                        </button>
                    </Link>
                ))}
            </div>
        </div>
    );
}
