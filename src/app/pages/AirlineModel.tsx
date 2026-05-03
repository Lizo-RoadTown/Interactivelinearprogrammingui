/**
 * AirlineModel.tsx — one-off page for the team's final-presentation LP.
 *
 *   Max  z = 300 x1 + 1980 x2 + 0.335 x3
 *   s.t. 3.8 x1 + 11.1 x2          ≤ 2,688      (cabin space)
 *        240 x1 + 340 x2 + x3      ≤ 120,000    (weight)
 *                          x3      ≤ 126,000    (cargo capacity)
 *        x1 + x2                   ≤ 420        (passenger limit)
 *               x2                 ≤ 22         (business demand)
 *        x1, x2, x3 ≥ 0
 *
 * Self-contained: solves the LP entirely in the browser via a small
 * embedded simplex routine — no backend roundtrip, no /api/solve call.
 * Works on the static-only Render deployment.
 *
 * UI: a constraint-utilization chart (one horizontal bar per constraint,
 * filled to LHS / RHS with a BINDING badge when at the limit) takes the
 * place of a 2D feasible-region graph (which doesn't apply to a 3-variable
 * LP). Sliders for objective coefficients and RHS values re-solve live.
 */

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import DiscoveryGraph from './workspace/DiscoveryGraph';
import { LPDraft } from './workspace/guidedTypes';

// localStorage keys — persist slider state across reloads so a what-if
// scenario isn't wiped by a tab close or accidental refresh.
const LS_OBJ = 'airline-demo.obj';
const LS_RHS = 'airline-demo.rhs';

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// ── The LP, as code ─────────────────────────────────────────────────────────

interface ConstraintDef {
  label: string;
  coefficients: [number, number, number]; // x1, x2, x3
  baseRhs: number;
}

const VAR_NAMES = ['x1', 'x2', 'x3'] as const;
const VAR_LABELS = ['Coach passengers', 'Business passengers', 'Cargo (lb)'] as const;

const BASE_OBJECTIVE: [number, number, number] = [300, 1980, 0.335];

const CONSTRAINTS: ConstraintDef[] = [
  { label: 'Cabin space',     coefficients: [3.8, 11.1, 0], baseRhs: 2688 },
  { label: 'Weight',          coefficients: [240, 340, 1],  baseRhs: 120000 },
  { label: 'Cargo capacity',  coefficients: [0, 0, 1],      baseRhs: 126000 },
  { label: 'Passenger limit', coefficients: [1, 1, 0],      baseRhs: 420 },
  { label: 'Business demand', coefficients: [0, 1, 0],      baseRhs: 22 },
];

function sliderRange(value: number): { min: number; max: number; step: number } {
  const span = Math.max(Math.abs(value) * 0.5, 1);
  const niceStep = span > 100 ? Math.max(1, Math.round(span / 100)) : span > 10 ? 0.1 : 0.01;
  return {
    min: Math.max(0, +(value - span).toFixed(2)),
    max: +(value + span).toFixed(2),
    step: niceStep,
  };
}

// ── Embedded simplex solver ─────────────────────────────────────────────────
// Standard simplex for: max c·x  subject to  A·x ≤ b,  x ≥ 0,  b ≥ 0.
// Initial basis is the slack variables (one per constraint), so the all-zero
// origin is a feasible BFS as long as every b_i ≥ 0 (which it always is for
// this airline model — RHS sliders are clamped to ≥ 0).

interface SimplexResult {
  status: 'optimal' | 'unbounded' | 'infeasible';
  x: number[];   // length n (decision variables)
  z: number;     // objective value
}

function simplex(
  c: number[],
  A: number[][],
  b: number[],
): SimplexResult {
  const n = c.length;
  const m = b.length;

  // Reject negative RHS — origin no longer a feasible BFS.
  for (let i = 0; i < m; i++) {
    if (b[i] < -1e-9) return { status: 'infeasible', x: [], z: 0 };
  }

  // Build tableau:
  //   m constraint rows + 1 objective row
  //   n decision cols + m slack cols + 1 RHS col
  const T: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = new Array(n + m + 1).fill(0);
    for (let j = 0; j < n; j++) row[j] = A[i][j];
    row[n + i] = 1;             // identity slack
    row[n + m] = b[i];          // RHS
    T.push(row);
  }
  const zRow = new Array(n + m + 1).fill(0);
  for (let j = 0; j < n; j++) zRow[j] = -c[j];   // maximization → negate
  T.push(zRow);

  const basis = new Array(m);
  for (let i = 0; i < m; i++) basis[i] = n + i;

  const MAX_ITER = 200;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Bland's rule (avoids cycling): pick LOWEST-index column with negative
    // entry in the z-row.
    let enterCol = -1;
    for (let j = 0; j < n + m; j++) {
      if (T[m][j] < -1e-9) { enterCol = j; break; }
    }
    if (enterCol === -1) {
      // Optimal — extract solution
      const x = new Array(n).fill(0);
      for (let i = 0; i < m; i++) {
        if (basis[i] < n) x[basis[i]] = T[i][n + m];
      }
      return { status: 'optimal', x, z: T[m][n + m] };
    }

    // Min-ratio test for leaving variable. Bland's rule again for ties.
    let leaveRow = -1;
    let minRatio = Infinity;
    for (let i = 0; i < m; i++) {
      const a = T[i][enterCol];
      if (a > 1e-9) {
        const ratio = T[i][n + m] / a;
        if (ratio < minRatio - 1e-12 ||
            (Math.abs(ratio - minRatio) < 1e-12 && (leaveRow === -1 || basis[i] < basis[leaveRow]))) {
          minRatio = ratio;
          leaveRow = i;
        }
      }
    }
    if (leaveRow === -1) return { status: 'unbounded', x: [], z: 0 };

    // Pivot
    const piv = T[leaveRow][enterCol];
    for (let j = 0; j <= n + m; j++) T[leaveRow][j] /= piv;
    for (let i = 0; i <= m; i++) {
      if (i === leaveRow) continue;
      const f = T[i][enterCol];
      if (Math.abs(f) < 1e-12) continue;
      for (let j = 0; j <= n + m; j++) T[i][j] -= f * T[leaveRow][j];
    }
    basis[leaveRow] = enterCol;
  }
  // Should never hit MAX_ITER for this small LP, but guard anyway.
  return { status: 'unbounded', x: [], z: 0 };
}

