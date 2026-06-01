const express = require("express");
const router = express.Router();
const pool = require("../db");

const normalizarFechaInput = (value) => {
    const texto = String(value || "").trim();
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return null;
    }

    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    const fechaUtc = new Date(Date.UTC(year, month - 1, day));

    const esValida =
        !Number.isNaN(fechaUtc.getTime())
        && fechaUtc.getUTCFullYear() === year
        && fechaUtc.getUTCMonth() === month - 1
        && fechaUtc.getUTCDate() === day;

    if (!esValida) {
        return null;
    }

    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

// GET todas las novedades
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                n.id_novedad,
                n.numero_lampara,
                n.tipo_novedad,
                n.tecnologia_anterior,
                n.tecnologia_nueva,
                n.accion,
                n.fecha_novedad,
                n.fecha_registro,
                COALESCE(NULLIF(BTRIM(n.observacion), ''), mv.observacion_reciente) AS observacion,
                COALESCE(NULLIF(BTRIM(n.codigo_pqr), ''), mv.codigo_pqr_reciente) AS codigo_pqr,
                COALESCE(NULLIF(BTRIM(n.id_electricista), ''), mv.id_electricista_reciente) AS id_electricista,
                COALESCE(e_nov.nombre, mv.nombre_electricista_reciente) AS nombre_electricista,
                mv.codigo_pqr_reciente,
                mv.id_electricista_reciente,
                mv.nombre_electricista_reciente,
                n.created_at,
                n.updated_at
            FROM novedad_luminaria n
            LEFT JOIN electricista e_nov ON e_nov.documento = n.id_electricista
            LEFT JOIN LATERAL (
                SELECT
                    NULLIF(BTRIM(mb.observacion), '') AS observacion_reciente,
                    NULLIF(BTRIM(mb.codigo_pqr), '') AS codigo_pqr_reciente,
                    mb.id_electricista AS id_electricista_reciente,
                    e.nombre AS nombre_electricista_reciente
                FROM movimiento_bodega mb
                LEFT JOIN electricista e ON e.documento = mb.id_electricista
                WHERE mb.id_novedad_luminaria = n.id_novedad
                ORDER BY mb.fecha DESC, mb.id_movimiento DESC
                LIMIT 1
            ) mv ON true
            ORDER BY fecha_novedad DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("Error consultando novedades:", error);
        res.status(500).json({ error: "Error consultando novedades" });
    }
});

