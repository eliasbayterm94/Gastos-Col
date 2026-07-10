import { createContext, useContext, useState, useCallback } from 'react';
import { ESTADO_LABEL, ANTICIPO_ESTADO_LABEL } from '../lib/format.js';

export function Spinner({ full }) {
  if (full) return <div className="fc-center-screen"><div className="fc-spinner" /></div>;
  return <div className="fc-spinner" />;
}

export function StatusBadge({ estado, kind = 'expense' }) {
  const label = kind === 'anticipo' ? ANTICIPO_ESTADO_LABEL[estado] : ESTADO_LABEL[estado];
  return <span className={`fc-badge ${estado}`}>{label || estado}</span>;
}

export function PendienteBadge() {
  return <span className="fc-badge pendiente">Soporte pendiente</span>;
}

export function EmptyState({ icon, title, sub }) {
  return (
    <div className="fc-empty">
      {icon}
      <div style={{ fontWeight: 600, color: 'var(--fc-ink-700)' }}>{title}</div>
      {sub && <div style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="fc-sheet-backdrop" onClick={onClose}>
      <div className="fc-sheet" onClick={(e) => e.stopPropagation()}>
        {title && <div className="fc-sheet-title" style={{ marginBottom: 16 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────────
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {toast && (
        <div className="fc-toast-wrap">
          <div className={`fc-toast ${toast.kind}`}>{toast.message}</div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const c = useContext(ToastCtx);
  return c || { show: () => {} };
}
