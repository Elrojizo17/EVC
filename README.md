## 📘 Nombre del Proyecto

# Sistema de Gestión de Luminarias e Inventario de Bodega

Aplicación web para la gestión operativa de luminarias georreferenciadas, novedades de mantenimiento, movimientos de inventario y trazabilidad de materiales/electricistas. El sistema integra visualización SIG básica (mapa), registro de novedades en campo y control de inventario mediante API REST y base de datos PostgreSQL.

---

## 🎯 Objetivo del Proyecto

Centralizar en una sola plataforma los procesos de:

- Consulta geográfica de luminarias por ubicación y tecnología.
- Registro de novedades técnicas sobre luminarias.
- Control de inventario de bodega por lotes y movimientos.
- Trazabilidad de responsable (electricista) y código PQR en movimientos.
- Generación de reportes operativos y de costos.

Problema que resuelve: dispersión de la información operativa (campo + bodega), poca trazabilidad y dificultad para analizar impacto técnico y económico de las intervenciones.

---

## 🧩 Funcionalidades Principales

- **Gestión de luminarias (consulta)**
  - Visualización en mapa con filtros por tecnología, búsqueda por número y rango de lámparas.
  - Consulta puntual con mini mapa en flujo de novedades.

- **Registro de novedades de luminaria**
  - Alta de novedades por tipo (`MANTENIMIENTO`, `CAMBIO_TECNOLOGIA`, `REPARACION`; y en frontend también `INSTALACION` para reportes).
  - Diagnóstico de existencia de lámpara previo al registro.
  - Actualización de estado/tecnología de luminaria según tipo de novedad (lógica en backend).

- **Gestión de inventario de bodega**
  - Registro de nuevos elementos (producto + lote) con código, cantidad, costo y fecha de compra.
  - Consulta de inventario consolidado con stock disponible calculado por movimientos.
  - Histórico de movimientos por elemento y exportación a Excel.

- **Movimientos de bodega / gastos**
  - Registro de movimientos: `ENTRADA`, `DESPACHADO`, `DEVOLUCION`, `MATERIAL_EXCEDENTE`, `PRESTADO`.
  - Validaciones de stock para salidas.
  - Asociación opcional con novedad y obligatoria con electricista activo + PQR en ciertos flujos de UI.

- **Devoluciones y préstamos**
  - Flujo específico para registrar préstamos y devoluciones.
  - Selección asistida de despacho previo para devoluciones.
  - Cálculo de saldo de préstamos vigentes por lote.

- **Gestión de electricistas**
  - CRUD básico (listar, crear, actualizar estado).
  - Asignación y remoción de lotes al inventario de electricistas.

- **Reportes**
  - Reporte de novedades con detalle de movimientos asociados.
  - Reporte general de gastos con filtros por tipo, fecha y texto.
  - Cálculo de costo neto (devoluciones restan).

- **Notificaciones UI**
  - Sistema de notificaciones con `react-hot-toast` para éxito, error, carga e información.

---

## ⚙️ Arquitectura General

- **Estilo arquitectónico**: aplicación web de 3 capas (Frontend SPA + Backend API REST + PostgreSQL).
- **Backend**: Node.js con Express, estructura modular por rutas/controladores.
- **Frontend**: React + Vite, enrutamiento por páginas, consumo de API por módulos `api/*`.
- **Persistencia**: PostgreSQL con esquema relacional y migraciones SQL.

### Componentes principales

- **Frontend (`frontend/`)**
  - Páginas operativas (`src/pages`) para dashboard, novedades, inventario, reportes, electricistas y devoluciones/préstamos.
  - Componentes reutilizables (`src/components`) y hooks (`useFormValidation`, `useNotification`).

- **Backend (`backend/`)**
  - `server.js` como punto de entrada.
  - Rutas REST (`routes/*`) para dominios funcionales.
  - Controladores (`controllers/*`) para reglas de negocio y SQL.
  - Middleware de errores centralizado.

- **Base de datos**
  - Script base (`init.sql`) + migraciones (`migrations/*`) para evolución del esquema.

### Relación entre módulos

1. Usuario interactúa en frontend (formularios, mapa, reportes).
2. Frontend consume API REST (`/api/*`).
3. Backend valida, aplica reglas y opera sobre PostgreSQL.
4. Respuesta vuelve a frontend para renderizar estado, métricas y notificaciones.

---

## 🛠️ Tecnologías Utilizadas

- **Lenguajes**
  - JavaScript (frontend y backend)
  - SQL (PostgreSQL)

- **Frontend**
  - React 19
  - Vite (con `rolldown-vite`)
  - React Router DOM
  - Axios + Fetch API
  - React Hot Toast
  - Leaflet + React-Leaflet
  - XLSX (exportación a Excel)

- **Backend**
  - Node.js
  - Express 5
  - `pg` (cliente PostgreSQL)
  - `cors`
  - `dotenv`

- **Base de datos**
  - PostgreSQL (modelo relacional por tablas de luminarias, novedades, productos, lotes, movimientos, electricistas)

- **Herramientas de desarrollo**
  - ESLint
  - Scripts npm para ejecución de frontend/backend

---

## 📂 Estructura del Proyecto

