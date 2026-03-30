-- Temporalmente deshabilitar el trigger de protección para limpiar observaciones
ALTER TABLE movimiento_bodega DISABLE TRIGGER trg_no_update_delete_movimiento;

-- Limpiar observaciones de movimientos ENTRADA para remover información de números de orden y fechas
UPDATE movimiento_bodega
SET observacion = 'Ingreso inicial'
WHERE tipo_movimiento = 'ENTRADA'
  AND (
    observacion LIKE '%Ingreso inicial por creación%'
    OR observacion LIKE '%Ingreso inventario%'
    OR observacion LIKE '%Backfill ENTRADA%'
  );

-- Reabilitar el trigger de protección
ALTER TABLE movimiento_bodega ENABLE TRIGGER trg_no_update_delete_movimiento;
