import { useEffect, useMemo, useState } from 'react';
import { listOperarios, listApprovedUnpaid, listActiveAnticiposFor, createClosure } from '../../lib/contab.js';
import { callFunction } from '../../lib/functions.js';
import { closurePreview } from '../../lib/money.js';
import { formatCOP, formatDate, SALDO_LABEL, METODO_LABEL } from '../../lib/format.js';
import { Spinner, EmptyState, useToast } from '../../components/ui.jsx';
import { IcReceipt } from '../../components/Icons.jsx';

export default function Closures() {
  const toast = useToast();
  const [operarios, setOperarios] = useState([]);
  const [userId, setUserId] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [selected, setSelected] = useState({});      // id -> bool
  const [anticipoId, setAnticipoId] = useState('');
  const [metodo, setMetodo] = useState('transferencia');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { listOperarios().then(setOperarios).catch(() => {}); }, []);

  async function pickOperario(uid) {
    setUserId(uid); setAnticipoId(''); setObs('');
    if (!uid) { setExpenses([]); setAnticipos([]); setSelected({}); return; }
    setLoading(true);
    try {
      const [exp, ant] = await Promise.all([listApprovedUnpaid(uid), listActiveAnticiposFor(uid)]);
      setExpenses(exp); setAnticipos(ant);
      setSelected(Object.fromEntries(exp.map((e) => [e.id, true])));
    } finally { setLoading(false); }
  }

  const chosen = useMemo(() => expenses.filter((e) => selected[e.id]), [expenses, selected]);
  const anticipoMonto = anticipoId ? (anticipos.find((a) => a.id === anticipoId)?.monto ?? null) : null;
  const preview = chosen.length ? closurePreview(chosen.map((e) => ({ monto: e.monto })), anticipoMonto) : null;

  async function confirm() {
    if (!chosen.length) return toast.show('Selecciona al menos un gasto', 'err');
    setBusy(true);
    try {
      const closure = await createClosure({
        user_id: userId, expense_ids: chosen.map((e) => e.id),
        anticipo_id: anticipoId || null, metodo_pago: metodo, observaciones: obs,
      });
      // Notificación al operario (best-effort; EMAIL_DRY_RUN por defecto).
      try { await callFunction('notify-closure', { closure_id: closure.id }); } catch { /* ignore */ }
      toast.show('Cierre creado', 'ok');
      pickOperario(userId);
    } catch (e) { toast.show(e.message, 'err'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="fc-eyebrow">Contabilidad</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-5)' }}>Cierres</div>

      <div className="fc-field" style={{ maxWidth: 360 }}>
        <label className="fc-label">Operario</label>
        <select className="fc-select" value={userId} onChange={(e) => pickOperario(e.target.value)}>
          <option value="">Selecciona…</option>
          {operarios.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>

      {!userId ? (
        <EmptyState icon={<IcReceipt size={40} />} title="Elige un operario" sub="Para ver sus gastos aprobados por cerrar." />
      ) : loading ? <Spinner full />
        : (
          <div className="fc-review-grid">
            <div>
              <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Gastos aprobados sin cerrar</div>
              {expenses.length === 0 ? <div className="fc-help-text">No hay gastos aprobados pendientes.</div>
                : (
                  <div className="fc-list">
                    {expenses.map((e) => (
                      <label className="fc-row-card" key={e.id} style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!selected[e.id]}
                          onChange={() => setSelected((s) => ({ ...s, [e.id]: !s[e.id] }))}
                          style={{ width: 20, height: 20 }} />
                        <div className="fc-row-main">
                          <div className="fc-row-title">{e.expense_categories?.nombre}</div>
                          <div className="fc-row-sub">{formatDate(e.fecha_gasto)}{e.anticipo_id ? ' · con anticipo' : ''}</div>
                        </div>
                        <div className="fc-row-amount">{formatCOP(e.monto)}</div>
                      </label>
                    ))}
                  </div>
                )}
            </div>

            {/* Resumen del cierre */}
            <div>
              <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Resumen del cierre</div>
              <div className="fc-stat-card">
                <div className="fc-field">
                  <label className="fc-label">Liquidar anticipo</label>
                  <select className="fc-select" value={anticipoId} onChange={(e) => setAnticipoId(e.target.value)}>
                    <option value="">Sin anticipo</option>
                    {anticipos.map((a) => <option key={a.id} value={a.id}>{formatCOP(a.monto)} — {a.descripcion || formatDate(a.fecha)}</option>)}
                  </select>
                </div>

                <div className="fc-divider" />
                <SumRow label="Total gastos" value={formatCOP(preview?.totalGastos || 0)} />
                <SumRow label="Anticipo aplicado" value={formatCOP(preview?.anticipoAplicado || 0)} />
                <SumRow label="Saldo" value={formatCOP(preview?.saldo || 0)} strong />
                {preview && (
                  <div className={`fc-badge ${preview.direccion === 'a_favor_operario' ? 'aprobado' : preview.direccion === 'a_favor_forest' ? 'pendiente' : 'liquidado'}`}
                    style={{ marginTop: 10 }}>
                    {SALDO_LABEL[preview.direccion]}
                  </div>
                )}

                <div className="fc-field" style={{ marginTop: 16 }}>
                  <label className="fc-label">Método de pago</label>
                  <select className="fc-select" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                    {Object.entries(METODO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="fc-field">
                  <label className="fc-label">Observaciones</label>
                  <textarea className="fc-textarea" value={obs} onChange={(e) => setObs(e.target.value)} />
                </div>

                <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy || !chosen.length} onClick={confirm}>
                  {busy ? 'Cerrando…' : `Cerrar ${chosen.length} gasto(s)`}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

function SumRow({ label, value, strong }) {
  return (
    <div className="fc-row-between" style={{ padding: '6px 0' }}>
      <span className="fc-small">{label}</span>
      <span className="fc-mono" style={{ fontWeight: strong ? 700 : 500, fontSize: strong ? 18 : 14 }}>{value}</span>
    </div>
  );
}
