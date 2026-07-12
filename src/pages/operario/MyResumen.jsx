import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.jsx';
import { myDashboard } from '../../lib/api.js';
import { formatCOP, formatDate } from '../../lib/format.js';
import { Spinner } from '../../components/ui.jsx';
import { IcPlus, IcChevron } from '../../components/Icons.jsx';

export default function MyResumen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState(null);

  useEffect(() => {
    if (!user) return;
    myDashboard(user.id).then(setD).catch(() => setD(null));
  }, [user]);

  if (!d) return <Spinner full />;

  const nombre = (profile?.nombre || '').split(' ')[0];

  return (
    <div>
      <div className="fc-eyebrow">Hola{nombre ? `, ${nombre}` : ''}</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-5)' }}>Mi resumen</div>

      {/* Lo más importante: cuánto te van a reembolsar */}
      <div className="fc-hero-card featured" style={{ cursor: 'pointer', marginBottom: 14 }}
        onClick={() => navigate('/gastos?estado=aprobado')}>
        <div className="fc-hero-label">Por reembolsar (aprobado, sin pagar)</div>
        <div className="fc-hero-big" style={{ fontSize: 'var(--fc-fs-48)' }}>{formatCOP(d.porReembolsarMonto)}</div>
        <div className="fc-hero-pills" style={{ marginTop: 14 }}>
          <span className="fc-pill">{d.porReembolsarCount} gasto(s)</span>
        </div>
      </div>

      {/* Rechazados: requiere tu atención */}
      {d.rechazados.length > 0 && (
        <button className="fc-alert critical" style={{ marginBottom: 14 }} onClick={() => navigate('/gastos?estado=rechazado')}>
          <div className="fc-alert-body">
            <div className="fc-alert-title">Tienes {d.rechazados.length} gasto(s) rechazado(s)</div>
            <div className="fc-alert-sub">Corrígelos y reenvíalos para que te los aprueben.</div>
          </div>
          <span className="fc-alert-arrow"><IcChevron size={18} /></span>
        </button>
      )}

      {/* Tarjetas concretas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <button className="fc-stat-card" style={{ textAlign: 'left' }} onClick={() => navigate('/gastos?estado=en_revision')}>
          <div className="fc-stat-label">En revisión</div>
          <div className="fc-stat-value">{formatCOP(d.enRevisionMonto)}</div>
          <div className="fc-stat-sub">{d.enRevisionCount} gasto(s) con contabilidad</div>
        </button>
        <button className="fc-stat-card" style={{ textAlign: 'left' }} onClick={() => navigate('/anticipos')}>
          <div className="fc-stat-label">Anticipos activos</div>
          <div className={`fc-stat-value ${d.anticipoSaldo < 0 ? 'red' : 'green'}`}>{formatCOP(d.anticipoSaldo)}</div>
          <div className="fc-stat-sub">{d.anticiposActivos} anticipo(s) · saldo</div>
        </button>
        <button className="fc-stat-card" style={{ textAlign: 'left' }} onClick={() => navigate('/gastos?estado=borrador')}>
          <div className="fc-stat-label">Borradores</div>
          <div className="fc-stat-value">{d.borradorCount}</div>
          <div className="fc-stat-sub">Sin enviar</div>
        </button>
        <button className="fc-stat-card" style={{ textAlign: 'left' }} onClick={() => navigate('/reembolsos')}>
          <div className="fc-stat-label">Pagado (histórico)</div>
          <div className="fc-stat-value green">{formatCOP(d.pagadoMonto)}</div>
          <div className="fc-stat-sub">Ya reembolsado/cerrado</div>
        </button>
      </div>

      {d.soportePendienteCount > 0 && (
        <div className="fc-alert" style={{ marginBottom: 14, cursor: 'default' }}>
          <div className="fc-alert-body">
            <div className="fc-alert-title">{d.soportePendienteCount} gasto(s) sin soporte</div>
            <div className="fc-alert-sub">Contabilidad puede pedirte la foto antes de aprobar.</div>
          </div>
        </div>
      )}

      <button className="fc-fab" onClick={() => navigate('/gastos/nuevo')}>
        <IcPlus /> Nuevo gasto
      </button>
    </div>
  );
}
