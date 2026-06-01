-- Migración: Agregar columna id_lote a movimiento_bodega y FK a lote_producto
-- Fecha: 2026-03-02

ALTER TABLE movimiento_bodega
    ADD COLUMN IF NOT EXISTS id_lote BIGINT;

-- Si la tabla lote_producto existe, agregar FK de forma segura (verificando existencia)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lote_producto') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            WHERE t.relname = 'movimiento_bodega' AND c.conname = 'fk_movimiento_lote'
        ) THEN
            EXECUTE 'ALTER TABLE movimiento_bodega ADD CONSTRAINT fk_movimiento_lote FOREIGN KEY (id_lote) REFERENCES lote_producto(id_lote) ON DELETE SET NULL';
        END IF;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_movimiento_bodega_id_lote ON movimiento_bodega(id_lote);
