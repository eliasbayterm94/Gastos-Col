import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.jsx';
import { useToast } from '../../components/ui.jsx';
import { IcCamera, IcUpload, IcBack } from '../../components/Icons.jsx';
import { bogotaToday, formatCOP, parseCOP } from '../../lib/format.js';
import {
  getTypes, getCategories, getLocations, getRegions, listMyAnticipos,
  createExpense, updateExpense, uploadAttachment, removeAttachment, setExpenseStatus,
} from '../../lib/api.js';

// existing = null (nuevo) | expense (editar/reenviar). initialAttachments para editar.
export default function ExpenseForm({ existing = null, initialAttachments = [] }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isEdit = Boolean(existing);

  const [types, setTypes] = useState([]);
  const [cats, setCats] = useState([]);
  const [locs, setLocs] = useState([]);
  const [regions, setRegions] = useState([]);
  const [anticipos, setAnticipos] = useState([]);

  const [typeId, setTypeId] = useState(existing?.type_id || '');
  const [categoryId, setCategoryId] = useState(existing?.category_id || '');
  const [fecha, setFecha] = useState(existing?.fecha_gasto || bogotaToday());
  const [montoText, setMontoText] = useState(existing ? String(existing.monto) : '');
  const [proveedor, setProveedor] = useState(existing?.proveedor_nombre || '');
  const [nit, setNit] = useState(existing?.proveedor_nit || '');
  const [descripcion, setDescripcion] = useState(existing?.descripcion || '');
  const [anticipoId, setAnticipoId] = useState(existing?.anticipo_id || '');
  const [locationId, setLocationId] = useState(existing?.location_id || '');
  const [regionId, setRegionId] = useState(existing?.client_region_id || '');

  const [pending, setPending] = useState([]);              // File[] aún no subidos (modo nuevo)
  const [uploaded, setUploaded] = useState(initialAttachments); // adjuntos ya en DB (modo editar)
  const [previews, setPreviews] = useState([]);            // urls locales de pending
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const camRef = useRef(null);

  useEffect(() => {
    getTypes().then(setTypes).catch((e) => { console.error('getTypes', e); toast.show('No se pudieron cargar los tipos', 'err'); });
    getCategories().then(setCats).catch((e) => { console.error('getCategories', e); toast.show('No se pudieron cargar las categorías', 'err'); });
    getLocations().then(setLocs).catch(() => {});
    getRegions().then(setRegions).catch(() => {}); // opcional: silencioso
    if (user) listMyAnticipos(user.id).then((a) => setAnticipos(a.filter((x) => x.estado === 'activo'))).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedType = useMemo(() => types.find((t) => t.id === typeId), [types, typeId]);
  const showRegion = Boolean(selectedType?.is_client);
  const monto = parseCOP(montoText);

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setPending((p) => [...p, ...files]);
    setPreviews((p) => [...p, ...files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null))]);
  }
  function removePending(i) {
    setPending((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  }
  async function removeUploaded(att) {
    try { await removeAttachment(att); setUploaded((u) => u.filter((a) => a.id !== att.id)); }
    catch { toast.show('No se pudo eliminar el soporte', 'err'); }
  }

  function validate() {
    const e = {};
    if (!typeId) e.typeId = 'Selecciona un tipo';
    if (!categoryId) e.categoryId = 'Selecciona una categoría';
    if (!monto || monto <= 0) e.monto = 'Ingresa un monto mayor a 0';
    if (!fecha) e.fecha = 'Ingresa la fecha';
    else if (fecha > bogotaToday()) e.fecha = 'La fecha no puede ser futura';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save(enviar) {
    if (!validate()) { toast.show('Revisa los campos marcados', 'err'); return; }
    setBusy(true);
    try {
      const fields = {
        type_id: typeId, category_id: categoryId, fecha_gasto: fecha, monto,
        proveedor_nombre: proveedor || null, proveedor_nit: nit || null,
        descripcion: descripcion || null, anticipo_id: anticipoId || null,
        location_id: locationId || null,
        client_region_id: showRegion ? (regionId || null) : null,
      };
      let id = existing?.id;
      if (isEdit) await updateExpense(id, fields);
      else id = await createExpense({ ...fields, user_id: user.id, estado: 'borrador' });

      // Subir soportes pendientes (nunca perder una foto: si falla, no continúa).
      for (const file of pending) await uploadAttachment(id, file, user.id);

      const totalSoportes = uploaded.length + pending.length;
      await updateExpense(id, { soporte_pendiente: totalSoportes === 0 });

      if (enviar) {
        await setExpenseStatus(id, 'enviado', isEdit ? 'Reenviado tras corrección' : null);
        toast.show('Gasto enviado', 'ok');
      } else {
        toast.show('Borrador guardado', 'ok');
      }
      navigate('/gastos', { replace: true });
    } catch (err) {
      toast.show(err.message || 'No se pudo guardar', 'err');
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="fc-row-between fc-page-head">
        <button className="fc-btn fc-btn-ghost" onClick={() => navigate(-1)} style={{ padding: '8px 10px' }}>
          <IcBack size={16} />
        </button>
        <div className="fc-page-title" style={{ fontSize: 'var(--fc-fs-18)' }}>
          {isEdit ? 'Corregir gasto' : 'Nuevo gasto'}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {isEdit && existing?.estado === 'rechazado' && existing?.motivo_rechazo && (
        <div className="fc-alert critical" style={{ marginBottom: 16, cursor: 'default' }}>
          <div className="fc-alert-body">
            <div className="fc-alert-title">Motivo del rechazo</div>
            <div className="fc-alert-sub">{existing.motivo_rechazo}</div>
          </div>
        </div>
      )}

      {/* Soporte primero: cámara / archivo */}
      <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Soporte (foto o PDF)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button type="button" className="fc-capture" onClick={() => camRef.current?.click()}>
          <IcCamera /> Tomar foto
        </button>
        <button type="button" className="fc-capture" onClick={() => fileRef.current?.click()}>
          <IcUpload /> Subir archivo
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

      {(previews.length > 0 || uploaded.length > 0) && (
        <div className="fc-thumbs">
          {uploaded.map((a) => (
            <div className="fc-thumb" key={a.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: 'var(--fc-ink-500)', padding: 4, textAlign: 'center' }}>
                {a.mime_type === 'application/pdf' ? 'PDF' : '📎'} guardado
              </div>
              <button type="button" className="rm" onClick={() => removeUploaded(a)}>×</button>
            </div>
          ))}
          {pending.map((f, i) => (
            <div className="fc-thumb" key={i}>
              {previews[i]
                ? <img src={previews[i]} alt="soporte" />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: 'var(--fc-ink-500)' }}>PDF</div>}
              <button type="button" className="rm" onClick={() => removePending(i)}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="fc-help-text" style={{ marginTop: 6 }}>
        El soporte es opcional; si no lo adjuntas, contabilidad lo marcará como pendiente.
      </div>

      <div className="fc-divider" />

      {/* Monto — grande y primero de los campos */}
      <div className="fc-field">
        <label className="fc-label">Monto <span className="req">*</span></label>
        <div className="fc-amount">
          <span className="prefix">$</span>
          <input className={`fc-input ${errors.monto ? 'is-error' : ''}`} inputMode="numeric"
            placeholder="0" value={montoText}
            onChange={(e) => setMontoText(e.target.value)} />
        </div>
        {monto > 0 && <div className="fc-help-text">{formatCOP(monto)}</div>}
        {errors.monto && <div className="fc-error-text">{errors.monto}</div>}
      </div>

      <div className="fc-field">
        <label className="fc-label">Tipo de gasto <span className="req">*</span></label>
        <select className={`fc-select ${errors.typeId ? 'is-error' : ''}`} value={typeId}
          onChange={(e) => {
            const t = types.find((x) => x.id === e.target.value);
            setTypeId(e.target.value);
            if (!t?.is_client) setRegionId('');
          }}>
          <option value="">Selecciona…</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <div className="fc-help-text">¿Para qué fue el gasto?</div>
        {errors.typeId && <div className="fc-error-text">{errors.typeId}</div>}
      </div>

      <div className="fc-field">
        <label className="fc-label">Categoría <span className="req">*</span></label>
        <select className={`fc-select ${errors.categoryId ? 'is-error' : ''}`} value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Selecciona…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="fc-help-text">¿Qué se pagó?</div>
        {errors.categoryId && <div className="fc-error-text">{errors.categoryId}</div>}
      </div>

      {showRegion && (
        <div className="fc-field">
          <label className="fc-label">Región del cliente</label>
          <select className="fc-select" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="">Sin especificar (opcional)</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
      )}

      <div className="fc-field">
        <label className="fc-label">Fecha del gasto <span className="req">*</span></label>
        <input className={`fc-input ${errors.fecha ? 'is-error' : ''}`} type="date"
          value={fecha} max={bogotaToday()} onChange={(e) => setFecha(e.target.value)} />
        {errors.fecha && <div className="fc-error-text">{errors.fecha}</div>}
      </div>

      <div className="fc-field">
        <label className="fc-label">Proveedor</label>
        <input className="fc-input" value={proveedor} onChange={(e) => setProveedor(e.target.value)}
          placeholder="Nombre del proveedor" />
      </div>
      <div className="fc-field">
        <label className="fc-label">NIT / Cédula del proveedor</label>
        <input className="fc-input fc-input-mono" inputMode="numeric" value={nit}
          onChange={(e) => setNit(e.target.value)} placeholder="Opcional" />
      </div>

      {anticipos.length > 0 && (
        <div className="fc-field">
          <label className="fc-label">¿Contra un anticipo?</label>
          <select className="fc-select" value={anticipoId} onChange={(e) => setAnticipoId(e.target.value)}>
            <option value="">Sin anticipo (reembolso directo)</option>
            {anticipos.map((a) => (
              <option key={a.id} value={a.id}>
                {formatCOP(a.monto)} — {a.descripcion || a.fecha}
              </option>
            ))}
          </select>
        </div>
      )}

      {locs.length > 0 && (
        <div className="fc-field">
          <label className="fc-label">Ubicación</label>
          <select className="fc-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Sin ubicación</option>
            {locs.map((l) => <option key={l.id} value={l.id}>{l.nombre}{l.is_milling ? ' (trilladora)' : ''}</option>)}
          </select>
        </div>
      )}

      <div className="fc-field">
        <label className="fc-label">Descripción</label>
        <textarea className="fc-textarea" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalle breve del gasto" />
      </div>

      <div className="fc-stack" style={{ marginTop: 8 }}>
        <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy} onClick={() => save(true)}>
          {busy ? 'Guardando…' : 'Enviar'}
        </button>
        <button className="fc-btn fc-btn-ghost fc-btn-block" disabled={busy} onClick={() => save(false)}>
          Guardar borrador
        </button>
      </div>
    </div>
  );
}
