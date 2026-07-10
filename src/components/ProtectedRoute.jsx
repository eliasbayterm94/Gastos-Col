import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { Spinner } from './ui.jsx';

const HOME_BY_ROLE = { usuario: '/gastos', contabilidad: '/rev', admin: '/admin' };

export default function ProtectedRoute({ children, roles }) {
  const { loading, session, role } = useAuth();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) {
    return <Navigate to={HOME_BY_ROLE[role] || '/login'} replace />;
  }
  return children;
}

export { HOME_BY_ROLE };
