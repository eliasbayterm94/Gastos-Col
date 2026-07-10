import { formatCOP } from '../lib/format.js';

// Barras horizontales simples (sin librerías). data: [{k, v}].
export function BarList({ data, max, money = true, colorVar = '--fc-navy' }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="fc-stack" style={{ gap: 10 }}>
      {data.map((d) => (
        <div key={d.k}>
          <div className="fc-row-between" style={{ marginBottom: 4 }}>
            <span className="fc-small" style={{ color: 'var(--fc-ink-700)' }}>{d.k}</span>
            <span className="fc-mono" style={{ fontSize: 13 }}>{money ? formatCOP(d.v) : d.v}</span>
          </div>
          <div className="fc-bar-track" style={{ marginBottom: 0 }}>
            <div className="fc-bar-fill" style={{ width: `${(d.v / top) * 100}%`, background: `var(${colorVar})` }} />
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="fc-help-text">Sin datos.</div>}
    </div>
  );
}

// Barras verticales para serie mensual. data: [{k:'YYYY-MM', v}]
export function MonthlyBars({ data }) {
  const top = Math.max(1, ...data.map((d) => d.v));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, overflowX: 'auto', paddingTop: 8 }}>
      {data.map((d) => (
        <div key={d.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 40 }}>
          <div title={formatCOP(d.v)}
            style={{ width: 28, height: `${Math.max(4, (d.v / top) * 130)}px`, background: 'var(--fc-navy)', borderRadius: 'var(--fc-radius-1)' }} />
          <span className="fc-caption" style={{ whiteSpace: 'nowrap' }}>{d.k.slice(5)}/{d.k.slice(2, 4)}</span>
        </div>
      ))}
      {data.length === 0 && <div className="fc-help-text">Sin datos.</div>}
    </div>
  );
}
