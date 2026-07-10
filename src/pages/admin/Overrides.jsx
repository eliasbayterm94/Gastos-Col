import { useEffect, useState } from 'react';
import { listPagadoExpenses, adminUpdateExpense, adminDeleteExpense, listClosures, reopenClosure } from '../../lib/admin.js';
import { formatCOP, formatDate, parseCOP, SALDO_LABEL } from '../../lib/format.js';
import { Spinner, Sheet, useToast } from '../../components/ui.jsx';

export default function Overrides() {
  const toast = useToast();
  const [tab, setTab] = useState('pagados');
  const [expenses, setExpenses] = useState(null);
  const [closures, setClosures] = useState(null);
  const [modal, setModal] = useState(null); // {type, row}

  const load = () => {
    setExpenses(null); setClosures(null);
    listPagadoExpenses().then(setExpenses).catch(() => setExpenses([]));
    listClosures().then(setClosures).catch(() => setClosures([]));
  };
  useEffect(load, []);

  return (
    <div>
      <div className="fc-eyebrow">Administrador</div>
      <div className="fc-page-title" style={{ marginBottom: 8 }}>Overrides</div>
      <div className="fc-help-text" style={{ marginBottom: 'var(--fc-space-5)' }}>
        Acciones sensibles sobre registros cerrados. Cada acción exige motivo y queda en la auditoría.
      </div>

      <div className="fc-filters">
        <button className={`fc-chip${tab === 'pagados' ? ' active' : ''}`} onClick={() => setTab('pagados')}>Gastos pagados</button>
        <button className={`fc-chip${tab === 'cierres' ? ' active' : ''}`} onClick={() => setTab('cierres')}>Cierres</button>
      </div>

      {tab === 'pagados' ? (
        expenses === null ? <Spinner full /> : (
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead><tr><th>Operario</th><th>Categoría</th><th>Fecha</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.users?.nombre}</td><td>{e.expense_categories?.nombre}</td>
                    <td className="fc-td-mono">{formatDate(e.fecha_gasto)}</td>
                    <td className="fc-td-mono">{formatCOP(e.monto)}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="fc-btn fc-btn-ghost" onClick={() => setModal({ type: 'edit', row: e })}>Editar</button>
                      <button className="fc-btn fc-btn-danger" onClick={() => setModal({ type: 'delete', row: e })}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        closures === null ? <Spinner full /> : (
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead><tr><th>Operario</th><th>Fecha</th><th>Total</th><th>Saldo</th><th></th></tr></thead>
              <tbody>
                {closures.map((c) => (
                  <tr key={c.id}>
                    <td>{c.users?.nombre}</td>
                    <td className="fc-td-mono">{formatDate(c.fecha)}</td>
                    <td className="fc-td-mono">{formatCOP(c.total_gastos)}</td>
                    <td className="fc-td-mono">{formatCOP(c.saldo)} {c.reopened ? '· (reabierto)' : ''}</td>
                    <td><button className="fc-btn fc-btn-ghost" onClick={() => setModal({ type: 'reopen', row: c })}>Reabrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {modal && <OverrideModal {...modal} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); toast.show('Hecho', 'ok'); }} />}
    </div>
  );
}

function OverrideModal({ type, row, onClose, onDone }) {
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [montoText, setMontoText] = useState(type === 'edit' ? String(row.monto) : '');
  const [descripcion, setDescripcion] = useState(row.descripcion || '');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!motivo.trim()) return toast.show('El motivo es obligatorio', 'err');
    setBusy(true);
    try {
      if (type === 'edit') {
        const patch = { descripcion };
        const m = parseCOP(montoText);
        if (m && m > 0) patch.monto = m;
        await adminUpdateExpense(row.id, patch, motivo.trim());
      } else if (type === 'delete') {
        await adminDeleteExpense(row.id, motivo.trim());
      } else {
        await reopenClosure(row.id, motivo.trim());
      }
      onDone();
    } catch (e) { toast.show(e.message, 'err'); setBusy(false); }
  }

  const titles = { edit: 'Editar gasto pagado', delete: 'Eliminar gasto', reopen: 'Reabrir cierre' };
  return (
    <Sheet title={titles[type]} onClose={onClose}>
      {type === 'edit' && (
        <>
          <div className="fc-field">
            <label className="fc-label">Monto</label>
            <div className="fc-amount"><span className="prefix">$</span>
              <input className="fc-input" inputMode="numeric" value={montoText} onChange={(e) => setMontoText(e.target.value)} /></div>
          </div>
          <div className="fc-field">
            <label className="fc-label">Descripción</label>
            <input className="fc-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
        </>
      )}
      {type === 'delete' && <p className="fc-body-text" style={{ marginBottom: 12 }}>Se eliminará el gasto de {formatCOP(row.monto)}. Queda un tombstone en la auditoría.</p>}
      {type === 'reopen' && <p className="fc-body-text" style={{ marginBottom: 12 }}>Los gastos volverán a “aprobado” y el anticipo a “activo”.</p>}
      <div className="fc-field">
        <label className="fc-label">Motivo <span className="req">*</span></label>
        <textarea className="fc-textarea" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
      </div>
      <button className={`fc-btn fc-btn-block fc-btn-lg ${type === 'delete' ? 'fc-btn-danger' : 'fc-btn-primary'}`} disabled={busy} onClick={submit}>
        {busy ? 'Procesando…' : type === 'delete' ? 'Eliminar' : type === 'reopen' ? 'Reabrir' : 'Guardar'}
      </button>
    </Sheet>
  );
}
