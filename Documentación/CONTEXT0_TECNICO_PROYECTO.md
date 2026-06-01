# Contexto Técnico del Proyecto

**Proyecto:** Sistema de Gestión de Luminarias e Inventario de Bodega  
**Base documental revisada:** README, Contexto v0.99, Casos de Uso, auditorías, bitácoras de cambios, guías de devoluciones, notificaciones, solución de entrada de materiales y readmes complementarios del frontend y del subproyecto Flutter.

---

## 1. Resumen Ejecutivo

El sistema centraliza la operación técnica y logística relacionada con luminarias, novedades de campo, inventario de bodega, préstamos y devoluciones, electricistas y reportes operativos. La solución está construida como una aplicación web de tres capas: frontend en React, backend en Node.js/Express y persistencia en PostgreSQL. Además, existe un subproyecto Flutter separado para consulta local de luminarias con base SQLite en el dispositivo móvil.

La finalidad principal es resolver la dispersión de la información operativa: qué luminaria fue intervenida, qué materiales se usaron, quién ejecutó la tarea, qué salió de bodega, qué fue devuelto y qué impacto tuvo todo eso en inventario y costos.

---

## 2. Arquitectura General

### 2.1 Capa de presentación

El frontend web está construido con React + Vite y organiza la operación en páginas funcionales. Desde allí se consultan luminarias, se registran novedades, se administran inventarios, se controlan devoluciones/préstamos, se gestionan electricistas y se generan reportes.

### 2.2 Capa de API

El backend usa Express y expone endpoints REST bajo el prefijo `/api`. Las rutas están separadas por dominio funcional y delegan la lógica a controladores o consultas SQL directas. El servidor arranca migraciones automáticamente y valida compatibilidad de base de datos al inicio.

### 2.3 Capa de datos

La base de datos principal es PostgreSQL. El esquema se mantiene mediante SQL base y migraciones versionadas. El modelo actual refleja una evolución hacia inventario simplificado sin depender de la lógica histórica de lotes como entidad operativa principal, aunque algunos documentos conservan trazas de esa etapa anterior para auditoría y compatibilidad.

### 2.4 Subproyecto móvil

Existe una app Flutter independiente llamada `mapa_luminarias_flutter`, orientada a consulta local de luminarias con persistencia SQLite en el teléfono, mapa basado en OpenStreetMap y filtros básicos.

---

## 3. Módulos Funcionales del Sistema

### 3.1 Mapa de luminarias

Permite visualizar luminarias georreferenciadas en un mapa interactivo. El usuario puede filtrar por tecnología, buscar por número de lámpara y consultar información básica de cada punto. En el frontend web se usa una vista principal con mapa y barra lateral; en Flutter existe una versión local con datos persistidos.

### 3.2 Novedades de luminaria

Registra eventos técnicos como mantenimiento, reparación y cambio de tecnología. La novedad puede impactar el estado de la luminaria y, según el caso, su tecnología o potencia. También puede vincular electricista, observación y código PQR. La novedad sirve como núcleo de trazabilidad entre campo e inventario.

### 3.3 Inventario de bodega

Gestiona productos/materiales, stock disponible, entradas, salidas, devoluciones, préstamos y material excedente. El stock se calcula por agregación de movimientos y no por edición manual del saldo. Hay vistas de inventario consolidado, productos, movimientos e historial de elementos.

### 3.4 Devoluciones y préstamos

Controla salidas temporales o definitivas de materiales hacia electricistas y el retorno posterior. La trazabilidad de devoluciones se fortaleció para exigir referencia a la novedad origen, despacho previo y validación de cantidades.

### 3.5 Electricistas

Administra el catálogo de electricistas y su inventario asignado. Permite crear, actualizar, listar, asignar materiales y remover registros. Los movimientos operativos requieren electricista válido y activo cuando aplica.

### 3.6 Reportes

Incluye reporte de novedades y reporte de gastos generales. Los reportes consolidan movimientos, permiten filtrar por fecha, texto y tipo, y muestran información útil para seguimiento técnico y financiero.

### 3.7 Configuración y seguridad

Existen rutas de configuración para umbrales visuales y una capa de seguridad OTP por correo para proteger ediciones críticas. La documentación de OTP describe el flujo de solicitud y validación mediante correo Gmail.

