import { useEffect, useState } from 'react';
import { fetchExpensesForStats, aggregate } from '../../lib/admin.js';
import { formatCOP, ESTADO_LABEL } from '../../lib/format.js';
import { BarList, MonthlyBars } from '../../components/Charts.jsx';
import { Spinner } from '../../components/ui.jsx';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetchExpensesForStats().then((rows) => setStats(aggregate(rows))).catch(() => setStats(aggregate([])));
  }, []);
  if (!stats) return <Spinner full />;

  const estadoData = stats.byEstado.map((d) => ({ k: ESTADO_LABEL[d.k] || d.k, v: d.v }));

  return (
    <div>
      <div className="fc-eyebrow">Administrador</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-6)' }}>Panel global</div>

      <div className="fc-hero-row">
        <div className="fc-hero-card featured">
          <div className="fc-hero-label">Gasto total registrado</div>
          <div className="fc-hero-big" style={{ fontSize: 'var(--fc-fs-48)' }}>{formatCOP(stats.total)}</div>
          <div className="fc-hero-pills" style={{ marginTop: 16 }}>
            <span className="fc-pill">{stats.count} gastos</span>
          </div>
        </div>
        <div className="fc-hero-card">
          <div className="fc-stat-label">Por estado</div>
          <div style={{ marginTop: 12 }}><BarList data={estadoData} /></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginTop: 14 }}>
        <div className="fc-stat-card">
          <div className="fc-stat-label" style={{ marginBottom: 12 }}>Gasto por mes</div>
          <MonthlyBars data={stats.byMonth} />
        </div>
        <div className="fc-stat-card">
          <div className="fc-stat-label" style={{ marginBottom: 12 }}>Por categoría</div>
          <BarList data={stats.byCat.slice(0, 8)} />
        </div>
        <div className="fc-stat-card">
          <div className="fc-stat-label" style={{ marginBottom: 12 }}>Por operario</div>
          <BarList data={stats.byOperario.slice(0, 8)} />
        </div>
      </div>
    </div>
  );
}
