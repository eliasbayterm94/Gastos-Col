// POST /.netlify/functions/siigo-push  { expense_id }
// Empuja un documento soporte a Siigo por gasto. Idempotente (una sola vez por
// gasto). Registra cada intento en siigo_pushes con payload/response.
// DRY_RUN=true (por defecto) simula: arma y registra el payload sin enviar.
import { handler, requireUser, serviceClient, json, httpError } from './_lib/supabase.js';
import { siigoConfigured, findOrCreateTercero, createSupportDocument } from './_lib/siigo.js';

const DRY_RUN = (process.env.SIIGO_DRY_RUN ?? 'true').toLowerCase() !== 'false';

export const handlerFn = handler(async (event) => {
  if (event.httpMethod !== 'POST') throw httpError(405, 'Método no permitido');
  const { profile } = await requireUser(event, ['contabilidad', 'admin']);
  const { expense_id } = JSON.parse(event.body || '{}');
  if (!expense_id) throw httpError(400, 'Falta expense_id');

  const svc = serviceClient();

  // Idempotencia: ¿ya hay un push exitoso para este gasto?
  const { data: prior } = await svc
    .from('siigo_pushes')
    .select('id, siigo_document_id, status')
    .eq('idempotency_key', expense_id)
    .eq('status', 'success')
    .maybeSingle();
  if (prior) {
    return json(200, { alreadyPushed: true, siigo_document_id: prior.siigo_document_id });
  }

  // Cargar gasto + relaciones necesarias para el soporte.
  const { data: exp, error } = await svc
    .from('expenses')
    .select('id, monto, fecha_gasto, descripcion, proveedor_nombre, proveedor_nit, estado, siigo_document_id')
    .eq('id', expense_id)
    .single();
  if (error || !exp) throw httpError(404, 'Gasto no encontrado');
  if (!['aprobado', 'pagado'].includes(exp.estado)) {
    throw httpError(409, 'Solo se pueden enviar a Siigo gastos aprobados o pagados');
  }

  // Armar el esqueleto del payload. ⚠️ Los valores contables (document.id,
  // cost_center, items[].account, taxes/retenciones, payments) los define
  // contabilidad; van vía variables de entorno cuando el contador los confirme.
  const payloadSkeleton = buildSupportDocPayload(exp);

  // --- DRY_RUN: registrar y salir sin enviar --------------------------------
  if (DRY_RUN) {
    const { data: log } = await svc.from('siigo_pushes').insert({
      expense_id, idempotency_key: expense_id, status: 'dry_run',
      request_payload: payloadSkeleton, dry_run: true, pushed_by: profile.id,
    }).select('id').single();
    return json(200, {
      dryRun: true, pushId: log?.id,
      note: 'DRY_RUN activo: payload validado y registrado, no se envió a Siigo.',
      payload: payloadSkeleton,
    });
  }

  // --- Envío real ------------------------------------------------------------
  if (!siigoConfigured()) throw httpError(503, 'Credenciales Siigo no configuradas');
  // Guard de honestidad: la clasificación contable aún no está integrada.
  if (!process.env.SIIGO_DOCUMENT_TYPE_ID || !process.env.SIIGO_COST_CENTER) {
    throw httpError(501, 'Clasificación contable Siigo pendiente (document type / cost center). Ver Fase posterior.');
  }

  try {
    if (exp.proveedor_nit) {
      await findOrCreateTercero({ identification: exp.proveedor_nit, nombre: exp.proveedor_nombre });
    }
    const response = await createSupportDocument(payloadSkeleton);
    const siigoId = String(response?.id ?? response?.document?.id ?? '');

    await svc.from('siigo_pushes').insert({
      expense_id, idempotency_key: expense_id, status: 'success',
      siigo_document_id: siigoId, request_payload: payloadSkeleton, response,
      dry_run: false, pushed_by: profile.id,
    });
    // Guardar el id de Siigo en el gasto (service client: puede ser 'pagado').
    await svc.from('expenses').update({ siigo_document_id: siigoId }).eq('id', expense_id);

    return json(200, { pushed: true, siigo_document_id: siigoId });
  } catch (err) {
    await svc.from('siigo_pushes').insert({
      expense_id, idempotency_key: expense_id, status: 'error',
      request_payload: payloadSkeleton, response: err.response ?? null,
      error_message: err.message, dry_run: false, pushed_by: profile.id,
    });
    throw httpError(502, `Push a Siigo falló: ${err.message}`);
  }
});

// El id local del gasto viaja en observations para trazabilidad e idempotencia
// cruzada (Supabase Storage es la fuente de verdad del soporte físico).
function buildSupportDocPayload(exp) {
  const nitClean = (exp.proveedor_nit || '').replace(/[^\d]/g, '');
  return {
    document: { id: numOrNull(process.env.SIIGO_DOCUMENT_TYPE_ID) },
    date: exp.fecha_gasto,
    supplier: { identification: nitClean || undefined },
    cost_center: numOrNull(process.env.SIIGO_COST_CENTER),
    observations: `Forest Gastos ${exp.id} — ${exp.descripcion || ''}`.trim(),
    // ⚠️ items[] y payments[] requieren cuenta contable, impuestos/retenciones y
    // tipo de pago según configuración Siigo. Se completan cuando el contador
    // confirme el mapeo (fase de clasificación contable, diferida).
    items: [{ description: exp.descripcion || 'Gasto', quantity: 1, price: exp.monto }],
    payments: [],
  };
}

function numOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

export { handlerFn as handler };
