import { supabase } from './supabaseClient.js';
import { callFunction } from './functions.js';

// ── Estadísticas (agregación en cliente; volumen modesto para MVP) ───────────
export async function fetchExpensesForStats() {
  const { data, error } = await supabase.from('expenses')
    .select('monto, estado, fecha_gasto, sin_soporte, ' +
      'expense_categories:category_id(nombre), expense_types:type_id(nombre), ' +
      'client_regions:client_region_id(nombre), users:user_id(nombre, areas:area_id(nombre))');
  if (error) throw error; return data || [];
}

export function aggregate(rows) {
  const byCat = {}, byMonth = {}, byOperario = {}, byEstado = {}, byArea = {}, byType = {}, byRegion = {};
  let total = 0, sinFactura = 0;
  const add = (obj, k, v) => { const key = k || '—'; obj[key] = (obj[key] || 0) + v; };
  for (const r of rows) {
    total += r.monto;
    if (r.sin_soporte) sinFactura += r.monto;
    add(byCat, r.expense_categories?.nombre, r.monto);
    add(byType, r.expense_types?.nombre, r.monto);
    add(byArea, r.users?.areas?.nombre || 'Sin área', r.monto);
    add(byOperario, r.users?.nombre, r.monto);
    add(byEstado, r.estado, r.monto);
    if (r.client_regions?.nombre) add(byRegion, r.client_regions.nombre, r.monto);
    const mes = (r.fecha_gasto || '').slice(0, 7);
    if (mes) add(byMonth, mes, r.monto);
  }
  const toSorted = (obj) => Object.entries(obj).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  return {
    total, count: rows.length, sinFactura,
    avgTicket: rows.length ? Math.round(total / rows.length) : 0,
    byCat: toSorted(byCat), byType: toSorted(byType), byArea: toSorted(byArea),
    byOperario: toSorted(byOperario), byEstado: toSorted(byEstado), byRegion: toSorted(byRegion),
    byMonth: Object.entries(byMonth).map(([k, v]) => ({ k, v })).sort((a, b) => a.k.localeCompare(b.k)),
  };
}

// ── Usuarios ─────────────────────────────────────────────────────────────────
export async function listUsers() {
  const { data, error } = await supabase.from('users')
    .select('id, email, nombre, rol, active, area_id, created_at, areas:area_id(nombre)').order('nombre');
  if (error) throw error; return data;
}
export async function createUser({ email, nombre, rol, password, area_id }) {
  const body = { email, nombre, rol };
  if (password) body.password = password; // si va contraseña, se crea sin correo
  if (area_id) body.area_id = area_id;
  return callFunction('admin-create-user', body);
}
export async function listAreas() {
  const { data, error } = await supabase.from('areas').select('id, nombre').eq('active', true).order('sort_order');
  if (error) throw error; return data;
}
export async function updateUser(id, patch) {
  const { error } = await supabase.from('users').update(patch).eq('id', id);
  if (error) throw error;
}

// ── Catálogos (tipos, categorías, ubicaciones) ───────────────────────────────
export async function listTypesAll() {
  const { data, error } = await supabase.from('expense_types').select('*').order('sort_order');
  if (error) throw error; return data;
}
export async function listCategoriesAll() {
  const { data, error } = await supabase.from('expense_categories').select('*').order('sort_order');
  if (error) throw error; return data;
}
export async function listLocationsAll() {
  const { data, error } = await supabase.from('locations').select('*').order('nombre');
  if (error) throw error; return data;
}
export async function listAreasAll() {
  const { data, error } = await supabase.from('areas').select('*').order('sort_order');
  if (error) throw error; return data;
}
export async function listRegionsAll() {
  const { data, error } = await supabase.from('client_regions').select('*').order('sort_order');
  if (error) throw error; return data;
}
export const upsertType = (row) => save('expense_types', row);
export const upsertCategory = (row) => save('expense_categories', row);
export const upsertLocation = (row) => save('locations', row);
export const upsertArea = (row) => save('areas', row);
export const upsertRegion = (row) => save('client_regions', row);
async function save(table, row) {
  const { id, ...rest } = row;
  const q = id ? supabase.from(table).update(rest).eq('id', id) : supabase.from(table).insert(rest);
  const { error } = await q; if (error) throw error;
}

// ── Overrides ────────────────────────────────────────────────────────────────
export async function listPagadoExpenses() {
  const { data, error } = await supabase.from('expenses')
    .select('id, monto, fecha_gasto, descripcion, estado, users:user_id(nombre), expense_categories:category_id(nombre)')
    .eq('estado', 'pagado').order('fecha_gasto', { ascending: false });
  if (error) throw error; return data;
}
export async function adminUpdateExpense(id, patch, motivo) {
  const { error } = await supabase.rpc('admin_update_expense', { p_id: id, p_patch: patch, p_motivo: motivo });
  if (error) throw error;
}
export async function adminDeleteExpense(id, motivo) {
  const { error } = await supabase.rpc('admin_delete_expense', { p_id: id, p_motivo: motivo });
  if (error) throw error;
}
export async function listClosures() {
  const { data, error } = await supabase.from('reimbursement_closures')
    .select('id, fecha, total_gastos, saldo, saldo_direccion, reopened, users:user_id(nombre)')
    .order('created_at', { ascending: false });
  if (error) throw error; return data;
}
export async function reopenClosure(id, motivo) {
  const { error } = await supabase.rpc('reopen_closure', { p_closure_id: id, p_motivo: motivo });
  if (error) throw error;
}

// ── Auditoría ────────────────────────────────────────────────────────────────
export async function listAudit({ action, from, to } = {}) {
  let q = supabase.from('audit_log')
    .select('id, action, entity_type, entity_id, motivo, created_at, actor:actor_id(nombre, email)')
    .order('created_at', { ascending: false }).limit(500);
  if (action) q = q.eq('action', action);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', `${to}T23:59:59`);
  const { data, error } = await q;
  if (error) throw error; return data;
}
