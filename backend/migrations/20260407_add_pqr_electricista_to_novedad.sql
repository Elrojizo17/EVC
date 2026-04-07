-- Agrega contexto de trazabilidad directo en novedad_luminaria
-- para mostrar PQR y electricista incluso sin movimientos asociados.

ALTER TABLE IF EXISTS novedad_luminaria
    ADD COLUMN IF NOT EXISTS codigo_pqr TEXT,
    ADD COLUMN IF NOT EXISTS id_electricista VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_novedad_luminaria_id_electricista
    ON novedad_luminaria(id_electricista);

-- Backfill inicial tomando el movimiento más reciente de cada novedad.
WITH ultimo_movimiento AS (
    SELECT DISTINCT ON (mb.id_novedad_luminaria)
        mb.id_novedad_luminaria AS id_novedad,
        NULLIF(BTRIM(mb.codigo_pqr), '') AS codigo_pqr,
        NULLIF(BTRIM(mb.id_electricista), '') AS id_electricista
    FROM movimiento_bodega mb
    WHERE mb.id_novedad_luminaria IS NOT NULL
    ORDER BY mb.id_novedad_luminaria, mb.fecha DESC, mb.id_movimiento DESC
)
UPDATE novedad_luminaria n
SET
    codigo_pqr = COALESCE(NULLIF(BTRIM(n.codigo_pqr), ''), um.codigo_pqr),
    id_electricista = COALESCE(NULLIF(BTRIM(n.id_electricista), ''), um.id_electricista)
FROM ultimo_movimiento um
WHERE n.id_novedad = um.id_novedad;
