-- Agregar columna numero_orden a movimiento_bodega para diferencias entradas iniciales de entradas con orden
ALTER TABLE movimiento_bodega 
ADD COLUMN numero_orden VARCHAR(80);

CREATE INDEX idx_movimiento_bodega_numero_orden ON movimiento_bodega(numero_orden);
