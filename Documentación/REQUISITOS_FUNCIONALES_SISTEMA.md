# 📋 Requisitos Funcionales - Sistema de Gestión de Luminarias EVC

**Última actualización:** Marzo 2026  
**Versión del sistema:** 1.0  
**Aplicación:** Gestión Integral de Luminarias - EVC (Empresas Varias de Caicedonia)

---

## 📑 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Módulos Principales](#módulos-principales)
3. [Requisitos Funcionales por Módulo](#requisitos-funcionales-por-módulo)
4. [Requisitos de Seguridad](#requisitos-de-seguridad)
5. [Requisitos de Integración](#requisitos-de-integración)

---

## 🎯 Introducción

El **Sistema de Gestión de Luminarias** es una aplicación web que centraliza la administración de:
- Inventario de materiales y componentes eléctricos
- Registro y seguimiento de eventos/novedades en luminarias
- Gestión de electricistas y su inventario personal
- Trazabilidad completa de movimientos y devoluciones
- Generación de reportes operativos

**Tecnología:**
- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Autenticación: OTP por correo

---

## 🏗️ Módulos Principales

El sistema está organizado en 7 módulos funcionales:

| Módulo | Descripción | Usuarios | Estado |
|--------|-------------|----------|--------|
| **1. Mapa de Luminarias** | Visualización geográfica de luminarias | Todos | ✅ Activo |
| **2. Novedad de Censo** | Registro de eventos en luminarias | Operarios, Admin | ✅ Activo |
| **3. Inventario de Bodega** | Gestión centralizada de inventario | Almacenista, Admin | ✅ Activo |
| **4. Devoluciones/Préstamos** | Control de préstamos y retornos | Almacenista, Admin | ✅ Activo |
| **5. Gestión de Electricistas** | Administración de electricistas y su inventario | Admin | ✅ Activo |
| **6. Reportes** | Análisis de novedades y gastos | Admin, Supervisores | ✅ Activo |
| **7. Configuración & Seguridad** | OTP, auditoría, configuración | Admin | ✅ Activo |

---

## 📋 Requisitos Funcionales por Módulo

### 1️⃣ MÓDULO: MAPA DE LUMINARIAS

**Objetivo:** Proporcionar una vista geográfica interactiva de todas las luminarias registradas en el sistema.

#### RF-1.1: Visualización del Mapa Geográfico
- **Descripción:** El sistema mostrará un mapa interactivo con marcadores para cada luminaria.
- **Funcionalidad:**
  - Cargar datos de todas las luminarias desde la base de datos
  - Mostrar marcadores con coordenadas (latitud, longitud)
  - Permitir zoom, desplazamiento y búsqueda en el mapa
  - Mostrar información básica de cada luminaria en popup
  - Identificar luminarias por tecnología (LED, Sodio, Metal Halide)

#### RF-1.2: Filtrado de Luminarias por Tecnología
- **Descripción:** Permitir al usuario filtrar las luminarias mostradas en el mapa por tipo de tecnología.
- **Opciones de filtro:**
  - Todas (sin filtro)
  - LED
  - Sodio
  - Metal Halide
- **Comportamiento:**
  - Aplicar filtro en tiempo real
  - Perseguir selección en localStorage
  - Actualizar contador de luminarias visibles

#### RF-1.3: Búsqueda de Luminarias
- **Descripción:** Búsqueda rápida de luminarias por número o ubicación.
- **Funcionalidad:**
  - Campo de búsqueda por número de lámpara
  - Rango de búsqueda por número mínimo y máximo
  - Resaltar resultados en el mapa
  - Persistir parámetros de búsqueda en sesión

#### RF-1.4: Información Detallada de Luminarias
- **Descripción:** Mostrar datos técnicos y de estado de cada luminaria al seleccionarla.
- **Datos mostrados:**
  - Número de lámpara (identificador único)
  - Tecnología actual (LED, Sodio, Metal Halide)
  - Estado (Activa, Inactiva, Mantenimiento)
  - Coordenadas geográficas (latitud, longitud)
  - Historial de cambios y novedades asociadas

---

### 2️⃣ MÓDULO: NOVEDAD DE CENSO

**Objetivo:** Registrar y documentar eventos, cambios y mantenimientos realizados en las luminarias.

#### RF-2.1: Crear Registro de Novedad
- **Descripción:** Permitir al operario registrar un nuevo evento/novedad asociado a una luminaria.
- **Campos obligatorios:**
  - Número de lámpara (búsqueda/validación)
  - Tipo de novedad (Mantenimiento, Cambio de tecnología, Otro)
  - Fecha de novedad (formato YYYY-MM-DD)
  - Electricista responsable (selección de lista)
  - Código PQR (mínimo 3 caracteres)
- **Campos opcionales:**
  - Tecnología anterior (se auto-llena si existe en BD)
  - Tecnología nueva (LED, Sodio, Metal Halide)
  - Potencia nueva (en watts)
  - Observaciones
- **Validaciones:**
  - Número de lámpara debe existir en el censo
  - Fecha no puede ser futura
  - Código PQR con formato válido (alfanumérico)
  - Electricista debe estar registrado y activo

#### RF-2.2: Vinculación de Materiales a Novedad
- **Descripción:** Asociar materiales/componentes del inventario a la novedad registrada.
- **Funcionalidad:**
  - Tabla dinámicamente con filas de materiales
  - Cada fila contiene:
    - Código de material (búsqueda en inventario)
    - Descripción del material (auto-llena)
    - Cantidad utilizada
  - Validar disponibilidad de stock antes de registrar
  - Reducir automáticamente inventario de bodega al registrar
- **Restricción de stock:**
  - Si stock es bajo (umbral configurable, default=10), mostrar advertencia visual
  - Permitir proceder pero registrar como "stock bajo"

#### RF-2.3: Historial de Novedades
- **Descripción:** Consultar el registro histórico de eventos de una luminaria.
- **Información mostrada:**
  - Número de lámpara
  - Tipo de novedad
  - Fecha y hora del registro
  - Electricista responsable
  - Materiales utilizados
  - Observaciones
- **Funcionalidad:**
  - Filtrar por rango de fechas
  - Filtrar por tipo de novedad
  - Exportar historial (CSV)

#### RF-2.4: Diagnóstico de Luminaria
- **Descripción:** Consultar el estado actual y resumen de cambios de una luminaria específica.
- **Información:**
  - Estado actual (Activa/Inactiva)
  - Tecnología actual
  - Últimas 3 novedades
  - Responsable de última modificación
  - Fecha de último cambio

---

### 3️⃣ MÓDULO: INVENTARIO DE BODEGA

**Objetivo:** Gestionar centralizadamente el inventario de materiales y componentes eléctricos.

#### RF-3.1: Visualización del Inventario
- **Descripción:** Mostrar tabla con todos los elementos disponibles en bodega.
- **Columnas mostradas:**
  - Código de elemento (identificador único)
  - Nombre/Descripción del material
  - Cantidad inicial (stock histórico)
  - Entrada (compras/devoluciones agregadas)
  - Devuelto (materiales devueltos)
  - Despachado (materiales salidos por novedades)
  - Préstamo (materiales en préstamo)
  - Gastado en PQR (materiales usados en novedades)
  - Material excedente (residuos registrados)
  - **Stock disponible** (Inicial + Entrada + Devuelto - Despachado - Préstamo - Gastado PQR)
  - Costo unitario
  - Costo total (precio unitario × stock disponible)
- **Indicadores visuales:**
  - Stock BAJO: marcado en rojo si < umbral configurable (default=10)
  - Stock NORMAL: marcado en verde
  - Icono de advertencia para stock bajo

#### RF-3.2: Agregar Nuevo Elemento
- **Descripción:** Registrar un nuevo producto/material en el inventario.
- **Campos obligatorios:**
  - Código de elemento (alfanumérico único)
  - Nombre/Descripción
  - Cantidad inicial
  - Precio unitario
  - Número de orden de compra (opcional)
- **Proceso:**
  - Validar que el código sea único
  - Crear producto en BD
  - Registrar automáticamente movimiento de "ENTRADA" con cantidad inicial
  - Mostrar confirmación

#### RF-3.3: Registrar Entrada de Material
- **Descripción:** Documentar la llegada de nuevos materiales a bodega (compras, devoluciones).
- **Tipos de entrada:**
  - ENTRADA: Compra o ingreso nuevo (con número de orden)
  - DEVOLUCION: Material devuelto de electricista o PQR
- **Campos:**
  - Código de producto
  - Cantidad
  - Número de orden (para ENTRADA)
  - Fecha (default = hoy)
  - Observación
- **Validaciones:**
  - Producto debe existir
  - Cantidad > 0
  - Número de orden único para tipo ENTRADA

#### RF-3.4: Movimientos de Bodega
- **Descripción:** Ver historial completo de movimientos del inventario.
- **Información registrada en cada movimiento:**
  - Tipo de movimiento (ENTRADA, DESPACHADO, DEVOLUCION, PRESTADO, MATERIAL_EXCEDENTE)
  - Código de producto
  - Cantidad
  - Fecha del movimiento
  - Número de orden (si aplica)
  - Código PQR (si está vinculado a novedad)
  - Electricista responsable
  - Observaciones
- **Filtros disponibles:**
  - Por rango de fechas
  - Por tipo de movimiento
  - Por código de producto
  - Por electricista

#### RF-3.5: Detalle de Historial de Elemento
- **Descripción:** Consultar el historial completo de movimientos de un material específico.
- **Funcionalidad:**
  - Tabla con todos los movimientos del elemento
  - Mostrar saldo acumulativo en cada movimiento
  - Filtrar por fecha
  - Ver vinculación a novedades/PQRs
  - Exportar historial (XLSX)

#### RF-3.6: Edición de Stock (Protegida)
- **Descripción:** Permitir correcciones de stock con autenticación OTP.
- **Restricciones:**
  - Solo usuarios autorizados (Admin)
  - Requiere verificación OTP antes de guardar
  - Registrar auditoría de cambios
  - Mostrar razón del cambio en observación
- **Campos editables:**
  - Cantidad inicial (ajuste de inventario inicial)
  - Precio unitario

---

### 4️⃣ MÓDULO: DEVOLUCIONES Y PRÉSTAMOS

**Objetivo:** Controlar el flujo de materiales entre bodega y electricistas (préstamos y devoluciones).

#### RF-4.1: Registrar Préstamo
- **Descripción:** Documentar la salida de materiales hacia un electricista.
- **Campos:**
  - Electricista (selección de lista activos)
  - Código de material (búsqueda)
  - Cantidad
  - Fecha de préstamo
  - Observación (opcional)
  - Código PQR (opcional)
- **Validaciones:**
  - Stock disponible >= cantidad solicitada
  - Electricista activo
  - Cantidad > 0
- **Efecto:**
  - Reduce stock disponible de bodega
  - Crea registro en tabla `inventario_electricista`
  - Registra movimiento tipo "PRESTADO"

#### RF-4.2: Registrar Devolución
- **Descripción:** Documentar la devolución de materiales por parte de electricista.
- **Modalidad 1: Desde lista de despachos**
  - Mostrar tabla de materiales despachados a electricista seleccionado
  - Permitir seleccionar qué materiales devuelve
  - Ingresar cantidad devuelta (puede ser parcial)
  - Generar movimiento tipo "DEVOLUCION"
- **Modalidad 2: Devolución manual**
  - Ingreso directo de material, cantidad y electricista
  - Crear movimiento "DEVOLUCION"
- **Validaciones:**
  - Cantidad devuelta <= cantidad prestada
  - Electricista debe tener registro de préstamo

#### RF-4.3: Filtrado de Despachos
- **Descripción:** Buscar y filtrar los despachos realizados por cada electricista.
- **Filtros:**
  - Por electricista
  - Por fecha
  - Por código de material
  - Por estado (Pendiente devolución, Parcialmente devuelto, Completamente devuelto)

#### RF-4.4: Visualización de Despachos Pendientes
- **Descripción:** Mostrar resumen de materiales pendientes de devolución por electricista.
- **Información:**
  - Electricista
  - Material prestado
  - Cantidad original
  - Cantidad devuelta
  - Cantidad pendiente
  - Días desde el préstamo
  - Código PQR asociado

---

### 5️⃣ MÓDULO: GESTIÓN DE ELECTRICISTAS

**Objetivo:** Administrar los datos, inventario personal y asignaciones de electricistas.

#### RF-5.1: Crear Nuevo Electricista
- **Descripción:** Registrar un nuevo electricista en el sistema.
- **Campos obligatorios:**
  - Documento de identidad (único)
  - Nombre completo
  - Teléfono de contacto
- **Campos opcionales:**
  - Correo electrónico
  - Dirección
  - Zona de trabajo
- **Validaciones:**
  - Documento único y válido
  - Nombre no vacío
  - Teléfono con formato válido
- **Efecto:**
  - Crear registro activo en base de datos
  - Permitir asignación de inventario

#### RF-5.2: Listar Electricistas
- **Descripción:** Mostrar tabla de todos los electricistas registrados.
- **Columnas:**
  - Documento (ID)
  - Nombre
  - Teléfono
  - Correo
  - Estado (Activo/Inactivo)
  - Fecha de registro
  - Acciones (Editar, Ver inventario)

#### RF-5.3: Editar Datos de Electricista
- **Descripción:** Actualizar información de un electricista existente.
- **Campos editables:**
  - Nombre
  - Teléfono
  - Correo
  - Zona de trabajo
  - Estado (Activo/Inactivo)
- **Restricciones:**
  - No permitir cambiar documento (ID inmutable)
  - Requerir confirmación para desactivar

#### RF-5.4: Ver Inventario de Electricista
- **Descripción:** Consultar los materiales asignados y en inventario personal del electricista.
- **Información mostrada:**
  - Material (código, descripción)
  - Cantidad asignada
  - Cantidad utilizada en PQRs
  - Cantidad disponible en mano
  - Última actualización
- **Funcionalidad:**
  - Filtrar por estado del material
  - Ver historial de movimientos de este electricista
  - Exportar reporte (PDF/Excel)

#### RF-5.5: Asignar Material a Electricista
- **Descripción:** Entregar materiales del inventario de bodega al inventario personal de un electricista.
- **Proceso:**
  - Seleccionar electricista
  - Seleccionar producto
  - Ingresar cantidad
  - Validar disponibilidad en bodega
  - Crear registro en `inventario_electricista`
  - Registrar movimiento "ENTREGA_ELECTRICISTA"
- **Validaciones:**
  - Stock disponible en bodega >= cantidad
  - Electricista activo
  - Cantidad > 0

#### RF-5.6: Remover Material de Electricista
- **Descripción:** Retirar asignación de material de un electricista (devolución total o cancelación).
- **Proceso:**
  - Confirmar devolución de materiales
  - Generar movimiento "DEVOLUCION"
  - Actualizar stock de bodega
  - Registrar auditoría

---

### 6️⃣ MÓDULO: REPORTES

**Objetivo:** Proporcionar análisis y visibilidad de operaciones del sistema.

#### RF-6.1: Reporte de Novedades
- **Descripción:** Análisis detallado de eventos registrados en luminarias.
- **Filtros disponibles:**
  - Rango de fechas (desde/hasta)
  - Tipo de novedad (Mantenimiento, Cambio de tecnología, etc.)
  - Electricista responsable
  - Número de lámpara
  - Estado de la novedad
- **Información mostrada:**
  - Número de lámpara
  - Tipo de novedad
  - Tecnología (anterior → nueva)
  - Fecha de registro
  - Electricista
  - Código PQR
  - Materiales utilizados (cantidad y costo total)
  - Observaciones
- **Métricas:**
  - Total de novedades en período
  - Cantidad por tipo
  - Cantidad por electricista
  - Costo total de materiales utilizados
- **Exportación:**
  - Descargar como XLSX con formato
  - Incluir gráficos de resumen

#### RF-6.2: Reporte de Gastos Generales
- **Descripción:** Análisis de gastos de inventario (movimientos de bodega).
- **Filtros:**
  - Rango de fechas
  - Tipo de movimiento (DESPACHADO, PRESTADO, DEVOLUCION, etc.)
  - Código de material
  - Electricista involucrado
  - Código PQR
- **Columnas del reporte:**
  - Fecha del movimiento
  - Material (código, nombre)
  - Tipo de movimiento
  - Cantidad
  - Precio unitario
  - Costo total (cantidad × precio)
  - Número de orden
  - Código PQR
  - Electricista responsable
  - Observación
- **Totales:**
  - Cantidad total movida
  - Costo total del período
  - Desglose por tipo de movimiento
  - Desglose por electricista
- **Exportación:**
  - XLSX con fórmulas de suma
  - Gráficos de distribución de gastos

#### RF-6.3: Análisis de Stock
- **Descripción:** Reporte de estado actual del inventario.
- **Información:**
  - Material
  - Stock inicial
  - Entradas totales
  - Salidas totales
  - Stock actual
  - Valor total (stock × precio unitario)
  - Materiales con stock bajo (< umbral)
- **Alertas:**
  - Resaltar materiales agotados
  - Listar artículos con stock bajo
  - Estimar días de consumo

#### RF-6.4: Reporte de Actividad por Electricista
- **Descripción:** Resumen de operaciones y responsabilidades de cada electricista.
- **Información por electricista:**
  - Total de novedades registradas
  - Cantidad de materiales movidos
  - Costo total de materiales asociados
  - Promedio de gasto por novedad
  - Materiales más frecuentes
  - Período activo

---

### 7️⃣ MÓDULO: CONFIGURACIÓN Y SEGURIDAD

**Objetivo:** Gestionar autenticación, autorización y configuraciones del sistema.

#### RF-7.1: Autenticación por OTP
- **Descripción:** Sistema de autenticación de un factor mediante código OTP enviado a correo.
- **Flujo:**
  1. Usuario accede a función protegida (ej: editar stock)
  2. Sistema solicita código OTP
  3. Usuario solicita generación de código
  4. Sistema genera código numérico aleatorio (6 dígitos)
  5. Backend envía código a correo configurado (GMAIL_USER)
  6. Usuario ingresa código en modal
  7. Backend valida y expira automáticamente en 10 minutos
  8. Si válido, habilita la operación protegida
- **Configuración:**
  - Variables de entorno:
    - `GMAIL_USER`: Correo remitente
    - `GMAIL_APP_PASSWORD`: Contraseña de aplicación Gmail
    - `OTP_EXPIRY_MINUTES`: Duración (default=10)
    - `OTP_DIGITS`: Longitud (default=6)
- **Restricciones:**
  - Un solo código activo por correo
  - Máximo 3 intentos fallidos
  - Código case-insensitive

#### RF-7.2: Control de Acceso Protegido
- **Descripción:** Operaciones críticas requieren autenticación adicional.
- **Operaciones protegidas:**
  - Editar stock de inventario
  - Eliminar registros de novedades
  - Desactivar electricistas
  - Cambiar configuración del sistema
- **Requisito:** Pasar validación OTP antes de ejecutar

#### RF-7.3: Configuración de Umbrales
- **Descripción:** Parámetros configurables del sistema.
- **Parámetros:**
  - `STOCK_BAJO_UMBRAL`: Cantidad mínima antes de marcar como "bajo" (default=10)
  - `OTP_EXPIRY_MINUTES`: Expiración de código OTP (default=10)
  - `GMAIL_USER`: Correo para envío de OTP
  - `GMAIL_APP_PASSWORD`: Credencial Gmail
- **Consulta por API:**
  - `GET /api/config/ui` retorna configuración disponible
  - Frontend lee y aplica umbrales dinámicamente

#### RF-7.4: Auditoría de Operaciones
- **Descripción:** Registrar cambios críticos para auditoría.
- **Eventos registrados:**
  - Modificaciones de stock
  - Cambios en datos de electricistas
  - Validaciones OTP fallidas
  - Operaciones eliminar
- **Información capturada:**
  - Usuario responsable
  - Tipo de operación
  - Valores antes y después
  - Timestamp
  - IP del cliente (si disponible)

#### RF-7.5: Gestión de Sesión
- **Descripción:** Control de sessión del usuario.
- **Comportamiento:**
  - LocalStorage para persistencia de filtros y preferencias
  - Datos de sesión clara al cerrar navegador
  - Refresco de token (si aplica)

---

## 🔒 Requisitos de Seguridad

### SEG-1: Validación de Entrada
- Todos los campos se validan en frontend y backend
- Inyección SQL prevenida con prepared statements
- Validación de tipos de datos

### SEG-2: Autenticación
- Implementada mediante OTP por correo
- Credenciales almacenadas en variables de entorno
- Código con expiración automática

### SEG-3: CORS
- Backend permite solicitudes solo desde frontend
- Headers de seguridad configurados

### SEG-4: Gestión de Errores
- Errores capturados y registrados centralizadamente
- Mensajes seguros sin exposición de detalles técnicos

### SEG-5: Base de Datos
- Credenciales en `.env`
- Pool de conexiones limitado
- Backups automáticos recomendados

---

## 🔗 Requisitos de Integración

### INT-1: API REST
- Endpoints organizados por dominio (`/api/luminarias`, `/api/novedades`, etc.)
- Respuestas en JSON
- Códigos HTTP estándar (200, 400, 404, 500)

### INT-2: Base de Datos
- PostgreSQL 12+
- Migraciones versionadas
- Triggers para auditoría de movimientos

### INT-3: Correo Electrónico
- Integración con Gmail via OAuth2
- Variables de entorno para credenciales
- Reintentos automáticos en fallos

### INT-4: Frontend - Backend
- Axios para peticiones HTTP
- Autenticación via headers
- Manejo de errores uniforme

### INT-5: Mapa Interactivo
- Leaflet para visualización
- Coordenadas en formato WGS84 (latitud, longitud)

---

## 📊 Matriz de Cumplimiento

| Requisito | Módulo | Backend | Frontend | BD | Estado |
|-----------|--------|---------|----------|----|----|
| RF-1.1 | Mapa | ✅ | ✅ | ✅ | Activo |
| RF-1.2 | Mapa | ✅ | ✅ | ✅ | Activo |
| RF-1.3 | Mapa | ✅ | ✅ | ✅ | Activo |
| RF-1.4 | Mapa | ✅ | ✅ | ✅ | Activo |
| RF-2.1 | Novedad | ✅ | ✅ | ✅ | Activo |
| RF-2.2 | Novedad | ✅ | ✅ | ✅ | Activo |
| RF-2.3 | Novedad | ✅ | ✅ | ✅ | Activo |
| RF-2.4 | Novedad | ✅ | ✅ | ✅ | Activo |
| RF-3.1 | Inventario | ✅ | ✅ | ✅ | Activo |
| RF-3.2 | Inventario | ✅ | ✅ | ✅ | Activo |
| RF-3.3 | Inventario | ✅ | ✅ | ✅ | Activo |
| RF-3.4 | Inventario | ✅ | ✅ | ✅ | Activo |
| RF-3.5 | Inventario | ✅ | ✅ | ✅ | Activo |
| RF-3.6 | Inventario | ✅ | ✅ | ✅ | Activo |
| RF-4.1 | Devoluciones | ✅ | ✅ | ✅ | Activo |
| RF-4.2 | Devoluciones | ✅ | ✅ | ✅ | Activo |
| RF-4.3 | Devoluciones | ✅ | ✅ | ✅ | Activo |
| RF-4.4 | Devoluciones | ✅ | ✅ | ✅ | Activo |
| RF-5.1 | Electricistas | ✅ | ✅ | ✅ | Activo |
| RF-5.2 | Electricistas | ✅ | ✅ | ✅ | Activo |
| RF-5.3 | Electricistas | ✅ | ✅ | ✅ | Activo |
| RF-5.4 | Electricistas | ✅ | ✅ | ✅ | Activo |
| RF-5.5 | Electricistas | ✅ | ✅ | ✅ | Activo |
| RF-5.6 | Electricistas | ✅ | ✅ | ✅ | Activo |
| RF-6.1 | Reportes | ✅ | ✅ | ✅ | Activo |
| RF-6.2 | Reportes | ✅ | ✅ | ✅ | Activo |
| RF-6.3 | Reportes | ✅ | ✅ | ✅ | Activo |
| RF-6.4 | Reportes | ✅ | ✅ | ✅ | Activo |
| RF-7.1 | Seguridad | ✅ | ✅ | ✅ | Activo |
| RF-7.2 | Seguridad | ✅ | ✅ | ✅ | Activo |
| RF-7.3 | Seguridad | ✅ | ✅ | ✅ | Activo |
| RF-7.4 | Seguridad | ✅ | ✅ | ✅ | Activo |
| RF-7.5 | Seguridad | ✅ | ✅ | ✅ | Activo |

---

## 🎓 Notas Técnicas

### Consideraciones de Diseño
1. **Modelo de Inventario:** Simplificado sin lotes intermediarios, movimientos directos a productos
2. **Trazabilidad:** Cada movimiento registra electricista, fecha, tipo y observaciones
3. **Stock Disponible:** Calculado en tiempo real como `Inicial + Entrada + Devolución - Despachado - Préstamo - Gastado PQR`
4. **Umbral Configurable:** Permite adaptar alertas de stock bajo según operación

### Migraciones Base de Datos
- Evolución versionada en carpeta `/backend/migrations/`
- Se ejecutan automáticamente al iniciar servidor
- Incluyen cambios de esquema, triggers, funciones almacenadas

### Flujo Típico de Operación
1. Usuario accede a dashboard principal
2. Navega a módulo específico (Inventario, Novedades, etc.)
3. Realiza operación (crear, editar, consultar)
4. Sistema valida, registra en BD y retorna confirmación
5. Cambios se reflejan en tiempo real en interfaz

---

## 📞 Contacto y Soporte

Para consultas sobre funcionalidades específicas o reporte de incidencias, contactar al equipo de desarrollo.

**Sistema versión:** 1.0  
**Última actualización:** Marzo 2026  
**Estado:** ✅ En operación

---

*Documento generado automáticamente - Requisitos del Sistema de Gestión de Luminarias EVC*
