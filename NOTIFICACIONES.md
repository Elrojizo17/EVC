# Sistema de Notificaciones - Documentación

## 📋 Descripción General

Se ha implementado un sistema de notificaciones moderno y elegante usando **react-hot-toast**. Las notificaciones reemplazan los antiguos `alert()` y divs de estado, proporcionando una mejor experiencia de usuario.

## 🚀 Características

- ✨ Notificaciones animadas y suaves
- 🎨 Diferentes tipos: success, error, loading, info
- ⏱️ Duraciones personalizables
- 📍 Posicionamiento en la esquina superior derecha
- 🎯 Estilos consistentes y profesionales
- 🔧 Fácil de usar en cualquier componente

## 📝 Uso

### 1. Importar el hook en tu componente

```jsx
import { useNotification } from "../hooks/useNotification";
```

### 2. Usar el hook

```jsx
const { success, error, loading, info, promise, dismiss } = useNotification();
```

### 3. Ejemplos de uso

#### Success - Éxito
```jsx
success("Elemento creado exitosamente");
```

#### Error - Error
```jsx
error("Error al guardar los datos. Intenta nuevamente.");
```

#### Loading - Cargando
```jsx
const toastId = loading("Guardando cambios...");

// Después de completar
dismiss(toastId);
```

#### Info - Información
```jsx
info("Este es un mensaje informativo");
```

#### Promise - Operación asincrónica
```jsx
promise(
  createLuminaria(formData),
  {
    loading: "Creando luminaria...",
    success: "Luminaria creada exitosamente",
    error: "Error al crear la luminaria"
  }
);
```

#### Dismiss - Cerrar notificación
```jsx
const toastId = loading("Procesando...");
// Cerrar notificación específica
dismiss(toastId);
// O cerrar todas las notificaciones
dismiss();
```

## 🎨 Personalizaciones

### Cambiar posición
En `App.jsx`, modifica la prop `position` del `Toaster`:
```jsx
<Toaster position="bottom-right" /> // bottom-left, top-left, top-right, bottom-right
```

### Cambiar duración por defecto
En `useNotification.js`, modifica el `duration`:
```jsx
duration: 3000 // milisegundos
```

### Cambiar colores
Los colores se pueden personalizar en `useNotification.js` dentro de cada función:
```jsx
style: {
  background: '#10b981', // Verde
  color: '#fff',
  // ... otros estilos
}
```

## 📱 Componentes Actualizados

Los siguientes componentes ya están usando el nuevo sistema:

- ✅ LuminariaForm.jsx
- ✅ InventarioBodega.jsx
- ✅ NovedadCenso.jsx
- ✅ GastoInventario.jsx

## 🔄 Migración desde Alert/Divs

### Antes (alert)
```jsx
handleSubmit = async (e) => {
  e.preventDefault();
  await createLuminaria(form);
  alert("Luminaria creada");
};
```

### Después (toast notification)
```jsx
handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await createLuminaria(form);
    success("Luminaria creada exitosamente");
  } catch (err) {
    error(err.message || "Error al crear la luminaria");
  }
};
```

### Antes (divs de estado)
```jsx
{mensaje && (
  <div style={{ background: "#d1fae5", color: "#065f46" }}>
    {mensaje}
  </div>
)}
{error && (
  <div style={{ background: "#fee2e2", color: "#991b1b" }}>
    {error}
  </div>
)}
```

### Después (toast notification)
```jsx
// Los mensajes aparecen automáticamente como toasts
// No necesitas renderizar divs
```

## 💡 Mejores Prácticas

1. **Usa success() para operaciones exitosas**
   ```jsx
   success("Datos guardados correctamente");
   ```

2. **Usa error() para errores**
   ```jsx
   error("No se pudo guardar los datos");
   ```

3. **Desactiva botones durante operaciones**
   ```jsx
   <button disabled={loading}>
     {loading ? "Guardando..." : "Guardar"}
   </button>
   ```

4. **Proporciona mensajes claros y útiles**
   ```jsx
   // ✅ Bueno
   error("El código del elemento ya existe");
   
   // ❌ Malo
   error("Error");
   ```

5. **Maneja errores del servidor**
   ```jsx
   try {
     await api.call();
   } catch (err) {
     error(err.response?.data?.message || "Error desconocido");
   }
   ```

## 🛠️ Personalización del Hook

Si necesitas agregar más tipos de notificaciones, edita `useNotification.js`:

```jsx
const warning = (message) => {
  toast.warning(message, {
    duration: 3000,
    position: 'top-right',
    style: {
      background: '#f59e0b',
      color: '#fff',
      // ... otros estilos
    },
  });
};

return { success, error, loading, info, promise, dismiss, warning };
```

## 📚 Recursos

- [react-hot-toast Documentation](https://react-hot-toast.com/)
- Ver `src/hooks/useNotification.js` para la implementación
- Ver `src/App.jsx` para la configuración del Toaster
