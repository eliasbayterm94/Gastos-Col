// Scheduled (see netlify.toml): resumen semanal de gastos pendientes de revisión
// para el equipo de contabilidad. Corre sin usuario => usa service client.
import { serviceClient } from './_lib/supabase.js';
import { sendEmail, tplResumenPendientes } from './_lib/email.js';
import { formatCOP } from '../../src/lib/money.js';

export const handler = async () => {
  const svc = serviceClient();

  const { data: pendientes, error } = await svc
    .from('expenses')
    .select('id, monto, fecha_gasto, estado, users:user_id(nombre), expense_categories:category_id(nombre)')
    .in('estado', ['enviado', 'en_revision'])
    .order('fecha_gasto', { ascending: true });
  if (error) { console.error(error); return { statusCode: 500, body: 'error' }; }

  const count = pendientes?.length || 0;
  const rows = (pendientes || []).slice(0, 50).map((e) =>
    `<tr><td style="padding:4px 8px">${e.users?.nombre || ''}</td>
     <td style="padding:4px 8px">${e.expense_categories?.nombre || ''}</td>
     <td style="padding:4px 8px;font-family:monospace">${formatCOP(e.monto)}</td>
     <td style="padding:4px 8px">${e.fecha_gasto}</td></tr>`).join('');
  const lista = count
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead>
       <tr style="background:#1b203d;color:#fff"><th style="padding:4px 8px;text-align:left">Operario</th>
       <th style="padding:4px 8px;text-align:left">Categoría</th><th style="padding:4px 8px;text-align:left">Monto</th>
       <th style="padding:4px 8px;text-align:left">Fecha</th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p>No hay gastos pendientes. 🎉</p>';

  const { data: contadores } = await svc
    .from('users').select('email').eq('rol', 'contabilidad').eq('active', true);

  const { subject, html } = tplResumenPendientes({ count, lista });
  for (const c of contadores || []) {
    try { await sendEmail({ to: c.email, subject, html }); }
    catch (err) { console.error('email fail', c.email, err.message); }
  }
  return { statusCode: 200, body: JSON.stringify({ count, notified: (contadores || []).length }) };
};
