import { supabase } from './supabaseClient.js';
import { compressImage } from './image.js';

// ── Catálogos ───────────────────────────────────────────────────────────────
export async function getTypes() {
  const { data, error } = await supabase
    .from('expense_types').select('id, nombre, is_client').eq('active', true).order('sort_order');
  if (error) throw error; return data;
}
export async function getCategories() {
  const { data, error } = await supabase
    .from('expense_categories').select('id, nombre').eq('active', true).order('sort_order');
  if (error) throw error; return data;
}
export async function getLocations() {
  const { data, error } = await supabase
    .from('locations').select('id, nombre, is_milling').eq('active', true).order('nombre');
  if (error) throw error; return data;
}
export async function getRegions() {
  const { data, error } = await supabase
    .from('client_regions').select('id, nombre').eq('active', true).order('sort_order');
  if (error) throw error; return data;
}

// ── Gastos ───────────────────────────────────────────────────────────────────
const EXPENSE_SELECT =
  'id, monto, fecha_gasto, descripcion, proveedor_nombre, proveedor_nit, estado, ' +
  'soporte_pendiente, sin_soporte, sin_soporte_motivo, motivo_rechazo, anticipo_id, type_id, category_id, location_id, ' +
  'siigo_document_id, client_region_id, created_at, ' +
  'expense_categories:category_id(nombre), expense_types:type_id(nombre), ' +
  'locations:location_id(nombre), client_regions:client_region_id(nombre)';

export async function listMyExpenses(userId, { estado } = {}) {
  let q = supabase.from('expenses').select(EXPENSE_SELECT).eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) throw error; return data;
}

export async function getExpense(id) {
  const { data, error } = await supabase.from('expenses').select(EXPENSE_SELECT).eq('id', id).single();
  if (error) throw error; return data;
}

export async function getAttachments(expenseId) {
  const { data, error } = await supabase
    .from('file_attachments').select('id, storage_path, file_name, mime_type, created_at')
    .eq('expense_id', expenseId).order('created_at');
  if (error) throw error; return data;
}

export async function getStatusLog(expenseId) {
  const { data, error } = await supabase
    .from('expense_status_log').select('id, from_estado, to_estado, comentario, created_at')
    .eq('expense_id', expenseId).order('created_at');
  if (error) throw error; return data;
}

export async function createExpense(payload) {
  const { data, error } = await supabase.from('expenses').insert(payload).select('id').single();
  if (error) throw error; return data.id;
}

export async function updateExpense(id, patch) {
  const { error } = await supabase.from('expenses').update(patch).eq('id', id);
  if (error) throw error;
}

/** Elimina un gasto no cruzado (dueño/contabilidad). RLS + trigger lo gobiernan. */
export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

/** Transición de estado vía RPC (motivo en la misma transacción). */
export async function setExpenseStatus(expenseId, newStatus, comment = null) {
  const { error } = await supabase.rpc('set_expense_status', {
    p_expense_id: expenseId, p_new_status: newStatus, p_comment: comment,
  });
  if (error) throw error;
}

// ── Soportes (Storage) ───────────────────────────────────────────────────────
export async function uploadAttachment(expenseId, file, uploadedBy) {
  const compact = await compressImage(file);
  const ext = (compact.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${expenseId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from('soportes')
    .upload(path, compact, { contentType: compact.type, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase.from('file_attachments').insert({
    expense_id: expenseId, storage_path: path, file_name: file.name,
    mime_type: compact.type, size_bytes: compact.size, uploaded_by: uploadedBy,
  }).select('id, storage_path, file_name, mime_type').single();
  if (error) throw error;
  return data;
}

export async function removeAttachment(att) {
  await supabase.storage.from('soportes').remove([att.storage_path]);
  const { error } = await supabase.from('file_attachments').delete().eq('id', att.id);
  if (error) throw error;
}

export async function signedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('soportes').createSignedUrl(path, expiresIn);
  if (error) throw error; return data.signedUrl;
}

// ── Anticipos & cierres del operario ─────────────────────────────────────────
export async function listMyAnticipos(userId) {
  const { data: anticipos, error } = await supabase
    .from('anticipos').select('id, monto, fecha, metodo_entrega, estado, descripcion, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  const { data: balances, error: bErr } = await supabase
    .from('anticipo_balances').select('anticipo_id, monto, gastos_aplicados, saldo');
  if (bErr) throw bErr;
  const byId = Object.fromEntries((balances || []).map((b) => [b.anticipo_id, b]));
  return (anticipos || []).map((a) => ({ ...a, balance: byId[a.id] || null }));
}

// Resumen del operario para la pantalla de inicio.
export async function myDashboard(userId) {
  const [{ data: exp, error }, anticipos] = await Promise.all([
    supabase.from('expenses')
      .select('id, monto, estado, fecha_gasto, soporte_pendiente, expense_categories:category_id(nombre)')
      .eq('user_id', userId),
    listMyAnticipos(userId),
  ]);
  if (error) throw error;
  const rows = exp || [];
  const sumBy = (pred) => rows.filter(pred).reduce((a, e) => a + e.monto, 0);
  const countBy = (pred) => rows.filter(pred).length;
  const enRev = (e) => e.estado === 'enviado' || e.estado === 'en_revision';
  const activos = (anticipos || []).filter((a) => a.estado === 'activo');
  const rechazados = rows
    .filter((e) => e.estado === 'rechazado')
    .sort((a, b) => (a.fecha_gasto < b.fecha_gasto ? 1 : -1));

  return {
    porReembolsarMonto: sumBy((e) => e.estado === 'aprobado'),
    porReembolsarCount: countBy((e) => e.estado === 'aprobado'),
    enRevisionMonto: sumBy(enRev),
    enRevisionCount: countBy(enRev),
    borradorCount: countBy((e) => e.estado === 'borrador'),
    pagadoMonto: sumBy((e) => e.estado === 'pagado'),
    rechazados,
    anticiposActivos: activos.length,
    anticipoSaldo: activos.reduce((a, x) => a + (x.balance?.saldo ?? x.monto), 0),
    soportePendienteCount: countBy((e) => e.soporte_pendiente && (enRev(e) || e.estado === 'aprobado')),
  };
}

export async function listMyClosures(userId) {
  const { data, error } = await supabase
    .from('reimbursement_closures')
    .select('id, fecha, total_gastos, anticipo_aplicado, saldo, saldo_direccion, metodo_pago, observaciones, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error; return data;
}
