-- Reinicia el esquema para pruebas eliminando tablas heredadas
DROP TABLE IF EXISTS inventario_electricista CASCADE;
DROP TABLE IF EXISTS movimiento_bodega CASCADE;
DROP TABLE IF EXISTS lote_producto CASCADE;
DROP TABLE IF EXISTS producto CASCADE;
DROP TABLE IF EXISTS novedad CASCADE;
DROP TABLE IF EXISTS ingreso_inventario CASCADE;
DROP TABLE IF EXISTS gasto_inventario CASCADE;
DROP TABLE IF EXISTS inventario_bodega CASCADE;
DROP TABLE IF EXISTS novedad_luminaria CASCADE;
DROP TABLE IF EXISTS electricista CASCADE;
DROP TABLE IF EXISTS luminaria CASCADE;

-- Tabla de luminarias registradas en campo
CREATE TABLE luminaria (
    numero_lampara TEXT PRIMARY KEY,
    sector TEXT,
    numero_transformador TEXT,
    tecnologia TEXT NOT NULL,
    potencia_w INTEGER NOT NULL CHECK (potencia_w > 0),
    coord_x NUMERIC(10,6) NOT NULL,
    coord_y NUMERIC(10,6) NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('ACTIVA', 'INACTIVA', 'DAÑADA')),
    direccion TEXT,
    barrio TEXT,
    reactancia INTEGER,
    potencia_total INTEGER,
    consumo_mes NUMERIC(10,2),
    tipo_liquido TEXT,
    observaciones TEXT
);

-- Registro de electricistas autorizados
CREATE TABLE electricista (
    id_electricista SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    documento TEXT NOT NULL UNIQUE,
    telefono TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Catálogo de novedades registradas en luminarias
CREATE TABLE novedad_luminaria (
    id_novedad SERIAL PRIMARY KEY,
    numero_lampara TEXT,
    tipo_novedad TEXT CHECK (tipo_novedad IN ('MANTENIMIENTO', 'CAMBIO_TECNOLOGIA', 'REPARACION')),
    tecnologia_anterior TEXT,
    tecnologia_nueva TEXT,
    accion TEXT,
    fecha_novedad TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT,
    CONSTRAINT fk_novedad_luminaria
        FOREIGN KEY (numero_lampara)
        REFERENCES luminaria(numero_lampara)
        ON DELETE RESTRICT
);

-- Productos disponibles en bodega
CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lotes de productos comprados
CREATE TABLE lote_producto (
    id_lote SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    anio_compra INTEGER NOT NULL CHECK (anio_compra >= 2000),
    precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    fecha_compra DATE NOT NULL
);

CREATE INDEX idx_lote_producto_id_producto ON lote_producto(id_producto);

-- Movimientos en bodega (entradas, salidas y devoluciones)
CREATE TABLE movimiento_bodega (
    id_movimiento SERIAL PRIMARY KEY,
    id_lote INTEGER NOT NULL REFERENCES lote_producto(id_lote) ON DELETE RESTRICT,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('ENTRADA', 'DESPACHADO', 'DEVOLUCION', 'MATERIAL_EXCEDENTE', 'PRESTADO')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT,
    id_novedad_luminaria INTEGER REFERENCES novedad_luminaria(id_novedad) ON DELETE SET NULL,
    id_electricista INTEGER REFERENCES electricista(id_electricista) ON DELETE SET NULL,
    codigo_pqr TEXT
);

CREATE INDEX idx_movimiento_bodega_lote ON movimiento_bodega(id_lote);
CREATE INDEX idx_movimiento_bodega_tipo ON movimiento_bodega(tipo_movimiento);

-- Inventario asignado a electricistas para seguimiento en campo
CREATE TABLE inventario_electricista (
    id_registro SERIAL PRIMARY KEY,
    id_electricista INTEGER NOT NULL REFERENCES electricista(id_electricista) ON DELETE CASCADE,
    id_lote INTEGER NOT NULL REFERENCES lote_producto(id_lote) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_electricista, id_lote)
);

CREATE INDEX idx_inventario_electricista_lote ON inventario_electricista(id_lote);
