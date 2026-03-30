# Prompt para GitHub Copilot – Validación OTP por correo para edición protegida

> **Proyecto:** Sistema de gestión de luminarias (React + Vite / Node.js + Express / PostgreSQL)
> **Contexto base:** Contexto v0.99 (2026-03-17)
> **Objetivo de esta instrucción:** Agregar una capa de seguridad mediante contraseña temporal (OTP) enviada a un correo Gmail antes de permitir editar datos en los módulos de Inventario, Electricistas y Novedades.

---

## 1. Pregunta inicial obligatoria

Antes de generar cualquier código, GitHub Copilot **debe hacer las siguientes preguntas al desarrollador** y esperar sus respuestas:

1. **¿Cuál es la dirección de correo Gmail** que recibirá el OTP de validación?
   - Ejemplo esperado: `admin@gmail.com`
   - Esta dirección quedará como constante configurable en el backend.

2. **¿Cuántos dígitos tendrá el OTP?** (recomendado: 6)

3. **¿Cuántos minutos de validez tendrá el OTP?** (recomendado: 5 minutos)

> ⚠️ No continúes con la generación de código hasta tener respuesta a estas tres preguntas.

---

## 2. Contexto técnico del proyecto

### Stack
- **Frontend:** React + Vite (`frontend/src/`)
- **Backend:** Node.js + Express (`backend/`)
- **Base de datos:** PostgreSQL
- **Correo:** Gmail vía `nodemailer` con OAuth2 o contraseña de aplicación

### Módulos afectados
Los tres módulos donde se debe proteger la **edición** (no la lectura ni la creación) son:

| Módulo | Página frontend | Ruta backend principal |
|---|---|---|
| Inventario | `frontend/src/pages/InventarioBodega.jsx` | `backend/routes/inventario.routes.js` |
| Electricistas | `frontend/src/pages/Electricistas.jsx` | `backend/routes/electricista.routes.js` |
| Novedades | `frontend/src/pages/ReporteNovedades.jsx` | `backend/routes/novedad.routes.js` |

### Controladores involucrados
- `backend/controllers/inventario.controller.js`
- `backend/controllers/electricista.controller.js`
- `backend/controllers/novedad.controller.js`

---

## 3. Qué se debe implementar

### 3.1 Backend – Nuevo módulo OTP

Crear los siguientes archivos nuevos:

#### `backend/services/otp.service.js`
- Generar un OTP aleatorio numérico (cantidad de dígitos según respuesta del desarrollador).
- Almacenarlo en memoria (un objeto `Map` en Node.js) con clave `email` y valor `{ code, expiresAt }`.
- Función `generateOtp(email)`: genera, guarda y retorna el código.
- Función `validateOtp(email, code)`: verifica que el código coincida y no esté expirado. Elimina el registro tras validación exitosa.

#### `backend/services/mail.service.js`
- Usar `nodemailer` con transporte Gmail.
- Configurar credenciales mediante variables de entorno:
  - `GMAIL_USER` → dirección Gmail del remitente (la que el desarrollador indicó).
  - `GMAIL_APP_PASSWORD` → contraseña de aplicación Gmail.
- Función `sendOtpEmail(destinatario, codigo)`: envía el OTP al correo configurado.

> 📌 **Indicar al desarrollador** que el valor de `GMAIL_USER` debe agregarse en el archivo `.env` del backend. Mostrar exactamente en qué línea del archivo `.env` (o crearlo si no existe) se debe colocar la variable.

#### `backend/routes/otp.routes.js`
- `POST /api/otp/solicitar` → llama a `generateOtp` y envía el correo.
- `POST /api/otp/verificar` → llama a `validateOtp` y retorna `{ valido: true/false }`.

#### Registrar la ruta en `backend/server.js`
- Agregar: `app.use('/api/otp', require('./routes/otp.routes'))` junto a las rutas existentes.

---

### 3.2 Frontend – Componente modal OTP reutilizable

#### Crear `frontend/src/components/OtpModal.jsx`
- Modal que se muestra antes de habilitar el modo edición.
- Contiene:
  - Botón **"Solicitar código"** → llama a `POST /api/otp/solicitar`.
  - Campo de texto para ingresar el OTP recibido.
  - Botón **"Verificar"** → llama a `POST /api/otp/verificar`.
  - Mensaje de error si el código es incorrecto o expiró.
  - Mensaje de éxito que cierra el modal y habilita la edición.
- Props esperadas:
  - `isOpen` (boolean)
  - `onClose` (función)
  - `onVerificado` (función callback que se ejecuta cuando el OTP es válido)

#### Crear `frontend/src/api/otp.api.js`
- `solicitarOtp()` → `POST /api/otp/solicitar`
- `verificarOtp(codigo)` → `POST /api/otp/verificar`

