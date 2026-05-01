/**
 * RequireAuth — gate a route on a signed-in Supabase user.
 *
 * Wraps a child component (or <Outlet/>) and redirects to /signin if
 * there's no session. Used to protect /admin from anonymous access.
 *
 * The redirect carries `?returnTo=<pathname>` so the sign-in page can
 * send the user back where they were trying to go.
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <span className="text-sm">Checking sign-in…</span>
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
