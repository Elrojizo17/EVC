-- Migración: Crear tabla lote_producto (compatibilidad legacy)
-- Fecha: 2026-03-01
-- Descripción: Agrega la tabla lote_producto que usan vistas y triggers legacy

CREATE TABLE IF NOT EXISTS lote_producto (
    id_lote BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_producto VARCHAR(50) NOT NULL,
    numero_orden VARCHAR(80),
    anio_compra INT,
    precio_unitario NUMERIC(12,3) DEFAULT 0 CHECK (precio_unitario >= 0),
    cantidad INT DEFAULT 0 CHECK (cantidad >= 0),
    fecha_compra TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    FOREIGN KEY (codigo_producto) REFERENCES producto(codigo) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_lote_producto_codigo ON lote_producto(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_lote_producto_numero_orden ON lote_producto(numero_orden);

-- Nota: esta tabla replica la estructura mínima esperada por el código y las vistas.
