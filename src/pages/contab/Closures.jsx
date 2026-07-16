import { useEffect, useMemo, useState } from 'react';
import {
  listClosureCandidates, createClosureAuto, listAllClosures,
} from '../../lib/contab.js';
import { callFunction } from '../../lib/functions.js';
import { toCSV, downloadCSV, copyTSV } from '../../lib/exportTable.js';
import { formatCOP, formatDate, SALDO_LABEL, METODO_LABEL } from '../../lib/format.js';
import { Spinner, EmptyState, Sheet, useToast } from '../../components/ui.jsx';
import { IcReceipt } from '../../components/Icons.jsx';

const PAY_HEADERS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'email', label: 'Correo' },
  { key: 'aPagar', label: 'Valor a pagar' },
];

export default function Closures() {
  const [tab, setTab] = useState('por_cerrar');
  return (
    <div>
      <div className="fc-eyebrow">Contabilidad</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-4)' }}>Cierres</div>
      <div className="fc-filters">
        <button className={`fc-chip${tab === 'por_cerrar' ? ' active' : ''}`} onClick={() => setTab('por_cerrar')}>Por cerrar</button>
        <button className={`fc-chip${tab === 'historial' ? ' active' : ''}`} onClick={() => setTab('historial')}>Historial de cierres</button>
      </div>
      {tab === 'por_cerrar' ? <PorCerrar /> : <Historial />}
    </div>
  );
}