// POST crear novedad
router.post("/", async (req, res) => {
    const {
        numero_lampara,
        tipo_novedad,
        tecnologia_anterior,
        tecnologia_nueva,
        potencia_nueva_w,
        id_elemento_reemplazo,
        accion,
        fecha_novedad,
        observacion,
        codigo_pqr,
        id_electricista
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const numeroLamparaTexto = String(numero_lampara || "").trim();
        if (!numeroLamparaTexto) {
            throw new Error("El número de lámpara es obligatorio");
        }

        // Validar existencia de la lámpara antes del INSERT evita consumir IDs en fallos de FK.
        const lamparaExistenteResult = await client.query(
            `SELECT numero_lampara
             FROM luminaria
             WHERE CAST(numero_lampara AS TEXT) = CAST($1 AS TEXT)
                OR numero_lampara = $1
             LIMIT 1`,
            [numeroLamparaTexto]
        );

        if (lamparaExistenteResult.rows.length === 0) {
            throw new Error(`La lámpara ${numeroLamparaTexto} no existe en el censo`);
        }

        const numeroLamparaDb = lamparaExistenteResult.rows[0].numero_lampara;
        const codigoPqrNormalizado = codigo_pqr ? String(codigo_pqr).trim() : null;
        const electricistaDocumento = id_electricista ? String(id_electricista).trim() : null;
        const fechaNovedadNormalizada = (() => {
            if (fecha_novedad === undefined || fecha_novedad === null || String(fecha_novedad).trim() === "") {
                return new Date().toISOString().slice(0, 10);
            }

            const normalizada = normalizarFechaInput(fecha_novedad);
            if (!normalizada) {
                throw new Error("La fecha de novedad no es válida. Usa el formato YYYY-MM-DD con una fecha real del calendario.");
            }
            return normalizada;
        })();

        if (electricistaDocumento) {
            const electricistaCheck = await client.query(
                `SELECT documento FROM electricista WHERE documento = $1`,
                [electricistaDocumento]
            );

            if (electricistaCheck.rows.length === 0) {
                throw new Error("Electricista no encontrado para la novedad");
            }
        }

        const normalizarTecnologia = (valor) => {
            if (valor === null || valor === undefined) return null;
            const texto = String(valor).trim();
            return texto === "" ? null : texto.toLowerCase();
        };

        let cambiosRealizados = {
            novedadCreada: true,
            mantenimientoAplicado: false,
            cambioTecnologiaAplicado: false,
            lampara: numeroLamparaDb
        };

        if (String(tipo_novedad).toUpperCase() === "MANTENIMIENTO") {
            console.log(`🔧 Aplicando mantenimiento a lámpara ${numeroLamparaDb}`);
            const mantenimientoResult = await client.query(
                "UPDATE luminaria SET estado = $1 WHERE CAST(numero_lampara AS TEXT) = CAST($2 AS TEXT) OR numero_lampara = $3 RETURNING numero_lampara, estado",
                ["INACTIVA", numeroLamparaDb, numeroLamparaDb]
            );
            if (mantenimientoResult.rows.length > 0) {
                console.log(`✅ Mantenimiento aplicado a lámpara ${numeroLamparaDb}`);
                cambiosRealizados.mantenimientoAplicado = true;
            }
        }

        if (String(tipo_novedad).toUpperCase() === "CAMBIO_TECNOLOGIA") {
            const tecNormalizada = normalizarTecnologia(tecnologia_nueva);
            if (tecNormalizada) {
                // Primero, verificar si la lámpara existe
                const verificarResult = await client.query(
                    "SELECT * FROM luminaria WHERE CAST(numero_lampara AS TEXT) = CAST($1 AS TEXT) OR numero_lampara = $2",
                    [numeroLamparaDb, numeroLamparaDb]
                );
                
                if (verificarResult.rows.length === 0) {
                    console.warn(`⚠️ Lámpara ${numeroLamparaDb} no encontrada en base de datos`);
                    cambiosRealizados.cambioTecnologiaAplicado = false;
                } else {
                    // Obtener potencia del elemento de inventario (lote) si se proporcionó
                    let potencia_nueva = null;

                    const potenciaManual = Number(potencia_nueva_w);
                    if (Number.isFinite(potenciaManual) && potenciaManual > 0) {
                        potencia_nueva = Math.floor(potenciaManual);
                    }

                    if (id_elemento_reemplazo) {
                        const elementoResult = await client.query(
                            `SELECT 
                                p.nombre as elemento,
                                p.codigo as codigo_elemento
                             FROM lote_producto lp
                             JOIN producto p ON lp.codigo_producto = p.codigo
                             WHERE lp.id_lote = $1`,
                            [id_elemento_reemplazo]
                        );
                        
                        if (elementoResult.rows.length > 0 && !potencia_nueva) {
                            const elemento = elementoResult.rows[0];
                            // Intentar extraer la potencia del nombre o código del elemento
                            // Ej: "Lámpara LED 150W" o "LAMP-150"
                            const nombreCompleto = `${elemento.elemento} ${elemento.codigo_elemento}`.toLowerCase();
                            const matchPotencia = nombreCompleto.match(/(\d+)\s*w/i) || nombreCompleto.match(/[-_](\d+)/);
                            
                            if (matchPotencia && matchPotencia[1]) {
                                potencia_nueva = parseInt(matchPotencia[1]);
                                console.log(`📦 Potencia extraída del elemento: ${potencia_nueva}W`);
                            }
                        }
                    }
                    
                    console.log(`📝 Actualizando lámpara ${numeroLamparaDb} con tecnología: ${tecNormalizada}${potencia_nueva ? ` y potencia: ${potencia_nueva}W` : ''}`);
                    
                    // La lámpara existe, ahora actualizarla con tecnología y opcionalmente potencia
                    let updateQuery, updateParams;
                    
                    if (potencia_nueva && potencia_nueva > 0) {
                        // Actualizar tecnología y potencia
                        updateQuery = "UPDATE luminaria SET tecnologia = $1, potencia_w = $2 WHERE CAST(numero_lampara AS TEXT) = CAST($3 AS TEXT) OR numero_lampara = $4 RETURNING *";
                        updateParams = [tecNormalizada, potencia_nueva, numeroLamparaDb, numeroLamparaDb];
                    } else {
                        // Solo actualizar tecnología
                        updateQuery = "UPDATE luminaria SET tecnologia = $1 WHERE CAST(numero_lampara AS TEXT) = CAST($2 AS TEXT) OR numero_lampara = $3 RETURNING *";
                        updateParams = [tecNormalizada, numeroLamparaDb, numeroLamparaDb];
                    }
                    
                    const updateResult = await client.query(updateQuery, updateParams);
                    
                    if (updateResult.rows.length > 0) {
                        console.log(`✅ Lámpara actualizada exitosamente: Número=${updateResult.rows[0].numero_lampara}, Tecnología=${updateResult.rows[0].tecnologia}, Potencia=${updateResult.rows[0].potencia_w}W`);
                        cambiosRealizados.cambioTecnologiaAplicado = true;
                    } else {
                        console.warn(`⚠️ No se pudo actualizar la lámpara ${numeroLamparaDb}`);
                        cambiosRealizados.cambioTecnologiaAplicado = false;
                    }
                }
            }
        }

        const query = `
            INSERT INTO novedad_luminaria (
                numero_lampara,
                tipo_novedad,
                tecnologia_anterior,
                tecnologia_nueva,
                accion,
                fecha_novedad,
                observacion,
                codigo_pqr,
                id_electricista
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const values = [
            numeroLamparaDb,
            tipo_novedad,
            normalizarTecnologia(tecnologia_anterior),
            normalizarTecnologia(tecnologia_nueva),
            accion,
            fechaNovedadNormalizada,
            observacion,
            codigoPqrNormalizado,
            electricistaDocumento
        ];

        const result = await client.query(query, values);

        await client.query("COMMIT");
        
        // Enviar respuesta con información de cambios realizados
        const respuesta = {
            ...result.rows[0],
            _actualizaciones: cambiosRealizados
        };
        
        res.status(201).json(respuesta);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creando novedad:", error);
        res.status(500).json({ error: error.message || "Error creando novedad" });
    } finally {
        client.release();
    }
});

// PUT editar novedad
router.put("/:id", async (req, res) => {
    const idNovedad = Number(req.params.id);

    if (!Number.isInteger(idNovedad) || idNovedad <= 0) {
        return res.status(400).json({ error: "ID de novedad inválido" });
    }

    const {
        numero_lampara,
        tipo_novedad,
        tecnologia_anterior,
        tecnologia_nueva,
        fecha_novedad,
        observacion,
        codigo_pqr,
        id_electricista
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const actualResult = await client.query(
            "SELECT * FROM novedad_luminaria WHERE id_novedad = $1",
            [idNovedad]
        );

        if (actualResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Novedad no encontrada" });
        }

        const actual = actualResult.rows[0];

        const normalizarTecnologia = (valor) => {
            if (valor === null || valor === undefined) return null;
            const texto = String(valor).trim();
            return texto === "" ? null : texto.toLowerCase();
        };

        const tipoFinal = tipo_novedad || actual.tipo_novedad;
        const fechaNovedadFinal = (() => {
            if (fecha_novedad === undefined) {
                return actual.fecha_novedad;
            }

            const normalizada = normalizarFechaInput(fecha_novedad);
            if (!normalizada) {
                throw new Error("La fecha de novedad no es válida. Usa el formato YYYY-MM-DD con una fecha real del calendario.");
            }
            return normalizada;
        })();
        const tecnologiaAnteriorFinal = String(tipoFinal).toUpperCase() === "CAMBIO_TECNOLOGIA"
            ? normalizarTecnologia(tecnologia_anterior !== undefined ? tecnologia_anterior : actual.tecnologia_anterior)
            : null;
        const tecnologiaNuevaFinal = String(tipoFinal).toUpperCase() === "CAMBIO_TECNOLOGIA"
            ? normalizarTecnologia(tecnologia_nueva !== undefined ? tecnologia_nueva : actual.tecnologia_nueva)
            : null;
        const codigoPqrFinal = codigo_pqr !== undefined
            ? (String(codigo_pqr || "").trim() || null)
            : actual.codigo_pqr;
        const idElectricistaFinal = id_electricista !== undefined
            ? (String(id_electricista || "").trim() || null)
            : actual.id_electricista;

        if (idElectricistaFinal) {
            const electricistaCheck = await client.query(
                `SELECT documento FROM electricista WHERE documento = $1`,
                [idElectricistaFinal]
            );

            if (electricistaCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Electricista no encontrado para la novedad" });
            }
        }

        const updateResult = await client.query(
            `UPDATE novedad_luminaria
             SET numero_lampara = $1,
                 tipo_novedad = $2,
                 tecnologia_anterior = $3,
                 tecnologia_nueva = $4,
                 fecha_novedad = $5,
                 observacion = $6,
                 codigo_pqr = $7,
                 id_electricista = $8
             WHERE id_novedad = $9
             RETURNING *`,
            [
                numero_lampara !== undefined ? numero_lampara : actual.numero_lampara,
                tipoFinal,
                tecnologiaAnteriorFinal,
                tecnologiaNuevaFinal,
                fechaNovedadFinal,
                observacion !== undefined ? (observacion || null) : actual.observacion,
                codigoPqrFinal,
                idElectricistaFinal,
                idNovedad
            ]
        );

        await client.query("COMMIT");
        res.json(updateResult.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error actualizando novedad:", error);
        res.status(500).json({ error: "Error actualizando novedad" });
    } finally {
        client.release();
    }
});

// Endpoint de diagnóstico - verifica si una lámpara existe y su estado actual
router.get("/diagnostico/:numero_lampara", async (req, res) => {
    const { numero_lampara } = req.params;
    try {
        const result = await pool.query(
            "SELECT numero_lampara, tecnologia, potencia_w, estado FROM luminaria WHERE CAST(numero_lampara AS TEXT) = CAST($1 AS TEXT) OR numero_lampara = $1",
            [numero_lampara]
        );

        if (result.rows.length === 0) {
            return res.json({ 
                encontrada: false, 
                numero_buscado: numero_lampara,
                mensaje: `Lámpara ${numero_lampara} no encontrada`
            });
        }

        res.json({
            encontrada: true,
            numero_buscado: numero_lampara,
            lampara: result.rows[0],
            totalEncontradas: result.rows.length
        });
    } catch (error) {
        console.error("Error en diagnóstico:", error);
        res.status(500).json({ error: "Error en diagnóstico" });
    }
});

module.exports = router;
