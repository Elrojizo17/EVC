import "./LoadingScreen.css";

export default function LoadingScreen() {
    return (
        <div className="loading-screen">
            <div className="loading-card">
                <div className="loading-title">EVC - Sistema de Gestion de Luminarias</div>
                <div className="loading-subtitle">Conectando con el servidor...</div>
                <div className="loading-spinner" aria-label="Cargando" />
                <div className="loading-footnote">El servidor puede tardar algunos segundos en iniciar.</div>
            </div>
        </div>
    );
}
