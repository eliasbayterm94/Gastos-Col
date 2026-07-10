import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext.jsx';
import { listMyAnticipos } from '../../lib/api.js';
import { formatCOP, formatDate, METODO_LABEL } from '../../lib/format.js';
import { StatusBadge, Spinner, EmptyState } from '../../components/ui.jsx';
import { IcWallet } from '../../components/Icons.jsx';

export default function MyAnticipos() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!user) return;
    listMyAnticipos(user.id).then(setRows).catch(() => setRows([]));
  }, [user]);

  if (rows === null) return <Spinner full />;

  return (
    <div>
      <div className="fc-page-head"><div className="fc-page-title">Mis anticipos</div></div>
      {rows.length === 0 ? (
        <EmptyState icon={<IcWallet size={40} />} title="Sin anticipos" sub="Contabilidad registra los anticipos que te entreguen." />
      ) : (
        <div className="fc-list">
          {rows.map((a) => {
            const saldo = a.balance?.saldo ?? a.monto;
            const aplicado = a.balance?.gastos_aplicados ?? 0;
            return (
              <div className="fc-stat-card" key={a.id}>
                <div className="fc-row-between" style={{ marginBottom: 10 }}>
                  <div className="fc-stat-label" style={{ margin: 0 }}>{formatDate(a.fecha)} · {METODO_LABEL[a.metodo_entrega]}</div>
                  <StatusBadge estado={a.estado} kind="anticipo" />
                </div>
                <div className="fc-row-between" style={{ alignItems: 'flex-end' }}>
                  <div>
                    <div className="fc-caption">Anticipo</div>
                    <div className="fc-stat-value">{formatCOP(a.monto)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="fc-caption">Saldo</div>
                    <div className={`fc-stat-value ${saldo < 0 ? 'red' : 'green'}`} style={{ fontSize: 'var(--fc-fs-20)' }}>
                      {formatCOP(saldo)}
                    </div>
                  </div>
                </div>
                <div className="fc-bar-track" style={{ marginTop: 12, marginBottom: 6 }}>
                  <div className="fc-bar-fill" style={{ width: `${Math.min(100, a.monto ? (aplicado / a.monto) * 100 : 0)}%` }} />
                </div>
                <div className="fc-caption">Gastos aplicados: {formatCOP(aplicado)} de {formatCOP(a.monto)}</div>
                {a.descripcion && <div className="fc-row-sub" style={{ marginTop: 6 }}>{a.descripcion}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
