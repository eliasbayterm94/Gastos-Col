import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { ToastProvider, Spinner } from './components/ui.jsx';
import ProtectedRoute, { HOME_BY_ROLE } from './components/ProtectedRoute.jsx';
import OperarioLayout from './components/OperarioLayout.jsx';
import Login from './pages/Login.jsx';
import MyResumen from './pages/operario/MyResumen.jsx';
import MyExpenses from './pages/operario/MyExpenses.jsx';
import NuevoGasto from './pages/operario/NuevoGasto.jsx';
import ExpenseDetail from './pages/operario/ExpenseDetail.jsx';
import MyAnticipos from './pages/operario/MyAnticipos.jsx';
import MyReembolsos from './pages/operario/MyReembolsos.jsx';
import ContabLayout from './pages/contab/ContabLayout.jsx';
import Dashboard from './pages/contab/Dashboard.jsx';
import ReviewQueue from './pages/contab/ReviewQueue.jsx';
import ReviewDetail from './pages/contab/ReviewDetail.jsx';
import Anticipos from './pages/contab/Anticipos.jsx';
import Closures from './pages/contab/Closures.jsx';
import History from './pages/contab/History.jsx';
import SiigoPush from './pages/contab/SiigoPush.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import Users from './pages/admin/Users.jsx';
import Catalogs from './pages/admin/Catalogs.jsx';
import Overrides from './pages/admin/Overrides.jsx';
import AuditLog from './pages/admin/AuditLog.jsx';

function RootRedirect() {
  const { loading, session, role } = useAuth();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[role] || '/gastos'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RootRedirect />} />

            <Route element={<ProtectedRoute roles={['usuario', 'admin']}><OperarioLayout /></ProtectedRoute>}>
              <Route path="/resumen" element={<MyResumen />} />
              <Route path="/gastos" element={<MyExpenses />} />
              <Route path="/gastos/nuevo" element={<NuevoGasto />} />
              <Route path="/gastos/:id" element={<ExpenseDetail />} />
              <Route path="/anticipos" element={<MyAnticipos />} />
              <Route path="/reembolsos" element={<MyReembolsos />} />
            </Route>

            <Route element={<ProtectedRoute roles={['contabilidad', 'admin']}><ContabLayout /></ProtectedRoute>}>
              <Route path="/c" element={<Dashboard />} />
              <Route path="/c/revision" element={<ReviewQueue />} />
              <Route path="/c/revision/:id" element={<ReviewDetail />} />
              <Route path="/c/historial" element={<History />} />
              <Route path="/c/anticipos" element={<Anticipos />} />
              <Route path="/c/cierres" element={<Closures />} />
              <Route path="/c/siigo" element={<SiigoPush />} />
            </Route>

            <Route element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/usuarios" element={<Users />} />
              <Route path="/admin/catalogos" element={<Catalogs />} />
              <Route path="/admin/overrides" element={<Overrides />} />
              <Route path="/admin/auditoria" element={<AuditLog />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
