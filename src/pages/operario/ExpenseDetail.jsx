import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExpense, getAttachments, getStatusLog, signedUrl } from '../../lib/api.js';
import { formatCOP, formatDate, formatDateTime, ESTADO_LABEL } from '../../lib/format.js';
import { StatusBadge, PendienteBadge, Spinner } from '../../components/ui.jsx';
import { IcBack } from '../../components/Icons.jsx';
import ExpenseForm from './ExpenseForm.jsx';

export default function ExpenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exp, setExp] = useState(null);
  const [atts, setAtts] = useState([]);
  const [urls, setUrls] = useState({});
  const [log, setLog] = useState([]);
  const [editing, setEditing] = useState(false);

  async function load() {
    const e = await getExpense(id);
    setExp(e);
    const [a, l] = await Promise.all([getAttachments(id), getStatusLog(id)]);
    setAtts(a); setLog(l);
    const entries = await Promise.all(a.map(async (x) => [x.id, await signedUrl(x.storage_path).catch(() => null)]));
    setUrls(Object.fromEntries(entries));
  }
  useEffect(() => { load().catch(() => {}); /* eslint-disable-next-line */ }, [id]);

  if (!exp) return <Spinner full />;

  const editable = ['borrador', 'rechazado'].includes(exp.estado);
  if (editing) {
    return <ExpenseForm existing={exp} initialAttachments={atts} />;
  }

  return (
    <div>
      <div className="fc-row-between fc-page-head">
        <button className="fc-btn fc-btn-ghost" onClick={() => navigate('/gastos')} style={{ padding: '8px 10px' }}>
          <IcBack size={16} />
        </button>
        <div className="fc-page-title" style={{ fontSize: 'var(--fc-fs-18)' }}>Detalle</div>
        <div style={{ width: 40 }} />
      </div>

      <div className="fc-stat-card" style={{ marginBottom: 16 }}>
        <div className="fc-row-between" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <StatusBadge estado={exp.estado} />
            {exp.soporte_pendiente && ['enviado', 'en_revision'].includes(exp.estado) && <PendienteBadge />}
          </div>
          {exp.siigo_document_id && <span className="fc-caption fc-mono">Siigo #{exp.siigo_document_id}</span>}
        </div>
        <div className="fc-stat-value" style={{ fontSize: 'var(--fc-fs-30)' }}>{formatCOP(exp.monto)}</div>
        <div className="fc-stat-sub" style={{ fontSize: 13 }}>
          {exp.expense_types?.nombre} · {exp.expense_categories?.nombre}
        </div>
      </div>

      {exp.estado === 'rechazado' && exp.motivo_rechazo && (
        <div className="fc-alert critical" style={{ marginBottom: 16, cursor: 'default' }}>
          <div className="fc-alert-body">
            <div className="fc-alert-title">Rechazado</div>
            <div className="fc-alert-sub">{exp.motivo_rechazo}</div>
          </div>
        </div>
      )}

      <Field label="Fecha del gasto" value={formatDate(exp.fecha_gasto)} />
      {exp.proveedor_nombre && <Field label="Proveedor" value={exp.proveedor_nombre} />}
      {exp.proveedor_nit && <Field label="NIT / Cédula" value={exp.proveedor_nit} mono />}
      {exp.locations?.nombre && <Field label="Ubicación" value={exp.locations.nombre} />}
      {exp.descripcion && <Field label="Descripción" value={exp.descripcion} />}

      <div className="fc-eyebrow" style={{ margin: '20px 0 8px' }}>Soportes</div>
      {atts.length === 0 ? (
        <div className="fc-help-text">Sin soportes adjuntos.</div>
      ) : (
        <div className="fc-thumbs">
          {atts.map((a) => (
            <a className="fc-thumb" key={a.id} href={urls[a.id]} target="_blank" rel="noreferrer">
              {a.mime_type?.startsWith('image/') && urls[a.id]
                ? <img src={urls[a.id]} alt={a.file_name} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: 'var(--fc-ink-500)' }}>PDF</div>}
            </a>
          ))}
        </div>
      )}

      <div className="fc-eyebrow" style={{ margin: '24px 0 8px' }}>Historial</div>
      <div className="fc-stack" style={{ gap: 8 }}>
        {log.map((l) => (
          <div key={l.id} className="fc-row-between" style={{ fontSize: 13 }}>
            <span>
              {l.from_estado ? `${ESTADO_LABEL[l.from_estado]} → ` : ''}
              <strong>{ESTADO_LABEL[l.to_estado]}</strong>
              {l.comentario ? ` — ${l.comentario}` : ''}
            </span>
            <span className="fc-caption" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(l.created_at)}</span>
          </div>
        ))}
      </div>

      {editable && (
        <div className="fc-stack" style={{ marginTop: 24 }}>
          <button className="fc-btn fc-btn-primary fc-btn-block fc-btn-lg" onClick={() => setEditing(true)}>
            {exp.estado === 'rechazado' ? 'Corregir y reenviar' : 'Editar'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--fc-ink-100)' }}>
      <div className="fc-caption" style={{ marginBottom: 2 }}>{label}</div>
      <div className={mono ? 'fc-mono' : ''} style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}
