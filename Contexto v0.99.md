# Contexto v0.99

## 1. Objetivo del documento
Este documento describe el contexto técnico actual del sistema: estructura del proyecto, funcionamiento por secciones, relación con la base de datos y restricciones de operación para mantener integridad de datos.

## 2. Arquitectura general
- Frontend: React + Vite.
- Backend: Node.js + Express.
- Base de datos: PostgreSQL.
- Patrón general: SPA que consume API REST y persiste en modelo relacional.

Flujo base:
1. Usuario interactúa en módulos frontend.
2. Frontend consume endpoints API en backend.
3. Backend valida reglas de negocio y ejecuta SQL.
4. PostgreSQL responde y frontend renderiza resultados.

## 3. Estructura del proyecto

### 3.1 Raíz
- Cambios_10_03_26.md
- CAMBIOS_REALIZADOS.md
- CASOS_DE_USO.md
- InsertsBD.txt
- NOTIFICACIONES.md
- README.md
- SIG.txt
- Contexto v0.99.md
- GUIA_IMPLEMENTACION_DEVOLUCIONES.md
- MEJORAS_DEVOLUCIONES_2026-03-17.md
- backend/
- frontend/

### 3.2 Backend
- backend/db.js
- backend/diagnostic.js
- backend/init.sql
- backend/initDB.js
- backend/package.json
- backend/server.js
- backend/Tablas Nuevas.txt
- backend/test-inventario.js
- backend/controllers/electricista.controller.js
- backend/controllers/inventario.controller.js
- backend/controllers/luminaria.controller.js
- backend/controllers/novedad.controller.js
- backend/middleware/error.middleware.js
- backend/migrations/20260211_add_electricista_pqr_movimiento_bodega.sql
- backend/migrations/20260211_remove_legacy_stock_triggers.sql
- backend/migrations/20260317_improve_devolucion_tracking.sql
- backend/routes/config.routes.js
- backend/routes/electricista.routes.js
- backend/routes/gasto.routes.js
- backend/routes/inventario.routes.js
- backend/routes/luminaria.routes.js
- backend/routes/novedad.routes.js

### 3.3 Frontend
- frontend/eslint.config.js
- frontend/index.html
- frontend/package.json
- frontend/README.md
- frontend/vite.config.js
- frontend/public/
- frontend/src/App.css
- frontend/src/App.jsx
- frontend/src/index.css
- frontend/src/main.jsx
- frontend/src/api/config.api.js
- frontend/src/api/electricistas.api.js
- frontend/src/api/gastos.api.js
- frontend/src/api/inventario.api.js
- frontend/src/api/inventario.new.api.js
- frontend/src/api/novedades.api.js
- frontend/src/assets/
- frontend/src/components/ActionButtons.jsx
- frontend/src/components/AppShell.jsx
- frontend/src/components/BackButton.jsx
- frontend/src/components/ElectristaForm.jsx
- frontend/src/components/ElectristaList.jsx
- frontend/src/components/FormInput.jsx
- frontend/src/components/FormSelect.jsx
- frontend/src/components/Header.jsx
- frontend/src/components/MapView.jsx
- frontend/src/components/MiniMapaLuminaria.jsx
- frontend/src/components/StatsCards.jsx
- frontend/src/constants/inventario.js
- frontend/src/hooks/useFormValidation.js
- frontend/src/hooks/useNotification.js
- frontend/src/pages/Dashboard.css
- frontend/src/pages/Dashboard.jsx
- frontend/src/pages/DevolucionesPrestamos.jsx
- frontend/src/pages/Electricistas.jsx
- frontend/src/pages/InventarioBodega.jsx
- frontend/src/pages/NovedadCenso.jsx
- frontend/src/pages/ReporteGastosGenerales.jsx
- frontend/src/pages/ReporteNovedades.jsx
- frontend/src/utils/gastos.js

## 4. Backend: funcionamiento por sección

### 4.1 server.js
Responsabilidades:
- Inicializa Express y middlewares CORS + JSON.
- Registra rutas:
  - /api/luminarias
  - /api/novedades
  - /api/inventario
  - /api/gastos
  - /api/electricistas
  - /api/config
- Aplica compatibilidad de base de datos al inicio:
  - agrega columnas id_electricista y codigo_pqr a movimiento_bodega si no existen.
  - elimina funciones legacy de ajuste de stock.
