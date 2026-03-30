-- Migración: Corregir duplicados de entrada y aplicar lógica correcta
-- Fecha: 2026-03-30 Rev2
-- Descripción: 
-- - REVERTIR los duplicados creados por la migración anterior
-- - Guardar los datos en tabla de auditoría
-- - Aplicar lógica correcta: inicial (sin orden) vs recibe (con orden)

-- 1. Crear tabla de auditoría si no existe
CREATE TABLE IF NOT EXISTS auditoria_entrada_duplicados (
    id SERIAL PRIMARY KEY,
    id_movimiento INT,
    id_lote INT,
    cantidad INT,
    numero_orden VARCHAR(80),
    tipo_accion VARCHAR(50),
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. DESACTIVAR el trigger que bloquea DELETE
DROP TRIGGER IF EXISTS trg_no_update_delete_movimiento ON public.movimiento_bodega;

-- 3. GUARDAR los movimientos ENTRADA que van a ser eliminados (para auditoría)
INSERT INTO auditoria_entrada_duplicados (id_movimiento, id_lote, cantidad, numero_orden, tipo_accion)
SELECT 
    mb.id_movimiento,
    mb.id_lote,
    mb.cantidad,
    lp.numero_orden,
    'ENTRADA_ELIMINADA_DUPLICADO'
FROM movimiento_bodega mb
JOIN lote_producto lp ON mb.id_lote = lp.id_lote
WHERE mb.tipo_movimiento = 'ENTRADA'
  AND (lp.numero_orden IS NULL OR TRIM(lp.numero_orden) = '')
  AND (
      mb.observacion LIKE '%Backfill ENTRADA inicial%'
      OR mb.observacion LIKE '%ENTRADA inicial: lote%'
  );

-- 4. ELIMINAR los movimientos ENTRADA duplicados de lotes SIN número de orden
DELETE FROM movimiento_bodega mb
USING lote_producto lp
WHERE mb.id_lote = lp.id_lote
  AND mb.tipo_movimiento = 'ENTRADA'
  AND (lp.numero_orden IS NULL OR TRIM(lp.numero_orden) = '')
  AND (
      mb.observacion LIKE '%Backfill ENTRADA inicial%'
      OR mb.observacion LIKE '%ENTRADA inicial: lote%'
  );

-- 5. REACTIVAR el trigger de protección
CREATE TRIGGER trg_no_update_delete_movimiento
BEFORE UPDATE OR DELETE ON public.movimiento_bodega
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_modificacion_movimiento();

-- 6. Verificar que la lógica sea correcta:
-- - Lotes sin orden NO deben tener movimientos ENTRADA (es solo cantidad inicial)
-- - Lotes con orden SÍ deben tener movimientos ENTRADA cuando se compren

-- Log de la limpieza
INSERT INTO auditoria_entrada_duplicados (id_movimiento, id_lote, cantidad, numero_orden, tipo_accion)
SELECT 
    NULL,
    NULL,
    COUNT(*),
    NULL,
    'LIMPIEZA_COMPLETADA'
FROM auditoria_entrada_duplicados 
WHERE tipo_accion = 'ENTRADA_ELIMINADA_DUPLICADO';
