# Mejora: Validación de Integridad en Devoluciones

**Fecha**: Marzo 17, 2026  
**Versión**: 1.0  
**Estado**: ✅ Completado

---

## 📋 Resumen del Problema

Se han identificado fallos en las devoluciones donde no hay validación suficiente de integridad entre:
- Número de novedad
- Número de lámpara
- Cantidad devuelta vs cantidad despachada

Esto causaba inconsistencias en los datos y pérdida de trazabilidad.

---

## 🔧 Soluciones Implementadas

### 1. **Backend - Validación Mejorada** (`backend/routes/gasto.routes.js`)

#### Cambios:
- ✅ **Validación obligatoria de novedad**: Para devoluciones (DEVOLUCION), ahora se requiere `id_novedad_luminaria`
- ✅ **Verificación de despacho previo**: Busca movimiento DESPACHADO anterior con la misma novedad y lote
- ✅ **Validación de cantidad**: La cantidad devuelta no puede exceder la cantidad despachada
- ✅ **Verificación de lámpara**: Se vincula y valida el número de lámpara de la novedad
- ✅ **Logs de auditoría**: Registra información de devoluciones para trazabilidad

#### Validaciones Específicas:
```javascript
// Para DEVOLUCION se valida:
1. id_novedad_luminaria es obligatorio
2. La novedad existe en BD
3. Existe movimiento DESPACHADO previo (mismo lote + novedad)
4. Cantidad devuelta ≤ cantidad despachada
5. Número de lámpara se vincula correctamente
```

---

### 2. **Frontend - Validaciones Complementarias** (`frontend/src/pages/DevolucionesPrestamos.jsx`)

#### Mejoras:
- ✅ **Selección obligatoria de despacho**: Para devoluciones debe seleccionarse un despacho válido
- ✅ **Validación de correspondencia**: Lote del despacho debe coincidir con el seleccionado
- ✅ **Mensajes de error mejorados**: Incluyen número de novedad, lote y cantidad
- ✅ **Logs de validación**: Registra detalles antes de enviar
- ✅ **Presentación visual mejorada**: 
  - Filas de devoluciones en color verde para identificarlas
  - Información de trazabilidad debajo de cada devolución
  - Cantidad original despachada visible
  - Alerta visual de DEVOLUCION sin novedad vinculada

---

### 3. **Database - Nueva Estructura** (`backend/migrations/20260317_improve_devolucion_tracking.sql`)

#### Cambios a BD:
- ✅ **Campos en `movimiento_bodega`**:
  - `estado_devolucion`: Rastrear estado (PENDIENTE, RECIBIDA, VALIDADA, RECHAZADA)
  - `devolucion_procesada`: Flag booleano de procesamiento completo

- ✅ **Nueva tabla `detalle_novedad`**:
  - Registro granular de TODOS los movimientos por novedad
  - Campos: `id_novedad`, `tipo_operacion`, `id_movimiento`, `cantidad`, `numero_lampara`
  - Trigger automático para registrar movimientos
  - Índices para búsqueda rápida

- ✅ **Vista `vw_integridad_devoluciones`**:
  - Auditoría completa de devoluciones
  - Verifica presencia de despacho previo
  - Cuenta movimientos asociados por novedad
  - Estado de integridad para cada devolución

---

### 4. **API Mejorada** (`backend/routes/gasto.routes.js` - GET)

#### Nuevos Campos en Respuesta:
```json
{
  "id_gasto": 123,
  "tipo_movimiento": "DEVOLUCION",
  "cantidad_usada": 5,
  "id_novedad": 45,
  "numero_lampara": "1234",
  "tipo_novedad": "CAMBIO_TECNOLOGIA",
  "cantidad_original_despachada": 10,
  "total_devuelto_hasta_ahora": 5,
  "codigo_pqr": "PQR-2026-001"
}
```

---

## 🎯 Flujo de Validación Actual

### Para Registrar una DEVOLUCION:

```
1. Frontend Validaciones:
   ├─ ¿Formulario válido? → Error
   ├─ ¿Es DEVOLUCION? → No, salta a 5
   ├─ ¿Despacho seleccionado? → Error si no
   ├─ ¿Tiene novedad vinculada? → Error si no
   ├─ ¿Lote coincide? → Error si no
   ├─ ¿Cantidad ≤ despachada? → Error si no
   └─ ✓ Envía al backend

2. Backend Validaciones:
   ├─ ¿Novedad obligatoria presente? → Error si no
   ├─ ¿Novedad existe en BD? → Error si no
   ├─ ¿Existe DESPACHADO previo? → Error si no
   ├─ ¿Cantidad ≤ despachada? → Error si no
   ├─ Registra en movimiento_bodega
   ├─ Trigger automático → Crea registro en detalle_novedad
   └─ ✓ Retorna con confirmación

3. Trazabilidad:
   └─ Vista vw_integridad_devoluciones → Auditoría completa
```

---

## 📊 Ejemplo de Flujo Correcto

```
Novedad #45: Cambio de tecnología en lámpara 1234

① DESPACHO (30 lámparas LED)
   - Fecha: 2026-03-10
   - Cantidad: 3
   - Electricista: Juan Díaz
   - PQR: PQR-2026-001

② DEVOLUCION (2 de 3)
   - Fecha: 2026-03-15
   - Cantidad: 2
   - Electricista: Juan Díaz
   - Novedad: #45 ✓ Vinculada
   - Lámpara: 1234 ✓ Coincide
   - Original: 3 ✓ No excede
   - Estado: VALIDADA ✓

③ SALDO FINAL
   - Cantidad restante en campo: 1
   - Trazabilidad completa: detalle_novedad
```

---

## ⚠️ Casos de Error Ahora Detectados

| Caso | Antes | Ahora |
|------|-------|-------|
| Devolución sin novedad | ✗ Aceptaba | ✓ RECHAZA |
| Novedad no existe | ✗ Aceptaba | ✓ RECHAZA |
| Sin despacho previo | ✗ Aceptaba | ✓ RECHAZA |
| Cantidad excede despacho | ⚠️ A veces validaba mal | ✓ RECHAZA con claridad |
| Número de lámpara inconsistente | ✗ No validaba | ✓ LOG de auditoría |
| Lote no coincide | ✗ No validaba | ✓ RECHAZA |

---

## 🚀 Próximos Pasos Recomendados

1. **Ejecutar migración**:
   ```bash
   psql -d tu_base -f backend/migrations/20260317_improve_devolucion_tracking.sql
   ```

2. **Pruebas**:
   - Intentar devolución sin seleccionar despacho → Debe fallar
   - Intentar devolución con cantidad > despachada → Debe fallar
   - Devolución válida → Debe mostrar trazabilidad

3. **Reporte de devoluciones**:
   ```sql
   SELECT * FROM vw_integridad_devoluciones 
   WHERE tipo_movimiento = 'DEVOLUCION' 
   AND estado_integridad = 'SIN_DESPACHO_PREVIO';
   ```

4. **Auditoría de novedades**:
   ```sql
   SELECT * FROM detalle_novedad WHERE id_novedad = 45;
   ```

---

## 📝 Archivos Modificados

- ✅ `backend/routes/gasto.routes.js` - POST y GET mejorados
- ✅ `frontend/src/pages/DevolucionesPrestamos.jsx` - Validaciones y UI mejorada
- ✅ `backend/migrations/20260317_improve_devolucion_tracking.sql` - Nuevo (migraci ón BD)

---

## 💡 Notas Importantes

- La validación ahora es **bilateral**: Frontend + Backend
- Los logs registran TODOS los intentos de devolución para auditoría
- La tabla `detalle_novedad` permite rastrear el historial completo de una novedad
- La vista `vw_integridad_devoluciones` permite auditar inconsistencias
- Los datos históricos se mantienen, solo se aplican validaciones prospectivas

---

**Generado**: 2026-03-17  
**Responsable**: Sistema de Gestión de Luminarias