---

## 4. Backend: Estructura y Función

### 4.1 Punto de entrada

`backend/server.js` inicializa Express, carga variables de entorno, registra rutas, ejecuta migraciones y verifica compatibilidad de esquema antes de levantar el servidor.

Responsabilidades observadas:
- Registrar rutas de luminarias, novedades, inventario, gastos, electricistas, configuración y OTP.
- Aplicar middleware CORS y JSON.
- Gestionar errores globales y respuesta 404 uniforme.
- Ejecutar ajustes de compatibilidad sobre tablas existentes al arrancar.

### 4.2 Rutas principales

- `/api/luminarias`: consulta de luminarias.
- `/api/novedades`: listado, creación y edición controlada de novedades.
- `/api/inventario`: productos, movimientos e inventario plano.
- `/api/gastos`: consulta y creación de movimientos de bodega.
- `/api/electricistas`: CRUD de electricistas y asignación de inventario.
- `/api/config`: configuración de UI.
- `/api/otp`: solicitud y validación de códigos OTP.

### 4.3 Reglas de negocio más importantes

- Una novedad con movimientos asociados no debe editarse libremente.
- Los movimientos de salida deben validar stock suficiente.
- Para devoluciones, la cantidad no puede exceder lo despachado.
- El electricista debe existir y estar activo cuando el flujo lo exige.
- El inventario se calcula a partir de movimientos y no por edición manual del saldo.

### 4.4 Migraciones y compatibilidad

Se documenta un sistema de migraciones automáticas y correcciones sucesivas sobre el cálculo de entradas, la integridad de devoluciones y la adaptación a un modelo sin lotes como entidad operativa principal.

---

## 5. Frontend Web: Estructura y Pantallas

### 5.1 Organización general

El frontend usa páginas por dominio, componentes reutilizables, hooks de validación/notificación y módulos API separados por funcionalidad. La navegación principal se concentra en un dashboard con acceso a los módulos operativos.

### 5.2 Páginas principales

- `Dashboard.jsx`: navegación general, mapa y filtros persistentes.
- `NovedadCenso.jsx`: formulario de registro de novedades.
- `InventarioBodega.jsx`: consulta y edición controlada del inventario.
- `DevolucionesPrestamos.jsx`: flujo de préstamos y devoluciones.
- `Electricistas.jsx`: administración de electricistas e inventario asignado.
- `ReporteNovedades.jsx`: análisis de novedades y movimientos asociados.
- `ReporteGastosGenerales.jsx`: análisis general de gastos y movimientos.

### 5.3 Componentes reutilizables

El sistema usa componentes como `AppShell`, `Header`, `MapView`, `MiniMapaLuminaria`, `StatsCards`, `OtpModal`, formularios genéricos y botones de acción. También utiliza hooks de validación y notificaciones para mejorar la experiencia operativa.

### 5.4 Cliente API

Cada módulo tiene su archivo API. El frontend usa principalmente `axios` y en algunos casos `fetch`. Los archivos relevantes son:
- `src/api/inventario.api.js`
- `src/api/gastos.api.js`
- `src/api/electricistas.api.js`
- `src/api/novedades.api.js`
- `src/api/config.api.js`
- `src/api/otp.api.js`

---

## 6. Modelo de Datos y Entidades Clave

### 6.1 Entidades operativas

- `luminaria`: registro geográfico y técnico de luminarias.
- `novedad_luminaria`: eventos o intervenciones sobre luminarias.
- `producto`: catálogo de materiales o elementos de inventario.
- `movimiento_bodega`: trazabilidad de entradas, salidas, devoluciones y préstamos.
- `electricista`: catálogo de responsables operativos.
- `inventario_electricista`: asignación de materiales a electricistas.

### 6.2 Campos y trazabilidad relevantes

La información operativa más importante gira alrededor de:
- código de producto
- número de lámpara
- tipo de movimiento
- cantidad
- número de orden
- electricista responsable
- código PQR
- observación
- fecha

### 6.3 Evolución del modelo

