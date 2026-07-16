import { useState } from 'react';
import { IcRefresh } from './Icons.jsx';
import { useToast } from './ui.jsx';
import { forceLatest } from '../lib/updateApp.js';

// Botón "traer última versión" para la barra superior (todos los roles).
export default function UpdateButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function click() {
    if (!navigator.onLine) { toast.show('Sin conexión — conéctate para actualizar', 'err'); return; }
    setBusy(true);
    toast.show('Buscando la última versión…', 'info');
    try { await forceLatest(); } // recarga la página al terminar
    catch { setBusy(false); toast.show('No se pudo actualizar', 'err'); }
  }

  return (
    <button className="fc-btn fc-btn-ghost" onClick={click} disabled={busy}
      aria-label="Actualizar app" title="Traer última versión" style={{ padding: '8px 10px' }}>
      <IcRefresh size={16} />
    </button>
  );
}