function PorCerrar() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState({});
  const [preview, setPreview] = useState(false);
  const [metodo, setMetodo] = useState('transferencia');
  const [busy, setBusy] = useState(false);

  const load = () => { setRows(null); setSel({}); listClosureCandidates().then(setRows).catch(() => setRows([])); };
  useEffect(load, []);

  const chosen = useMemo(() => (rows || []).filter((r) => sel[r.user_id]), [rows, sel]);
  const payRows = chosen.map((c) => ({ nombre: c.nombre, email: c.email, aPagar: Math.max(0, c.saldo), saldo: c.saldo }));
  const totalPagar = payRows.reduce((a, r) => a + r.aPagar, 0);
  const allChecked = rows && rows.length > 0 && chosen.length === rows.length;

  async function confirm() {
    setBusy(true);
    let ok = 0;
    for (const c of chosen) {
      try {
        const cl = await createClosureAuto(c.user_id, metodo, null);
        ok += 1;
        try { await callFunction('notify-closure', { closure_id: cl.id }); } catch { /* best-effort */ }
      } catch (e) { toast.show(`${c.nombre}: ${e.message}`, 'err'); }
    }
    setBusy(false); setPreview(false);
    toast.show(`${ok} cierre(s) generado(s)`, 'ok');
    load();
  }

  const exportRows = () =>
    payRows.map((r) => ({ nombre: r.nombre, email: r.email, aPagar: r.aPagar }));

  if (rows === null) return <Spinner full />;
  if (rows.length === 0) {
    return <EmptyState icon={<IcReceipt size={40} />} title="Nada por cerrar" sub="No hay operarios con gastos aprobados pendientes." />;
  }

  return (
    <div>
      <div className="fc-toolbar">
        <span className="fc-small">{chosen.length} seleccionado(s)</span>
        <button className="fc-btn fc-btn-primary" disabled={!chosen.length} onClick={() => setPreview(true)}>
          Generar cierre ({chosen.length})
        </button>
      </div>

      <div className="fc-table-wrap">
        <table className="fc-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allChecked}
                  onChange={(e) => setSel(e.target.checked ? Object.fromEntries(rows.map((r) => [r.user_id, true])) : {})}
                  style={{ width: 18, height: 18 }} />
              </th>
              <th>Operario</th><th>Anticipo</th><th># Gastos</th><th>Sin factura</th>
              <th>Total gastos</th><th>A pagar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td><input type="checkbox" checked={!!sel[r.user_id]}
                  onChange={() => setSel((s) => ({ ...s, [r.user_id]: !s[r.user_id] }))} style={{ width: 18, height: 18 }} /></td>
                <td>{r.nombre}</td>
                <td className="fc-td-mono">{r.anticipo_total > 0 ? formatCOP(r.anticipo_total) : '—'}</td>
                <td className="fc-td-mono">{r.n_gastos}</td>
                <td className="fc-td-mono">{r.n_sin_factura || '—'}</td>
                <td className="fc-td-mono">{formatCOP(r.total_gastos)}</td>
                <td className="fc-td-mono" style={{ color: r.saldo < 0 ? 'var(--fc-danger)' : 'var(--fc-success)' }}>
                  {r.saldo < 0 ? `Devuelve ${formatCOP(-r.saldo)}` : formatCOP(r.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview && (
        <Sheet title="Resumen del cierre" onClose={() => setPreview(false)}>
          <div className="fc-table-wrap" style={{ marginBottom: 14 }}>
            <table className="fc-table">
              <thead><tr><th>Operario</th><th>Valor a pagar</th></tr></thead>
              <tbody>
                {payRows.map((r) => (
                  <tr key={r.email}>
                    <td>{r.nombre}</td>
                    <td className="fc-td-mono">{r.saldo < 0 ? `Devuelve ${formatCOP(-r.saldo)}` : formatCOP(r.aPagar)}</td>
                  </tr>
                ))}
                <tr><td style={{ fontWeight: 700 }}>Total a pagar</td>
                  <td className="fc-td-mono" style={{ fontWeight: 700 }}>{formatCOP(totalPagar)}</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button className="fc-btn fc-btn-ghost" style={{ flex: 1 }}
              onClick={() => downloadCSV('pagos_cierre.csv', toCSV(exportRows(), PAY_HEADERS))}>
              Descargar CSV
            </button>
            <button className="fc-btn fc-btn-ghost" style={{ flex: 1 }}
              onClick={() => copyTSV(exportRows(), PAY_HEADERS).then(() => toast.show('Copiado', 'ok'))}>
              Copiar tabla
            </button>
          </div>

          <div className="fc-field">
            <label className="fc-label">Método de pago</label>
            <select className="fc-select" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {Object.entries(METODO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy} onClick={confirm}>
            {busy ? 'Cerrando…' : `Confirmar y cerrar ${chosen.length} operario(s)`}
          </button>
        </Sheet>
      )}
    </div>
  );
}

function Historial() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  useEffect(() => { listAllClosures().then(setRows).catch(() => setRows([])); }, []);

  if (rows === null) return <Spinner full />;
  if (rows.length === 0) return <EmptyState icon={<IcReceipt size={40} />} title="Sin cierres" sub="Aún no se han generado cierres." />;

  const exportAll = () => {
    const headers = [
      { key: 'nombre', label: 'Operario' }, { key: 'fecha', label: 'Fecha' },
      { key: 'total', label: 'Total gastos' }, { key: 'saldo', label: 'Saldo' },
    ];
    const data = rows.map((c) => ({ nombre: c.users?.nombre, fecha: c.fecha, total: c.total_gastos, saldo: c.saldo }));
    downloadCSV('historial_cierres.csv', toCSV(data, headers));
  };

  return (
    <div>
      <div className="fc-toolbar">
        <button className="fc-btn fc-btn-ghost" onClick={exportAll}>Descargar CSV</button>
      </div>
      <div className="fc-table-wrap">
        <table className="fc-table">
          <thead><tr><th>Fecha</th><th>Operario</th><th>Total</th><th>Anticipo</th><th>Saldo</th><th>Resultado</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="fc-td-mono">{formatDate(c.fecha)}</td>
                <td>{c.users?.nombre}{c.reopened ? ' · (reabierto)' : ''}</td>
                <td className="fc-td-mono">{formatCOP(c.total_gastos)}</td>
                <td className="fc-td-mono">{c.anticipo_aplicado > 0 ? formatCOP(c.anticipo_aplicado) : '—'}</td>
                <td className="fc-td-mono">{formatCOP(c.saldo)}</td>
                <td className="fc-small">{SALDO_LABEL[c.saldo_direccion]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