```text
/backend
  server.js                # Arranque API y registro de rutas
  db.js                    # Configuración pool PostgreSQL
  init.sql                 # Esquema base de BD
  initDB.js                # Inicialización de BD
  migrations/              # Cambios evolutivos de esquema
  controllers/             # Lógica de negocio por dominio
  routes/                  # Endpoints REST
  middleware/              # Manejo centralizado de errores

/frontend
  src/App.jsx              # Router principal y toaster global
  src/pages/               # Pantallas del sistema
  src/components/          # Componentes reutilizables
  src/api/                 # Clientes API por dominio
  src/hooks/               # Hooks de validación/notificación
  src/utils/               # Utilidades transversales (gastos, etc.)

/CAMBIOS_REALIZADOS.md     # Bitácora reciente de cambios
/NOTIFICACIONES.md         # Guía del sistema de notificaciones
/SIG.txt                   # Documentación funcional SIG
/InsertsBD.txt             # Datos de carga de luminarias
```

---

## 📋 Requisitos Funcionales Identificados

- **RF-01:** El sistema debe permitir consultar luminarias en un mapa con filtros por tecnología, número y rango.
- **RF-02:** El sistema debe registrar novedades asociadas a una lámpara con fecha, tipo y observaciones.
- **RF-03:** Para novedades de mantenimiento, el sistema debe actualizar el estado de la luminaria.
- **RF-04:** Para novedades de cambio tecnológico, el sistema debe actualizar tecnología (y potencia cuando sea inferible) de la luminaria.
- **RF-05:** El sistema debe permitir registrar productos/lotes en inventario con código único, cantidad, costo unitario y fecha de compra.
- **RF-06:** El sistema debe calcular stock disponible en tiempo real a partir de movimientos de bodega.
- **RF-07:** El sistema debe permitir registrar movimientos de bodega con tipos controlados (`ENTRADA`, `DESPACHADO`, `DEVOLUCION`, `MATERIAL_EXCEDENTE`, `PRESTADO`).
- **RF-08:** El sistema debe validar stock suficiente antes de registrar movimientos de salida.
- **RF-09:** El sistema debe exigir electricista válido y activo para registrar movimientos en los flujos operativos actuales.
- **RF-10:** El sistema debe registrar código PQR en movimientos cuando aplique según flujo de UI.
- **RF-11:** El sistema debe permitir registrar préstamos y devoluciones con validaciones de consistencia (ej. devolución no superior a despacho).
- **RF-12:** El sistema debe permitir gestionar electricistas (listar, crear, actualizar, activar/desactivar).
- **RF-13:** El sistema debe permitir asignar/remover inventario de electricista por lote.
- **RF-14:** El sistema debe ofrecer reporte de novedades con detalle de movimientos asociados y total neto.
- **RF-15:** El sistema debe ofrecer reporte general de gastos con filtros por texto, tipo y rango de fechas.
- **RF-16:** El sistema debe exportar información de inventario a Excel.
- **RF-17:** El sistema debe exponer configuración UI (`stock_bajo_umbral`) desde backend para parametrizar alertas visuales.

---

## 🔒 Requisitos No Funcionales (Inferidos)

- **RNF-01 Seguridad básica de configuración:** uso de variables de entorno para conexión a BD y validación de variables requeridas.
- **RNF-02 Integridad de datos:** restricciones SQL (`CHECK`, claves foráneas, unicidad) para proteger consistencia.
- **RNF-03 Confiabilidad transaccional:** operaciones críticas con `BEGIN/COMMIT/ROLLBACK` en creación de novedades/movimientos.
- **RNF-04 Manejo de errores uniforme:** middleware centralizado en backend y mensajes de error controlados.
- **RNF-05 Usabilidad operativa:** notificaciones no bloqueantes, formularios con validación y estados de carga.
- **RNF-06 Rendimiento en consulta geográfica:** renderizado de mapa con canvas y filtros en frontend.
- **RNF-07 Mantenibilidad:** separación por dominios (rutas/controladores/api/pages/hooks) y utilidades compartidas.
- **RNF-08 Configurabilidad:** umbral de stock bajo parametrizable desde variable de entorno.

---

## 🔄 Flujo General del Sistema

1. Usuario ingresa al dashboard y consulta luminarias en mapa.
2. Si hay intervención, registra novedad sobre una lámpara.
3. Desde novedad o módulo de devoluciones/préstamos, registra movimientos de inventario.
4. Backend valida reglas (stock, tipo de movimiento, electricista activo, formato de datos) y persiste en PostgreSQL.
5. Inventario y reportes se actualizan con base en movimientos registrados.
6. Usuario consulta reportes de novedades/gastos para seguimiento técnico y financiero.

---

## 🚀 Estado Actual del Proyecto

### Nivel de avance (inferido)

- **Avance funcional alto** para operación básica: mapa SIG, novedades, inventario, movimientos, electricistas y reportes están implementados.
- **Evolución reciente activa**: evidencia de migraciones y documento de cambios con ajustes de lógica de stock/gastos y nuevos reportes.

### Componentes implementados

- API REST de dominios principales (`luminarias`, `novedades`, `inventario`, `gastos`, `electricistas`, `config`).
- Frontend multipágina con formularios, filtros, tablas y reportes.
- Integración BD con scripts de inicialización y migraciones.

### Posibles pendientes / oportunidades

- **Autenticación/autorización:** no se observa capa de seguridad por usuario/rol.
- **Pruebas automatizadas:** existe archivo de prueba aislado, pero no suite formal activa en scripts.
- **Estandarización de cliente HTTP:** coexistencia de `fetch` y `axios` en frontend.
- **Documentación de despliegue:** no hay guía raíz consolidada previa (este documento cubre base inicial).
- **Observación SIG:** hay listener de evento `luminariasActualizadas`; conviene confirmar emisión en todos los flujos que modifican luminarias.

---

## Notas de alcance de este documento

Este documento se construye a partir del código y artefactos disponibles en el repositorio actual. Las inferencias se limitaron a comportamientos observables en rutas, controladores, páginas, scripts SQL y documentación interna existente.