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

function App() {
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
        <Route path="/" element={<Dashboard />} />
        <Route path="/novedad-censo" element={<AppShell><NovedadCenso /></AppShell>} />
        <Route path="/inventario-bodega" element={<AppShell><InventarioBodega /></AppShell>} />
        <Route path="/reporte-novedades" element={<AppShell><ReporteNovedades /></AppShell>} />
        <Route path="/reporte-gastos" element={<AppShell><ReporteGastosGenerales /></AppShell>} />
        <Route path="/electricistas" element={<AppShell><Electricistas /></AppShell>} />
        <Route path="/devoluciones-prestamos" element={<AppShell><DevolucionesPrestamos /></AppShell>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
