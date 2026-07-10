// Shared Supabase helpers for Netlify Functions.
// Two clients:
//  - userClient(token): acts AS the calling user; RLS applies. Use for anything
//    that should respect role permissions (the default).
//  - serviceClient(): bypasses RLS (service_role key). Use ONLY for privileged
//    tasks that cannot be expressed under RLS (creating auth users, writing
//    siigo_pushes/logs as the system). Always re-check the caller's role first.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getBearerToken(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

/** Supabase client scoped to the caller's JWT — RLS enforced. */
export function userClient(token) {
  if (!SUPABASE_URL || !ANON_KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY');
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client — bypasses RLS. Handle with care. */
export function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolves the caller: returns { user, profile } or throws 401/403-style errors.
 * profile carries { id, email, nombre, rol, active }.
 */
export async function requireUser(event, allowedRoles = null) {
  const token = getBearerToken(event);
  if (!token) throw httpError(401, 'No autenticado');
  const supa = userClient(token);
  const { data: auth, error: authErr } = await supa.auth.getUser();
  if (authErr || !auth?.user) throw httpError(401, 'Sesión inválida');

  const { data: profile, error: pErr } = await supa
    .from('users')
    .select('id, email, nombre, rol, active')
    .eq('id', auth.user.id)
    .single();
  if (pErr || !profile) throw httpError(403, 'Perfil no encontrado');
  if (!profile.active) throw httpError(403, 'Usuario inactivo');
  if (allowedRoles && !allowedRoles.includes(profile.rol)) {
    throw httpError(403, `Requiere rol: ${allowedRoles.join(' o ')}`);
  }
  return { token, supa, user: auth.user, profile };
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export function json(status, body) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

/** Wraps a handler with uniform error -> JSON mapping. */
export function handler(fn) {
  return async (event, context) => {
    try {
      return await fn(event, context);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('[function error]', err);
      return json(status, { error: err.message || 'Error interno' });
    }
  };
}