// ── 2D projection: 3-var airline LP → LPDraft for DiscoveryGraph ─────────
//
// Project the 3-variable LP onto the (x1, x2) plane by substituting
// x3 = x3* into each constraint. Constraints whose 2D coefficient pair
// becomes (0, 0) (e.g. cargo capacity x3 ≤ 126,000 once x3 is fixed)
// are dropped — they're either trivially satisfied or trivially
// infeasible and contribute no line to the (x1, x2) picture.

function projectTo2D(
  obj: [number, number, number],
  rhs: number[],
  x3Fixed: number,
): LPDraft {
  const constraints = CONSTRAINTS
    .map((c, i) => ({
      a1: c.coefficients[0],
      a2: c.coefficients[1],
      a3: c.coefficients[2],
      label: c.label,
      rhsProj: rhs[i] - c.coefficients[2] * x3Fixed,
    }))
    .filter(c => Math.abs(c.a1) > 1e-9 || Math.abs(c.a2) > 1e-9)
    .map(c => ({
      started: true,
      label: c.label,
      coefficients: [c.a1, c.a2] as (number | null)[],
      operator: '<=' as const,
      rhs: c.rhsProj,
    }));
  return {
    variables: [
      { name: 'x1', description: 'coach passengers' },
      { name: 'x2', description: 'business passengers' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [obj[0], obj[1]],
    constraints,
  };
}

// DiscoveryGraph asks which constraint indices have had their LINE
// revealed (linesDrawn) and which have had their SIDE chosen
// (sideDrawnFor). The airline page wants every line/side visible from
// the start, so a "max-out" set of indices is passed in for both.
const ALL_LINES_2D: Set<number> = new Set([0, 1, 2, 3, 4]);

// ── Page ────────────────────────────────────────────────────────────────────

interface SolveView {
  status: 'optimal' | 'infeasible' | 'unbounded';
  z: number;
  x: number[];
  bindingConstraints: boolean[];
}

export default function AirlineModel() {
  const [obj, setObj] = useState<[number, number, number]>(
    () => loadJSON<[number, number, number]>(LS_OBJ, [...BASE_OBJECTIVE]),
  );
  const [rhs, setRhs] = useState<number[]>(
    () => loadJSON<number[]>(LS_RHS, CONSTRAINTS.map(c => c.baseRhs)),
  );

  // Persist slider state on every change so reloads/tab closes don't
  // wipe a what-if scenario.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_OBJ, JSON.stringify(obj));
    }
  }, [obj]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_RHS, JSON.stringify(rhs));
    }
  }, [rhs]);

  // Solve synchronously on every render — the LP is tiny (3 vars, 5
  // constraints), simplex converges in a handful of iterations,
  // browser does it imperceptibly fast on slider drags.
  const result = useMemo<SolveView>(() => {
    const A = CONSTRAINTS.map(c => [c.coefficients[0], c.coefficients[1], c.coefficients[2]]);
    const r = simplex([...obj], A, [...rhs]);
    if (r.status !== 'optimal') {
      return {
        status: r.status,
        z: 0,
        x: [0, 0, 0],
        bindingConstraints: CONSTRAINTS.map(() => false),
      };
    }
    const binding = CONSTRAINTS.map((c, i) => {
      const lhs = c.coefficients.reduce((s, a, k) => s + a * (r.x[k] ?? 0), 0);
      return Math.abs(lhs - rhs[i]) < 1e-4 * Math.max(1, rhs[i]);
    });
    return { status: 'optimal', z: r.z, x: r.x, bindingConstraints: binding };
  }, [obj, rhs]);

  const reset = () => {
    setObj([...BASE_OBJECTIVE]);
    setRhs(CONSTRAINTS.map(c => c.baseRhs));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-6 sm:p-8 space-y-6">

        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <Button onClick={reset} variant="outline" size="sm" className="text-slate-300">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to baseline
          </Button>
        </div>

        {/* Compact optimum strip — just so you can see what the sliders
            are doing. Kept tiny so it doesn't compete with the chart. */}
        {result.status === 'optimal' ? (
          <div className="text-sm font-mono text-slate-300 tabular-nums flex flex-wrap gap-4">
            <span>x1*={fmtRound(result.x[0])}</span>
            <span>x2*={fmtRound(result.x[1])}</span>
            <span>x3*={fmtRound(result.x[2])}</span>
            <span className="text-emerald-300 font-bold">z*={fmtRound(result.z)}</span>
          </div>
        ) : (
          <p className="text-amber-300 text-sm">Status: <strong>{result.status}</strong></p>
        )}

        {/* ── 2D feasible-region projection (x1 vs x2, x3 fixed) ──────── */}
        {/* Uses the same DiscoveryGraph component the rest of the app uses
            so colors, calibration, and the optimum marker match. We project
            the 3-var LP onto the (x1, x2) plane by substituting x3 = x3*
            into the weight constraint and dropping constraints that don't
            involve x1 or x2 (e.g. cargo capacity becomes 0 ≤ const). */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">
            Feasible region — x₁ vs x₂ (x₃ projected at optimum)
          </p>
          <DiscoveryGraph
            draft={projectTo2D(obj, rhs, result.x[2] ?? 0)}
            linesDrawn={ALL_LINES_2D}
            sideDrawnFor={ALL_LINES_2D}
            feasibleRegionRevealed
            bfsPoint={result.status === 'optimal' ? { x: result.x[0] ?? 0, y: result.x[1] ?? 0 } : null}
            optimumConfirmed={result.status === 'optimal'}
            optimumTarget={result.z}
          />
          <p className="text-[10px] text-slate-500 italic mt-2">
            x₃ fixed at {Math.round(result.x[2] ?? 0).toLocaleString()} (current optimum). Drag any
            slider above to see how the constraint lines and the green optimum point shift.
          </p>
        </div>

        {/* ── Constraint utilization chart ─────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">
            Constraint utilization (LHS ÷ RHS)
          </p>
          <div className="space-y-3">
            {CONSTRAINTS.map((c, i) => {
              const lhs = c.coefficients.reduce((s, a, k) => s + a * (result.x[k] ?? 0), 0);
              const limit = rhs[i];
              const pct = limit > 0 ? Math.min(100, (lhs / limit) * 100) : 0;
              const binding = result.bindingConstraints[i];
              return (
                <div key={c.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-semibold">{c.label}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {fmtRound(lhs)} / {fmtRound(limit)}
                      {binding && <span className="ml-2 text-amber-300 font-semibold">BINDING</span>}
                    </span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${binding ? 'bg-amber-500' : 'bg-cyan-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sliders — Objective coefficients ─────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Objective coefficients — what each variable contributes to profit
          </p>
          {VAR_NAMES.map((n, i) => {
            const r = sliderRange(BASE_OBJECTIVE[i]);
            return (
              <SliderRow
                key={n}
                label={`${n} — ${VAR_LABELS[i]}`}
                baseValue={BASE_OBJECTIVE[i]}
                value={obj[i]}
                min={r.min}
                max={r.max}
                step={r.step}
                onChange={v => setObj(prev => {
                  const next: [number, number, number] = [...prev];
                  next[i] = v;
                  return next;
                })}
              />
            );
          })}
        </div>

        {/* ── Sliders — Constraint RHS ────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Constraint right-hand sides — resource availability
          </p>
          {CONSTRAINTS.map((c, i) => {
            const r = sliderRange(c.baseRhs);
            return (
              <SliderRow
                key={c.label}
                label={c.label}
                baseValue={c.baseRhs}
                value={rhs[i]}
                min={r.min}
                max={r.max}
                step={r.step}
                onChange={v => setRhs(prev => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                })}
              />
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function SliderRow({
  label, baseValue, value, min, max, step, onChange,
}: {
  label: string;
  baseValue: number;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const changed = Math.abs(value - baseValue) > 1e-9;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-slate-300 font-semibold">{label}</span>
        <span className="font-mono tabular-nums text-slate-200">
          <span className="text-base font-bold">{fmt(value)}</span>
          {changed && (
            <span className="text-slate-500 ml-2 text-[10px]">
              (baseline {fmt(baseValue)}, {value > baseValue ? '+' : ''}{fmt(value - baseValue)})
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 tabular-nums w-14 text-right">{fmt(min)}</span>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-5 accent-cyan-500 cursor-pointer"
        />
        <span className="text-[10px] text-slate-500 tabular-nums w-14">{fmt(max)}</span>
      </div>
    </div>
  );
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return v.toLocaleString('en-US');
  if (Math.abs(v) >= 100) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return v.toFixed(3).replace(/\.?0+$/, '');
}

function fmtRound(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}
