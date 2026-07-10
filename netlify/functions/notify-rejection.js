// POST /.netlify/functions/notify-rejection { expense_id }
// Llamado por contabilidad tras rechazar un gasto. Verifica que el gasto esté
// rechazado y notifica al operario con el motivo.
import { handler, requireUser, serviceClient, json, httpError } from './_lib/supabase.js';
import { sendEmail, tplRechazo } from './_lib/email.js';
import { formatCOP } from '../../src/lib/money.js';

export const handlerFn = handler(async (event) => {
  if (event.httpMethod !== 'POST') throw httpError(405, 'Método no permitido');
  await requireUser(event, ['contabilidad', 'admin']);
  const { expense_id } = JSON.parse(event.body || '{}');
  if (!expense_id) throw httpError(400, 'Falta expense_id');

  const svc = serviceClient();
  const { data: exp, error } = await svc
    .from('expenses')
    .select('id, monto, estado, motivo_rechazo, user_id, category_id, users:user_id(nombre,email), expense_categories:category_id(nombre)')
    .eq('id', expense_id)
    .single();
  if (error || !exp) throw httpError(404, 'Gasto no encontrado');
  if (exp.estado !== 'rechazado') throw httpError(409, 'El gasto no está rechazado');

  const { subject, html } = tplRechazo({
    nombre: exp.users?.nombre || 'operario',
    categoria: exp.expense_categories?.nombre || 'gasto',
    monto: formatCOP(exp.monto),
    motivo: exp.motivo_rechazo || 'Sin motivo especificado',
  });
  const result = await sendEmail({ to: exp.users?.email, subject, html });
  return json(200, { notified: true, ...result });
});

export { handlerFn as handler };
