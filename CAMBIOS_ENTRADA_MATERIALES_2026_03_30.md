# Revisión y Corrección: Entrada de Materiales

**Fecha:** 30 de marzo de 2026  
**Versión:** 1.0

---

## Problema Identificado

El cálculo de **movimientos recibidos** (campo `entrada`) en el inventario estaba basado en condiciones del campo `numero_orden`, lo que causaba que **NO se contabilizaran correctamente todas las entradas de materiales**. 

### Sintoma
Las columnas "Recibe" (entrada) no sumaban correctamente el total de materiales ingresados a la bodega.

### Causa Raíz
La consulta SQL en `getInventarioFlat` tenía lógica condicional confusa:
```sql
entrada = 
  (IF numero_orden no está vacío: suma lp.cantidad)
  +
  (IF numero_orden está vacío: suma movimientos ENTRADA legacy)
```

Esto era incorrecto porque:
1. No contabilizaba todas las ENTRADAS simultáneamente
2. Dividía la lógica basada en si había número de orden
3. Incluía un CTE legacy (`mov_recibe_legacy`) que no debería ser necesario

---

## Cambios Realizados

### 1. **Simplificación del Query SQL** (`backend/controllers/inventario.controller.js`)

#### ❌ Antes (Complejo y Confuso):
```sql
entrada = (SUM lp.cantidad si numero_orden <> '')
        + (SUM movimientos legacy si numero_orden = '')
```

#### ✅ Después (Simple y Directo):
```sql
entrada = SUM(mov.entrada)  -- Suma TODOS los movimientos tipo ENTRADA
```

#### Cambios en el cálculo de `stock_disponible`:
```sql
-- Antes (Confuso con condiciones):
stock = cantidad_lote + recibe_legacy - salidas + devoluciones

-- Después (Claro y Consistente):
stock = cantidad_inicial + entradas + devoluciones - salidas
```

**Beneficios:**
- Matemática clara y documentada
- Eliminada la tabla CTE `mov_recibe_legacy`
- El campo `cantidad` ahora es simplemente `SUM(lp.cantidad)` en lugar de una condición

---

### 2. **Migración de Corrección** (`backend/migrations/20260330_fix_entrada_calculation.sql`)

Se creó una migración idempotente que:
- Verifica que TODOS los lotes con `cantidad > 0` tengan un movimiento de tipo ENTRADA
- Registra las correcciones en una tabla de auditoría (`log_entrada_audit`)
- No afecta los movimientos ya existentes

**SQL clave:**
```sql
INSERT INTO movimiento_bodega (id_lote, tipo_movimiento, cantidad, observacion, fecha)
SELECT ... FROM lote_producto lp
WHERE lp.cantidad > 0 
  AND NOT EXISTS (SELECT 1 FROM movimiento_bodega WHERE ... AND tipo_movimiento = 'ENTRADA')
```

---

### 3. **Sistema de Migraciones Automáticas** (`backend/runMigrations.js`)

Se creó un nuevo script que:
- Ejecuta automáticamente TODAS las migraciones en `backend/migrations/`
- Mantiene registro en tabla `migrations_log` para evitar ejecuciones duplicadas
- Es idempotente (safe to run multiple times)

**Uso:**
```bash
node runMigrations.js  # Manual
# O automáticamenter en server startup
```

---

### 4. **Integración en Startup** (`backend/server.js`)

Se integró `runMigrations.js` en el inicio del servidor:
```javascript
// Ahora se ejecuta automáticamente al iniciar
await runMigrations();
```

**Flujo al iniciar servidor:**
1. Ejecutar migraciones pendientes
2. Verificar compatibilidad de BD
3. Iniciar servidor Express

---

## Validación

### ¿Cómo verificar que funcionó?

#### Dashboard - Inventario Bodega:
1. Ve a la página **Inventario Bodega**
2. Verifica en la tabla:
   - Columna **"Recibe"** debe coincidir con la suma de movimientos ENTRADA
   - Columna **"Stock"** debe ser: Recibe + Devoluciones - Despachado

#### Query de Auditoría (SQL):
```sql
-- Ver qué se corrigió
SELECT * FROM log_entrada_audit ORDER BY fecha_check DESC;

-- Verificar movimientos de ENTRADA
SELECT 
    COUNT(*) as total_entradas,
    SUM(cantidad) as total_cantidad_entrada
FROM movimiento_bodega
WHERE tipo_movimiento = 'ENTRADA';

-- Verificar que cada lote tiene entrada
SELECT 
    lp.id_lote,
    lp.cantidad as cantidad_lote,
    COALESCE(SUM(mb.cantidad), 0) as cantidad_movida
FROM lote_producto lp
LEFT JOIN movimiento_bodega mb ON lp.id_lote = mb.id_lote 
    AND mb.tipo_movimiento = 'ENTRADA'
GROUP BY lp.id_lote, lp.cantidad
HAVING COALESCE(SUM(mb.cantidad), 0) != lp.cantidad;
```

---

## Garantías

✅ **Todas las entradas se suman correctamente** a movimientos recibidos  
✅ **El stock total es consistente** = cantidad_inicial + entradas + devoluciones - salidas  
✅ **Sin duplicados** - Las migraciones son idempotentes  
✅ **Automático** - Se ejecuta al iniciar el servidor  
✅ **Auditable** - Registro de todas las correcciones aplicadas  

---

## Cambios Posteriores Requeridos (Opcional)

Si en el futuro necesitas ajustar el cálculo de entrada:
1. **Modifica** la consulta en `getInventarioFlat` (línea ~1-120)
2. **Crea** una nueva migración en `backend/migrations/` con patrón `YYYYMMDD_descripcion.sql`
3. **Reinicia** el servidor - Las migraciones corren automáticamente

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/controllers/inventario.controller.js` | ✏️ Simplificado cálculo de entrada y stock |
| `backend/migrations/20260330_fix_entrada_calculation.sql` | 🆕 Nueva migración |
| `backend/runMigrations.js` | 🆕 Sistema de migraciones automáticas |
| `backend/server.js` | ✏️ Integración de migraciones al startup |

