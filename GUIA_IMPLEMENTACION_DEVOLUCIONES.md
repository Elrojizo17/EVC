# Guía de Implementación: Validación de Devoluciones

## Pasos de Instalación

### 1. Aplicar la Migración a la BD

Si tienes herramienta de migraciones automáticas:
```bash
# Si usas script de inicialización
cd backend
node initDB.js  # Ejecuta todas las migraciones en migrations/
```

Si es manual:
```bash
# Conéctate a PostgreSQL
psql -U tu_usuario -d tu_base_de_datos -f migrations/20260317_improve_devolucion_tracking.sql
```

Verifica que se crearon las tablas y vistas:
```sql
-- Verificar tabla detalle_novedad
SELECT COUNT(*) FROM detalle_novedad;

-- Verificar vista
SELECT * FROM vw_integridad_devoluciones LIMIT 5;

-- Verificar trigger
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_registrar_detalle_novedad';
```

---

### 2. Reiniciar Backend

```bash
cd backend
npm install  # Si hay dep nuevas
npm start     # Reinicia servidor
```

---

### 3. Probar en Frontend

Accede a **Devoluciones y Préstamos** y prueba:

#### Test 1: Devolución sin despacho (debe fallar)
1. Selecciona "Devolución"
2. Selecciona elemento
3. Ingresa cantidad
4. NO selecciones despacho
5. Envía → **Debe mostrar: "Debes seleccionar el despacho..."**

#### Test 2: Devolución válida
1. Selecciona "Devolución"
2. Selecciona un despacho válido de la lista
3. Se prellenarán: Elemento, Cantidad, PQR
4. Valida que novedad está vinculada
5. Envía → **Debe registrar exitosamente**

---

## Monitoreo de Integridad

### Query para Auditar Devoluciones Problemáticas

```sql
-- Devoluciones sin novedad vinculada (ERROR)
SELECT 
    mb.id_movimiento,
    mb.fecha,
    mb.id_lote,
    mb.id_novedad_luminaria,
    mb.cantidad,
    e.nombre AS electricista,
    mb.codigo_pqr
FROM movimiento_bodega mb
LEFT JOIN electricista e ON e.documento = mb.id_electricista
WHERE mb.tipo_movimiento = 'DEVOLUCION'
  AND mb.id_novedad_luminaria IS NULL;

-- Devoluciones sin despacho previo (ERROR)
SELECT 
    vl.id_movimiento,
    vl.tipo_movimiento,
    vl.estado_integridad,
    vl.numero_lampara,
    vl.elemento,
    vl.electricista
FROM vw_integridad_devoluciones vl
WHERE vl.estado_integridad = 'SIN_DESPACHO_PREVIO';

-- Historial completo de una novedad
SELECT 
    dn.id_detalle,
    dn.tipo_operacion,
    dn.cantidad,
    dn.numero_lampara,
    dn.fecha_registro,
    e.nombre AS electricista,
    mb.codigo_pqr
FROM detalle_novedad dn
LEFT JOIN movimiento_bodega mb ON mb.id_movimiento = dn.id_movimiento
LEFT JOIN electricista e ON e.documento = mb.id_electricista
WHERE dn.id_novedad = ?
ORDER BY dn.fecha_registro ASC;
```

---

## Validaciones por Tipo de Movimiento

### PRESTADO
- [ ] Elemento seleccionado
- [ ] Cantidad > 0
- [ ] Stock disponible ≥ cantidad
- [ ] Electricista seleccionado
- [ ] PQR válido (≥ 3 caracteres)

### DEVOLUCION
- [ ] **Despacho original seleccionado** ← NUEVO
- [ ] **Novedad vinculada a despacho** ← NUEVO
- [ ] **Lote coincide con despacho** ← NUEVO
- [ ] Cantidad ≤ cantidad despachada
- [ ] Numero de lámpara matches ← NUEVO (log)
- [ ] Electricista seleccionado
- [ ] PQR válido

---

## Campos del Formulario DevolucionesPrestamos

### Cuando tipo_movimiento = "PRESTADO"
- ✓ Elemento de inventario (habilitado)
- ✓ Cantidad (libre)
- ✓ Electricista (requerido)
- ✓ PQR (requerido)

