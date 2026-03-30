-- Backfill: crea movimientos ENTRADA faltantes para lotes con cantidad inicial.
-- Idempotente: solo inserta cuando el lote no tiene ninguna ENTRADA registrada.

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
            'Backfill ENTRADA inicial por lote (' || lp.numero_orden || ')'
        ELSE
            'Backfill ENTRADA inicial por lote'
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
  );
