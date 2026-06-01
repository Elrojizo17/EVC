import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles, children }) {
    const { token, rol, ready } = useAuth();
    const location = useLocation();

    if (!ready) {
        return null;
    }

    if (!token) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (allowedRoles && !allowedRoles.includes(rol)) {
        return <Navigate to="/" replace />;
    }

    return children;
}
