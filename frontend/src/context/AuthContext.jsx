import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginAdmin, loginInvitado } from "../api/auth.api";

const AUTH_STORAGE_KEY = "evc_auth";
const TOKEN_STORAGE_KEY = "evc_token";

const AuthContext = createContext(null);

const parseStoredAuth = () => {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [usuario, setUsuario] = useState(null);
    const [rol, setRol] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const stored = parseStoredAuth();
        if (stored?.token) {
            setToken(stored.token);
            setUsuario(stored.usuario || null);
            setRol(stored.rol || stored.usuario?.rol || null);
            localStorage.setItem(TOKEN_STORAGE_KEY, stored.token);
        }
        setReady(true);
    }, []);

    const persistAuth = (payload) => {
        const authPayload = {
            token: payload.token,
            usuario: payload.usuario,
            rol: payload.usuario?.rol || payload.rol || null
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authPayload));
        localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
        setToken(payload.token);
        setUsuario(payload.usuario);
        setRol(authPayload.rol);
    };

    const login = async (usuarioInput, password) => {
        const data = await loginAdmin(usuarioInput, password);
        persistAuth({
            token: data.token,
            usuario: data.usuario
        });
        return data.usuario;
    };

    const loginAsGuest = async () => {
        const data = await loginInvitado();
        persistAuth({
            token: data.token,
            usuario: data.usuario
        });
        return data.usuario;
    };

    const logout = () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUsuario(null);
        setRol(null);
    };

    const value = useMemo(() => ({
        token,
        usuario,
        rol,
        ready,
        login,
        loginAsGuest,
        logout
    }), [token, usuario, rol, ready]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth debe usarse dentro de AuthProvider");
    }
    return context;
};
