import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  // La app monta igual (pantalla de login); las llamadas fallarán hasta configurar
  // VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (Netlify env).
  console.warn('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

// Sesión persistente y de larga duración: un login sobrevive a un viaje de campo.
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'forest-gastos-auth',
  },
});
