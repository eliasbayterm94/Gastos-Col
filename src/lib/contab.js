import { supabase } from './supabaseClient.js';
import { setExpenseStatus } from './api.js';

// ── Cola de revisión ─────────────────────────────────────────────────────────
const REVIEW_SELECT =
  'id, monto, fecha_gasto, descripcion, proveedor_nombre, proveedor_nit, estado, soporte_pendiente, ' +
  'sin_soporte, sin_soporte_motivo, siigo_document_id, type_id, category_id, location_id, client_region_id, ' +
  'anticipo_id, created_at, user_id, ' +
  'users:user_id(nombre, email, areas:area_id(nombre)), expense_categories:category_id(nombre), ' +
  'expense_types:type_id(nombre), locations:location_id(nombre), client_regions:client_region_id(nombre), ' +
  'file_attachments(id)';

export async function listReviewQueue() {
  const { data, error } = await supabase.from('expenses').select(REVIEW_SELECT)
    .in('estado', ['enviado', 'en_revision'])
    .order('created_at', { ascending: true }); // más viejos primero
  if (error) throw error;
  return data;
}

export async function getReviewExpense(id) {
  const { data, error } = await supabase.from('expenses').select(REVIEW_SELECT).eq('id', id).single();
  if (error) throw error; return data;
}

// enviado -> en_revision -> aprobado (dos pasos si viene de enviado)
export async function approveExpense(id, estado) {
  if (estado === 'enviado') await setExpenseStatus(id, 'en_revision');
  await setExpenseStatus(id, 'aprobado');
}
export async function rejectExpense(id, estado, motivo) {
  if (!motivo?.trim()) throw new Error('El motivo es obligatorio');
  if (estado === 'enviado') await setExpenseStatus(id, 'en_revision');
  await setExpenseStatus(id, 'rechazado', motivo.trim());
}
export async function bulkApprove(rows) {
  for (const r of rows) await approveExpense(r.id, r.estado);
}

// ── Operarios & anticipos ────────────────────────────────────────────────────
export async function listOperarios() {
  const { data, error } = await supabase.from('users')
    .select('id, nombre, email, rol').eq('active', true).order('nombre');
  if (error) throw error;
  return (data || []).filter((u) => u.rol === 'usuario');
}

export async function createAnticipo({ user_id, monto, fecha, metodo_entrega, descripcion, created_by }) {
  const { data, error } = await supabase.from('anticipos')
    .insert({ user_id, monto, fecha, metodo_entrega, descripcion: descripcion || null, created_by })
    .select('id').single();
  if (error) throw error; return data.id;
}

export async function listAnticiposWithBalances() {
  const { data: anticipos, error } = await supabase.from('anticipos')
    .select('id, user_id, monto, fecha, metodo_entrega, estado, descripcion, created_at, users:user_id(nombre)')
    .order('fecha', { ascending: true });
  if (error) throw error;
  const { data: balances } = await supabase.from('anticipo_balances')
    .select('anticipo_id, gastos_aplicados, saldo');
  const byId = Object.fromEntries((balances || []).map((b) => [b.anticipo_id, b]));
  return (anticipos || []).map((a) => ({ ...a, balance: byId[a.id] || null }));
}

// ── Cierres ──────────────────────────────────────────────────────────────────
export async function listApprovedUnpaid(userId) {
  const { data, error } = await supabase.from('expenses')
    .select('id, monto, fecha_gasto, descripcion, anticipo_id, sin_soporte, expense_categories:category_id(nombre)')
    .eq('user_id', userId).eq('estado', 'aprobado').is('closure_id', null)
    .order('fecha_gasto');
  if (error) throw error; return data;
}
export async function listActiveAnticiposFor(userId) {
  const { data, error } = await supabase.from('anticipos')
    .select('id, monto, fecha, descripcion').eq('user_id', userId).eq('estado', 'activo')
    .order('fecha');
  if (error) throw error; return data;
}
export async function createClosure({ user_id, expense_ids, anticipo_id, metodo_pago, observaciones }) {
  const { data, error } = await supabase.rpc('create_closure', {
    p_user_id: user_id, p_expense_ids: expense_ids,
    p_anticipo_id: anticipo_id || null, p_metodo_pago: metodo_pago || null,
    p_observaciones: observaciones || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

// ── Siigo ────────────────────────────────────────────────────────────────────
export async function listPushable() {
  const { data, error } = await supabase.from('expenses')
    .select('id, monto, fecha_gasto, estado, siigo_document_id, proveedor_nombre, proveedor_nit, expense_categories:category_id(nombre), users:user_id(nombre)')
    .in('estado', ['aprobado', 'pagado'])
    .order('fecha_gasto', { ascending: false });
  if (error) throw error;
  const { data: pushes } = await supabase.from('siigo_pushes')
    .select('expense_id, status, siigo_document_id, error_message, created_at')
    .order('created_at', { ascending: false });
  const latest = {};
  for (const p of pushes || []) if (!latest[p.expense_id]) latest[p.expense_id] = p;
  return (data || []).map((e) => ({ ...e, push: latest[e.id] || null }));
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export async function dashboardMetrics() {
  const [pending, activeAnt, approvedUnpaid, pushes] = await Promise.all([
    supabase.from('expenses').select('id', { count: 'exact', head: true }).in('estado', ['enviado', 'en_revision']),
    supabase.from('anticipos').select('monto').eq('estado', 'activo'),
    supabase.from('expenses').select('monto').eq('estado', 'aprobado').is('closure_id', null),
    supabase.from('siigo_pushes').select('expense_id, status').order('created_at', { ascending: false }),
  ]);
  const sum = (rows) => (rows || []).reduce((a, r) => a + (r.monto || 0), 0);

  // Fallos Siigo = gastos cuyo último push es 'error'
  const latest = {};
  for (const p of pushes.data || []) if (!(p.expense_id in latest)) latest[p.expense_id] = p.status;
  const failures = Object.values(latest).filter((s) => s === 'error').length;

  return {
    pendingReview: pending.count || 0,
    activeAnticiposTotal: sum(activeAnt.data),
    unclosedApprovedTotal: sum(approvedUnpaid.data),
    siigoFailures: failures,
  };
}
