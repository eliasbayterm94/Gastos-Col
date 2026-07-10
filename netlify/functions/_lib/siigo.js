// Siigo Nube API client (raw fetch — no SDK).
// Endpoints verified in Phase 0 against Siigo's developer & client portals:
//   Auth:            POST {BASE}/auth            body { username, access_key }
//   Terceros:        GET/POST {BASE}/v1/customers
//   Documento sop.:  POST {BASE}/v1/purchase-support-documents
//   Tipos de doc DS: GET {BASE}/v1/document-types?type=DS
// Every request must carry the Partner-Id header. access_token lasts ~24h.
//
// ⚠️ The documento-soporte PAYLOAD (document type id, cost_center, item
// accounts, taxes/retenciones, payment types) depends on the Siigo account's
// accounting configuration. Per Phase 0, that CLASSIFICATION is set by
// contabilidad and is out of scope now — so real pushes stay behind DRY_RUN
// until the contador confirms the mapping. This module does auth + terceros +
// a documented payload skeleton; it never invents required accounting values.

const BASE = process.env.SIIGO_BASE_URL || 'https://api.siigo.com';
const PARTNER_ID = process.env.SIIGO_PARTNER_ID || 'ForestGastos';

let _tokenCache = { token: null, expiresAt: 0 };

export function siigoConfigured() {
  return Boolean(process.env.SIIGO_USERNAME && process.env.SIIGO_ACCESS_KEY);
}

async function siigoAuth() {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt - 60_000) return _tokenCache.token;
  if (!siigoConfigured()) throw new Error('Faltan credenciales Siigo (SIIGO_USERNAME / SIIGO_ACCESS_KEY)');

  const res = await fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Partner-Id': PARTNER_ID },
    body: JSON.stringify({
      username: process.env.SIIGO_USERNAME,
      access_key: process.env.SIIGO_ACCESS_KEY,
    }),
  });
  if (!res.ok) throw new Error(`Siigo auth falló: ${res.status} ${await safeText(res)}`);
  const data = await res.json();
  const ttlMs = (data.expires_in ? data.expires_in * 1000 : 24 * 3600 * 1000);
  _tokenCache = { token: data.access_token, expiresAt: now + ttlMs };
  return _tokenCache.token;
}

async function siigoFetch(path, { method = 'GET', body } = {}, attempt = 0) {
  const token = await siigoAuth();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Partner-Id': PARTNER_ID,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Backoff on rate limit.
  if (res.status === 429 && attempt < 4) {
    await sleep(2 ** attempt * 1000);
    return siigoFetch(path, { method, body }, attempt + 1);
  }
  const text = await safeText(res);
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Siigo ${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.response = parsed;
    throw err;
  }
  return parsed;
}

/** Busca un tercero por identificación (NIT). Devuelve el primero o null. */
export async function findTercero(identification) {
  if (!identification) return null;
  const clean = String(identification).replace(/[^\d]/g, '');
  const data = await siigoFetch(`/v1/customers?identification=${encodeURIComponent(clean)}`);
  const results = data?.results || data?.data || (Array.isArray(data) ? data : []);
  return results.length ? results[0] : null;
}

/**
 * Busca o crea un tercero mínimo. person_type 'Company' si el NIT es de empresa
 * (heurística: >= 9 dígitos), si no 'Person'. id_type '31' (NIT) / '13' (Cédula).
 * ⚠️ Ajustar id_type / fiscal_responsibilities con el contador si se requiere.
 */
export async function findOrCreateTercero({ identification, nombre }) {
  const existing = await findTercero(identification);
  if (existing) return existing;

  const clean = String(identification || '').replace(/[^\d]/g, '');
  const isCompany = clean.length >= 9;
  const payload = {
    type: 'Supplier',
    person_type: isCompany ? 'Company' : 'Person',
    id_type: isCompany ? '31' : '13',
    identification: clean,
    name: isCompany ? [nombre || 'Proveedor'] : (nombre || 'Proveedor').split(' '),
  };
  return siigoFetch('/v1/customers', { method: 'POST', body: payload });
}

/** Lista tipos de comprobante de Documento Soporte (DS) configurados en Siigo. */
export async function getSupportDocumentTypes() {
  return siigoFetch('/v1/document-types?type=DS');
}

/**
 * Crea un documento soporte en Siigo.
 * @param {object} payload  cuerpo COMPLETO ya armado (document, date, supplier,
 *   cost_center, items, payments, observations). Este módulo no rellena valores
 *   contables por su cuenta (ver ⚠️ arriba); el llamador provee el payload.
 */
export async function createSupportDocument(payload) {
  return siigoFetch('/v1/purchase-support-documents', { method: 'POST', body: payload });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function safeText(res) { try { return await res.text(); } catch { return ''; } }
