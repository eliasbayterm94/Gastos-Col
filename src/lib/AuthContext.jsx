import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data } = await supabase
      .from('users')
      .select('id, email, nombre, rol, active')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await loadProfile(s?.user?.id);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email: email.trim(), password });
  const signOut = () => supabase.auth.signOut();

  const value = {
    session, profile, loading,
    role: profile?.rol ?? null,
    user: session?.user ?? null,
    signIn, signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
