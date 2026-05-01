/**
 * SignInPage — combined sign-in / sign-up page for professors.
 *
 * Students don't sign in: they pick a bank from the splash and read
 * directly. This page only exists to gate /admin.
 *
 * Mode toggle between "Sign in" (existing account) and "Sign up" (new
 * professor). Sign-up captures display_name and a desired bank slug,
 * then on success creates a row in `banks` so the professor's bank
 * exists immediately and shows up in the student dropdown.
 *
 * If Supabase is unconfigured (env vars missing), the page renders a
 * helpful message instead of crashing.
 */

import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, isConfigured } from '../lib/supabase';

type Mode = 'signin' | 'signup';

export default function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo') || '/admin';

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bankName, setBankName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isConfigured || !supabase) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Auth not configured</h1>
          <p className="text-sm text-slate-400">
            Supabase env vars are missing. Set <code className="text-slate-200">VITE_SUPABASE_URL</code>{' '}
            and <code className="text-slate-200">VITE_SUPABASE_ANON_KEY</code> in <code className="text-slate-200">.env.local</code>{' '}
            (dev) or in your Render/Vercel build env (prod), then reload.
          </p>
          <Link to="/" className="inline-block text-sm text-emerald-300 underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        navigate(returnTo, { replace: true });
        return;
      }

      // Sign up
      if (!displayName.trim()) throw new Error('Display name is required.');
      const slug = bankName.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{2,}$/.test(slug)) {
        throw new Error('Bank slug: lowercase letters, digits, and dashes only (min 3 chars).');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
        },
      });
      if (error) throw new Error(error.message);

      // If email confirmation is required, session will be null here and
      // the user must verify before they can sign in. We can't claim the
      // bank slug without an authenticated session, so we save the
      // intended slug locally and finish the claim on first sign-in.
      if (!data.session) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('lp.pendingBankClaim', slug);
          localStorage.setItem('lp.pendingDisplayName', displayName.trim());
        }
        setInfo(
          'Check your email for a confirmation link. After confirming, sign in here and your bank will be created automatically.',
        );
        setBusy(false);
        return;
      }

      // Session is live — claim the bank slug now.
      const { error: bankErr } = await supabase.from('banks').insert({
        bank_name: slug,
        user_id: data.session.user.id,
        display_label: displayName.trim(),
      });
      if (bankErr) {
        // Surface but don't block — the user can claim a slug later from /admin.
        setErr(`Account created, but couldn't claim bank "${slug}": ${bankErr.message}`);
        navigate(returnTo, { replace: true });
        return;
      }

      navigate(returnTo, { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-md mx-auto p-6 sm:p-10">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold mb-1">
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            {mode === 'signin'
              ? 'Sign in to manage your problem bank.'
              : 'Create a professor account and pick a bank slug your students will use.'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Prof. Jenkins"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Bank slug
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="jenkins-orie310-fall26"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Lowercase letters, digits, and dashes. Students type this to find your bank.
                  </p>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@university.edu"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                required
                minLength={6}
              />
            </div>

            {err && (
              <div className="flex gap-2 items-start text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}
            {info && (
              <div className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900 rounded-lg p-3">
                {info}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-400 mt-6">
            {mode === 'signin' ? (
              <>
                No account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setErr(null); setInfo(null); }}
                  className="text-emerald-300 hover:underline"
                >
                  Sign up as a professor
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setErr(null); setInfo(null); }}
                  className="text-emerald-300 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