### Cuando tipo_movimiento = "DEVOLUCION"
- ✗ Elemento de inventario (DESHABILITADO - se toma del despacho)
- ✗ Cantidad (SE PREFIJA - máximo lo despachado)
- ✓ Despacho a devolver (NUEVO CAMPO - requerido)
- ✓ Electricista (requerido)
- ✓ PQR (requerido, se PREFIJA del despacho)

---

## Mensajes de Error Esperados

### ❌ "Debes seleccionar el despacho"
**Causa**: No se seleccionó despacho en DEVOLUCION
**Solución**: Usa el buscador para encontrar el despacho original

### ❌ "Novedad no encontrada #[numero]"
**Causa**: La novedad no existe en BD
**Solución**: Verifica que el despacho fue creado correctamente

### ❌ "No existe un despacho previo para esta novedad"
**Causa**: Hay un movimiento DESPACHADO vinculado a esa novedad
**Solución**: Registra primero un DESPACHO con esa novedad

### ⚠️ "INTEGRIDAD FALLIDA: La devolución (X) no puede exceder lo despachado (Y)"
**Causa**: Intentas devolver más de lo que se despachó
**Solución**: Reduce la cantidad o selecciona otro despacho

### ⚠️ "El lote no coincide con el despacho original"
**Causa**: El elemento seleccionado es diferente al del despacho
**Solución**: El elemento se PREFIJA automáticamente, no deberías editarlo

---

## Logs de Auditoría

En la consola del backend verás:

```
✓ Devolución validada: Novedad #45, Lámpara 1234, Cantidad: 2/10
ℹ️  Registrando DEVOLUCION: ID Novedad: 45, Cantidad: 2, PQR: PQR-2026-001
```

---

## Dashboard SQL para Auditoría

```sql
-- Top: Novedades con más devoluciones
SELECT 
    dn.id_novedad,
    nl.numero_lampara,
    COUNT(*) AS num_operaciones,
    SUM(CASE WHEN dn.tipo_operacion = 'DESPACHO' THEN dn.cantidad ELSE 0 END) AS total_despachado,
    SUM(CASE WHEN dn.tipo_operacion = 'DEVOLUCION' THEN dn.cantidad ELSE 0 END) AS total_devuelto
FROM detalle_novedad dn
JOIN novedad_luminaria nl ON nl.id_novedad = dn.id_novedad
GROUP BY dn.id_novedad, nl.numero_lampara
HAVING SUM(CASE WHEN dn.tipo_operacion = 'DEVOLUCION' THEN dn.cantidad ELSE 0 END) > 0
ORDER BY total_devuelto DESC;

-- Estado de todas las devoluciones
SELECT 
    estado_integridad,
    COUNT(*) AS cantidad,
    tipo_novedad,
    numero_lampara
FROM vw_integridad_devoluciones
WHERE tipo_movimiento = 'DEVOLUCION'
GROUP BY estado_integridad, tipo_novedad, numero_lampara;
```

---

## Rollback (Si algo falla)

### Deshacer la migración:
```sql
-- Borrar la migración
DROP VIEW IF EXISTS vw_integridad_devoluciones;
DROP TRIGGER IF EXISTS trigger_registrar_detalle_novedad ON movimiento_bodega;
DROP FUNCTION IF EXISTS registrar_detalle_novedad();
DROP TABLE IF EXISTS detalle_novedad;

-- Las alteraciones a movimiento_bodega se quedan (no afectan)
-- ALTER TABLE movimiento_bodega DROP COLUMN estado_devolucion;
-- ALTER TABLE movimiento_bodega DROP COLUMN devolucion_procesada;
```

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Trigger no se ejecuta | Verifica BD: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_registrar_detalle_novedad'` |
| Tabla detalle_novedad vacía | Es normal si no hay devoluciones nuevas. Se llena con nuevos movimientos |
| Vista da error | Ejecuta: `SELECT pg_get_viewdef('vw_integridad_devoluciones');` |
| Validación en frontend no funciona | Reinicia npm: `npm restart` en client |
| Backend no valida | Revisa que gasto.routes.js esté actualizado |

---

**Documento generado**: 2026-03-17
