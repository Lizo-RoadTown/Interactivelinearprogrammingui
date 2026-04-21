/**
 * useLPWorkspace.ts
 *
 * Orchestrates the unified LP Workspace. Wraps useLPSolver (which owns the
 * actual LP state + API calls) and adds the workspace-level concerns:
 *
 *   - Which LPProblem is currently loaded
 *   - The narrative banner (current instruction to the student)
 *   - Lens visibility (which panels are open — Phase B)
 *   - Tutorial script attachment (Phase C)
 *
 * The key principle: one state, many lenses. Every lens that renders data
 * reads from useLPSolver via this hook. Mutations go through here so every
 * lens sees the effect.
 */

import { useState, useCallback, useEffect } from 'react';
import { LPProblem } from '../types';
import { useLPSolver } from './useLPSolver';

// ── Narrative banner (thin instruction layer above the tableau) ──────────────

export interface NarrativeBanner {
  kind: 'info' | 'question' | 'correct' | 'wrong' | 'hint';
  text: string;
  /** Optional secondary action, e.g. "Walk me through it" */
  action?: { label: string; onClick: () => void };
}

// ── Lens visibility (Phase B will expand) ────────────────────────────────────

export type LensId =
  | 'tableau'
  | 'graph'
  | 'formulation'
  | 'solution'
  | 'matrix'
  | 'shadow'
  | 'sensitivity'
  | 'dual'
  | 'history';

const DEFAULT_LENSES: Record<LensId, boolean> = {
  // Focused default — tableau + graph center, everything else behind toggles
  tableau:     true,
  graph:       true,
  formulation: false,
  solution:    false,
  matrix:      false,
  shadow:      false,
  sensitivity: false,
  dual:        false,
  history:     false,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLPWorkspace(initialProblem?: LPProblem) {
  const solver = useLPSolver();

  const [problem, setProblem] = useState<LPProblem | null>(initialProblem ?? null);
  const [method, setMethod] = useState<'simplex' | 'big-m' | 'two-phase'>('simplex');
  const [banner, setBanner] = useState<NarrativeBanner | null>(null);
  const [lenses, setLenses] = useState<Record<LensId, boolean>>(DEFAULT_LENSES);

  // Auto-solve when a new problem is loaded
  useEffect(() => {
    if (problem) void solver.solve(problem, method);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, method]);

  const loadProblem = useCallback((p: LPProblem, m: 'simplex' | 'big-m' | 'two-phase' = 'simplex') => {
    setMethod(m);
    setProblem(p);
    setBanner(null);
  }, []);

  const toggleLens = useCallback((id: LensId) => {
    setLenses(s => ({ ...s, [id]: !s[id] }));
  }, []);

  const openLens = useCallback((id: LensId) => {
    setLenses(s => ({ ...s, [id]: true }));
  }, []);

  const closeLens = useCallback((id: LensId) => {
    setLenses(s => ({ ...s, [id]: false }));
  }, []);

  return {
    // LP state (pass-through from solver)
    problem,
    method,
    solver,
    // Narrative
    banner,
    setBanner,
    // Lenses
    lenses,
    toggleLens,
    openLens,
    closeLens,
    // Mutations
    loadProblem,
    setMethod,
  };
}
