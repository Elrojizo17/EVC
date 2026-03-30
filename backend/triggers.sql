-- triggers.sql
-- Compatibilidad con backend/init.sql
-- Objetivo:
-- 1) Eliminar funciones/triggers legacy incompatibles
-- 2) Crear triggers utiles del modelo actual
--    - trigger_registrar_detalle_novedad (trazabilidad)
--    - trg_no_update_delete_movimiento (proteccion)

BEGIN;

-- ==========================================
-- LIMPIEZA DE OBJETOS LEGACY INCOMPATIBLES
-- ==========================================

-- Trigger legacy de post-insert sobre movimiento_bodega
DROP TRIGGER IF EXISTS trg_movimiento_bodega_ai ON public.movimiento_bodega;

-- Funciones legacy conocidas (firmas especificas)
DROP FUNCTION IF EXISTS public.movimiento_bodega_ai() CASCADE;
DROP FUNCTION IF EXISTS public.lote_adjust_stock(bigint, integer) CASCADE;
DROP FUNCTION IF EXISTS public.electricista_adjust_stock(bigint, bigint, integer) CASCADE;

-- Firmas alternativas por si existen variantes antiguas
DROP FUNCTION IF EXISTS public.lote_adjust_stock(integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.electricista_adjust_stock(integer, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.electricista_adjust_stock(character varying, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.electricista_adjust_stock(text, integer, integer) CASCADE;

-- ==========================================
-- SOPORTE DE TRAZABILIDAD EN DETALLE_NOVEDAD
-- ==========================================

CREATE TABLE IF NOT EXISTS public.detalle_novedad (
    id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_novedad BIGINT NOT NULL,
    tipo_operacion VARCHAR(20) NOT NULL CHECK (
        tipo_operacion IN ('DESPACHO', 'DEVOLUCION', 'PRESTAMO')
    ),
    id_movimiento INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    numero_lampara VARCHAR(64),
    observacion TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    FOREIGN KEY (id_novedad)
        REFERENCES public.novedad_luminaria(id_novedad)
        ON DELETE CASCADE,

    FOREIGN KEY (id_movimiento)
        REFERENCES public.movimiento_bodega(id_movimiento)
        ON DELETE CASCADE,

    UNIQUE (id_novedad, id_movimiento)
);

CREATE INDEX IF NOT EXISTS idx_detalle_novedad_novedad ON public.detalle_novedad(id_novedad);
CREATE INDEX IF NOT EXISTS idx_detalle_novedad_movimiento ON public.detalle_novedad(id_movimiento);
CREATE INDEX IF NOT EXISTS idx_detalle_novedad_tipo ON public.detalle_novedad(tipo_operacion);

CREATE OR REPLACE FUNCTION public.registrar_detalle_novedad()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_novedad_luminaria IS NOT NULL THEN
        INSERT INTO public.detalle_novedad (
            id_novedad,
            tipo_operacion,
            id_movimiento,
            cantidad,
            numero_lampara
        )
        SELECT
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
        FROM public.novedad_luminaria nl
        WHERE nl.id_novedad = NEW.id_novedad_luminaria
        ON CONFLICT (id_novedad, id_movimiento) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_registrar_detalle_novedad ON public.movimiento_bodega;

CREATE TRIGGER trigger_registrar_detalle_novedad
AFTER INSERT ON public.movimiento_bodega
FOR EACH ROW
EXECUTE FUNCTION public.registrar_detalle_novedad();

-- ==========================================
-- TRIGGER DE PROTECCION DE MOVIMIENTOS
-- ==========================================

CREATE OR REPLACE FUNCTION public.bloquear_modificacion_movimiento()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
    'No se permite modificar ni eliminar movimientos de bodega';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_update_delete_movimiento ON public.movimiento_bodega;

CREATE TRIGGER trg_no_update_delete_movimiento
BEFORE UPDATE OR DELETE ON public.movimiento_bodega
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_modificacion_movimiento();

COMMIT;
