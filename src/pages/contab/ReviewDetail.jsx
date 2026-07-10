import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReviewExpense, approveExpense, rejectExpense } from '../../lib/contab.js';
import { getAttachments, getStatusLog, signedUrl } from '../../lib/api.js';
import { formatCOP, formatDate, formatDateTime, ESTADO_LABEL } from '../../lib/format.js';
import { StatusBadge, PendienteBadge, Spinner, Sheet, useToast } from '../../components/ui.jsx';
import { IcBack } from '../../components/Icons.jsx';

export default function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [exp, setExp] = useState(null);
  const [atts, setAtts] = useState([]);
  const [urls, setUrls] = useState({});
  const [log, setLog] = useState([]);
  const [rejecting, setRejecting] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const e = await getReviewExpense(id); setExp(e);
    const [a, l] = await Promise.all([getAttachments(id), getStatusLog(id)]);
    setAtts(a); setLog(l);
    const entries = await Promise.all(a.map(async (x) => [x.id, await signedUrl(x.storage_path).catch(() => null)]));
    setUrls(Object.fromEntries(entries));
  }
  useEffect(() => { load().catch(() => toast.show('No se pudo cargar', 'err')); /* eslint-disable-next-line */ }, [id]);

  if (!exp) return <Spinner full />;

  async function approve() {
    setBusy(true);
    try { await approveExpense(exp.id, exp.estado); toast.show('Gasto aprobado', 'ok'); navigate('/c/revision'); }
    catch (e) { toast.show(e.message, 'err'); setBusy(false); }
  }
  async function reject() {
    if (!motivo.trim()) { toast.show('El motivo es obligatorio', 'err'); return; }
    setBusy(true);
    try { await rejectExpense(exp.id, exp.estado, motivo); toast.show('Gasto rechazado', 'ok'); navigate('/c/revision'); }
    catch (e) { toast.show(e.message, 'err'); setBusy(false); }
  }

  return (
    <div>
      <div className="fc-row-between" style={{ marginBottom: 'var(--fc-space-5)' }}>
        <button className="fc-btn fc-btn-ghost" onClick={() => navigate('/c/revision')} style={{ padding: '8px 12px' }}>
          <IcBack size={16} /> Volver
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {exp.soporte_pendiente && <PendienteBadge />}
          <StatusBadge estado={exp.estado} />
        </div>
      </div>

      <div className="fc-review-grid">
        {/* Soporte */}
        <div>
          <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Soporte</div>
          <div className="fc-soporte-viewer">
            {atts.length === 0 && <div className="fc-help-text" style={{ padding: 20, textAlign: 'center' }}>Sin soporte adjunto — pendiente por contabilidad.</div>}
            {atts.map((a) => (
              a.mime_type?.startsWith('image/') && urls[a.id]
                ? <img key={a.id} src={urls[a.id]} alt={a.file_name} />
                : <a key={a.id} className="pdf-link" href={urls[a.id]} target="_blank" rel="noreferrer">Abrir PDF: {a.file_name}</a>
            ))}
          </div>
        </div>

        {/* Datos + acciones */}
        <div>
          <div className="fc-stat-card" style={{ marginBottom: 16 }}>
            <div className="fc-caption">{exp.users?.nombre}</div>
            <div className="fc-stat-value" style={{ fontSize: 'var(--fc-fs-30)', margin: '4px 0' }}>{formatCOP(exp.monto)}</div>
            <div className="fc-stat-sub" style={{ fontSize: 13 }}>{exp.expense_types?.nombre} · {exp.expense_categories?.nombre}</div>
          </div>

          <Row label="Fecha" value={formatDate(exp.fecha_gasto)} />
          {exp.proveedor_nombre && <Row label="Proveedor" value={exp.proveedor_nombre} />}
          {exp.proveedor_nit && <Row label="NIT / Cédula" value={exp.proveedor_nit} mono />}
          {exp.locations?.nombre && <Row label="Ubicación" value={exp.locations.nombre} />}
          {exp.anticipo_id && <Row label="Vinculado a" value="Anticipo" />}
          {exp.descripcion && <Row label="Descripción" value={exp.descripcion} />}

          <div className="fc-stack" style={{ marginTop: 20 }}>
            <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" disabled={busy} onClick={approve}>
              Aprobar
            </button>
            <button className="fc-btn fc-btn-danger fc-btn-block" disabled={busy} onClick={() => setRejecting(true)}>
              Rechazar / Solicitar corrección
            </button>
          </div>
        </div>
      </div>

      <div className="fc-eyebrow" style={{ margin: '28px 0 8px' }}>Historial</div>
      <div className="fc-stack" style={{ gap: 8 }}>
        {log.map((l) => (
          <div key={l.id} className="fc-row-between" style={{ fontSize: 13 }}>
            <span>{l.from_estado ? `${ESTADO_LABEL[l.from_estado]} → ` : ''}<strong>{ESTADO_LABEL[l.to_estado]}</strong>{l.comentario ? ` — ${l.comentario}` : ''}</span>
            <span className="fc-caption" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(l.created_at)}</span>
          </div>
        ))}
      </div>

      {rejecting && (
        <Sheet title="Motivo del rechazo" onClose={() => setRejecting(false)}>
          <div className="fc-field">
            <label className="fc-label">Explica al operario qué corregir <span className="req">*</span></label>
            <textarea className="fc-textarea" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
              placeholder="Ej: el soporte no es legible / falta el NIT del proveedor" />
          </div>
          <div className="fc-stack">
            <button className="fc-btn fc-btn-danger fc-btn-block fc-btn-lg" disabled={busy} onClick={reject}>
              {busy ? 'Enviando…' : 'Rechazar con este motivo'}
            </button>
            <button className="fc-btn fc-btn-ghost fc-btn-block" onClick={() => setRejecting(false)}>Cancelar</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid var(--fc-ink-100)' }}>
      <div className="fc-caption" style={{ marginBottom: 2 }}>{label}</div>
      <div className={mono ? 'fc-mono' : ''} style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}
