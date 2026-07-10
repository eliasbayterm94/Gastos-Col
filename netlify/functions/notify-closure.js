// POST /.netlify/functions/notify-closure { closure_id }
// Llamado por contabilidad tras crear un cierre. Notifica al operario el
// resultado (total y saldo a favor de quién).
import { handler, requireUser, serviceClient, json, httpError } from './_lib/supabase.js';
import { sendEmail, tplCierre } from './_lib/email.js';
import { formatCOP, saldoDireccionLabel } from '../../src/lib/money.js';

export const handlerFn = handler(async (event) => {
  if (event.httpMethod !== 'POST') throw httpError(405, 'Método no permitido');
  await requireUser(event, ['contabilidad', 'admin']);
  const { closure_id } = JSON.parse(event.body || '{}');
  if (!closure_id) throw httpError(400, 'Falta closure_id');

  const svc = serviceClient();
  const { data: cl, error } = await svc
    .from('reimbursement_closures')
    .select('id, total_gastos, saldo, saldo_direccion, user_id, users:user_id(nombre,email)')
    .eq('id', closure_id)
    .single();
  if (error || !cl) throw httpError(404, 'Cierre no encontrado');

  const { subject, html } = tplCierre({
    nombre: cl.users?.nombre || 'operario',
    total: formatCOP(cl.total_gastos),
    saldoTexto: saldoDireccionLabel(cl.saldo_direccion, cl.saldo),
  });
  const result = await sendEmail({ to: cl.users?.email, subject, html });
  return json(200, { notified: true, ...result });
});

export { handlerFn as handler };
