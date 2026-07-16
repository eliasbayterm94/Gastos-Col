// Fuerza traer la última versión: revisa el service worker, activa la nueva
// versión si existe y recarga. Útil para PWA instaladas (pantalla de inicio),
// que no se actualizan solas.
export async function forceLatest() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update(); // busca una versión nueva
        const sw = reg.waiting || reg.installing;
        if (sw) {
          await new Promise((resolve) => {
            const done = () => resolve();
            sw.addEventListener('statechange', () => { if (sw.state === 'activated') done(); });
            try { sw.postMessage({ type: 'SKIP_WAITING' }); } catch { /* ignore */ }
            setTimeout(done, 2500); // no colgarse si no hay cambio
          });
        }
      }
    } catch { /* seguimos y recargamos igual */ }
  }
  window.location.reload();
}
