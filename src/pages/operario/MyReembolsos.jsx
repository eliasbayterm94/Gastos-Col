import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext.jsx';
import { listMyClosures } from '../../lib/api.js';
import { formatCOP, formatDate, SALDO_LABEL } from '../../lib/format.js';
import { Spinner, EmptyState } from '../../components/ui.jsx';
import { IcReceipt } from '../../components/Icons.jsx';

export default function MyReembolsos() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!user) return;
    listMyClosures(user.id).then(setRows).catch(() => setRows([]));
  }, [user]);

  if (rows === null) return <Spinner full />;

  return (
    <div>
      <div className="fc-page-head"><div className="fc-page-title">Mis reembolsos</div></div>
      {rows.length === 0 ? (
        <EmptyState icon={<IcReceipt size={40} />} title="Sin cierres" sub="Aquí verás los reembolsos y liquidaciones cerrados por contabilidad." />
      ) : (
        <div className="fc-list">
          {rows.map((c) => {
            const cls = c.saldo_direccion === 'a_favor_operario' ? 'is-ok'
              : c.saldo_direccion === 'a_favor_forest' ? 'is-warn' : '';
            return (
              <div className={`fc-hero-card alert-side ${cls}`} key={c.id}>
                <div className="fc-row-between">
                  <div className="fc-hero-label">Cierre {formatDate(c.fecha)}</div>
                </div>
                <div className="fc-row-between" style={{ alignItems: 'flex-end', marginTop: 4 }}>
                  <div>
                    <div className="fc-caption">Total gastos</div>
                    <div className="fc-num" style={{ fontSize: 'var(--fc-fs-20)', fontWeight: 600 }}>{formatCOP(c.total_gastos)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="fc-caption">Saldo</div>
                    <div className="fc-num" style={{ fontSize: 'var(--fc-fs-20)', fontWeight: 600 }}>{formatCOP(c.saldo)}</div>
                  </div>
                </div>
                <div className="fc-caption" style={{ marginTop: 10 }}>
                  {c.anticipo_aplicado > 0 && `Anticipo aplicado: ${formatCOP(c.anticipo_aplicado)} · `}
                  {SALDO_LABEL[c.saldo_direccion]}
                </div>
                {c.observaciones && <div className="fc-row-sub" style={{ marginTop: 6 }}>{c.observaciones}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
