# Cambios realizados

Fecha: 2026-03-02

## Resumen general
Se implementaron ajustes en backend y frontend para:
- Corregir el cálculo de gasto neto en inventario.
- Exponer configuración UI (umbral de stock bajo) desde backend.
- Mejorar los flujos de devoluciones/préstamos.
- Separar y ampliar reportes (novedades y gastos generales).
- Reutilizar lógica de costos/cantidades en utilidades compartidas.

---

## Backend

### 1) `backend/controllers/inventario.controller.js`
- **Ajuste de lógica en `getInventarioFlat`:**
  - `cantidad_gastada` ahora se calcula como:
    - salidas (`DESPACHADO`, `PRESTADO`, `MATERIAL_EXCEDENTE`) menos devoluciones (`DEVOLUCION`).
  - Se protegió el resultado con `GREATEST(..., 0)` para evitar valores negativos.
- **Cambios en agregación SQL de movimientos:**
  - Se reemplazó `total_movida` por:
    - `total_salidas`
    - `total_devolucion`

### 2) `backend/server.js`
- Se agregó import y registro de la nueva ruta de configuración:
  - `./routes/config.routes`
  - `app.use("/api/config", configRoutes)`

### 3) `backend/routes/config.routes.js` (nuevo)
- Nueva ruta `GET /api/config/ui`.
- Retorna configuración de UI:
  - `stock_bajo_umbral`.
- Lee variable de entorno `STOCK_BAJO_UMBRAL`.
- Si no existe o es inválida, usa valor por defecto `10`.

---

## Frontend

### 1) `frontend/src/App.jsx`
- Se importó la página `ReporteGastosGenerales`.
- Se agregó ruta:
  - `/reporte-gastos`.

### 2) `frontend/src/components/ActionButtons.jsx`
- Se actualizó el bloque de acciones:
  - Se reemplazó `Ver Reportes` por dos accesos separados:
    - `Reporte Novedades`
    - `Reporte Gastos`.

### 3) `frontend/src/pages/DevolucionesPrestamos.jsx`
- Se incorporó `useMemo` para optimizar filtrado.
- Se agregó búsqueda de despachos (`busquedaDespacho`).
- Mejora UX en devoluciones:
  - Reemplazo de `select` simple por tabla filtrable.
  - Selección explícita por botón `Seleccionar`.
  - Reseteo de búsqueda/selección al cambiar tipo de movimiento.
- Nuevo flujo de selección de despacho con función `seleccionarDespacho`.

### 4) `frontend/src/pages/InventarioBodega.jsx`
- Se integró lectura de configuración UI:
  - consumo de `getUiConfig()`.
  - uso de constante base `UMBRAL_STOCK_BAJO`.
- Umbral de stock bajo ahora configurable (`umbralStockBajo`) en lugar de valor fijo `10`.
- Ajustes visuales para estados de stock:
  - colores y etiqueta `AGOTÁNDOSE`.
- Historial de movimientos:
  - cálculo de costo total por movimiento usando utilidad compartida.
  - costo neto total del historial también unificado con utilidad.
  - mejora de texto para casos sin lámpara asociada.

### 5) `frontend/src/pages/NovedadCenso.jsx`
- Se integró configuración UI (`getUiConfig`, `UMBRAL_STOCK_BAJO`).
- Se añadió `setValues` para manipulación programática del formulario de novedad.
- Nueva limpieza automática de campos tecnológicos cuando el tipo no es `CAMBIO_TECNOLOGIA`.
- Se condicionó el renderizado de campos de tecnología/reemplazo solo cuando aplica.
- Se removió bloque de observaciones del formulario de novedad en la sección mostrada.
- Se aplicó estilo visual de stock bajo/agotado en opciones de inventario.

### 6) `frontend/src/pages/ReporteNovedades.jsx`
- Refactor importante de la vista:
  - enfoque centrado en novedades + movimientos asociados.
  - filtros por texto y tipo de novedad.
  - resumen por tipos (`MANTENIMIENTO`, `REPARACION`, `CAMBIO_TECNOLOGIA`, `INSTALACION`).
- Se eliminó lógica previa de exportación Excel y panel de filtros avanzados orientados a gastos.
- Se agregó modal de detalle por novedad con:
  - datos de la novedad.
  - tabla de movimientos asociados.
  - total neto calculado con utilidad compartida.

### 7) `frontend/src/pages/ReporteGastosGenerales.jsx` (nuevo)
- Nueva pantalla de reporte general de gastos.
- Funcionalidades:
  - filtros por texto, tipo de movimiento y rango de fechas.
  - tabla completa de movimientos.
  - total neto (devoluciones restan).
- Usa utilidades compartidas para cantidad con signo y costo total.

### 8) `frontend/src/api/config.api.js` (nuevo)
- Nuevo cliente API para configuración UI.
- Endpoint consumido: `GET /api/config/ui`.

### 9) `frontend/src/constants/inventario.js` (nuevo)
- Constante base:
  - `UMBRAL_STOCK_BAJO = 10`.

### 10) `frontend/src/utils/gastos.js` (nuevo)
- Utilidades compartidas:
  - `getCantidadConSigno(gasto)`.
  - `getCostoTotalMovimiento(gasto)`.

---

## Archivos nuevos detectados
- `backend/routes/config.routes.js`
- `frontend/src/api/config.api.js`
- `frontend/src/constants/inventario.js`
- `frontend/src/pages/ReporteGastosGenerales.jsx`
- `frontend/src/utils/gastos.js`

## Archivos modificados detectados
- `backend/controllers/inventario.controller.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/ActionButtons.jsx`
- `frontend/src/pages/DevolucionesPrestamos.jsx`
- `frontend/src/pages/InventarioBodega.jsx`
- `frontend/src/pages/NovedadCenso.jsx`
- `frontend/src/pages/ReporteNovedades.jsx`
