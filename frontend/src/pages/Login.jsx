import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoEvc from "../assets/evc-logo.svg";
import "./Login.css";

export default function Login() {
    const { login, loginAsGuest, token } = useAuth();
    const navigate = useNavigate();
    const [usuario, setUsuario] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (token) {
            navigate("/", { replace: true });
        }
    }, [token, navigate]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(usuario.trim(), password);
            navigate("/", { replace: true });
        } catch (err) {
            setError(err.message || "No se pudo iniciar sesion");
        } finally {
            setLoading(false);
        }
    };

    const handleGuest = async () => {
        setError("");
        setLoading(true);
        try {
            await loginAsGuest();
            navigate("/", { replace: true });
        } catch (err) {
            setError(err.message || "No se pudo ingresar como invitado");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <img src={logoEvc} alt="Logo EVC" className="login-logo" />
                <h1 className="login-title">Acceso al Sistema</h1>
                <p className="login-subtitle">Gestion de luminarias publicas de EVC</p>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label className="login-label" htmlFor="usuario">Usuario</label>
                    <input
                        id="usuario"
                        type="text"
                        value={usuario}
                        onChange={(event) => setUsuario(event.target.value)}
                        placeholder="Usuario administrador"
                        autoComplete="username"
                    />

                    <label className="login-label" htmlFor="password">Contrasena</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Contrasena"
                        autoComplete="current-password"
                    />

                    {error && <div className="login-error">{error}</div>}

                    <button className="login-primary" type="submit" disabled={loading}>
                        {loading ? "Ingresando..." : "Iniciar Sesion"}
                    </button>
                </form>

                <div className="login-divider">
                    <span>o</span>
                </div>

                <button className="login-secondary" type="button" onClick={handleGuest} disabled={loading}>
                    Entrar como Invitado
                </button>
            </div>
        </div>
    );
}
