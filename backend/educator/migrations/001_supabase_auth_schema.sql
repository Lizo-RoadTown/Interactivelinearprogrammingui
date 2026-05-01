-- ============================================================================
-- Migration 001: switch problem-bank schema from anonymous bank_id to
--                authenticated, per-professor bank_name + RLS.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New
-- query → paste → Run). Do NOT run it before the frontend has been
-- updated to use the new schema — the existing FastAPI /api/admin/banks
-- routes still write to the old bank_id partition and will start failing
-- the moment this is applied.
--
-- What it does:
--   1. Drops the legacy problems table (small loss; everything in there
--      was throwaway test data).
--   2. Creates `banks` — a tiny table whose primary key is the bank slug
--      students type in. Each bank is owned by one professor (user_id).
--   3. Creates `problems` — scoped to (bank_name, problem_id). Cascades
--      deletes when a bank is removed.
--   4. Enables Row-Level Security on both tables.
--   5. Policies: anyone (including unauthenticated students) can SELECT;
--      only authenticated bank-owners can INSERT/UPDATE/DELETE.
--   6. updated_at trigger keeps the column accurate without app code.
-- ============================================================================

-- ── 1. Drop legacy ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.problems CASCADE;

-- ── 2. banks: globally-unique slug, owned by one professor ──────────────────
CREATE TABLE public.banks (
  bank_name      TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_label  TEXT,             -- optional human-readable name for UI
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX banks_user_id_idx ON public.banks(user_id);

COMMENT ON TABLE  public.banks IS 'One row per professor-claimed bank slug. Bank slug is what students type/select to find their class problems.';
COMMENT ON COLUMN public.banks.bank_name IS 'Globally unique slug. First professor to claim a name owns it.';

-- ── 3. problems: bank-scoped, JSONB body ────────────────────────────────────
CREATE TABLE public.problems (
  bank_name    TEXT NOT NULL REFERENCES public.banks(bank_name) ON DELETE CASCADE,
  problem_id   TEXT NOT NULL,
  data         JSONB NOT NULL,    -- the LP word problem dict (id, scenario, vars, constraints, ...)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bank_name, problem_id)
);

CREATE INDEX problems_bank_idx ON public.problems(bank_name);

-- ── 4. updated_at trigger function (reusable) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER banks_set_updated_at
  BEFORE UPDATE ON public.banks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER problems_set_updated_at
  BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. Enable RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.banks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

-- ── 6. Policies on `banks` ──────────────────────────────────────────────────
-- Public can SELECT (the dropdown of all banks lives here)
CREATE POLICY banks_select_public ON public.banks
  FOR SELECT
  USING (true);

-- Authenticated user can claim a new bank slug, but only with their own user_id
CREATE POLICY banks_insert_authenticated ON public.banks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owner can update the row (rename display_label, etc.) but cannot reassign user_id
CREATE POLICY banks_update_owner ON public.banks
  FOR UPDATE
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner can drop their bank (cascades to its problems)
CREATE POLICY banks_delete_owner ON public.banks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 7. Policies on `problems` ───────────────────────────────────────────────
-- Public can SELECT (students don't sign in — they just read)
CREATE POLICY problems_select_public ON public.problems
  FOR SELECT
  USING (true);

-- Owner of the parent bank can INSERT
CREATE POLICY problems_insert_owner ON public.problems
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.banks b
      WHERE b.bank_name = problems.bank_name
        AND b.user_id   = auth.uid()
    )
  );

-- Owner of the parent bank can UPDATE
CREATE POLICY problems_update_owner ON public.problems
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.banks b
      WHERE b.bank_name = problems.bank_name
        AND b.user_id   = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.banks b
      WHERE b.bank_name = problems.bank_name
        AND b.user_id   = auth.uid()
    )
  );

-- Owner of the parent bank can DELETE
CREATE POLICY problems_delete_owner ON public.problems
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.banks b
      WHERE b.bank_name = problems.bank_name
        AND b.user_id   = auth.uid()
    )
  );
