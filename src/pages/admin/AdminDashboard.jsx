import { useEffect, useMemo, useState } from 'react';
import { fetchExpensesForStats, aggregate } from '../../lib/admin.js';
import { formatCOP, bogotaToday, ESTADO_LABEL } from '../../lib/format.js';
import { BarList, MonthlyBars } from '../../components/Charts.jsx';
import { Spinner } from '../../components/ui.jsx';

const PERIODOS = [
  { key: 'mes', label: 'Mes actual' },
  { key: '3m', label: 'Últimos 3 meses' },
  { key: 'anio', label: 'Año actual' },
  { key: 'todo', label: 'Todo' },
];
const REAL = ['aprobado', 'pagado'];
const ENVIADOS = ['enviado', 'en_revision', 'aprobado', 'pagado'];

function periodPredicate(period) {
  const today = bogotaToday();
  if (period === 'mes') { const ym = today.slice(0, 7); return (f) => (f || '').slice(0, 7) === ym; }
  if (period === 'anio') { const y = today.slice(0, 4); return (f) => (f || '').slice(0, 4) === y; }
  if (period === '3m') {
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCMonth(dt.getUTCMonth() - 3);
    const cutoff = dt.toISOString().slice(0, 10);
    return (f) => (f || '') >= cutoff;
  }
  return () => true;
}

function StatTile({ label, value, sub, tone }) {
  return (
    <div className="fc-stat-card">
      <div className="fc-stat-label">{label}</div>
      <div className={`fc-stat-value ${tone || ''}`}>{value}</div>
      {sub && <div className="fc-stat-sub">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="fc-stat-card">
      <div className="fc-stat-label" style={{ marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const [all, setAll] = useState(null);
  const [period, setPeriod] = useState('anio');
  const [base, setBase] = useState('real');

  useEffect(() => { fetchExpensesForStats().then(setAll).catch(() => setAll([])); }, []);

  const stats = useMemo(() => {
    if (!all) return null;
    const estados = base === 'real' ? REAL : ENVIADOS;
    const pred = periodPredicate(period);
    const rows = all.filter((r) => estados.includes(r.estado) && pred(r.fecha_gasto));
    return aggregate(rows);
  }, [all, period, base]);

  if (!stats) return <Spinner full />;

  const pctSinFactura = stats.total ? Math.round((stats.sinFactura / stats.total) * 100) : 0;
  const estadoData = stats.byEstado.map((d) => ({ k: ESTADO_LABEL[d.k] || d.k, v: d.v }));

  return (
    <div>
      <div className="fc-eyebrow">Administrador</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-4)' }}>Analytics de gasto</div>

      {/* Filtros */}
      <div className="fc-toolbar">
        <div className="fc-filters" style={{ margin: 0 }}>
          {PERIODOS.map((p) => (
            <button key={p.key} className={`fc-chip${period === p.key ? ' active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
          ))}
        </div>
        <select className="fc-select" style={{ width: 'auto' }} value={base} onChange={(e) => setBase(e.target.value)}>
          <option value="real">Aprobado + pagado</option>
          <option value="todos">Todos (incl. en revisión)</option>
        </select>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
        <StatTile label="Gasto total" value={formatCOP(stats.total)} sub={`${stats.count} gastos`} />
        <StatTile label="Ticket promedio" value={formatCOP(stats.avgTicket)} sub="por gasto" />
        <StatTile label="Sin factura" value={formatCOP(stats.sinFactura)} sub={`${pctSinFactura}% del total`} tone={pctSinFactura >= 25 ? 'red' : ''} />
        <StatTile label="# de gastos" value={String(stats.count)} sub="en el período" />
      </div>

      {/* Tendencia mensual — ancho completo */}
      <div className="fc-stat-card" style={{ marginBottom: 14 }}>
        <div className="fc-stat-label" style={{ marginBottom: 12 }}>Gasto por mes</div>
        <MonthlyBars data={stats.byMonth} />
      </div>

      {/* Desgloses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <ChartCard title="Por área"><BarList data={stats.byArea} /></ChartCard>
        <ChartCard title="Por tipo de gasto"><BarList data={stats.byType} /></ChartCard>
        <ChartCard title="Por categoría"><BarList data={stats.byCat.slice(0, 10)} /></ChartCard>
        <ChartCard title="Por operario (top 10)"><BarList data={stats.byOperario.slice(0, 10)} /></ChartCard>
        {stats.byRegion.length > 0 && (
          <ChartCard title="Gasto a clientes por región"><BarList data={stats.byRegion} /></ChartCard>
        )}
        <ChartCard title="Por estado"><BarList data={estadoData} /></ChartCard>
      </div>
    </div>
  );
}
