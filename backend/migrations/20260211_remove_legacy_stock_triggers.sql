-- Elimina funciones/trigger antiguos que ajustan stock usando la columna inexistente cantidad_disponible
-- Esto evita el error 42703 al insertar en movimiento_bodega.

DROP FUNCTION IF EXISTS movimiento_bodega_ai() CASCADE;
DROP FUNCTION IF EXISTS lote_adjust_stock(bigint, integer) CASCADE;
