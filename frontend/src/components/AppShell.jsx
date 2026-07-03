import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import logoEvc from '../assets/evc-logo.svg';
import { useAuth } from '../context/AuthContext';
import '../pages/Dashboard.css';

const menuOptionsBase = [
  { label: 'Mapa', path: '/' },
  { label: 'Registrar Novedad', path: '/novedad-censo' },
  { label: 'Inventario', path: '/inventario-bodega' },
  { label: 'Devoluciones / Prestamos', path: '/devoluciones-prestamos' },
  { label: 'Gestionar Electricistas', path: '/electricistas' },
  { label: 'Reporte Novedades', path: '/reporte-novedades' },
  { label: 'Reporte Gastos', path: '/reporte-gastos' }
];

export default function AppShell({ children }) {
  const { rol, usuario, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const menuOptions = useMemo(() => {
    if (rol === 'INVITADO') {
      return menuOptionsBase.filter((option) => option.path === '/');
    }
    return menuOptionsBase;
  }, [rol]);

  return (
    <div className='dashboard-page app-shell-soft'>
      <div className={`dashboard-shell ${sidebarCollapsed ? 'dashboard-shell--sidebar-collapsed' : ''}`}>
        <aside className='dashboard-sidebar'>
          <button
            type='button'
            className='dashboard-sidebar-toggle'
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
            aria-expanded={!sidebarCollapsed}
          >
            ←
          </button>

          <div className='dashboard-sidebar-content'>
            <div className='dashboard-logo-wrap'>
              <img src={logoEvc} alt='Logo EVC' className='dashboard-logo' />
            </div>

            <h1 className='dashboard-title'>Gestión de Luminarias</h1>

            <nav className='dashboard-menu'>
              {menuOptions.map((option) => (
                <NavLink
                  key={option.path}
                  to={option.path}
                  end={option.path === '/'}
                  className={({ isActive }) =>
                    `dashboard-menu-link ${isActive ? 'dashboard-menu-link--active' : ''}`
                  }
                >
                  {option.label}
                </NavLink>
              ))}
            </nav>

            <div className='dashboard-sidebar-footer'>
              <div className='dashboard-user-role'>
                {usuario?.nombre || 'Usuario'} · {rol || 'SIN ROL'}
              </div>
              <button type='button' className='dashboard-logout' onClick={logout}>
                Cerrar sesion
              </button>
            </div>
          </div>
        </aside>

        <main className='dashboard-main'>
          <section className='dashboard-map-card app-shell-soft-content'>{children}</section>
        </main>
      </div>
    </div>
  );
}
