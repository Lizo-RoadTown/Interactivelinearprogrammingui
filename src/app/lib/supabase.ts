/**
 * Supabase client singleton.
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the build-time
 * environment. Both are safe to ship in browser code — the anon key is
 * designed for client use and Row-Level Security policies (defined in
 * the Postgres schema) are what actually gate access.
 *
 * Local dev: put values in .env.local at the repo root.
 * Production (Render / Vercel): set them as build-time env vars.
 *
 * If either is missing, this module exports `null` for the client and
 * `isConfigured = false`. The auth/data hooks check that flag and
 * degrade gracefully — student pages still render the built-in word
 * problems even when Supabase isn't configured yet.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};

const SUPABASE_URL: string = _env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY: string = _env.VITE_SUPABASE_ANON_KEY ?? '';

export const isConfigured: boolean = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
