# Cambios realizados

Fecha: 2026-03-10

## Resumen general
Se implementaron ajustes en backend y frontend para:
- Consolidar navegación y layout general con `AppShell`.
- Mejorar consistencia visual de formularios y pantallas.
- Fortalecer el flujo de devoluciones y asociación de novedades.
- Habilitar edición controlada de novedades sin gastos asociados.
- Agregar flujo para asociar gastos desde `ReporteNovedades` solo cuando la novedad no tiene movimientos.
- Validar cambio de tecnología con reglas de negocio en `Registrar Novedad`.

---

## Backend

### 1) `backend/routes/gasto.routes.js`
- **Mejora en `GET /api/gastos`:**
  - La relación con novedad ahora usa herencia por contexto (`LATERAL`) cuando `id_novedad_luminaria` viene nulo.
  - Se agregó bandera `asociacion_heredada` para identificar asociaciones inferidas.
- Se mantuvo el alcance de escritura en creación de gastos (sin endpoints de edición/eliminación).

### 2) `backend/routes/novedad.routes.js`
- Se agregó `PUT /api/novedades/:id` para editar novedades.
- Regla de negocio aplicada:
  - Solo permite editar novedades que **no tengan movimientos/gastos asociados**.
  - Si hay movimientos, responde `409`.
- Se normalizan tecnologías y se conserva estructura de actualización por campos.

---

## Frontend

### 1) `frontend/src/components/AppShell.jsx` (nuevo)
- Nuevo contenedor de navegación lateral reutilizable para pantallas internas.
- Centraliza menú principal y branding.

### 2) `frontend/src/assets/evc-logo.svg` (nuevo)
- Se agregó logo institucional para cabecera/sidebar.

### 3) `frontend/src/pages/Dashboard.css` (nuevo)
- Nuevo sistema visual del dashboard y shell:
  - layout responsivo,
  - sidebar,
  - barra de búsqueda,
  - panel de filtros,
  - estilos compartidos de contenedor.

### 4) `frontend/src/App.jsx`
- Las rutas principales pasan a renderizarse dentro de `AppShell`.
- Se unifica estructura de navegación entre módulos.

### 5) `frontend/src/pages/ReporteNovedades.jsx`
- Se añadió acción **Editar gastos** solo cuando la novedad tiene `0` movimientos.
- Nuevo modal para asociar gastos iniciales a la novedad usando formulario operativo.
- Regla de negocio en UI:
  - si la novedad ya tiene movimientos, no abre formulario de edición de gastos.
- Se incorporó selector de inventario con colores por stock (misma configuración de `NovedadCenso`):
  - stock normal,
  - stock bajo,
  - agotado/deshabilitado.
- Se integró carga de configuración UI (`stock_bajo_umbral`) para umbral dinámico.

### 6) `frontend/src/pages/NovedadCenso.jsx`
- Para `CAMBIO_TECNOLOGIA` se implementó validación obligatoria:
  - tecnología anterior y nueva deben existir,
  - deben ser **distintas**.
- Campos `tecnologia_anterior` y `tecnologia_nueva` cambiaron de input libre a desplegable con opciones:
  - `Led`
  - `Solio`
  - `Metal Halide`

### 7) `frontend/src/pages/DevolucionesPrestamos.jsx`
- Se ajustó la regla de cantidad en devolución:
  - el usuario puede editar manualmente la cantidad,
  - el valor ingresado es el que se registra,
  - se valida que no exceda lo despachado.
- Mejor asociación de devoluciones con novedad de origen cuando aplica (`id_novedad_luminaria`).

### 8) `frontend/src/pages/InventarioBodega.jsx`
- Ajustes visuales/consistencia de estilos con el nuevo shell.
- Mejoras en tabla de historial para contexto de novedad/lámpara.

### 9) `frontend/src/pages/ReporteGastosGenerales.jsx`
- Ajustes visuales para consistencia con el nuevo estilo global.
- Resaltado visual para devoluciones con asociación heredada.

### 10) `frontend/src/pages/Electricistas.jsx`
- Integración visual al layout unificado (sin botón de regreso manual).

### 11) `frontend/src/components/FormInput.jsx`
- Ajustes de `boxSizing` y altura mínima para consistencia en formularios.

### 12) `frontend/src/components/FormSelect.jsx`
- Ajustes de `boxSizing` y altura mínima para consistencia en formularios.

### 13) `frontend/src/components/MapView.jsx`
- Ajuste de paleta institucional por tecnología.
- Mejoras visuales de contenedor y leyenda.

### 14) `frontend/src/index.css`
- Variables de color y tipografía global.
- Homologación de base visual y controles.

### 15) `frontend/src/api/novedades.api.js`
- Nuevo método `updateNovedad(id, data)` para soportar edición controlada de novedades.

---

## Archivos nuevos detectados
- `frontend/src/components/AppShell.jsx`
- `frontend/src/assets/evc-logo.svg`
- `frontend/src/pages/Dashboard.css`
- `Cambios_10_03_26.md`

## Archivos modificados detectados
- `backend/routes/gasto.routes.js`
- `backend/routes/novedad.routes.js`
- `frontend/src/App.jsx`
- `frontend/src/api/novedades.api.js`
- `frontend/src/components/FormInput.jsx`
- `frontend/src/components/FormSelect.jsx`
- `frontend/src/components/MapView.jsx`
- `frontend/src/index.css`
- `frontend/src/pages/DevolucionesPrestamos.jsx`
- `frontend/src/pages/Electricistas.jsx`
- `frontend/src/pages/InventarioBodega.jsx`
- `frontend/src/pages/NovedadCenso.jsx`
- `frontend/src/pages/ReporteGastosGenerales.jsx`
- `frontend/src/pages/ReporteNovedades.jsx`
