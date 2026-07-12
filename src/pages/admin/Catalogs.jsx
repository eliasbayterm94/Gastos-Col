import { useEffect, useState } from 'react';
import {
  listTypesAll, listCategoriesAll, listLocationsAll, listAreasAll, listRegionsAll,
  upsertType, upsertCategory, upsertLocation, upsertArea, upsertRegion,
} from '../../lib/admin.js';
import { Spinner, Sheet, useToast } from '../../components/ui.jsx';
import { IcPlus } from '../../components/Icons.jsx';

const TABS = [
  ['tipos', 'Tipos'], ['categorias', 'Categorías'], ['ubicaciones', 'Ubicaciones'],
  ['areas', 'Áreas'], ['regiones', 'Regiones'],
];
const UPSERT = {
  tipos: upsertType, categorias: upsertCategory, ubicaciones: upsertLocation,
  areas: upsertArea, regiones: upsertRegion,
};
const SINGULAR = { tipos: 'tipo', categorias: 'categoría', ubicaciones: 'ubicación', areas: 'área', regiones: 'región' };

export default function Catalogs() {
  const toast = useToast();
  const [tab, setTab] = useState('tipos');
  const [data, setData] = useState({ tipos: [], categorias: [], ubicaciones: [], areas: [], regiones: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // {kind, row}

  async function load() {
    setLoading(true);
    const [tipos, categorias, ubicaciones, areas, regiones] = await Promise.all([
      listTypesAll(), listCategoriesAll(), listLocationsAll(), listAreasAll(), listRegionsAll(),
    ]);
    setData({ tipos, categorias, ubicaciones, areas, regiones });
    setLoading(false);
  }
  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  async function toggleActive(kind, row) {
    try { await UPSERT[kind]({ id: row.id, active: !row.active }); load(); }
    catch (e) { toast.show(e.message, 'err'); }
  }

  const rows = data[tab];

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
          <table className="fc-table">
            <thead>
              <tr>
                <th>Nombre</th>
                {tab === 'tipos' && <th>Pide región</th>}
                {tab === 'ubicaciones' && <th>Trilladora</th>}
                <th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.nombre}</td>
                  {tab === 'tipos' && <td>{r.is_client ? 'Sí (cliente)' : 'No'}</td>}
                  {tab === 'ubicaciones' && <td>{r.is_milling ? 'Sí' : 'No'}</td>}
                  <td><span className={`fc-badge ${r.active ? 'activo' : 'cerrado'}`}>{r.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="fc-btn fc-btn-ghost" onClick={() => setEditing({ kind: tab, row: r })}>Editar</button>
                    <button className="fc-btn fc-btn-ghost" onClick={() => toggleActive(tab, r)}>{r.active ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="fc-help-text" style={{ padding: 20 }}>Sin registros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CatalogEditor kind={editing.kind} row={editing.row}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); load(); toast.show('Guardado', 'ok'); }} />
      )}
    </div>
  );
}

function CatalogEditor({ kind, row, onClose, onDone }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(row.nombre || '');
  const [isMilling, setIsMilling] = useState(!!row.is_milling);
  const [isClient, setIsClient] = useState(!!row.is_client);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!nombre.trim()) return toast.show('El nombre es obligatorio', 'err');
    setBusy(true);
    try {
      const base = { id: row.id, nombre: nombre.trim() };
      if (kind === 'tipos') base.is_client = isClient;
      if (kind === 'ubicaciones') base.is_milling = isMilling;
      await UPSERT[kind](base);
      onDone();
    } catch (e) { toast.show(e.message, 'err'); setBusy(false); }
  }

  return (
    <Sheet title={`${row.id ? 'Editar' : 'Nuevo'} ${SINGULAR[kind]}`} onClose={onClose}>
      <div className="fc-field">
        <label className="fc-label">Nombre <span className="req">*</span></label>
        <input className="fc-input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </div>
      {kind === 'tipos' && (
        <label className="fc-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={isClient} onChange={(e) => setIsClient(e.target.checked)} style={{ width: 20, height: 20 }} />
          <span className="fc-label" style={{ margin: 0 }}>Es un gasto de cliente (pide región)</span>
        </label>
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
