import { supabase } from './supabaseClient.js';

// Llama a una Netlify Function adjuntando el token de sesión (RLS/rol en backend).
export async function callFunction(name, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json;
}
