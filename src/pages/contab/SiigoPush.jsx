import { useEffect, useState } from 'react';
import { listPushable } from '../../lib/contab.js';
import { callFunction } from '../../lib/functions.js';
import { formatCOP, formatDate } from '../../lib/format.js';
import { Spinner, EmptyState, useToast } from '../../components/ui.jsx';
import { IcSend } from '../../components/Icons.jsx';

function PushBadge({ push }) {
  if (!push) return <span className="fc-badge borrador">Sin enviar</span>;
  if (push.status === 'success') return <span className="fc-badge aprobado">Enviado #{push.siigo_document_id}</span>;
  if (push.status === 'dry_run') return <span className="fc-badge en_revision">Simulado (DRY_RUN)</span>;
  if (push.status === 'error') return <span className="fc-badge rechazado">Error</span>;
  return <span className="fc-badge borrador">{push.status}</span>;
}

export default function SiigoPush() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [pushing, setPushing] = useState({});

  const load = () => { setRows(null); listPushable().then(setRows).catch(() => setRows([])); };
  useEffect(load, []);

  async function push(id) {
    setPushing((p) => ({ ...p, [id]: true }));
    try {
      const r = await callFunction('siigo-push', { expense_id: id });
      toast.show(r.dryRun ? 'Simulado (DRY_RUN): payload registrado' : r.alreadyPushed ? 'Ya estaba enviado' : `Enviado a Siigo #${r.siigo_document_id}`, 'ok');
      load();
    } catch (e) { toast.show(e.message, 'err'); }
    finally { setPushing((p) => ({ ...p, [id]: false })); }
  }

  return (
    <div>
      <div className="fc-eyebrow">Contabilidad</div>
      <div className="fc-page-title" style={{ marginBottom: 8 }}>Envío a Siigo</div>
      <div className="fc-help-text" style={{ marginBottom: 'var(--fc-space-5)' }}>
        Un documento soporte por gasto. Con DRY_RUN activo se simula sin enviar. La clasificación
        contable (retenciones, cuentas) se completa en una fase posterior.
      </div>

      {rows === null ? <Spinner full />
        : rows.length === 0 ? <EmptyState icon={<IcSend size={40} />} title="Nada por enviar" sub="No hay gastos aprobados o pagados." />
          : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr><th>Operario</th><th>Categoría</th><th>Fecha</th><th>Monto</th><th>Proveedor</th><th>Estado Siigo</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td>{e.users?.nombre}</td>
                      <td>{e.expense_categories?.nombre}</td>
                      <td className="fc-td-mono">{formatDate(e.fecha_gasto)}</td>
                      <td className="fc-td-mono">{formatCOP(e.monto)}</td>
                      <td>{e.proveedor_nombre || <span className="fc-text-mute">—</span>}</td>
                      <td><PushBadge push={e.push} /></td>
                      <td>
                        <button className="fc-btn fc-btn-navy" disabled={pushing[e.id] || e.push?.status === 'success'}
                          onClick={() => push(e.id)}>
                          {pushing[e.id] ? 'Enviando…' : e.push?.status === 'error' ? 'Reintentar' : 'Enviar'}
                        </button>
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
