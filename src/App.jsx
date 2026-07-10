import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { ToastProvider, Spinner } from './components/ui.jsx';
import ProtectedRoute, { HOME_BY_ROLE } from './components/ProtectedRoute.jsx';
import OperarioLayout from './components/OperarioLayout.jsx';
import Login from './pages/Login.jsx';
import MyExpenses from './pages/operario/MyExpenses.jsx';
import NuevoGasto from './pages/operario/NuevoGasto.jsx';
import ExpenseDetail from './pages/operario/ExpenseDetail.jsx';
import MyAnticipos from './pages/operario/MyAnticipos.jsx';
import MyReembolsos from './pages/operario/MyReembolsos.jsx';

function RootRedirect() {
  const { loading, session, role } = useAuth();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[role] || '/gastos'} replace />;
}

// Placeholder para roles cuyo frontend llega en fases 4–5.
function EnConstruccion({ rol }) {
  const { signOut } = useAuth();
  return (
    <div className="fc-center-screen" style={{ flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
      <div className="fc-h3">Módulo de {rol}</div>
      <p className="fc-body-text">Esta sección se entrega en una fase próxima.</p>
      <button className="fc-btn fc-btn-ghost" onClick={signOut}>Salir</button>
    </div>
  );
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
              <Route path="/gastos" element={<MyExpenses />} />
              <Route path="/gastos/nuevo" element={<NuevoGasto />} />
              <Route path="/gastos/:id" element={<ExpenseDetail />} />
              <Route path="/anticipos" element={<MyAnticipos />} />
              <Route path="/reembolsos" element={<MyReembolsos />} />
            </Route>

            <Route path="/rev" element={<ProtectedRoute roles={['contabilidad', 'admin']}><EnConstruccion rol="contabilidad" /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><EnConstruccion rol="admin" /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
