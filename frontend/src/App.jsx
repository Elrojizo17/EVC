import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Dashboard from "./pages/Dashboard";
import NovedadCenso from "./pages/NovedadCenso";
import InventarioBodega from "./pages/InventarioBodega";
import ReporteNovedades from "./pages/ReporteNovedades";
import ReporteGastosGenerales from "./pages/ReporteGastosGenerales";
import Electricistas from "./pages/Electricistas";
import DevolucionesPrestamos from "./pages/DevolucionesPrestamos";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingScreen from "./components/LoadingScreen";
import Login from "./pages/Login";
import { pingHealth } from "./api/auth.api";

function App() {
  const [healthReady, setHealthReady] = useState(false);

  useEffect(() => {
    let active = true;
    let retryTimeout;

    const checkHealth = async () => {
      try {
        await pingHealth();
        if (active) {
          setHealthReady(true);
        }
      } catch (error) {
        if (active) {
          retryTimeout = setTimeout(checkHealth, 3000);
        }
      }
    };

    checkHealth();

    return () => {
      active = false;
      clearTimeout(retryTimeout);
    };
  }, []);

  if (!healthReady) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        containerClassName=""
        containerStyle={{}}
        toastOptions={{
          className: '',
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "INVITADO"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/novedad-censo"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AppShell><NovedadCenso /></AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario-bodega"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AppShell><InventarioBodega /></AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reporte-novedades"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AppShell><ReporteNovedades /></AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reporte-gastos"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AppShell><ReporteGastosGenerales /></AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/electricistas"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AppShell><Electricistas /></AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/devoluciones-prestamos"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AppShell><DevolucionesPrestamos /></AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
