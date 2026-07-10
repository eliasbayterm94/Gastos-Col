// POST /.netlify/functions/extract-receipt { image_base64, mime_type }
// Claude Vision -> sugerencias tipadas (monto, fecha, proveedor, NIT) con
// confianza por campo. NUNCA autoenvía: la app las muestra para confirmación.
//
// Decisión Fase 0: HÍBRIDO. Se entrega ahora en manual; esta extracción queda
// detrás de EXTRACTION_ENABLED=false por defecto. No hay LLM en rutas de cálculo.
import { handler, requireUser, json, httpError } from './_lib/supabase.js';

const ENABLED = (process.env.EXTRACTION_ENABLED ?? 'false').toLowerCase() === 'true';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM = `Eres un asistente que extrae datos de recibos colombianos (facturas POS,
tirillas térmicas, recibos manuscritos). Devuelve SOLO un objeto JSON con las claves:
monto (entero en pesos COP, sin decimales ni separadores), fecha (YYYY-MM-DD),
proveedor_nombre (string), proveedor_nit (solo dígitos o null), y confidence
(objeto con monto, fecha, proveedor_nombre, proveedor_nit como número 0..1).
Si un dato no es legible, usa null y confidence 0. No inventes valores.`;

export const handlerFn = handler(async (event) => {
  if (event.httpMethod !== 'POST') throw httpError(405, 'Método no permitido');
  await requireUser(event); // cualquier usuario autenticado
  if (!ENABLED) throw httpError(501, 'Extracción con IA deshabilitada (EXTRACTION_ENABLED=false)');
  if (!process.env.ANTHROPIC_API_KEY) throw httpError(503, 'Falta ANTHROPIC_API_KEY');

  const { image_base64, mime_type = 'image/jpeg' } = JSON.parse(event.body || '{}');
  if (!image_base64) throw httpError(400, 'Falta image_base64');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime_type, data: image_base64 } },
          { type: 'text', text: 'Extrae los datos del recibo como JSON.' },
        ],
      }],
    }),
  });
  if (!res.ok) throw httpError(502, `Anthropic falló: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data?.content?.find((c) => c.type === 'text')?.text || '{}';

  let suggestion;
  try {
    const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    suggestion = JSON.parse(jsonStr);
  } catch {
    throw httpError(502, 'Respuesta de IA no parseable');
  }
  // Normaliza monto a entero; jamás autoconfirmar.
  if (suggestion.monto != null) suggestion.monto = Math.trunc(Number(suggestion.monto)) || null;
  return json(200, { suggestion, autoSubmit: false });
});

export { handlerFn as handler };
