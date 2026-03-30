-- Asignar Orden: 000 a la cantidad inicial de todos los productos (inventario inicial 2026)
-- Esta es la orden que contiene el inventario base con el que comienza el año 2026

-- Crear movimiento ENTRADA para cada producto con numero_orden = 'ORDEN: 000'
INSERT INTO movimiento_bodega (codigo_producto, tipo_movimiento, cantidad, numero_orden, observacion, fecha)
SELECT 
    p.codigo,
    'ENTRADA',
    p.cantidad_inicial,
    'ORDEN: 000',
    'Inventario inicial año 2026',
    COALESCE(p.fecha_compra, CURRENT_DATE)
FROM producto p
WHERE p.activo = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM movimiento_bodega mb 
      WHERE mb.codigo_producto = p.codigo 
        AND mb.numero_orden = 'ORDEN: 000'
        AND mb.tipo_movimiento = 'ENTRADA'
  );
