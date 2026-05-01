/**
 * AuthProvider — Supabase auth session, exposed via useAuth().
 *
 * Wraps the app at the root. Tracks the current Supabase session and
 * keeps it in sync with token-refresh / sign-in / sign-out events.
 *
 * If Supabase isn't configured (env vars missing), this provider still
 * renders its children — it just always reports `user = null`. Student
 * pages and /admin both check that and degrade gracefully:
 *   - Students see the built-in problems only.
 *   - /admin redirects to /signin (which itself shows an "auth not
 *     configured" message instead of crashing).
 *
 * Only professors sign in. Students never see this provider's effects
 * because the public bank reads don't require a session.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isConfigured } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(isConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    // Pick up the existing session on mount (page reload, tab reopen, ...)
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    // Subscribe to future auth events.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  };

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    isConfigured,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
