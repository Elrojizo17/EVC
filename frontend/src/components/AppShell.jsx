import { Link } from 'react-router-dom';
import logoEvc from '../assets/evc-logo.svg';
import '../pages/Dashboard.css';

const menuOptions = [
  { label: 'Mapa', path: '/' },
  { label: 'Registrar Novedad', path: '/novedad-censo' },
  { label: 'Ingresas Inventario', path: '/inventario-bodega' },
  { label: 'Devoluciones / Prestamos', path: '/devoluciones-prestamos' },
  { label: 'Gestionar Electricistas', path: '/electricistas' },
  { label: 'Reporte Novedades', path: '/reporte-novedades' },
  { label: 'Reporte Gastos', path: '/reporte-gastos' }
];

export default function AppShell({ children }) {
  return (
    <div className='dashboard-page app-shell-soft'>
      <div className='dashboard-shell'>
        <aside className='dashboard-sidebar'>
          <div className='dashboard-logo-wrap'>
            <img src={logoEvc} alt='Logo EVC' className='dashboard-logo' />
          </div>

          <h1 className='dashboard-title'>Gestión de Luminarias</h1>

          <nav className='dashboard-menu'>
            {menuOptions.map((option) => (
              <Link key={option.path} to={option.path} className='dashboard-menu-link'>
                {option.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className='dashboard-main'>
          <section className='dashboard-map-card app-shell-soft-content'>{children}</section>
        </main>
      </div>
    </div>
  );
}
