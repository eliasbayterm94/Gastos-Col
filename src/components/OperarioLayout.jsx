import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { IcGrid, IcList, IcWallet, IcReceipt, IcLogout } from './Icons.jsx';
import UpdateButton from './UpdateButton.jsx';

const NAV = [
  { to: '/resumen', label: 'Resumen', icon: IcGrid },
  { to: '/gastos', label: 'Gastos', icon: IcList },
  { to: '/anticipos', label: 'Anticipos', icon: IcWallet },
  { to: '/reembolsos', label: 'Reembolsos', icon: IcReceipt },
];

export default function OperarioLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const doLogout = async () => { await signOut(); navigate('/login', { replace: true }); };

  return (
    <div className="fc-app" style={{ flexDirection: 'column' }}>
      <div className="fc-topbar">
        <div className="fc-topbar-page-title">Forest Gastos</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UpdateButton />
          <span className="fc-small" style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.nombre}
          </span>
          <button className="fc-btn fc-btn-ghost" onClick={doLogout} aria-label="Salir" style={{ padding: '8px 10px' }}>
            <IcLogout size={16} />
          </button>
        </div>
      </div>

      <div className="fc-content" style={{ paddingBottom: 92, maxWidth: 640 }}>
        <Outlet />
      </div>

      <nav className="fc-bottom-nav" style={{ display: 'block' }}>
        <div className="fc-bottom-nav-inner" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `fc-bottom-nav-btn${isActive ? ' active' : ''}`}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
