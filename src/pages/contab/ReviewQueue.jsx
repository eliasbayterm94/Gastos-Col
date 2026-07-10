import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReviewQueue, bulkApprove } from '../../lib/contab.js';
import { formatCOP, formatDate, parseCOP } from '../../lib/format.js';
import { StatusBadge, PendienteBadge, Spinner, EmptyState, Sheet, useToast } from '../../components/ui.jsx';
import { IcInbox } from '../../components/Icons.jsx';

const THKEY = 'fc_bulk_threshold';

export default function ReviewQueue() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem(THKEY)) || 50000);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => { setRows(null); listReviewQueue().then(setRows).catch(() => setRows([])); };
  useEffect(load, []);

  const eligibles = (rows || []).filter((r) => r.monto <= threshold);

  async function doBulk() {
    setBusy(true);
    try {
      await bulkApprove(eligibles);
      toast.show(`${eligibles.length} gastos aprobados`, 'ok');
      setConfirming(false); load();
    } catch (e) { toast.show(e.message, 'err'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="fc-eyebrow">Contabilidad</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-5)' }}>Cola de revisión</div>

      <div className="fc-toolbar">
        <label className="fc-label" style={{ margin: 0 }}>Aprobación masiva ≤</label>
        <div className="fc-amount" style={{ width: 160 }}>
          <span className="prefix">$</span>
          <input className="fc-input" inputMode="numeric" value={threshold}
            onChange={(e) => { const v = parseCOP(e.target.value) || 0; setThreshold(v); localStorage.setItem(THKEY, v); }} />
        </div>
        <button className="fc-btn fc-btn-navy" disabled={!eligibles.length}
          onClick={() => setConfirming(true)}>
          Aprobar {eligibles.length} ≤ {formatCOP(threshold)}
        </button>
      </div>

      {rows === null ? <Spinner full />
        : rows.length === 0 ? <EmptyState icon={<IcInbox size={40} />} title="Nada por revisar" sub="La cola está vacía." />
          : (
            <div className="fc-list">
              {rows.map((e) => (
                <button className="fc-row-card" key={e.id} onClick={() => navigate(`/c/revision/${e.id}`)}>
                  <div className="fc-row-main">
                    <div className="fc-row-title">{e.users?.nombre} · {e.expense_categories?.nombre}</div>
                    <div className="fc-row-sub">
                      {formatDate(e.fecha_gasto)}{e.proveedor_nombre ? ` · ${e.proveedor_nombre}` : ''} · {e.file_attachments?.length || 0} soporte(s)
                    </div>
                  </div>
                  <div className="fc-row-right">
                    <div className="fc-row-amount">{formatCOP(e.monto)}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {e.soporte_pendiente && <PendienteBadge />}
                      <StatusBadge estado={e.estado} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

      {confirming && (
        <Sheet title="Confirmar aprobación masiva" onClose={() => setConfirming(false)}>
          <p className="fc-body-text">
            Se aprobarán <strong>{eligibles.length}</strong> gastos con monto ≤ {formatCOP(threshold)}.
          </p>
          <div className="fc-stack" style={{ marginTop: 16 }}>
            <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy} onClick={doBulk}>
              {busy ? 'Aprobando…' : 'Confirmar'}
            </button>
            <button className="fc-btn fc-btn-ghost fc-btn-block" onClick={() => setConfirming(false)}>Cancelar</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
