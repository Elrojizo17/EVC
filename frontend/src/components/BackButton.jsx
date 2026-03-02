import { Link } from "react-router-dom";

export default function BackButton({ to = "/", label = "Volver al inicio" }) {
    return (
        <Link
        to={to}
        style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "none",
            background: "#0f7c90",
            color: "white",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "13px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.12)"
        }}
        >
        <span
            style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "22px",
            height: "22px",
            borderRadius: "999px",
            background: "rgba(255, 255, 255, 0.2)",
            color: "white",
            fontSize: "14px",
            lineHeight: 1
            }}
        >
            ←
        </span>
        {label}
        </Link>
    );
}
