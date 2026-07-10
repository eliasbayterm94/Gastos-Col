import { useEffect, useState } from 'react';
import {
  listTypesAll, listCategoriesAll, listLocationsAll,
  upsertType, upsertCategory, upsertLocation,
} from '../../lib/admin.js';
import { Spinner, Sheet, useToast } from '../../components/ui.jsx';
import { IcPlus } from '../../components/Icons.jsx';

const TABS = [['tipos', 'Tipos'], ['categorias', 'Categorías'], ['ubicaciones', 'Ubicaciones']];

export default function Catalogs() {
  const toast = useToast();
  const [tab, setTab] = useState('tipos');
  const [types, setTypes] = useState([]);
  const [cats, setCats] = useState([]);
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // {kind, row}

  async function load() {
    setLoading(true);
    const [t, c, l] = await Promise.all([listTypesAll(), listCategoriesAll(), listLocationsAll()]);
    setTypes(t); setCats(c); setLocs(l); setLoading(false);
  }
  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  async function toggleActive(kind, row) {
    const fn = kind === 'tipos' ? upsertType : kind === 'categorias' ? upsertCategory : upsertLocation;
    try { await fn({ id: row.id, active: !row.active }); load(); }
    catch (e) { toast.show(e.message, 'err'); }
  }

  return (
    <div>
      <div className="fc-eyebrow">Administrador</div>
      <div className="fc-page-title" style={{ marginBottom: 'var(--fc-space-5)' }}>Catálogos</div>

      <div className="fc-filters">
        {TABS.map(([k, v]) => <button key={k} className={`fc-chip${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{v}</button>)}
        <button className="fc-btn fc-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing({ kind: tab, row: {} })}>
          <IcPlus size={16} /> Nuevo
        </button>
      </div>

      {loading ? <Spinner full /> : (
        <div className="fc-table-wrap">
          {tab === 'tipos' && (
            <CatalogTable rows={types} cols={['Nombre', 'Estado']}
              render={(r) => [r.nombre]} onEdit={(r) => setEditing({ kind: 'tipos', row: r })} onToggle={(r) => toggleActive('tipos', r)} />
          )}
          {tab === 'categorias' && (
            <CatalogTable rows={cats} cols={['Nombre', 'Tipo', 'Estado']}
              render={(r) => [r.nombre, types.find((t) => t.id === r.type_id)?.nombre || '—']}
              onEdit={(r) => setEditing({ kind: 'categorias', row: r })} onToggle={(r) => toggleActive('categorias', r)} />
          )}
          {tab === 'ubicaciones' && (
            <CatalogTable rows={locs} cols={['Nombre', 'Trilladora', 'Estado']}
              render={(r) => [r.nombre, r.is_milling ? 'Sí' : 'No']}
              onEdit={(r) => setEditing({ kind: 'ubicaciones', row: r })} onToggle={(r) => toggleActive('ubicaciones', r)} />
          )}
        </div>
      )}

      {editing && (
        <CatalogEditor kind={editing.kind} row={editing.row} types={types}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); load(); toast.show('Guardado', 'ok'); }} />
      )}
    </div>
  );
}

function CatalogTable({ rows, cols, render, onEdit, onToggle }) {
  return (
    <table className="fc-table">
      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}<th></th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            {render(r).map((v, i) => <td key={i}>{v}</td>)}
            <td><span className={`fc-badge ${r.active ? 'activo' : 'cerrado'}`}>{r.active ? 'Activo' : 'Inactivo'}</span></td>
            <td style={{ display: 'flex', gap: 8 }}>
              <button className="fc-btn fc-btn-ghost" onClick={() => onEdit(r)}>Editar</button>
              <button className="fc-btn fc-btn-ghost" onClick={() => onToggle(r)}>{r.active ? 'Desactivar' : 'Activar'}</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CatalogEditor({ kind, row, types, onClose, onDone }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(row.nombre || '');
  const [typeId, setTypeId] = useState(row.type_id || (types[0]?.id ?? ''));
  const [isMilling, setIsMilling] = useState(!!row.is_milling);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!nombre.trim()) return toast.show('El nombre es obligatorio', 'err');
    setBusy(true);
    try {
      if (kind === 'tipos') await upsertType({ id: row.id, nombre });
      else if (kind === 'categorias') await upsertCategory({ id: row.id, nombre, type_id: typeId });
      else await upsertLocation({ id: row.id, nombre, is_milling: isMilling });
      onDone();
    } catch (e) { toast.show(e.message, 'err'); setBusy(false); }
  }

  const title = row.id ? 'Editar' : 'Nuevo';
  return (
    <Sheet title={`${title} ${kind === 'tipos' ? 'tipo' : kind === 'categorias' ? 'categoría' : 'ubicación'}`} onClose={onClose}>
      <div className="fc-field">
        <label className="fc-label">Nombre <span className="req">*</span></label>
        <input className="fc-input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </div>
      {kind === 'categorias' && (
        <div className="fc-field">
          <label className="fc-label">Tipo</label>
          <select className="fc-select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
      )}
      {kind === 'ubicaciones' && (
        <label className="fc-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={isMilling} onChange={(e) => setIsMilling(e.target.checked)} style={{ width: 20, height: 20 }} />
          <span className="fc-label" style={{ margin: 0 }}>Es una trilladora</span>
        </label>
      )}
      <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy} onClick={submit}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
    </Sheet>
  );
}
