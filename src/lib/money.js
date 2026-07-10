// =============================================================================
// Forest Gastos — money.js
// Deterministic COP money utilities. Amounts are ALWAYS integer pesos (no cents,
// no floats). These functions are the single source of truth for closure and
// anticipo math on the client; the DB (triggers/RPCs) is authoritative on write.
// No LLM, no I/O, no side effects — pure and unit-tested.
// =============================================================================

/** Throws unless v is a safe, non-negative integer number of pesos. */
export function assertPesos(v, label = 'monto') {
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new TypeError(`${label} debe ser un entero de pesos (recibido: ${v})`);
  }
  return v;
}

/** Agrupa miles con punto (formato colombiano): 550000 -> "550.000". */
function groupThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formatea pesos enteros como COP: 550000 -> "$ 550.000"; -80000 -> "-$ 80.000". */
export function formatCOP(pesos) {
  assertPesos(Math.trunc(pesos), 'pesos');
  const neg = pesos < 0;
  return `${neg ? '-' : ''}$ ${groupThousands(Math.abs(pesos))}`;
}

/**
 * Convierte texto ingresado por el usuario a pesos enteros.
 * Acepta "$ 550.000", "550000", "550,000". Rechaza decimales de peso.
 * Devuelve un entero o null si no hay dígitos.
 */
export function parseCOP(input) {
  if (typeof input === 'number') return Math.trunc(input);
  if (input == null) return null;
  const s = String(input).trim();
  const neg = /^-/.test(s);
  const digits = s.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) throw new RangeError('Monto fuera de rango');
  return neg ? -n : n;
}

/** Dirección del saldo de un cierre a partir del saldo con signo. */
export function saldoDireccion(saldo) {
  if (saldo > 0) return 'a_favor_operario'; // Forest le debe al operario
  if (saldo < 0) return 'a_favor_forest'; // el operario devuelve a Forest
  return 'neutro';
}

/** Texto legible de la dirección del saldo (para UI). */
export function saldoDireccionLabel(direccion, saldo) {
  const abs = formatCOP(Math.abs(saldo));
  switch (direccion) {
    case 'a_favor_operario':
      return `Forest reembolsa ${abs} al operario`;
    case 'a_favor_forest':
      return `El operario devuelve ${abs} a Forest`;
    default:
      return 'Saldo en cero — nada por reembolsar ni devolver';
  }
}

/**
 * Saldo vivo de un anticipo = monto − Σ gastos aplicados (aprobados/pagados).
 * saldo > 0: queda anticipo por gastar. saldo < 0: los gastos exceden el anticipo.
 */
export function anticipoSaldo(montoAnticipo, gastosAplicados) {
  assertPesos(montoAnticipo, 'montoAnticipo');
  assertPesos(gastosAplicados, 'gastosAplicados');
  return montoAnticipo - gastosAplicados;
}

/**
 * Vista previa de cierre. Espeja create_closure() del backend para mostrar el
 * resultado ANTES de confirmar. Todo en enteros; reconcilia al peso.
 *
 * @param {Array<{monto:number}>} expenses  gastos aprobados a incluir
 * @param {number|null} anticipoMonto        monto del anticipo a liquidar (o null)
 * @returns {{totalGastos:number, anticipoAplicado:number, saldo:number, direccion:string}}
 */
export function closurePreview(expenses, anticipoMonto = null) {
  if (!Array.isArray(expenses) || expenses.length === 0) {
    throw new Error('El cierre requiere al menos un gasto');
  }
  const totalGastos = expenses.reduce((acc, e) => {
    return acc + assertPesos(e.monto, 'gasto.monto');
  }, 0);
  const anticipoAplicado = anticipoMonto == null ? 0 : assertPesos(anticipoMonto, 'anticipoMonto');
  const saldo = totalGastos - anticipoAplicado;
  return { totalGastos, anticipoAplicado, saldo, direccion: saldoDireccion(saldo) };
}