Los documentos muestran una transición desde una lógica basada en lotes hacia un modelo más plano. En esa transición se corrigieron consultas, filtros e historiales para que el frontend y backend usen `codigo_producto` como identificador funcional principal en varios flujos.

---

## 7. Trazabilidad Operativa

La trazabilidad es uno de los ejes del sistema. Una novedad puede generar consumos de materiales; esos consumos se reflejan en inventario y en reportes. A su vez, los movimientos pueden quedar asociados a electricista, novedad y código PQR.

Flujo típico:
1. El usuario consulta una luminaria o revisa un mapa.
2. Registra una novedad si existe una intervención.
3. Si aplica, consume materiales desde bodega.
4. Se generan movimientos de inventario y trazabilidad financiera.
5. El sistema refleja el impacto en reportes e historiales.

---

## 8. Reglas Operativas Relevantes

### 8.1 Inventario

- El stock se calcula dinámicamente.
- No debe quedar negativo.
- Los umbrales de stock bajo son configurables.
- El historial de un elemento debe construirse desde sus movimientos.

### 8.2 Novedades

- Se valida existencia de la lámpara antes de crear la novedad.
- El tipo de novedad puede modificar estado o tecnología.
- La edición queda restringida si ya hay movimientos asociados.

### 8.3 Devoluciones

- Una devolución debe tener vínculo con la novedad origen.
- Debe existir un despacho previo.
- No se puede devolver más de lo despachado.
- La UI y el backend participan en la validación.

### 8.4 Electricistas

- El documento es único.
- Los movimientos operativos dependen del estado activo del electricista.
- La asignación de materiales debe ser consistente con el inventario de bodega.

### 8.5 Seguridad

- Las operaciones sensibles pueden protegerse con OTP.
- Las credenciales y parámetros sensibles se manejan por variables de entorno.
- No se observan mecanismos completos de usuarios/roles, por lo que la seguridad descrita es principalmente operativa.

---

## 9. Documentos Revisados y Qué Aportan

- `README.md`: visión general del proyecto, stack y arquitectura.
- `Contexto v0.99.md`: inventario de archivos y funcionamiento por secciones.
- `CASOS_DE_USO.md`: actores, casos de uso y trazabilidad a endpoints.
- `AUDITORÍA_ENDPOINTS_30-03-2026.md`: validación de endpoints y correcciones por modelo de datos.
- `CAMBIOS_REALIZADOS.md` y `Cambios_10_03_26.md`: bitácoras de cambios funcionales.
- `CAMBIOS_ENTRADA_MATERIALES_2026_03_30.md` y `SOLUCION_ENTRADA_MATERIALES_2026_03_30_v2.md`: correcciones del cálculo de entradas y duplicados.
- `MEJORAS_DEVOLUCIONES_2026-03-17.md` y `GUIA_IMPLEMENTACION_DEVOLUCIONES.md`: endurecimiento de integridad de devoluciones.
- `NOTIFICACIONES.md`: sistema de feedback visual con react-hot-toast.
- `PROMPT_COPILOT_.md`: diseño del flujo de seguridad OTP por correo.
- `frontend/README.md`: plantilla base del frontend Vite.
- `mapa_luminarias_flutter/README.md`: contexto del cliente móvil local.
- `Documentación/PlantillaRequisitos.md`: plantilla formal de requisitos, útil como formato documental.

---

## 10. Estado Actual del Sistema

El sistema está en una etapa funcional avanzada. Los módulos clave están implementados y los documentos de auditoría muestran correcciones activas sobre inventario, devoluciones, reporte de gastos, relación con electricistas y compatibilidad entre frontend y backend.

El foco técnico actual parece estar en:
- mantener consistencia del inventario calculado,
- conservar trazabilidad entre novedad, movimiento y electricista,
- endurecer validaciones de devoluciones,
- y usar documentación técnica formal como soporte de evolución del sistema.

---

## 11. Conclusión

Este proyecto no es solo una interfaz de consulta de luminarias; es una plataforma operativa para controlar el ciclo completo de una intervención técnica: visualizar, diagnosticar, registrar, consumir materiales, devolver, auditar y reportar. La documentación existente confirma que el sistema ha evolucionado bastante y que su centro funcional está en la trazabilidad entre campo, bodega y reportes.
