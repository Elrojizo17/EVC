import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MapView from '../components/MapView';
import logoEvc from '../assets/evc-logo.svg';
import './Dashboard.css';

const dashboardOptions = [
    { label: 'Mapa', path: '/' },
    { label: 'Registrar Novedad', path: '/novedad-censo' },
    { label: 'Ingresas Inventario', path: '/inventario-bodega' },
    { label: 'Devoluciones / Prestamos', path: '/devoluciones-prestamos' },
    { label: 'Gestionar Electricistas', path: '/electricistas' },
    { label: 'Reporte Novedades', path: '/reporte-novedades' },
    { label: 'Reporte Gastos', path: '/reporte-gastos' }
];

export default function Dashboard() {
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
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
        <div className='dashboard-page'>
            <div className='dashboard-shell'>
                <aside className='dashboard-sidebar'>
                    <div className='dashboard-logo-wrap'>
                        <img src={logoEvc} alt='Logo EVC' className='dashboard-logo' />
                    </div>

                    <h1 className='dashboard-title'>Gestión de Luminarias</h1>

                    <nav className='dashboard-menu'>
                        {dashboardOptions.map((option) => (
                            <Link key={option.path} to={option.path} className='dashboard-menu-link'>
                                {option.label}
                            </Link>
                        ))}
                    </nav>
                </aside>

                <main className='dashboard-main'>
                    <section className='dashboard-top-bar'>
                        <label htmlFor='busqueda-lampara' className='dashboard-search-wrap'>
                            <svg className='dashboard-search-icon' width='18' height='18' viewBox='0 0 24 24' aria-hidden='true'>
                                <circle cx='10.5' cy='10.5' r='5.75' fill='none' stroke='currentColor' strokeWidth='1.8' />
                                <path d='M15 15L19.25 19.25' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
                            </svg>
                            <input
                                id='busqueda-lampara'
                                type='text'
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder='Barra de busqueda'
                                className='dashboard-search-input'
                            />
                        </label>

                        <button
                            type='button'
                            className='dashboard-filter-toggle'
                            onClick={() => setMostrarFiltros((prev) => !prev)}
                            aria-expanded={mostrarFiltros}
                        >
                            <svg width='18' height='18' viewBox='0 0 24 24' aria-hidden='true'>
                                <path d='M3 5H21M6 12H18M10 19H14' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                            </svg>
                            Filtros
                        </button>
                    </section>

                    {mostrarFiltros && (
                        <section className='dashboard-filters'>
                            <div className='dashboard-filter-field'>
                                <label htmlFor='tecnologia-filtro'>Tecnologia</label>
                                <select
                                    id='tecnologia-filtro'
                                    value={tecnologiaFiltro}
                                    onChange={(e) => setTecnologiaFiltro(e.target.value)}
                                >
                                    <option value='todas'>Todas</option>
                                    <option value='led'>LED</option>
                                    <option value='sodio'>Sodio</option>
                                    <option value='metal_halide'>Metal Halide</option>
                                </select>
                            </div>

                            <div className='dashboard-filter-field'>
                                <label htmlFor='numero-min'>Numero minimo</label>
                                <input
                                    id='numero-min'
                                    type='number'
                                    value={numeroMin}
                                    onChange={(e) => setNumeroMin(e.target.value)}
                                    placeholder='Desde'
                                />
                            </div>

                            <div className='dashboard-filter-field'>
                                <label htmlFor='numero-max'>Numero maximo</label>
                                <input
                                    id='numero-max'
                                    type='number'
                                    value={numeroMax}
                                    onChange={(e) => setNumeroMax(e.target.value)}
                                    placeholder='Hasta'
                                />
                            </div>
                        </section>
                    )}

                    <section className='dashboard-map-card'>
                        <MapView
                            tecnologiaFiltro={tecnologiaFiltro}
                            busqueda={busqueda}
                            numeroMin={numeroMin}
                            numeroMax={numeroMax}
                        />
                    </section>
                </main>
            </div>
        </div>
    );
}