- Manejo de errores centralizado y 404 uniforme.

Restricciones operativas:
- Si falla la compatibilidad de BD en arranque, el servidor se detiene.

### 4.2 Luminarias
Archivo clave:
- backend/routes/luminaria.routes.js

Cómo funciona:
- GET lista luminarias con alias de coordenadas (latitud/longitud).

Relación BD:
- Lee tabla luminaria.

Restricciones:
- Solo lectura desde este módulo.

### 4.3 Novedades
Archivo clave:
- backend/routes/novedad.routes.js

Cómo funciona:
- GET lista novedades ordenadas por fecha.
- POST crea novedad en novedad_luminaria.
- Reglas especiales por tipo:
  - MANTENIMIENTO: actualiza estado de luminaria a INACTIVA.
  - CAMBIO_TECNOLOGIA: actualiza tecnología y puede inferir potencia a partir del material de reemplazo.
- PUT edita novedad solo si no tiene movimientos asociados.
- GET diagnostico por número de lámpara.

Relación BD:
- Inserta y actualiza novedad_luminaria.
- Actualiza luminaria según tipo.
- Verifica relación con movimiento_bodega para bloquear edición si ya tiene gastos.

Restricciones:
- id de novedad debe ser entero positivo para edición.
- Una novedad con movimientos asociados no se puede editar.

### 4.4 Inventario
Archivos clave:
- backend/routes/inventario.routes.js
- backend/controllers/inventario.controller.js

Cómo funciona:
- Endpoint principal de inventario consolidado: GET /api/inventario/todos.
- Expone productos/lotes, detalle de lote y movimientos.
- Permite crear producto, lote o elemento completo (producto + lote).
- Stock disponible y cantidad gastada se calculan por agregación de movimientos, no por actualización manual del lote.

Relación BD:
- producto
- lote_producto
- movimiento_bodega
- novedad_luminaria (join para historial)

Restricciones:
- Tipo de movimiento válido en crearMovimiento:
  ENTRADA, DESPACHADO, DEVOLUCION, MATERIAL_EXCEDENTE, PRESTADO.
- cantidad debe ser mayor a 0 para movimientos.
- código de producto debe ser único.
- para crear lote: producto existente y valores positivos.

### 4.5 Gastos y movimientos de bodega
Archivo clave:
- backend/routes/gasto.routes.js

Cómo funciona:
- GET devuelve movimientos enriquecidos con trazabilidad:
  novedad, lámpara, tipo de novedad, cantidad original despachada y acumulado devuelto.
- POST crea movimiento con validación transaccional.

Relación BD:
- movimiento_bodega
- lote_producto
- producto
- novedad_luminaria
- electricista

Restricciones de negocio críticas:
- Campos obligatorios: id_lote, tipo_movimiento, cantidad.
- tipo_movimiento debe estar en catálogo permitido.
- Para salidas (DESPACHADO, PRESTADO, MATERIAL_EXCEDENTE), valida stock disponible.
- electricista obligatorio y debe estar activo.
- Para DEVOLUCION:
  - id_novedad_luminaria obligatorio.
  - la novedad debe existir.
  - debe existir DESPACHADO previo del mismo lote y novedad.
  - cantidad devuelta no puede exceder la cantidad despachada.
- Manejo por transacción con BEGIN, COMMIT y ROLLBACK.

### 4.6 Electricistas
Archivos clave:
- backend/routes/electricista.routes.js
- backend/controllers/electricista.controller.js

Cómo funciona:
- CRUD básico de electricistas.
- activación/desactivación por update.
- asignación y remoción de lotes a inventario del electricista.

Relación BD:
- electricista
- inventario_electricista
- lote_producto
- producto

Restricciones:
- nombre y documento son obligatorios al crear.
- documento único.
- en asignación: electricista y lote deben existir, cantidad mayor a 0.
- asignación usa upsert por par documento_electricista + id_lote.

### 4.7 Config
Archivo clave:
- backend/routes/config.routes.js

Cómo funciona:
- GET /api/config/ui retorna stock_bajo_umbral.
- si variable de entorno no es válida, usa valor por defecto 10.

Restricciones:
- valor final entero y mayor o igual a 1.

