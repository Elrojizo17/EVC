const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET todas las novedades
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM novedad_luminaria 
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
        observacion
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const normalizarTecnologia = (valor) => {
            if (valor === null || valor === undefined) return null;
            const texto = String(valor).trim();
            return texto === "" ? null : texto.toLowerCase();
        };

        const query = `
            INSERT INTO novedad_luminaria (
                numero_lampara,
                tipo_novedad,
                tecnologia_anterior,
                tecnologia_nueva,
                accion,
                fecha_novedad,
                observacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const values = [
            numero_lampara,
            tipo_novedad,
            normalizarTecnologia(tecnologia_anterior),
            normalizarTecnologia(tecnologia_nueva),
            accion,
            fecha_novedad || new Date(),
            observacion
        ];

        const result = await client.query(query, values);
        
        let cambiosRealizados = {
            novedadCreada: true,
            mantenimientoAplicado: false,
            cambioTecnologiaAplicado: false,
            lampara: numero_lampara
        };

        if (String(tipo_novedad).toUpperCase() === "MANTENIMIENTO") {
            console.log(`🔧 Aplicando mantenimiento a lámpara ${numero_lampara}`);
            const mantenimientoResult = await client.query(
                "UPDATE luminaria SET estado = $1 WHERE CAST(numero_lampara AS TEXT) = CAST($2 AS TEXT) OR numero_lampara = $3 RETURNING numero_lampara, estado",
                ["INACTIVA", numero_lampara, numero_lampara]
            );
            if (mantenimientoResult.rows.length > 0) {
                console.log(`✅ Mantenimiento aplicado a lámpara ${numero_lampara}`);
                cambiosRealizados.mantenimientoAplicado = true;
            }
        }

        if (String(tipo_novedad).toUpperCase() === "CAMBIO_TECNOLOGIA") {
            const tecNormalizada = normalizarTecnologia(tecnologia_nueva);
            if (tecNormalizada) {
                // Primero, verificar si la lámpara existe
                const verificarResult = await client.query(
                    "SELECT * FROM luminaria WHERE CAST(numero_lampara AS TEXT) = CAST($1 AS TEXT) OR numero_lampara = $2",
                    [numero_lampara, numero_lampara]
                );
                
                if (verificarResult.rows.length === 0) {
                    console.warn(`⚠️ Lámpara ${numero_lampara} no encontrada en base de datos`);
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
                    
                    console.log(`📝 Actualizando lámpara ${numero_lampara} con tecnología: ${tecNormalizada}${potencia_nueva ? ` y potencia: ${potencia_nueva}W` : ''}`);
                    
                    // La lámpara existe, ahora actualizarla con tecnología y opcionalmente potencia
                    let updateQuery, updateParams;
                    
                    if (potencia_nueva && potencia_nueva > 0) {
                        // Actualizar tecnología y potencia
                        updateQuery = "UPDATE luminaria SET tecnologia = $1, potencia_w = $2 WHERE CAST(numero_lampara AS TEXT) = CAST($3 AS TEXT) OR numero_lampara = $4 RETURNING *";
                        updateParams = [tecNormalizada, potencia_nueva, numero_lampara, numero_lampara];
                    } else {
                        // Solo actualizar tecnología
                        updateQuery = "UPDATE luminaria SET tecnologia = $1 WHERE CAST(numero_lampara AS TEXT) = CAST($2 AS TEXT) OR numero_lampara = $3 RETURNING *";
                        updateParams = [tecNormalizada, numero_lampara, numero_lampara];
                    }
                    
                    const updateResult = await client.query(updateQuery, updateParams);
                    
                    if (updateResult.rows.length > 0) {
                        console.log(`✅ Lámpara actualizada exitosamente: Número=${updateResult.rows[0].numero_lampara}, Tecnología=${updateResult.rows[0].tecnologia}, Potencia=${updateResult.rows[0].potencia_w}W`);
                        cambiosRealizados.cambioTecnologiaAplicado = true;
                    } else {
                        console.warn(`⚠️ No se pudo actualizar la lámpara ${numero_lampara}`);
                        cambiosRealizados.cambioTecnologiaAplicado = false;
                    }
                }
            }
        }

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
        res.status(500).json({ error: "Error creando novedad" });
    } finally {
        client.release();
    }
});

// PUT editar novedad (solo si no tiene gastos/movimientos asociados)
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
        observacion
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

        const movimientosResult = await client.query(
            "SELECT COUNT(*)::int AS total FROM movimiento_bodega WHERE id_novedad_luminaria = $1",
            [idNovedad]
        );
        const totalMovimientos = Number(movimientosResult.rows[0]?.total || 0);

        if (totalMovimientos > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "No se puede editar la novedad porque tiene gastos asociados" });
        }

        const actual = actualResult.rows[0];

        const normalizarTecnologia = (valor) => {
            if (valor === null || valor === undefined) return null;
            const texto = String(valor).trim();
            return texto === "" ? null : texto.toLowerCase();
        };

        const tipoFinal = tipo_novedad || actual.tipo_novedad;
        const tecnologiaAnteriorFinal = String(tipoFinal).toUpperCase() === "CAMBIO_TECNOLOGIA"
            ? normalizarTecnologia(tecnologia_anterior !== undefined ? tecnologia_anterior : actual.tecnologia_anterior)
            : null;
        const tecnologiaNuevaFinal = String(tipoFinal).toUpperCase() === "CAMBIO_TECNOLOGIA"
            ? normalizarTecnologia(tecnologia_nueva !== undefined ? tecnologia_nueva : actual.tecnologia_nueva)
            : null;

        const updateResult = await client.query(
            `UPDATE novedad_luminaria
             SET numero_lampara = $1,
                 tipo_novedad = $2,
                 tecnologia_anterior = $3,
                 tecnologia_nueva = $4,
                 fecha_novedad = $5,
                 observacion = $6
             WHERE id_novedad = $7
             RETURNING *`,
            [
                numero_lampara !== undefined ? numero_lampara : actual.numero_lampara,
                tipoFinal,
                tecnologiaAnteriorFinal,
                tecnologiaNuevaFinal,
                fecha_novedad || actual.fecha_novedad,
                observacion !== undefined ? (observacion || null) : actual.observacion,
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