---

### 3.3 Integración por módulo

En cada página afectada, aplicar el siguiente patrón de integración:

#### Patrón general
```jsx
// Estado para controlar si la edición está habilitada
const [edicionHabilitada, setEdicionHabilitada] = useState(false);
const [mostrarOtp, setMostrarOtp] = useState(false);

// Botón que dispara el flujo OTP antes de editar
<button onClick={() => setMostrarOtp(true)}>
  Editar
</button>

// Modal OTP
<OtpModal
  isOpen={mostrarOtp}
  onClose={() => setMostrarOtp(false)}
  onVerificado={() => {
    setEdicionHabilitada(true);
    setMostrarOtp(false);
  }}
/>

// Los controles de edición solo se muestran si edicionHabilitada === true
{edicionHabilitada && <FormularioEdicion ... />}
```

#### Archivo: `frontend/src/pages/InventarioBodega.jsx`
- El botón de edición de un producto/lote debe disparar el modal OTP.
- Solo tras OTP válido se habilitan los campos editables del formulario de inventario.

#### Archivo: `frontend/src/pages/Electricistas.jsx`
- El switch de disponibilidad ON/OFF y cualquier acción de edición deben pasar por el modal OTP.
- Respetar la restricción existente: _"operación de actualización bloquea UI durante guardado"_.

#### Archivo: `frontend/src/pages/ReporteNovedades.jsx`
- El formulario de edición de novedad (que ya valida que no tenga movimientos asociados) debe requerir OTP antes de mostrarse.
- Respetar la restricción existente: _"no editar novedad si ya tiene movimientos asociados"_.

---

## 4. Dónde se puede cambiar el correo destino

Copilot debe indicar explícitamente los **puntos exactos** donde el desarrollador puede cambiar la dirección de correo receptora del OTP:

| Ubicación | Variable / Constante | Descripción |
|---|---|---|
| `backend/.env` | `GMAIL_USER=admin@gmail.com` | Correo remitente y receptor del OTP |
| `backend/services/mail.service.js` | Parámetro `to` en `sendOtpEmail()` | Si se desea un receptor diferente al remitente, modificar aquí |
| `backend/routes/otp.routes.js` | Cuerpo de `POST /api/otp/solicitar` | Puede recibir el email por body si se quiere dinamizar en el futuro |

> 📌 Copilot debe agregar un comentario `// CAMBIAR CORREO AQUÍ` en cada uno de estos puntos del código generado.

---

## 5. Instalación de dependencias

Copilot debe indicar el comando a ejecutar en el backend:

```bash
cd backend
npm install nodemailer
```

---

## 6. Variables de entorno requeridas

Copilot debe indicar que en `backend/.env` se deben agregar:

```env
# Configuración OTP por Gmail
GMAIL_USER=correo-indicado-por-el-desarrollador@gmail.com   # CAMBIAR CORREO AQUÍ
GMAIL_APP_PASSWORD=tu_contraseña_de_aplicacion_gmail
OTP_DIGITS=6          # Cantidad de dígitos del OTP
OTP_EXPIRY_MINUTES=5  # Minutos de validez del OTP
```

> ⚠️ Recordar al desarrollador que `GMAIL_APP_PASSWORD` **no es la contraseña normal de Gmail**, sino una contraseña de aplicación generada en: `Cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicación`.

---

## 7. Restricciones que NO se deben romper

Al implementar esta funcionalidad, Copilot debe respetar todas las restricciones existentes del sistema documentadas en `Contexto v0.99`:

- ✅ Una novedad con movimientos asociados **sigue sin poder editarse**, independientemente del OTP.
- ✅ El stock no puede quedar negativo en salidas.
- ✅ El documento del electricista sigue siendo único.
- ✅ Los tipos de movimiento válidos no cambian.
- ✅ La disponibilidad del electricista sigue impactando los movimientos.
- ✅ No modificar la lógica de devoluciones ni su trazabilidad.

---

## 8. Orden de implementación sugerido

1. Instalar `nodemailer` en backend.
2. Crear `backend/services/otp.service.js`.
3. Crear `backend/services/mail.service.js`.
4. Crear `backend/routes/otp.routes.js`.
5. Registrar la ruta en `backend/server.js`.
6. Agregar variables de entorno en `backend/.env`.
7. Crear `frontend/src/api/otp.api.js`.
8. Crear `frontend/src/components/OtpModal.jsx`.
9. Integrar `OtpModal` en `InventarioBodega.jsx`.
10. Integrar `OtpModal` en `Electricistas.jsx`.
11. Integrar `OtpModal` en `ReporteNovedades.jsx`.

---

*Generado para uso con GitHub Copilot en VS Code – Contexto v0.99 – 2026-03-17*
