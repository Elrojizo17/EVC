import { useEffect, useMemo, useState } from "react";
import { solicitarOtp, verificarOtp } from "../api/otp.api";

export default function OtpModal({ isOpen, onClose, onVerificado }) {
    const [codigo, setCodigo] = useState("");
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [loadingSolicitar, setLoadingSolicitar] = useState(false);
    const [loadingVerificar, setLoadingVerificar] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(0);

    useEffect(() => {
        if (!isOpen || secondsLeft <= 0) {
            return undefined;
        }

        const intervalId = setInterval(() => {
            setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isOpen, secondsLeft]);

    useEffect(() => {
        if (secondsLeft === 0 && mensaje.includes("enviado")) {
            setError("El codigo OTP expiro. Solicita uno nuevo.");
        }
    }, [secondsLeft, mensaje]);

    const countdownLabel = useMemo(() => {
        if (secondsLeft <= 0) {
            return "00:00";
        }

        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }, [secondsLeft]);

    if (!isOpen) {
        return null;
    }

    const handleSolicitar = async () => {
        try {
            setError("");
            setMensaje("");
            setLoadingSolicitar(true);
            const response = await solicitarOtp();
            const ttl = Number(response?.expiresInSeconds || 0);
            setSecondsLeft(Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : 300);
            if (response?.devOtp) {
                setMensaje(`Modo desarrollo: OTP ${response.devOtp}`);
            } else {
                setMensaje("Codigo OTP enviado al correo configurado.");
            }
        } catch (err) {
            setError(err.message || "No se pudo solicitar el OTP");
        } finally {
            setLoadingSolicitar(false);
        }
    };

    const handleVerificar = async () => {
        try {
            setError("");
            setLoadingVerificar(true);

            if (secondsLeft <= 0) {
                setError("El codigo OTP expiro. Solicita uno nuevo.");
                return;
            }

            const response = await verificarOtp(codigo);

            if (!response?.valido) {
                setError("Codigo incorrecto o expirado");
                return;
            }

            setMensaje("OTP validado correctamente.");
            setCodigo("");
            setSecondsLeft(0);
            onVerificado?.();
        } catch (err) {
            setError(err.message || "No se pudo verificar el OTP");
        } finally {
            setLoadingVerificar(false);
        }
    };

    return (
        <div
            style={overlayStyle}
            onClick={onClose}
        >
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, color: "#0a5c6d" }}>Validacion OTP requerida</h3>
                <p style={{ color: "#64748b", fontSize: "14px", marginTop: "6px" }}>
                    Solicita un codigo temporal y validalo para habilitar acciones de edicion.
                </p>

                <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <button
                        type="button"
                        onClick={handleSolicitar}
                        disabled={loadingSolicitar || loadingVerificar}
                        style={buttonPrimaryStyle}
                    >
                        {loadingSolicitar ? "Enviando..." : "Solicitar codigo"}
                    </button>
                </div>

                <div style={{ marginBottom: "10px", fontSize: "12px", color: secondsLeft > 0 ? "#334155" : "#b91c1c" }}>
                    Expiracion OTP: {countdownLabel}
                </div>

                <label style={labelStyle}>Codigo OTP</label>
                <input
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ingresa el codigo"
                    style={inputStyle}
                    disabled={loadingVerificar}
                />

                {error && <div style={errorStyle}>{error}</div>}
                {mensaje && <div style={okStyle}>{mensaje}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                    <button type="button" onClick={onClose} style={buttonSecondaryStyle} disabled={loadingVerificar || loadingSolicitar}>
                        Cerrar
                    </button>
                    <button
                        type="button"
                        onClick={handleVerificar}
                        style={buttonPrimaryStyle}
                        disabled={!codigo || loadingVerificar || loadingSolicitar || secondsLeft <= 0}
                    >
                        {loadingVerificar ? "Verificando..." : "Verificar"}
                    </button>
                </div>
            </div>
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
    zIndex: 3000,
    padding: "16px"
};

const modalStyle = {
    width: "min(460px, 100%)",
    background: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 15px 30px rgba(0,0,0,0.2)"
};

const labelStyle = {
    display: "block",
    fontSize: "12px",
    marginBottom: "6px",
    color: "#334155",
    fontWeight: "600"
};

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    boxSizing: "border-box",
    fontSize: "14px"
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

const errorStyle = {
    marginTop: "8px",
    fontSize: "12px",
    color: "#dc2626"
};

const okStyle = {
    marginTop: "8px",
    fontSize: "12px",
    color: "#059669"
};
