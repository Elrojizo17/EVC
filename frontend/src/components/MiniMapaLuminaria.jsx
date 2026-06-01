import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import httpClient from "../api/httpClient";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = "https://luminariasevc.onrender.com/api/luminarias";

const getLuminarias = async () => {
    try {
        const response = await httpClient.get(API_URL);
        return response.data;
    } catch (error) {
        console.error("Error fetching luminarias:", error);
        throw error;
    }
};

const getColorByTecnologia = (tecnologia) => {
    const tech = String(tecnologia || "").toLowerCase();
    if (tech.includes("led")) return "#0066ff";
    if (tech.includes("metal_halide")) return "#00cc44";
    if (tech.includes("sodio")) return "#ff0033";
    return "#9933ff";
};

export default function MiniMapaLuminaria({ numeroLampara }) {
    const [luminaria, setLuminaria] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!numeroLampara || numeroLampara.trim() === "") {
            setLuminaria(null);
            setError("");
            return;
        }

        buscarLuminaria();
    }, [numeroLampara]);

    const buscarLuminaria = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await getLuminarias();
            
            if (!Array.isArray(data)) {
                setError("Error al cargar luminarias");
                setLuminaria(null);
                return;
            }

            const encontrada = data.find(l => 
                String(l.numero_lampara).toLowerCase() === String(numeroLampara).toLowerCase().trim()
            );

            if (encontrada) {
                const lat = Number(encontrada.latitud);
                const lng = Number(encontrada.longitud);
                
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    setLuminaria(encontrada);
                    setError("");
                } else {
                    setError("Esta luminaria no tiene coordenadas vÃ¡lidas");
                    setLuminaria(null);
                }
            } else {
                setError("Luminaria no encontrada");
                setLuminaria(null);
            }
        } catch (err) {
            console.error("Error buscando luminaria:", err);
            setError("Error al buscar la luminaria");
            setLuminaria(null);
        } finally {
            setLoading(false);
        }
    };

    if (!numeroLampara || numeroLampara.trim() === "") {
        return (
            <div style={{
                padding: "20px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "2px dashed #cbd5e1",
                textAlign: "center",
                color: "#64748b",
                fontSize: "13px"
            }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>ðŸ—ºï¸</div>
                <div style={{ fontWeight: "500", marginBottom: "5px" }}>Vista previa del mapa</div>
                <div>Ingresa un nÃºmero de lÃ¡mpara para ver su ubicaciÃ³n aquÃ­</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{
                padding: "15px",
                background: "#f8fafc",
                borderRadius: "8px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "12px"
            }}>
                Buscando luminaria...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                padding: "15px",
                background: "#fef2f2",
                borderRadius: "8px",
                textAlign: "center",
                color: "#dc2626",
                fontSize: "12px"
            }}>
                âš ï¸ {error}
            </div>
        );
    }

    if (!luminaria) {
        return null;
    }

    return (
        <div style={{
            background: "white",
            padding: "15px",
            borderRadius: "8px",
            border: "2px solid #0f7c90"
        }}>
            <div style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#0a5c6d",
                marginBottom: "10px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
            }}>
                ðŸ“ UbicaciÃ³n de luminaria #{luminaria.numero_lampara}
            </div>
            
            <MapContainer
                center={[luminaria.latitud, luminaria.longitud]}
                zoom={17}
                style={{ height: "250px", width: "100%", borderRadius: "8px" }}
                scrollWheelZoom={false}
                dragging={true}
                zoomControl={true}
            >
                <TileLayer
                    attribution='Â© OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <CircleMarker
                    center={[luminaria.latitud, luminaria.longitud]}
                    radius={10}
                    pathOptions={{
                        fillColor: getColorByTecnologia(luminaria.tecnologia),
                        fillOpacity: 1,
                        color: "#ffffff",
                        weight: 3
                    }}
                >
                    <Popup>
                        <div style={{ fontSize: "12px" }}>
                            <strong>Luminaria #{luminaria.numero_lampara}</strong>
                            <div style={{ marginTop: "5px", lineHeight: "1.5" }}>
                                <div><strong>TecnologÃ­a:</strong> {luminaria.tecnologia}</div>
                                <div><strong>Potencia:</strong> {Number(luminaria.potencia_w || 0).toFixed(0)} W</div>
                                <div><strong>Estado:</strong> {luminaria.estado}</div>
                            </div>
                        </div>
                    </Popup>
                </CircleMarker>
            </MapContainer>

            {/* Info adicional */}
            <div style={{
                marginTop: "10px",
                fontSize: "11px",
                color: "#64748b",
                lineHeight: "1.6"
            }}>
                <div><strong>TecnologÃ­a:</strong> {luminaria.tecnologia}</div>
                <div><strong>Potencia:</strong> {Number(luminaria.potencia_w || 0)} W</div>
                <div><strong>Coord:</strong> X:{luminaria.coord_x}, Y:{luminaria.coord_y}</div>
            </div>
        </div>
    );
}
