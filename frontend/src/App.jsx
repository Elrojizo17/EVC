import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Dashboard from "./pages/Dashboard";
import NovedadCenso from "./pages/NovedadCenso";
import InventarioBodega from "./pages/InventarioBodega";
import ReporteNovedades from "./pages/ReporteNovedades";
import Electricistas from "./pages/Electricistas";
import DevolucionesPrestamos from "./pages/DevolucionesPrestamos";

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
        <Route path="/novedad-censo" element={<NovedadCenso />} />
        <Route path="/inventario-bodega" element={<InventarioBodega />} />
        <Route path="/reporte-novedades" element={<ReporteNovedades />} />
        <Route path="/electricistas" element={<Electricistas />} />
        <Route path="/devoluciones-prestamos" element={<DevolucionesPrestamos />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
