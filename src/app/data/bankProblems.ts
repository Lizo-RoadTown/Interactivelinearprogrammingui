/**
 * bankProblems.ts — bridge between professor-saved problems (in Supabase)
 * and the student-facing pages.
 *
 * A student picks a bank slug on the splash. Their selection is stored
 * in localStorage as `lp.activeBank` and drives every student page:
 *
 *   useBankProblems() → built-ins + active bank's problems
 *   useAllBanks()     → list of all banks (for the splash dropdown)
 *
 * Built-in problems (the hardcoded WORD_PROBLEMS array) come with rich
 * pedagogy data — formulation hints, scenario highlights, solving
 * hints. Bank-saved problems carry only the LP shape; the coercer
 * fills the missing pedagogy fields with empty defaults so the student
 * pages render without crashing. When a bank entry collides with a
 * built-in id, the bank entry wins (a professor editing a built-in is
 * intentional override).
 */

import { useEffect, useState } from 'react';
import {
  WORD_PROBLEMS, WordProblem, WPDifficulty, WPCategory, WPMethod,
} from './wordProblems';
import { Constraint } from '../types';
import { supabase, isConfigured } from '../lib/supabase';

const ACTIVE_BANK_KEY = 'lp.activeBank';

export function getActiveBank(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ACTIVE_BANK_KEY) ?? '';
}

export function setActiveBank(bankName: string) {
  if (typeof window === 'undefined') return;
  if (bankName) localStorage.setItem(ACTIVE_BANK_KEY, bankName);
  else localStorage.removeItem(ACTIVE_BANK_KEY);
  // Notify same-tab listeners; the cross-tab `storage` event already covers other tabs.
  window.dispatchEvent(new CustomEvent('lp-active-bank-change'));
}

const DIFFICULTY_MAP: Record<string, WPDifficulty> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  Beginner: 'Beginner',
  Intermediate: 'Intermediate',
  Advanced: 'Advanced',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceConstraint(c: any, i: number, numVars: number): Constraint {
  const coeffs: number[] = Array.isArray(c?.coefficients)
    ? c.coefficients.map((n: unknown) => Number(n) || 0)
    : [];
  while (coeffs.length < numVars) coeffs.push(0);
  return {
    id: typeof c?.id === 'string' && c.id ? c.id : `c${i + 1}`,
    coefficients: coeffs.slice(0, numVars),
    operator: (c?.operator === '>=' || c?.operator === '=') ? c.operator : '<=',
    rhs: typeof c?.rhs === 'number' ? c.rhs : Number(c?.rhs) || 0,
    label: typeof c?.label === 'string' ? c.label : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function coerceBankProblem(p: any): WordProblem | null {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.id !== 'string' || !p.id) return null;

  const numVars = Math.max(
    1,
    Number(p.numVars) || (Array.isArray(p.variables) ? p.variables.length : 0) || 2,
  );

  // variables can be string[] (admin shape) or {name, description}[] (full shape)
  const rawVars = Array.isArray(p.variables) ? p.variables : [];
  const variableNames: string[] = rawVars
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((v: any) => typeof v === 'string' ? v : (v && typeof v.name === 'string' ? v.name : ''))
    .filter((s: string) => !!s);
  while (variableNames.length < numVars) variableNames.push(`x${variableNames.length + 1}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variables = variableNames.slice(0, numVars).map((name: string, i: number) => {
    const orig = rawVars[i];
    const description = (orig && typeof orig === 'object' && typeof orig.description === 'string')
      ? orig.description
      : name;
    return { name, description };
  });

  const objCoeffs: number[] = Array.isArray(p.objectiveCoefficients)
    ? p.objectiveCoefficients.map((n: unknown) => Number(n) || 0)
    : [];
  while (objCoeffs.length < numVars) objCoeffs.push(0);

  return {
    id: p.id,
    title: typeof p.title === 'string' && p.title ? p.title : p.id,
    category: (p.category as WPCategory) || 'Product Mix',
    difficulty: DIFFICULTY_MAP[p.difficulty] ?? 'Intermediate',
    numVars,
    scenario: typeof p.scenario === 'string' ? p.scenario : '',
    variables,
    objectiveType: p.objectiveType === 'min' ? 'min' : 'max',
    objectiveCoefficients: objCoeffs.slice(0, numVars),
    constraints: Array.isArray(p.constraints)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? p.constraints.map((c: any, i: number) => coerceConstraint(c, i, numVars))
      : [],
    method: (p.method as WPMethod) || 'simplex',
    formulationHints: {
      variables: '',
      objective: '',
      constraints: [],
      method: '',
    },
    methodExplanation: '',
    solvingHints: {},
  };
}

export function mergeBankWithBuiltins(bank: WordProblem[]): WordProblem[] {
  const byId = new Map<string, WordProblem>();
  for (const p of WORD_PROBLEMS) byId.set(p.id, p);
  for (const p of bank) byId.set(p.id, p); // bank wins on id collision
  return Array.from(byId.values());
}

// Subscribe to active-bank changes (same tab via custom event, other tabs via storage)
function useActiveBank(): string {
  const [bank, setBank] = useState<string>(() => getActiveBank());
  useEffect(() => {
    const handler = () => setBank(getActiveBank());
    window.addEventListener('lp-active-bank-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('lp-active-bank-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return bank;
}

export interface BankSummary {
  bank_name: string;
  display_label: string | null;
}

/** All banks any professor has claimed (for the student dropdown). */
export function useAllBanks() {
  const [banks, setBanks] = useState<BankSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(isConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('banks')
      .select('bank_name, display_label')
      .order('display_label', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setBanks(data as BankSummary[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { banks, loading };
}

/**
 * Built-in WORD_PROBLEMS plus the problems in the student's currently
 * selected bank. If no bank is selected (or Supabase isn't configured),
 * just the built-ins. Re-runs when the active bank changes.
 */
export function useAllProblems() {
  const activeBank = useActiveBank();
  const [bankProblems, setBankProblems] = useState<WordProblem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!supabase || !activeBank) {
      setBankProblems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('problems')
      .select('data')
      .eq('bank_name', activeBank)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setBankProblems([]);
        } else {
          const coerced = (data as { data: unknown }[])
            .map(r => coerceBankProblem(r.data))
            .filter((p): p is WordProblem => p !== null);
          setBankProblems(coerced);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeBank]);

  const problems = bankProblems.length === 0
    ? WORD_PROBLEMS
    : mergeBankWithBuiltins(bankProblems);

  return { problems, bankProblems, loading, activeBank };
}
