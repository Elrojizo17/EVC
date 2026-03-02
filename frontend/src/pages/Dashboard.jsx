import { useEffect, useState } from 'react';
import Header from '../components/Header';
import ActionButtons from '../components/ActionButtons';
import MapView from '../components/MapView';

export default function Dashboard() {
    const [tecnologiaFiltro, setTecnologiaFiltro] = useState(() => {
        return localStorage.getItem('tecnologiaFiltro') || 'todas';
    });

    const [busqueda, setBusqueda] = useState(() => {
        return localStorage.getItem('busquedaLampara') || '';
    });

    const [numeroMin, setNumeroMin] = useState(() => {
        return localStorage.getItem('numeroMin') || '';
    });

    const [numeroMax, setNumeroMax] = useState(() => {
        return localStorage.getItem('numeroMax') || '';
    });

    useEffect(() => {
        localStorage.setItem('tecnologiaFiltro', tecnologiaFiltro);
    }, [tecnologiaFiltro]);

    useEffect(() => {
        localStorage.setItem('busquedaLampara', busqueda);
    }, [busqueda]);

    useEffect(() => {
        localStorage.setItem('numeroMin', numeroMin);
    }, [numeroMin]);

    useEffect(() => {
        localStorage.setItem('numeroMax', numeroMax);
    }, [numeroMax]);

    return (
        <div style={{ padding: '20px' }}>
            <Header />
            <ActionButtons />
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <aside style={{
                    width: '180px',
                    background: 'white',
                    borderRadius: '10px',
                    padding: '10px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                        FILTRO
                    </div>
                    
                    <label htmlFor='busqueda-lampara' style={{ fontSize: '12px', color: '#475569', marginTop: '10px', display: 'block' }}>
                        Buscar lámpara
                    </label>
                    <input
                        id='busqueda-lampara'
                        type='text'
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder='Número...'
                        style={{
                            width: '100%',
                            marginTop: '6px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            fontSize: '12px',
                            height: '30px',
                            boxSizing: 'border-box'
                        }}
                    />

                    <label htmlFor='tecnologia-filtro' style={{ fontSize: '12px', color: '#475569', marginTop: '10px', display: 'block' }}>
                        Tecnología
                    </label>
                    <select
                        id='tecnologia-filtro'
                        value={tecnologiaFiltro}
                        onChange={(e) => setTecnologiaFiltro(e.target.value)}
                        style={{
                            width: '100%',
                            marginTop: '6px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            fontSize: '12px'
                        }}
                    >
                        <option value='todas'>Todas</option>
                        <option value='led'>LED</option>
                        <option value='sodio'>Sodio</option>
                        <option value='metal_halide'>Metal Halide</option>
                    </select>

                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                        RANGO DE LÁMPARAS
                    </div>

                    <label htmlFor='numero-min' style={{ fontSize: '12px', color: '#475569', marginTop: '10px', display: 'block' }}>
                        Número mínimo
                    </label>
                    <input
                        id='numero-min'
                        type='number'
                        value={numeroMin}
                        onChange={(e) => setNumeroMin(e.target.value)}
                        placeholder='Mín'
                        style={{
                            width: '100%',
                            marginTop: '6px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            fontSize: '12px',
                            height: '30px',
                            boxSizing: 'border-box'
                        }}
                    />

                    <label htmlFor='numero-max' style={{ fontSize: '12px', color: '#475569', marginTop: '10px', display: 'block' }}>
                        Número máximo
                    </label>
                    <input
                        id='numero-max'
                        type='number'
                        value={numeroMax}
                        onChange={(e) => setNumeroMax(e.target.value)}
                        placeholder='Máx'
                        style={{
                            width: '100%',
                            marginTop: '6px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            fontSize: '12px',
                            height: '30px',
                            boxSizing: 'border-box'
                        }}
                    />
                </aside>
                <div style={{ flex: 1 }}>
                    <MapView tecnologiaFiltro={tecnologiaFiltro} busqueda={busqueda} numeroMin={numeroMin} numeroMax={numeroMax} />
                </div>
            </div>
        </div>
    );
}