## 5. Frontend: funcionamiento por sección

### 5.1 Router principal
Archivo:
- frontend/src/App.jsx

Rutas:
- /
- /novedad-censo
- /inventario-bodega
- /reporte-novedades
- /reporte-gastos
- /electricistas
- /devoluciones-prestamos

### 5.2 Dashboard y mapa
Archivos:
- frontend/src/pages/Dashboard.jsx
- frontend/src/components/MapView.jsx

Cómo funciona:
- muestra mapa con filtros por tecnología, búsqueda y rango numérico de lámparas.
- persiste filtros en localStorage.

Relación BD:
- consume /api/luminarias de forma indirecta mediante capa api y componente de mapa.

Restricciones:
- filtros de rango y búsqueda aplican sobre la data cargada.

### 5.3 Registrar novedad y gastos (NovedadCenso)
Archivo:
- frontend/src/pages/NovedadCenso.jsx

Cómo funciona:
- formulario de novedad con validaciones.
- diagnóstico de lámpara con debounce.
- formulario de gastos asociado a la novedad creada.
- permite lista de gastos pendientes antes de enviar.

Relación BD:
- POST novedad a /api/novedades.
- POST gastos a /api/gastos con id_novedad_luminaria.
- consulta inventario, electricistas y configuración UI.

Restricciones de UI:
- tipo_novedad obligatorio.
- número de lámpara requerido y alfanumérico.
- en CAMBIO_TECNOLOGIA, tecnología anterior y nueva deben existir y ser diferentes.
- para gasto: tipo, electricista y PQR obligatorios.
- cantidad usada mayor a 0.
- para tipos de salida, valida stock disponible.

### 5.4 Inventario de bodega
Archivo:
- frontend/src/pages/InventarioBodega.jsx

Cómo funciona:
- alta de elemento (producto + lote).
- consulta inventario consolidado.
- busca por código o nombre.
- ordena por código.
- exporta tabla a Excel.
- visualiza historial por elemento.

Relación BD:
- usa endpoints de inventario y gastos (historial).

Restricciones de UI:
- código obligatorio y único.
- nombre mínimo 3 caracteres.
- cantidad mínima 0.
- costo unitario numérico y mayor o igual a 0.
- fecha obligatoria.

### 5.5 Reporte de novedades
Archivo:
- frontend/src/pages/ReporteNovedades.jsx

Cómo funciona:
- lista novedades con filtros y orden por ID.
- muestra detalle de movimientos asociados.
- permite agregar gasto solo si la novedad no tiene movimientos previos.

Relación BD:
- consume novedades + gastos + inventario + electricistas.
- crea movimientos vía /api/gastos.

Restricciones:
- formulario de edición de gastos exige elemento, cantidad, electricista y PQR.
- valida stock para tipos de salida.
- usa fecha de la novedad para registrar el gasto asociado.

### 5.6 Reporte general de gastos
Archivo:
- frontend/src/pages/ReporteGastosGenerales.jsx

Cómo funciona:
- filtro por texto, tipo de movimiento y rango de fechas.
- orden por elemento.
- calcula total neto; devoluciones restan.

Relación BD:
- consume GET /api/gastos.

Restricciones:
- el costo total depende de cantidad con signo y costo unitario.

### 5.7 Gestión de electricistas
Archivos:
- frontend/src/pages/Electricistas.jsx
- frontend/src/components/ElectristaList.jsx
- frontend/src/components/ElectristaForm.jsx

Cómo funciona:
- lista, búsqueda y alta de electricistas.
- switch de disponibilidad ON/OFF.

Relación BD:
- consume /api/electricistas.

Restricciones:
- operación de actualización bloquea UI durante guardado.

### 5.8 Devoluciones y préstamos
Archivo:
- frontend/src/pages/DevolucionesPrestamos.jsx

Cómo funciona:
- flujo para PRESTADO y DEVOLUCION.
- para DEVOLUCION, se selecciona despacho origen y se autocompletan datos.
- historial con orden por fecha y elemento.
- muestra trazabilidad por novedad y lámpara.

Relación BD:
- consume inventario, electricistas y gastos.
- crea movimiento vía /api/gastos.

