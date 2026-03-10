-- Agrega trazabilidad de electricista y PQR a movimientos de bodega
ALTER TABLE IF EXISTS movimiento_bodega
    ADD COLUMN IF NOT EXISTS id_electricista VARCHAR(50) REFERENCES electricista(documento),
    ADD COLUMN IF NOT EXISTS codigo_pqr TEXT;
