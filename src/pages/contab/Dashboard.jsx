import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardMetrics } from '../../lib/contab.js';
import { formatCOP } from '../../lib/format.js';
import { Spinner } from '../../components/ui.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [m, setM] = useState(null);
  useEffect(() => { dashboardMetrics().then(setM).catch(() => setM({})); }, []);
  if (!m) return <Spinner full />;

  return (
    <div>
      <div className="fc-eyebrow">Contabilidad</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-6)' }}>Panel</div>

      <div className="fc-hero-row">
        <div className="fc-hero-card featured" style={{ cursor: 'pointer' }} onClick={() => navigate('/c/revision')}>
          <div className="fc-hero-label">Pendientes de revisión</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div className="fc-hero-big">{m.pendingReview}</div>
            <div className="fc-hero-unit">gastos</div>
          </div>
          <div className="fc-hero-pills" style={{ marginTop: 16 }}>
            <span className="fc-pill">Toca para revisar</span>
          </div>
        </div>
        <div className={`fc-hero-card alert-side ${m.siigoFailures ? 'is-crit' : 'is-ok'}`}
          style={{ cursor: 'pointer' }} onClick={() => navigate('/c/siigo')}>
          <div className="fc-hero-label">Fallos de Siigo</div>
          <div className="fc-hero-big-alt">{m.siigoFailures}</div>
          <div className="fc-caption">Envíos a revisar</div>
        </div>
      </div>

      <div className="fc-pnl-strip" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="fc-pnl-cell">
          <div className="fc-pnl-cell-label">Anticipos activos</div>
          <div className="fc-pnl-cell-value">{formatCOP(m.activeAnticiposTotal)}</div>
          <div className="fc-pnl-cell-sub">Saldo entregado sin liquidar</div>
        </div>
        <div className="fc-pnl-cell">
          <div className="fc-pnl-cell-label">Aprobado sin cerrar</div>
          <div className="fc-pnl-cell-value">{formatCOP(m.unclosedApprovedTotal)}</div>
          <div className="fc-pnl-cell-sub">Gastos aprobados por pagar</div>
        </div>
      </div>
    </div>
  );
}
