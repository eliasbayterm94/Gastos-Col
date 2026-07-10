// Formato y etiquetas. Fechas en America/Bogota.
export { formatCOP, parseCOP } from './money.js';

const TZ = 'America/Bogota';

/** Fecha de hoy en Bogotá como 'YYYY-MM-DD' (para max de inputs date). */
export function bogotaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts; // en-CA => YYYY-MM-DD
}

/** 'YYYY-MM-DD' -> '5 mar 2026' */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  }).format(dt);
}

/** timestamptz -> '5 mar 2026, 14:30' en Bogotá */
export function formatDateTime(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts));
}

export const ESTADO_LABEL = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
};

export const ANTICIPO_ESTADO_LABEL = {
  activo: 'Activo',
  liquidado: 'Liquidado',
  cerrado: 'Cerrado',
};

export const METODO_LABEL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  otro: 'Otro',
};

export const SALDO_LABEL = {
  a_favor_operario: 'Forest reembolsa al operario',
  a_favor_forest: 'El operario devuelve a Forest',
  neutro: 'Saldo en cero',
};
