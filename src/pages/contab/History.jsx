import { useEffect, useState } from 'react';
import { listExpenseHistory, recoverExpense } from '../../lib/contab.js';
import { formatCOP, formatDate } from '../../lib/format.js';
import { StatusBadge, SinFacturaBadge, Spinner, EmptyState, useToast } from '../../components/ui.jsx';
import { IcInbox } from '../../components/Icons.jsx';

const FILTERS = [
  { key: 'rechazado', label: 'Rechazados' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'pagado', label: 'Pagados' },
  { key: '', label: 'Todos' },
];

export default function History() {
  const toast = useToast();
  const [estado, setEstado] = useState('rechazado');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState({});

  const load = () => { setRows(null); listExpenseHistory(estado || undefined).then(setRows).catch(() => setRows([])); };
  useEffect(load, [estado]);

  async function recover(id) {
    setBusy((b) => ({ ...b, [id]: true }));
    try { await recoverExpense(id); toast.show('Gasto recuperado — vuelve a la cola de revisión', 'ok'); load(); }
    catch (e) { toast.show(e.message, 'err'); setBusy((b) => ({ ...b, [id]: false })); }
  }

  return (
    <div>
      <div className="fc-eyebrow">Contabilidad</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-4)' }}>Historial de gastos</div>

      <div className="fc-filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`fc-chip${estado === f.key ? ' active' : ''}`} onClick={() => setEstado(f.key)}>{f.label}</button>
        ))}
      </div>

      {rows === null ? <Spinner full />
        : rows.length === 0 ? <EmptyState icon={<IcInbox size={40} />} title="Sin registros" sub="No hay gastos para este filtro." />
          : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead><tr><th>Operario</th><th>Categoría</th><th>Fecha</th><th>Monto</th><th>Estado</th><th>Motivo rechazo</th><th></th></tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td>{e.users?.nombre}</td>
                      <td>{e.expense_categories?.nombre}{e.sin_soporte ? ' · ' : ''}{e.sin_soporte && <SinFacturaBadge />}</td>
                      <td className="fc-td-mono">{formatDate(e.fecha_gasto)}</td>
                      <td className="fc-td-mono">{formatCOP(e.monto)}</td>
                      <td><StatusBadge estado={e.estado} /></td>
                      <td className="fc-small">{e.estado === 'rechazado' ? (e.motivo_rechazo || '—') : ''}</td>
                      <td>
                        {e.estado === 'rechazado' && (
                          <button className="fc-btn fc-btn-navy" disabled={busy[e.id]} onClick={() => recover(e.id)}>
                            {busy[e.id] ? '…' : 'Recuperar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}
