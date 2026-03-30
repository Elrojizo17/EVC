-- Migración: Mejorar el seguimiento de devoluciones y vincular novedades
-- Fecha: 2026-03-17
-- Descripción: Agrega validaciones de integridad en devoluciones y detalle_novedad

-- 1. Agregar campo de estado a movimiento_bodega si no existe
ALTER TABLE movimiento_bodega
ADD COLUMN IF NOT EXISTS estado_devolucion VARCHAR(20) DEFAULT NULL
CHECK (estado_devolucion IS NULL OR estado_devolucion IN ('PENDIENTE', 'RECIBIDA', 'VALIDADA', 'RECHAZADA'));

-- 2. Agregar campo para rastrear si una devolución fue completamente procesada
ALTER TABLE movimiento_bodega
ADD COLUMN IF NOT EXISTS devolucion_procesada BOOLEAN DEFAULT FALSE;

-- 3. Crear tabla auxiliar de detalle_novedad para un registro más granular (OPCIONAL)
-- Esta tabla ayuda a rastrear todos los movimientos asociados a una novedad
CREATE TABLE IF NOT EXISTS detalle_novedad (
    id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_novedad BIGINT NOT NULL,
    tipo_operacion VARCHAR(20) NOT NULL CHECK (tipo_operacion IN ('DESPACHO', 'DEVOLUCION', 'PRESTAMO')),
    id_movimiento INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    numero_lampara VARCHAR(64),
    observacion TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    FOREIGN KEY (id_novedad) REFERENCES novedad_luminaria(id_novedad) ON DELETE CASCADE,
    FOREIGN KEY (id_movimiento) REFERENCES movimiento_bodega(id_movimiento) ON DELETE CASCADE,

    UNIQUE(id_novedad, id_movimiento)
);

CREATE INDEX IF NOT EXISTS idx_detalle_novedad_novedad ON detalle_novedad(id_novedad);
CREATE INDEX IF NOT EXISTS idx_detalle_novedad_movimiento ON detalle_novedad(id_movimiento);
CREATE INDEX IF NOT EXISTS idx_detalle_novedad_tipo ON detalle_novedad(tipo_operacion);

-- 4. Trigger para registrar automáticamente en detalle_novedad cuando se inserta un movimiento con novedad
CREATE OR REPLACE FUNCTION registrar_detalle_novedad()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_novedad_luminaria IS NOT NULL THEN
        INSERT INTO detalle_novedad (
            id_novedad,
            tipo_operacion,
            id_movimiento,
            cantidad,
            numero_lampara
        ) SELECT
            NEW.id_novedad_luminaria,
            CASE 
                WHEN NEW.tipo_movimiento = 'DESPACHADO' THEN 'DESPACHO'
                WHEN NEW.tipo_movimiento = 'DEVOLUCION' THEN 'DEVOLUCION'
                WHEN NEW.tipo_movimiento = 'PRESTADO' THEN 'PRESTAMO'
                ELSE NEW.tipo_movimiento
            END,
            NEW.id_movimiento,
            NEW.cantidad,
            nl.numero_lampara
        FROM novedad_luminaria nl
        WHERE nl.id_novedad = NEW.id_novedad_luminaria
        ON CONFLICT (id_novedad, id_movimiento) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_registrar_detalle_novedad ON movimiento_bodega;
CREATE TRIGGER trigger_registrar_detalle_novedad
AFTER INSERT ON movimiento_bodega
FOR EACH ROW
EXECUTE FUNCTION registrar_detalle_novedad();

-- 5. Comentarios de documentación
COMMENT ON TABLE detalle_novedad IS 'Registro detallado de todos los movimientos asociados a una novedad de luminaria para trazabilidad completa';
COMMENT ON COLUMN detalle_novedad.tipo_operacion IS 'Tipo de operación: DESPACHO, DEVOLUCION, PRESTAMO';
COMMENT ON COLUMN detalle_novedad.numero_lampara IS 'Número de lámpara de la novedad, copiado para referencia rápida';

-- 6. Vista para verificar integridad de devoluciones
CREATE OR REPLACE VIEW vw_integridad_devoluciones AS
SELECT 
    mb.id_movimiento,
    mb.tipo_movimiento,
    mb.id_lote,
    mb.id_novedad_luminaria,
    mb.cantidad AS cantidad_movimiento,
    mb.fecha,
    mb.codigo_pqr,
    nl.numero_lampara,
    nl.tipo_novedad,
    p.nombre AS elemento,
    e.nombre AS electricista,
    -- Para devoluciones: verificar que existe despacho previo
    CASE 
        WHEN mb.tipo_movimiento = 'DEVOLUCION' AND mb.id_novedad_luminaria IS NOT NULL THEN (
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM movimiento_bodega mb_orig
                    WHERE mb_orig.id_lote = mb.id_lote
                      AND mb_orig.id_novedad_luminaria = mb.id_novedad_luminaria
                      AND mb_orig.tipo_movimiento = 'DESPACHADO'
                      AND mb_orig.fecha < mb.fecha
                ) THEN 'VALIDO'
                ELSE 'SIN_DESPACHO_PREVIO'
            END
        )
        ELSE 'N/A'
    END AS estado_integridad,
    dn.id_detalle AS detalle_novedad_id,
    (SELECT COUNT(*) FROM detalle_novedad WHERE id_novedad = mb.id_novedad_luminaria) AS movimientos_asociados
FROM movimiento_bodega mb
LEFT JOIN novedad_luminaria nl ON nl.id_novedad = mb.id_novedad_luminaria
LEFT JOIN lote_producto lp ON lp.id_lote = mb.id_lote
LEFT JOIN producto p ON p.codigo = lp.codigo_producto
LEFT JOIN electricista e ON e.documento = mb.id_electricista
LEFT JOIN detalle_novedad dn ON dn.id_movimiento = mb.id_movimiento
ORDER BY mb.fecha DESC;

COMMENT ON VIEW vw_integridad_devoluciones IS 'Vista para auditar integridad de devoluciones y su vinculación con novedades';
