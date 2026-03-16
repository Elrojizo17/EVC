import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = "http://localhost:3000/api/luminarias";

const getLuminarias = async () => {
    try {
        const response = await axios.get(API_URL);
        return response.data;
    } catch (error) {
        console.error("Error fetching luminarias:", error);
        throw error;
    }
};

// Colores por tecnologia usando la paleta oficial
const getColorByTecnologia = (tecnologia) => {
    const tech = String(tecnologia || "").toLowerCase();
    if (tech.includes("led")) return "#0D70B4";
    if (tech.includes("metal_halide")) return "#095332";
    if (tech.includes("sodio")) return "#C51623";
    return "#1B4F72";
};

export default function MapView({ tecnologiaFiltro = "todas", busqueda = "", numeroMin = "", numeroMax = "" }) {
    const [luminarias, setLuminarias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actualizar, setActualizar] = useState(0); // Contador para forzar actualización
    const [luminariaSeleccionada, setLuminariaSeleccionada] = useState(null); // Luminaria con popup abierto
    const popupRef = useRef(null);
    const luminariaSeleccionadaRef = useRef(null); // Ref para acceder siempre al estado actual

    // Actualizar ref cuando cambia luminariaSeleccionada
    useEffect(() => {
        luminariaSeleccionadaRef.current = luminariaSeleccionada;
    }, [luminariaSeleccionada]);

    useEffect(() => {
        cargarLuminarias();
        
        // Escuchar evento personalizado cuando se actualiza una luminaria
        const handleActualizacion = async () => {
            console.log("🎯 MapView: Evento de actualización recibido");
            setActualizar(prev => prev + 1);
            await cargarLuminarias();
            
            // Si hay una luminaria seleccionada, actualizar su información inmediatamente
            if (luminariaSeleccionadaRef.current) {
                console.log("🔄 Actualizando información del popup para luminaria:", luminariaSeleccionadaRef.current.numero_lampara);
                await actualizarLuminariaSeleccionada();
            }
        };
        
        window.addEventListener('luminariasActualizadas', handleActualizacion);
        
        return () => {
            window.removeEventListener('luminariasActualizadas', handleActualizacion);
        };
    }, []);

    const cargarLuminarias = async () => {
        try {
            setLoading(true);
            setError("");
            console.log("📡 Cargando luminarias desde API...");
            const data = await getLuminarias();
            if (!Array.isArray(data)) {
                setLuminarias([]);
                setError("La API no devolvió una lista de luminarias.");
                return;
            }
            console.log(`✅ Se cargaron ${data.length} luminarias`);
            setLuminarias(data);
        } catch (err) {
            console.error("❌ Error cargando luminarias:", err);
            setLuminarias([]);
            setError("No se pudo cargar el mapa. Revisa el backend y CORS.");
        } finally {
            setLoading(false);
        }
    };

    const actualizarLuminariaSeleccionada = async () => {
        try {
            const lumiSeleccionada = luminariaSeleccionadaRef.current;
            if (!lumiSeleccionada) {
                console.log("⚠️ No hay luminaria seleccionada");
                return;
            }
            
            console.log("🔄 Actualizando información del popup...");
            const data = await getLuminarias();
            const lumiActualizada = data.find(l => l.numero_lampara === lumiSeleccionada.numero_lampara);
            
            if (lumiActualizada) {
                console.log("✅ Nuevos datos obtenidos:", lumiActualizada.tecnologia);
                setLuminariaSeleccionada(lumiActualizada);
                console.log("✅ Popup actualizado con nueva información");
            } else {
                console.warn("⚠️ No se encontró la luminaria actualizada:", lumiSeleccionada.numero_lampara);
            }
        } catch (err) {
            console.error("❌ Error actualizando luminaria seleccionada:", err);
        }
    };

    const luminariasValidas = useMemo(() => {
        return (luminarias || []).filter((l) => {
            const lat = Number(l.latitud);
            const lng = Number(l.longitud);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return false;
            }
            
            const tecnologia = String(l.tecnologia || "").toLowerCase();
            if (tecnologiaFiltro !== "todas" && !tecnologia.includes(tecnologiaFiltro)) {
                return false;
            }
            
            if (busqueda.trim() !== "") {
                const numeroLampara = String(l.numero_lampara || "").toLowerCase();
                if (!numeroLampara.includes(busqueda.toLowerCase())) {
                    return false;
                }
            }

            if (numeroMin !== "" || numeroMax !== "") {
                const num = Number(l.numero_lampara);
                if (numeroMin !== "" && num < Number(numeroMin)) {
                    return false;
                }
                if (numeroMax !== "" && num > Number(numeroMax)) {
                    return false;
                }
            }
            
            return true;
        });
    }, [luminarias, tecnologiaFiltro, busqueda, numeroMin, numeroMax]);

    return (
        <div className='map-view'>
            <MapContainer
                center={[4.334, -75.826]} // Caicedonia
                zoom={14}
                style={{ height: "100%", minHeight: "540px", width: "100%", borderRadius: "14px" }}
                preferCanvas={true}
                renderer={L.canvas({ tolerance: 5 })}
            >
                <TileLayer
                    attribution='© OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {luminariasValidas.map(l => {
                    const color = getColorByTecnologia(l.tecnologia);
                    // Usar la luminaria seleccionada si es la actual, sino usar la del listado
                    const datosMostrados = luminariaSeleccionada?.numero_lampara === l.numero_lampara 
                        ? luminariaSeleccionada 
                        : l;

                    return (
                        <CircleMarker
                            key={`${l.numero_lampara}-${actualizar}`}
                            center={[l.latitud, l.longitud]}
                            radius={7}
                            pathOptions={{
                                fillColor: getColorByTecnologia(datosMostrados.tecnologia),
                                fillOpacity: 0.9,
                                color: "#ffffff",
                                weight: 2
                            }}
                            eventHandlers={{
                                click: () => {
                                    console.log("📍 Luminaria seleccionada:", l.numero_lampara);
                                    setLuminariaSeleccionada(l);
                                }
                            }}
                        >
                            <Popup>
                                <div style={{ minWidth: "250px", fontSize: "13px" }}>
                                    <strong style={{ fontSize: "14px" }}>
                                        Luminaria #{datosMostrados.numero_lampara}
                                    </strong>
                                    <hr style={{ margin: "5px 0" }} />
                                    <div style={{ lineHeight: "1.6" }}>
                                        <div><strong>Tecnología:</strong> {datosMostrados.tecnologia}</div>
                                        <div><strong>Potencia:</strong> {Number(datosMostrados.potencia_w || 0).toFixed(0)} W</div>
                                        <div><strong>Coord X:</strong> {datosMostrados.coord_x}</div>
                                        <div><strong>Coord Y:</strong> {datosMostrados.coord_y}</div>
                                        <div><strong>Estado:</strong> {datosMostrados.estado}</div>
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#888", marginTop: "10px", fontStyle: "italic" }}>
                                        Actualizándose automáticamente...
                                    </div>
                                </div>
                            </Popup>
                        </CircleMarker>
                    );
                })}
            </MapContainer>
            
            <div style={{
                marginTop: "10px",
                background: "#ffffff",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #d7e1eb",
                display: "flex",
                gap: "20px",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap"
            }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#27425e" }}>
                    LEYENDA:
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#0D70B4", border: "2px solid white", boxShadow: "0 0 0 1px #0D70B4" }}></div>
                        <span style={{ fontSize: "12px", color: "#1e293b", fontWeight: "500" }}>LED</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#C51623", border: "2px solid white", boxShadow: "0 0 0 1px #C51623" }}></div>
                        <span style={{ fontSize: "12px", color: "#1e293b", fontWeight: "500" }}>Sodio</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#095332", border: "2px solid white", boxShadow: "0 0 0 1px #095332" }}></div>
                        <span style={{ fontSize: "12px", color: "#1e293b", fontWeight: "500" }}>Metal Halide</span>
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>
                Mostrando {luminariasValidas.length} de {luminarias.length} luminarias
                {luminariaSeleccionada && ` | Observando: Luminaria #${luminariaSeleccionada.numero_lampara}`}
            </div>
            {(loading || error) && (
                <div style={{ marginTop: "10px", color: error ? "#b00020" : "#1f6feb" }}>
                    {loading ? "Cargando luminarias..." : error}
                </div>
            )}
        </div>
    );
}
