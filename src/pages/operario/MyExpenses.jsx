import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.jsx';
import { listMyExpenses } from '../../lib/api.js';
import { formatCOP, formatDate } from '../../lib/format.js';
import { StatusBadge, PendienteBadge, SinFacturaBadge, Spinner, EmptyState } from '../../components/ui.jsx';
import { IcPlus, IcInbox } from '../../components/Icons.jsx';

const FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'borrador', label: 'Borradores' },
  { key: 'enviado', label: 'Enviados' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'pagado', label: 'Pagados' },
  { key: 'rechazado', label: 'Rechazados' },
];

export default function MyExpenses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [estado, setEstado] = useState(searchParams.get('estado') || '');
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!user) return;
    setRows(null);
    listMyExpenses(user.id, { estado: estado || undefined })
      .then(setRows).catch(() => setRows([]));
  }, [user, estado]);

  return (
    <div>
      <div className="fc-page-head fc-row-between">
        <div className="fc-page-title">Mis gastos</div>
      </div>

      <div className="fc-filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`fc-chip${estado === f.key ? ' active' : ''}`} onClick={() => setEstado(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {rows === null ? <Spinner full />
        : rows.length === 0 ? (
          <EmptyState icon={<IcInbox size={40} />} title="Sin gastos" sub="Toca “Nuevo gasto” para registrar el primero." />
        ) : (
          <div className="fc-list">
            {rows.map((e) => (
              <button className="fc-row-card" key={e.id} onClick={() => navigate(`/gastos/${e.id}`)}>
                <div className="fc-row-main">
                  <div className="fc-row-title">{e.expense_categories?.nombre || 'Gasto'}</div>
                  <div className="fc-row-sub">
                    {formatDate(e.fecha_gasto)}{e.proveedor_nombre ? ` · ${e.proveedor_nombre}` : ''}
                  </div>
                </div>
                <div className="fc-row-right">
                  <div className="fc-row-amount">{formatCOP(e.monto)}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {e.sin_soporte && <SinFacturaBadge />}
                    {e.soporte_pendiente && !e.sin_soporte && ['enviado', 'en_revision'].includes(e.estado) && <PendienteBadge />}
                    <StatusBadge estado={e.estado} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

      <button className="fc-fab" onClick={() => navigate('/gastos/nuevo')}>
        <IcPlus /> Nuevo gasto
      </button>
    </div>
  );
}
