import { useEffect, useState } from 'react';
import { listAudit } from '../../lib/admin.js';
import { formatDateTime } from '../../lib/format.js';
import { Spinner, EmptyState } from '../../components/ui.jsx';
import { IcList } from '../../components/Icons.jsx';

const ACTIONS = [
  ['', 'Todas'], ['delete', 'Eliminaciones'], ['override_pagado', 'Ediciones de pagado'], ['reopen_closure', 'Reaperturas'],
];
const ACTION_LABEL = { delete: 'Eliminación', override_pagado: 'Edición pagado', reopen_closure: 'Reapertura' };

export default function AuditLog() {
  const [rows, setRows] = useState(null);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    setRows(null);
    listAudit({ action: action || undefined, from: from || undefined, to: to || undefined })
      .then(setRows).catch(() => setRows([]));
  }, [action, from, to]);

  return (
    <div>
      <div className="fc-eyebrow">Administrador</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-5)' }}>Auditoría</div>

      <div className="fc-toolbar">
        <div className="fc-filters" style={{ margin: 0 }}>
          {ACTIONS.map(([k, v]) => <button key={k} className={`fc-chip${action === k ? ' active' : ''}`} onClick={() => setAction(k)}>{v}</button>)}
        </div>
        <input className="fc-input" type="date" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="fc-small">a</span>
        <input className="fc-input" type="date" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {rows === null ? <Spinner full />
        : rows.length === 0 ? <EmptyState icon={<IcList size={40} />} title="Sin registros" sub="No hay acciones para el filtro." />
          : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Motivo</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="fc-td-mono">{formatDateTime(r.created_at)}</td>
                      <td>{r.actor?.nombre || r.actor?.email || '—'}</td>
                      <td>{ACTION_LABEL[r.action] || r.action}</td>
                      <td className="fc-td-mono">{r.entity_type}</td>
                      <td>{r.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}
