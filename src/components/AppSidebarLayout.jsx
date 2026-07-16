import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { IcMenu, IcLogout } from './Icons.jsx';
import UpdateButton from './UpdateButton.jsx';

// Layout desktop-first con sidebar navy y drawer en móvil.
// nav: [{ to, label, icon, end }], title = título de la app en el sidebar.
export default function AppSidebarLayout({ nav, title = 'Forest Gastos', badge }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const doLogout = async () => { await signOut(); navigate('/login', { replace: true }); };

  return (
    <div className="fc-app">
      <div className={`fc-sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`fc-sidebar ${open ? 'open' : ''}`}>
        <div className="fc-sidebar-header">
          <div className="fc-sidebar-brand">
            <div className="fc-sidebar-logo">FG</div>
            <div className="fc-sidebar-title">{title}</div>
          </div>
        </div>
        <nav className="fc-sidebar-nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
              className={({ isActive }) => `fc-sidebar-link${isActive ? ' active' : ''}`}>
              <Icon /><span className="label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="fc-sidebar-footer">
          <div style={{ padding: '4px 10px 8px', minWidth: 0 }}>
            <div className="fc-caption" style={{ color: 'var(--fc-on-navy-3)' }}>{badge}</div>
            <div style={{ color: '#fff', fontSize: 'var(--fc-fs-12)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.nombre}
            </div>
          </div>
          <button className="fc-sidebar-toggle-footer" onClick={doLogout}>
            <IcLogout size={16} /><span className="label">Salir</span>
          </button>
        </div>
      </aside>

      <div className="fc-app-main">
        <div className="fc-topbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="fc-mobile-toggle" onClick={() => setOpen(true)} aria-label="Menú"><IcMenu /></button>
            <div className="fc-topbar-page-title">{title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UpdateButton />
            <span className="fc-small" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.nombre}
            </span>
            <button className="fc-btn fc-btn-ghost" onClick={doLogout} aria-label="Salir" style={{ padding: '8px 10px' }}>
              <IcLogout size={16} />
            </button>
          </div>
        </div>
        <div className="fc-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