Restricciones críticas de UI:
- id_inventario, tipo_movimiento, cantidad, electricista y PQR obligatorios.
- DEVOLUCION requiere despacho seleccionado.
- DEVOLUCION requiere novedad asociada en despacho.
- lote devuelto debe coincidir con lote del despacho.
- cantidad devuelta no puede superar cantidad despachada.
- PRESTADO valida stock > 0 y suficiente.

## 6. Modelo de datos y relaciones

### 6.1 Tablas principales
- luminaria
- electricista
- novedad_luminaria
- producto
- lote_producto
- movimiento_bodega
- inventario_electricista

### 6.2 Relaciones
- novedad_luminaria.numero_lampara -> luminaria.numero_lampara
- lote_producto.codigo_producto -> producto.codigo
- movimiento_bodega.id_lote -> lote_producto.id_lote
- movimiento_bodega.id_novedad_luminaria -> novedad_luminaria.id_novedad
- movimiento_bodega.id_electricista -> electricista.documento
- inventario_electricista.documento_electricista -> electricista.documento
- inventario_electricista.id_lote -> lote_producto.id_lote

### 6.3 Restricciones SQL relevantes
- novedad_luminaria.tipo_novedad limitado por CHECK:
  MANTENIMIENTO, CAMBIO_TECNOLOGIA, REPARACION.
- tecnologías en novedad limitadas por CHECK:
  led, sodio, metal_halide, solar.
- movimiento_bodega.tipo_movimiento limitado por CHECK:
  ENTRADA, DESPACHADO, DEVOLUCION, MATERIAL_EXCEDENTE, PRESTADO.
- movimiento_bodega.cantidad mayor a 0.
- inventario_electricista.cantidad mayor o igual a 0.
- clave única en inventario_electricista por documento_electricista + id_lote.

## 7. Migraciones y estado evolutivo

### 7.1 20260211_add_electricista_pqr_movimiento_bodega.sql
- agrega id_electricista y codigo_pqr a movimiento_bodega.

### 7.2 20260211_remove_legacy_stock_triggers.sql
- elimina funciones/trigger heredados de ajuste de stock incompatibles.

### 7.3 20260317_improve_devolucion_tracking.sql
- agrega estado_devolucion y devolucion_procesada en movimiento_bodega.
- crea tabla detalle_novedad.
- crea trigger registrar_detalle_novedad.
- crea vista vw_integridad_devoluciones para auditoría de integridad.

## 8. Restricciones de operación por sección (resumen rápido)

### Mapa
- solo lectura de luminarias.

### Novedades
- no editar novedad si ya tiene movimientos asociados.
- CAMBIO_TECNOLOGIA exige consistencia tecnológica.

### Inventario
- código de elemento único.
- costos y cantidades con validaciones numéricas.

### Gastos y movimientos
- electricista activo obligatorio.
- tipos de salida con control de stock.
- devoluciones con control de integridad contra despacho/novedad.

### Electricistas
- documento único.
- disponibilidad impacta operaciones de movimientos.

### Reportes
- dependen de consistencia de relaciones novedad-movimiento-lote.

## 9. Dependencias funcionales entre módulos
- NovedadCenso depende de:
  - Novedades para crear id_novedad.
  - Inventario para seleccionar lotes.
  - Electricistas para responsable activo.
  - Gastos para asociar consumos a la novedad.
- DevolucionesPrestamos depende de:
  - Gastos DESPACHADO previos.
  - Novedad asociada para trazabilidad.
  - Electricista activo.
- ReporteNovedades depende de:
  - Join lógico de novedades y gastos por id_novedad.
- ReporteGastos depende de:
  - Integridad de movimientos y costos unitarios por lote.

## 10. Checklist de correcto funcionamiento
1. Variables de entorno de BD configuradas en backend.
2. Esquema init.sql aplicado.
3. Migraciones de backend/migrations ejecutadas.
4. Electricistas activos disponibles.
5. Productos y lotes cargados para poder despachar/prestar.
6. Novedades registradas para relacionar movimientos cuando aplique.
7. Para devoluciones, debe existir despacho previo del mismo lote y novedad.
8. Stock disponible no debe quedar negativo en salidas.

## 11. Estado de versión del contexto
- Documento: Contexto v0.99
- Fecha: 2026-03-17
- Base: estructura y lógica observada en código backend, frontend y esquema SQL actual.