-- Temporalmente deshabilitar el trigger de protección para limpiar observaciones (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'trg_no_update_delete_movimiento' AND c.relname = 'movimiento_bodega'
  ) THEN
    EXECUTE 'ALTER TABLE movimiento_bodega DISABLE TRIGGER trg_no_update_delete_movimiento';
  END IF;
END$$;

-- Limpiar observaciones de movimientos ENTRADA para remover información de números de orden y fechas
UPDATE movimiento_bodega
SET observacion = 'Ingreso inicial'
WHERE tipo_movimiento = 'ENTRADA'
  AND (
    observacion LIKE '%Ingreso inicial por creación%'
    OR observacion LIKE '%Ingreso inventario%'
    OR observacion LIKE '%Backfill ENTRADA%'
  );

-- Reabilitar el trigger de protección (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'trg_no_update_delete_movimiento' AND c.relname = 'movimiento_bodega'
  ) THEN
    EXECUTE 'ALTER TABLE movimiento_bodega ENABLE TRIGGER trg_no_update_delete_movimiento';
  END IF;
END$$;
