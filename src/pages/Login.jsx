import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { HOME_BY_ROLE } from '../components/ProtectedRoute.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const { error } = await signIn(email, password);
    if (error) { setErr('Correo o contraseña incorrectos'); setBusy(false); return; }
    const { data } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('rol').eq('id', data.user.id).maybeSingle();
    navigate(HOME_BY_ROLE[prof?.rol] || '/gastos', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--fc-navy-dark)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="fc-sidebar-logo" style={{ width: 52, height: 52, margin: '0 auto 14px', fontSize: 22 }}>FG</div>
          <div className="fc-h3" style={{ color: '#fff' }}>Forest Gastos</div>
          <div className="fc-eyebrow" style={{ color: 'var(--fc-on-navy-3)', marginTop: 6 }}>Operaciones de origen</div>
        </div>

        <form onSubmit={submit} style={{ background: '#fff', borderRadius: 'var(--fc-radius-4)', padding: 24 }}>
          <div className="fc-field">
            <label className="fc-label">Correo</label>
            <input className="fc-input" type="email" inputMode="email" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="fc-field">
            <label className="fc-label">Contraseña</label>
            <input className="fc-input" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <div className="fc-error-text" style={{ marginBottom: 12 }}>{err}</div>}
          <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="fc-caption" style={{ color: 'var(--fc-on-navy-3)', textAlign: 'center', marginTop: 16 }}>
          ¿Sin acceso? Pide a un administrador que te cree la cuenta.
        </p>
      </div>
    </div>
  );
}
