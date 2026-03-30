-- Migración: Corregir cálculo de entrada de materiales
-- Fecha: 2026-03-30
-- Descripción: Asegurar que todos los movimientos de ENTRADA se contabilicen correctamente

-- 1. Verificar que TODOS los lotes con cantidad > 0 tengan un movimiento de ENTRADA
-- (Esta es una verificación idempotente del backfill anterior)
INSERT INTO movimiento_bodega (
    id_lote,
    tipo_movimiento,
    cantidad,
    observacion,
    fecha,
    created_at
)
SELECT
    lp.id_lote,
    'ENTRADA',
    lp.cantidad,
    CASE
        WHEN COALESCE(TRIM(lp.numero_orden), '') <> '' THEN
            'ENTRADA inicial: lote ' || lp.id_lote || ' (Orden: ' || lp.numero_orden || ')'
        ELSE
            'ENTRADA inicial: lote ' || lp.id_lote
    END,
    COALESCE(lp.fecha_compra::timestamp, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM lote_producto lp
WHERE lp.cantidad > 0
  AND NOT EXISTS (
      SELECT 1
      FROM movimiento_bodega mb
      WHERE mb.id_lote = lp.id_lote
        AND mb.tipo_movimiento = 'ENTRADA'
  )
ON CONFLICT DO NOTHING;

-- 2. Auditoría: Log de entradas registradas
CREATE TABLE IF NOT EXISTS log_entrada_audit (
    id SERIAL PRIMARY KEY,
    fecha_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lotes_sin_entrada INT,
    lotes_corregidos INT,
    total_cantidad_corregida BIGINT
);

-- 3. Registrar la auditoría de esta ejecución
INSERT INTO log_entrada_audit (lotes_sin_entrada, lotes_corregidos, total_cantidad_corregida)
SELECT
    COUNT(DISTINCT lp.id_lote) as lotes_sin_entrada,
    COUNT(DISTINCT lp.id_lote) as lotes_corregidos,
    SUM(lp.cantidad) as total_cantidad_corregida
FROM lote_producto lp
WHERE lp.cantidad > 0
  AND NOT EXISTS (
      SELECT 1
      FROM movimiento_bodega mb
      WHERE mb.id_lote = lp.id_lote
        AND mb.tipo_movimiento = 'ENTRADA'
  );
