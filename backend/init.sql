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
    numero_lampara        VARCHAR(64) PRIMARY KEY,
    tecnologia            VARCHAR(32),
    potencia_w            NUMERIC(10,2) CHECK (potencia_w >= 0),
    coord_x               NUMERIC(11,8),
    coord_y               NUMERIC(11,8),
    estado                VARCHAR(32),
    reactancia            NUMERIC(10,2) DEFAULT 0 CHECK (reactancia >= 0),
    potencia_total        NUMERIC(10,2) CHECK (potencia_total >= 0),
    consumo_mes           NUMERIC(12,3) CHECK (consumo_mes >= 0),
    tipo_liquido          VARCHAR(32),
    observaciones         TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ
);

-- Registro de electricistas autorizados
CREATE TABLE electricista (
    documento             VARCHAR(50) PRIMARY KEY,
    nombre                VARCHAR(150) NOT NULL,
    telefono              VARCHAR(20),
    activo                BOOLEAN DEFAULT TRUE,
    fecha_registro        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ
);

-- Catálogo de novedades registradas en luminarias
CREATE TABLE novedad_luminaria (
    id_novedad            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_lampara        VARCHAR(64) NOT NULL,
    tipo_novedad          TEXT NOT NULL CHECK (
        tipo_novedad IN ('MANTENIMIENTO', 'CAMBIO_TECNOLOGIA', 'REPARACION')
    ),
    tecnologia_anterior   TEXT CHECK (tecnologia_anterior IS NULL OR lower(tecnologia_anterior) IN ('led','sodio','metal_halide','solar')),
    tecnologia_nueva      TEXT CHECK (tecnologia_nueva IS NULL OR lower(tecnologia_nueva) IN ('led','sodio','metal_halide','solar')),
    accion                TEXT,
    fecha_novedad         TIMESTAMP NOT NULL DEFAULT now(),
    fecha_registro        TIMESTAMP NOT NULL DEFAULT now(),
    observacion           TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ,

    FOREIGN KEY (numero_lampara)
        REFERENCES luminaria(numero_lampara)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Productos disponibles en bodega
CREATE TABLE producto (
    codigo                VARCHAR(50) PRIMARY KEY,
    nombre                VARCHAR(150) NOT NULL,
    activo                BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ
);

-- Lotes de productos comprados
CREATE TABLE lote_producto (
    id_lote               SERIAL PRIMARY KEY,
    codigo_producto       VARCHAR(50) NOT NULL,
    anio_compra           INT NOT NULL,
    precio_unitario       NUMERIC(12,2) NOT NULL,
    cantidad              INT NOT NULL,
    fecha_compra          DATE NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ,

    FOREIGN KEY (codigo_producto)
        REFERENCES producto(codigo)
);

CREATE INDEX idx_lote_producto_codigo_producto ON lote_producto(codigo_producto);

-- Movimientos en bodega (entradas, salidas y devoluciones)
CREATE TABLE movimiento_bodega (
    id_movimiento         SERIAL PRIMARY KEY,
    id_lote               INT NOT NULL,
    tipo_movimiento       VARCHAR(20) NOT NULL CHECK (
        tipo_movimiento IN (
            'ENTRADA',
            'DESPACHADO',
            'DEVOLUCION',
            'MATERIAL_EXCEDENTE',
            'PRESTADO'
        )
    ),
    cantidad              INT NOT NULL CHECK (cantidad > 0),
    id_novedad_luminaria  BIGINT NULL,
    fecha                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observacion           TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ,

    FOREIGN KEY (id_lote) REFERENCES lote_producto(id_lote),
    FOREIGN KEY (id_novedad_luminaria) REFERENCES novedad_luminaria(id_novedad)
);

CREATE INDEX idx_movimiento_bodega_lote ON movimiento_bodega(id_lote);
CREATE INDEX idx_movimiento_bodega_tipo ON movimiento_bodega(tipo_movimiento);

-- Inventario asignado a electricistas para seguimiento en campo
CREATE TABLE inventario_electricista (
    id_registro            SERIAL PRIMARY KEY,
    documento_electricista VARCHAR(50) NOT NULL,
    id_lote                INT NOT NULL,
    cantidad               INT NOT NULL CHECK (cantidad >= 0),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ,

    FOREIGN KEY (documento_electricista)
        REFERENCES electricista(documento),

    FOREIGN KEY (id_lote)
        REFERENCES lote_producto(id_lote),

    UNIQUE (documento_electricista, id_lote)
);

CREATE INDEX idx_inventario_electricista_lote ON inventario_electricista(id_lote);
