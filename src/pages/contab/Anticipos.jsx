import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext.jsx';
import { listAnticiposWithBalances, listOperarios, createAnticipo } from '../../lib/contab.js';
import { formatCOP, formatDate, parseCOP, bogotaToday, METODO_LABEL } from '../../lib/format.js';
import { StatusBadge, Spinner, EmptyState, Sheet, useToast } from '../../components/ui.jsx';
import { IcWallet, IcPlus } from '../../components/Icons.jsx';

function agingDays(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = bogotaToday().split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - then) / 86400000);
}

export default function Anticipos() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [operarios, setOperarios] = useState([]);
  const [creating, setCreating] = useState(false);

  const load = () => { setRows(null); listAnticiposWithBalances().then(setRows).catch(() => setRows([])); };
  useEffect(() => { load(); listOperarios().then(setOperarios).catch(() => {}); }, []);

  return (
    <div>
      <div className="fc-row-between" style={{ marginBottom: 'var(--fc-space-5)' }}>
        <div>
          <div className="fc-eyebrow">Contabilidad</div>
          <div className="fc-page-title">Anticipos</div>
        </div>
        <button className="fc-btn fc-btn-primary" onClick={() => setCreating(true)}><IcPlus size={16} /> Nuevo anticipo</button>
      </div>

      {rows === null ? <Spinner full />
        : rows.length === 0 ? <EmptyState icon={<IcWallet size={40} />} title="Sin anticipos" sub="Crea el primer anticipo." />
          : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Operario</th><th>Fecha</th><th>Anticipo</th><th>Aplicado</th><th>Saldo</th><th>Antigüedad</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const saldo = a.balance?.saldo ?? a.monto;
                    const aplicado = a.balance?.gastos_aplicados ?? 0;
                    const age = a.estado === 'activo' ? agingDays(a.fecha) : null;
                    return (
                      <tr key={a.id}>
                        <td>{a.users?.nombre}</td>
                        <td className="fc-td-mono">{formatDate(a.fecha)}</td>
                        <td className="fc-td-mono">{formatCOP(a.monto)}</td>
                        <td className="fc-td-mono">{formatCOP(aplicado)}</td>
                        <td className="fc-td-mono" style={{ color: saldo < 0 ? 'var(--fc-danger)' : 'var(--fc-success)' }}>{formatCOP(saldo)}</td>
                        <td className="fc-td-mono">{age === null ? '—' : `${age} d`}</td>
                        <td><StatusBadge estado={a.estado} kind="anticipo" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

      {creating && (
        <NewAnticipo operarios={operarios} createdBy={user.id}
          onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); load(); toast.show('Anticipo creado', 'ok'); }} />
      )}
    </div>
  );
}

function NewAnticipo({ operarios, createdBy, onClose, onDone }) {
  const toast = useToast();
  const [userId, setUserId] = useState('');
  const [montoText, setMontoText] = useState('');
  const [fecha, setFecha] = useState(bogotaToday());
  const [metodo, setMetodo] = useState('transferencia');
  const [descripcion, setDescripcion] = useState('');
  const [busy, setBusy] = useState(false);
  const monto = parseCOP(montoText);

  async function submit() {
    if (!userId) return toast.show('Selecciona el operario', 'err');
    if (!monto || monto <= 0) return toast.show('Monto inválido', 'err');
    setBusy(true);
    try {
      await createAnticipo({ user_id: userId, monto, fecha, metodo_entrega: metodo, descripcion, created_by: createdBy });
      onDone();
    } catch (e) { toast.show(e.message, 'err'); setBusy(false); }
  }

  return (
    <Sheet title="Nuevo anticipo" onClose={onClose}>
      <div className="fc-field">
        <label className="fc-label">Operario <span className="req">*</span></label>
        <select className="fc-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Selecciona…</option>
          {operarios.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>
      <div className="fc-field">
        <label className="fc-label">Monto <span className="req">*</span></label>
        <div className="fc-amount"><span className="prefix">$</span>
          <input className="fc-input" inputMode="numeric" value={montoText} onChange={(e) => setMontoText(e.target.value)} />
        </div>
        {monto > 0 && <div className="fc-help-text">{formatCOP(monto)}</div>}
      </div>
      <div className="fc-field">
        <label className="fc-label">Fecha</label>
        <input className="fc-input" type="date" value={fecha} max={bogotaToday()} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <div className="fc-field">
        <label className="fc-label">Método de entrega</label>
        <select className="fc-select" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
          {Object.entries(METODO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="fc-field">
        <label className="fc-label">Descripción</label>
        <input className="fc-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Compra Huila semana 12" />
      </div>
      <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy} onClick={submit}>
        {busy ? 'Creando…' : 'Crear anticipo'}
      </button>
    </Sheet>
  );
}
