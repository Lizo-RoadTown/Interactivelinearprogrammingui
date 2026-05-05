/**
 * AirlineModel.tsx — Dreamliner LP demo for the final presentation.
 *
 *   Max  z = 300 x1 + 1980 x2 + 0.335 x3
 *   s.t. 3.8 x1 + 11.1 x2              ≤ 2,688     (cabin space)
 *        240 x1 + 340 x2 + 36 x3       ≤ 120,000   (payload weight)
 *                          0.0429 x3   ≤ 126,000   (cargo volume capacity)
 *        x1 + x2                       ≤ 420       (FAA passenger limit)
 *               x2                     ≤ 22        (business demand max)
 *               x2                     ≥ 20        (business demand min)
 *        x1, x2, x3 ≥ 0
 *
 * Self-contained: solves the LP entirely in the browser. The lower bound
 * x2 ≥ 20 is handled by variable substitution y2 = x2 − 20 (so y2 ≥ 0),
 * which lets the standard ≤-only simplex below stay simple.
 *
 * The solver returns a full §8.3 sensitivity report — shadow prices,
 * allowable RHS ranges, reduced costs, allowable objective-coefficient
 * ranges, plus the final optimal tableau — so the demo can point at
 * exactly where each "+1 unit of resource is worth $X" number comes
 * from.
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
  op: '<=' | '>=';
  baseRhs: number;
}

const VAR_NAMES = ['x1', 'x2', 'x3'] as const;
const VAR_LABELS = ['Economy seats', 'Business class seats', 'Cargo (lb)'] as const;

const BASE_OBJECTIVE: [number, number, number] = [300, 1980, 0.335];

// Per-unit total costs from the team's final-presentation cost breakdown
// (fuel + catering + labor + equipment + airport fees, summed). Implied
// revenue per unit = baseline profit + baseline cost. The cost sliders
// below derive profit from cost so dragging cost ↑ pushes profit ↓.
const BASE_COSTS: [number, number, number] = [60, 150, 0.30];
const BASE_REVENUES: [number, number, number] = [
  BASE_OBJECTIVE[0] + BASE_COSTS[0],   // 360
  BASE_OBJECTIVE[1] + BASE_COSTS[1],   // 2130
  BASE_OBJECTIVE[2] + BASE_COSTS[2],   // 0.635
];
const LS_COSTS = 'airline-demo.costs';

// Six constraints. Five are ≤ and feed the simplex directly; the
// last one (Business demand minimum, x2 ≥ 20) is handled by variable
// substitution y2 = x2 − 20 inside solveLP.
const CONSTRAINTS: ConstraintDef[] = [
  { label: 'Cabin space',          coefficients: [3.8, 11.1, 0],   op: '<=', baseRhs: 2688   },
  { label: 'Payload weight',       coefficients: [240, 340, 36],   op: '<=', baseRhs: 120000 },
  { label: 'Cargo volume capacity',coefficients: [0, 0, 0.0429],   op: '<=', baseRhs: 126000 },
  { label: 'FAA passenger limit',  coefficients: [1, 1, 0],        op: '<=', baseRhs: 420    },
  { label: 'Business demand max',  coefficients: [0, 1, 0],        op: '<=', baseRhs: 22     },
  { label: 'Business demand min',  coefficients: [0, 1, 0],        op: '>=', baseRhs: 20     },
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

// ── Embedded simplex solver with §8.3 sensitivity report ───────────────────
// Standard ≤-only simplex for: max c·x s.t. A·x ≤ b, x ≥ 0, b ≥ 0.
// Returns x, z, status PLUS shadow prices, reduced costs, allowable RHS
// ranges, allowable c (objective coefficient) ranges, the basis, and the
// optimal tableau itself — everything needed to render the textbook
// post-optimality report.

interface Range {
  lower: number;   // -Infinity if unbounded
  upper: number;   //  Infinity if unbounded
}

interface SimplexResult {
  status: 'optimal' | 'unbounded' | 'infeasible';
  x: number[];                  // length n (decision variables)
  z: number;                    // objective value
  // Sensitivity payload (defined only when status === 'optimal'):
  shadowPrices: number[];       // length m, dual y_i per ≤ constraint
  reducedCosts: number[];       // length n, c_B B^-1 a_j − c_j per decision var
  rhsRanges: Range[];           // length m, allowable b_i for current basis
  cRanges: Range[];             // length n, allowable c_j for current basis
  finalTableau: number[][];     // (m+1) × (n+m+1)
  basis: number[];              // length m, basic variable indices
  basicValues: number[];        // length m, values of basic variables (= RHS column)
}

function emptySensitivity(n: number, m: number): Omit<SimplexResult, 'status' | 'x' | 'z'> {
  return {
    shadowPrices: new Array(m).fill(0),
    reducedCosts: new Array(n).fill(0),
    rhsRanges: new Array(m).fill(null).map(() => ({ lower: 0, upper: 0 })),
    cRanges: new Array(n).fill(null).map(() => ({ lower: 0, upper: 0 })),
    finalTableau: [],
    basis: [],
    basicValues: [],
  };
}

function simplex(c: number[], A: number[][], b: number[]): SimplexResult {
  const n = c.length;
  const m = b.length;
  const empty = emptySensitivity(n, m);

  for (let i = 0; i < m; i++) {
    if (b[i] < -1e-9) return { status: 'infeasible', x: [], z: 0, ...empty };
  }

  // Build tableau: m+1 rows × (n + m + 1) cols
  //   cols 0..n-1     : decision variables
  //   cols n..n+m-1   : slacks (one per constraint, identity at start)
  //   col  n+m        : RHS
  const T: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = new Array(n + m + 1).fill(0);
    for (let j = 0; j < n; j++) row[j] = A[i][j];
    row[n + i] = 1;
    row[n + m] = b[i];
    T.push(row);
  }
  const zRow = new Array(n + m + 1).fill(0);
  for (let j = 0; j < n; j++) zRow[j] = -c[j];
  T.push(zRow);

  const basis: number[] = new Array(m);
  for (let i = 0; i < m; i++) basis[i] = n + i;

  const MAX_ITER = 200;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Bland's rule: lowest-index negative z-row entry enters
    let enterCol = -1;
    for (let j = 0; j < n + m; j++) {
      if (T[m][j] < -1e-9) { enterCol = j; break; }
    }
    if (enterCol === -1) break;   // optimal

    // Min-ratio test for leaving variable; Bland's tiebreaker
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
    if (leaveRow === -1) return { status: 'unbounded', x: [], z: 0, ...empty };

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

  // ── Extract optimal solution ────────────────────────────────────────────
  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < m; i++) {
    if (basis[i] < n) x[basis[i]] = T[i][n + m];
  }
  const z = T[m][n + m];
  const basicValues = new Array<number>(m);
  for (let i = 0; i < m; i++) basicValues[i] = T[i][n + m];

  // ── Shadow prices & reduced costs (read straight from optimal z-row) ────
  // Slack column i in optimal tableau equals B^-1 e_i, and z-row[n+i] equals
  // c_B^T B^-1 e_i = y_i = shadow price of constraint i.
  const shadowPrices = new Array<number>(m);
  for (let i = 0; i < m; i++) shadowPrices[i] = T[m][n + i];
  const reducedCosts = new Array<number>(n);
  for (let j = 0; j < n; j++) reducedCosts[j] = T[m][j];

  // ── Allowable RHS range (§8.3.3) ────────────────────────────────────────
  // If b_i changes by Δ, x_B changes by Δ * (i-th column of B^-1), which
  // in the optimal tableau is column (n+i). For feasibility we need
  // basicValues[r] + Δ * T[r][n+i] ≥ 0 for every basic row r.
  const rhsRanges: Range[] = [];
  for (let i = 0; i < m; i++) {
    let lower = -Infinity;
    let upper = Infinity;
    for (let r = 0; r < m; r++) {
      const a = T[r][n + i];
      const v = basicValues[r];
      if (a > 1e-9) {
        // v + Δ a ≥ 0  →  Δ ≥ -v/a
        const bound = -v / a;
        if (bound > lower) lower = bound;
      } else if (a < -1e-9) {
        // v + Δ a ≥ 0  →  Δ ≤ -v/a
        const bound = -v / a;
        if (bound < upper) upper = bound;
      }
    }
    rhsRanges.push({
      lower: lower === -Infinity ? -Infinity : b[i] + lower,
      upper: upper === Infinity ? Infinity : b[i] + upper,
    });
  }

  // ── Allowable c range (§8.3.1 / §8.3.2) ─────────────────────────────────
  // For non-basic var j: reduced cost is T[m][j] ≥ 0. Increasing c_j by δ
  // makes the new reduced cost T[m][j] − δ. Need ≥ 0 → δ ≤ T[m][j].
  // (Decreasing c_j only makes the variable less attractive, so unbounded
  // below in terms of basis stability.)
  // For basic var j (basis[r] = j): δ shifts every other reduced cost by
  //   T[m][k] − δ * T[r][k] ≥ 0 for all non-basic k.
  const cRanges: Range[] = [];
  for (let j = 0; j < n; j++) {
    const basicRow = basis.indexOf(j);
    if (basicRow === -1) {
      // Non-basic
      cRanges.push({ lower: -Infinity, upper: c[j] + T[m][j] });
    } else {
      let lo = -Infinity;
      let hi = Infinity;
      for (let k = 0; k < n + m; k++) {
        if (basis.indexOf(k) !== -1) continue;   // skip basic columns
        const a = T[basicRow][k];
        const r = T[m][k];
        if (a > 1e-9) {
          const bound = r / a;
          if (bound < hi) hi = bound;
        } else if (a < -1e-9) {
          const bound = r / a;
          if (bound > lo) lo = bound;
        }
      }
      cRanges.push({
        lower: lo === -Infinity ? -Infinity : c[j] + lo,
        upper: hi === Infinity ? Infinity : c[j] + hi,
      });
    }
  }

  return {
    status: 'optimal',
    x, z,
    shadowPrices,
    reducedCosts,
    rhsRanges,
    cRanges,
    finalTableau: T,
    basis,
    basicValues,
  };
}

// ── Wrapper that handles the x2 ≥ 20 lower bound via substitution ──────────
// Standard trick: let y2 = x2 − 20, so y2 ≥ 0 and the lower bound becomes
// the ordinary non-negativity constraint already enforced by simplex.
// Each ≤ constraint i has its RHS adjusted by −coef[i,2]·20, the objective
// gains a constant of c[2]·20, and after solving we shift x2 back up by 20.
//
// Sensitivity: shadow prices and reduced costs are invariant under a
// constant translation of a decision variable, so they pass through. RHS
// ranges shift by +coef[i,2]·20 to map back to the ORIGINAL b_i scale. The
// shadow price of the ≥ lower bound itself = reduced cost of y2 (positive
// only when the lower bound is binding, i.e. when x2* = 20).
interface SolveOutput {
  status: 'optimal' | 'unbounded' | 'infeasible';
  x: [number, number, number];
  z: number;
  // Per ORIGINAL constraint index (length 6, including the ≥ row).
  shadowPrices: number[];
  slack: number[];                // b_i − a_i·x for ≤; x·a − b_i for ≥
  rhsRanges: Range[];
  binding: boolean[];
  // Per decision variable (length 3).
  reducedCosts: number[];
  cRanges: Range[];
  // Tableau presented in the ORIGINAL (x1, x2, x3) framing (substitution
  // is invisible to the viewer except for an explanatory note in the UI).
  tableau: number[][];
  basis: number[];                // length = number of ≤ rows = 5
  basicValues: number[];
  // Column headers for the tableau (mirrors solver column ordering).
  tableauColLabels: string[];
  tableauRowLabels: string[];
}

const X2_LOWER = 20;

function solveLP(
  obj: [number, number, number],
  rhs: number[],
): SolveOutput {
  // Index of the ≥ row in CONSTRAINTS (Business demand min)
  const geIdx = CONSTRAINTS.findIndex(c => c.op === '>=');
  // Build a ≤-only LP after substituting y2 = x2 − 20.
  const leRows = CONSTRAINTS.map((c, i) => ({ c, i })).filter(({ c }) => c.op === '<=');
  const A: number[][] = [];
  const bSub: number[] = [];
  for (const { c, i } of leRows) {
    A.push([c.coefficients[0], c.coefficients[1], c.coefficients[2]]);
    bSub.push(rhs[i] - c.coefficients[1] * X2_LOWER);
  }
  // Verify the lower bound itself is feasible: x2_max (≤ row) ≥ x2_min (≥ row).
  const maxBound = rhs[CONSTRAINTS.findIndex(c => c.op === '<=' && c.coefficients[1] === 1 && c.coefficients[0] === 0 && c.coefficients[2] === 0)];
  const minBound = rhs[geIdx];
  if (maxBound !== undefined && minBound > maxBound + 1e-9) {
    return makeInfeasible(rhs);
  }

  const r = simplex([obj[0], obj[1], obj[2]], A, bSub);
  if (r.status !== 'optimal') {
    if (r.status === 'infeasible') return makeInfeasible(rhs);
    return makeUnbounded(rhs);
  }

  // Un-substitute
  const y2 = r.x[1];
  const x: [number, number, number] = [r.x[0], y2 + X2_LOWER, r.x[2]];
  const z = r.z + obj[1] * X2_LOWER;

  // ── Map sensitivity from substituted LP back to original framing ────────
  // Per-constraint shadow prices: ≤ rows pass through; ≥ row's shadow
  // price = reduced cost of y2 (positive only when y2 is non-basic, i.e.
  // the lower bound is binding at x2 = 20).
  const shadowPrices = new Array<number>(CONSTRAINTS.length).fill(0);
  for (let li = 0; li < leRows.length; li++) {
    shadowPrices[leRows[li].i] = r.shadowPrices[li];
  }
  // Lower bound shadow price: dual is positive iff y2 is non-basic at 0
  shadowPrices[geIdx] = (y2 < 1e-6) ? r.reducedCosts[1] : 0;

  // Slack and binding flag per ORIGINAL constraint (in original framing)
  const slack = new Array<number>(CONSTRAINTS.length).fill(0);
  const binding = new Array<boolean>(CONSTRAINTS.length).fill(false);
  for (let i = 0; i < CONSTRAINTS.length; i++) {
    const c = CONSTRAINTS[i];
    const lhs = c.coefficients[0] * x[0] + c.coefficients[1] * x[1] + c.coefficients[2] * x[2];
    if (c.op === '<=') {
      slack[i] = rhs[i] - lhs;
      binding[i] = Math.abs(slack[i]) < 1e-4 * Math.max(1, Math.abs(rhs[i]));
    } else {
      slack[i] = lhs - rhs[i];   // surplus
      binding[i] = Math.abs(slack[i]) < 1e-4 * Math.max(1, Math.abs(rhs[i]));
    }
  }

  // RHS ranges: shift back by +coef[i,2]·20 since we subtracted that off
  const rhsRanges: Range[] = new Array(CONSTRAINTS.length);
  for (let li = 0; li < leRows.length; li++) {
    const { c, i } = leRows[li];
    const subRange = r.rhsRanges[li];
    const shift = c.coefficients[1] * X2_LOWER;
    rhsRanges[i] = {
      lower: subRange.lower === -Infinity ? -Infinity : subRange.lower + shift,
      upper: subRange.upper === Infinity ? Infinity : subRange.upper + shift,
    };
  }
  // Lower-bound row range: how far can x2's lower bound move and keep this
  // basis optimal? In substituted space, that's the range over which y2's
  // non-negativity keeps the same basis. y2 = 0 (binding) means raising the
  // bound increases z (or keeps if non-basic with reduced cost 0); y2 > 0
  // (non-binding, basic) means we can drop the bound until it equals x2.
  if (y2 < 1e-6) {
    // Lower bound is currently binding. Range = [up to optimal cabin/weight/etc, +∞)
    // For simplicity, expose it as "binding, see shadow price".
    rhsRanges[geIdx] = { lower: -Infinity, upper: x[1] };
  } else {
    rhsRanges[geIdx] = { lower: -Infinity, upper: x[1] };
  }

  return {
    status: 'optimal',
    x, z,
    shadowPrices,
    slack,
    rhsRanges,
    binding,
    reducedCosts: r.reducedCosts,
    cRanges: r.cRanges,
    tableau: r.finalTableau,
    basis: r.basis,
    basicValues: r.basicValues,
    tableauColLabels: tableauColLabels(leRows.length),
    tableauRowLabels: tableauRowLabels(r.basis, leRows.length),
  };
}

function tableauColLabels(numLeRows: number): string[] {
  // Decision vars first, then slack-per-≤-row, then RHS.
  const labels: string[] = ['x₁', 'x₂', 'x₃'];
  // Slack labels paired with the ≤ row index (skipping the ≥ row).
  const leLabels = CONSTRAINTS
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.op === '<=')
    .map((_, k) => `s${k + 1}`);
  // Use only the first numLeRows of leLabels (defensive — equal in practice).
  for (let i = 0; i < numLeRows; i++) labels.push(leLabels[i]);
  labels.push('RHS');
  return labels;
}

function tableauRowLabels(basis: number[], numLeRows: number): string[] {
  const decisionLabels = ['x₁', 'x₂', 'x₃'];
  const slackLabels = Array.from({ length: numLeRows }, (_, k) => `s${k + 1}`);
  const labels = basis.map(b => (b < 3 ? decisionLabels[b] : slackLabels[b - 3]));
  labels.push('z');
  return labels;
}

function makeInfeasible(rhs: number[]): SolveOutput {
  return {
    status: 'infeasible',
    x: [0, 0, 0], z: 0,
    shadowPrices: new Array(CONSTRAINTS.length).fill(0),
    slack: new Array(CONSTRAINTS.length).fill(0),
    rhsRanges: rhs.map(b => ({ lower: b, upper: b })),
    binding: new Array(CONSTRAINTS.length).fill(false),
    reducedCosts: [0, 0, 0],
    cRanges: [{ lower: 0, upper: 0 }, { lower: 0, upper: 0 }, { lower: 0, upper: 0 }],
    tableau: [],
    basis: [],
    basicValues: [],
    tableauColLabels: [],
    tableauRowLabels: [],
  };
}

function makeUnbounded(rhs: number[]): SolveOutput {
  const out = makeInfeasible(rhs);
  out.status = 'unbounded';
  return out;
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
      op: c.op,
      rhsProj: rhs[i] - c.coefficients[2] * x3Fixed,
    }))
    .filter(c => Math.abs(c.a1) > 1e-9 || Math.abs(c.a2) > 1e-9)
    .map(c => ({
      started: true,
      label: c.label,
      coefficients: [c.a1, c.a2] as (number | null)[],
      operator: c.op,
      rhs: c.rhsProj,
    }));
  return {
    variables: [
      { name: 'x1', description: 'economy seats' },
      { name: 'x2', description: 'business class seats' },
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
const ALL_LINES_2D: Set<number> = new Set([0, 1, 2, 3, 4, 5]);

// ── Page ────────────────────────────────────────────────────────────────────

type SolveView = SolveOutput;

// Coerce localStorage payloads to the shapes the page expects. The bank of
// constraints grew from 5 → 6, so users with old `airline-demo.rhs` arrays
// in localStorage would otherwise see undefined for index 5 and crash on
// `(undefined).toFixed`. Re-pad against current CONSTRAINTS, validate each
// entry is a real number, fall back to baseline otherwise.
function sanitizeRhs(saved: unknown): number[] {
  const arr = Array.isArray(saved) ? saved : [];
  return CONSTRAINTS.map((c, i) => {
    const v = arr[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : c.baseRhs;
  });
}

function sanitizeTriple(saved: unknown, baseline: readonly [number, number, number]): [number, number, number] {
  const arr = Array.isArray(saved) ? saved : [];
  return [0, 1, 2].map(i => {
    const v = arr[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : baseline[i];
  }) as [number, number, number];
}

export default function AirlineModel() {
  const [obj, setObj] = useState<[number, number, number]>(
    () => sanitizeTriple(loadJSON<unknown>(LS_OBJ, null), BASE_OBJECTIVE),
  );
  const [rhs, setRhs] = useState<number[]>(
    () => sanitizeRhs(loadJSON<unknown>(LS_RHS, null)),
  );
  const [costs, setCosts] = useState<[number, number, number]>(
    () => sanitizeTriple(loadJSON<unknown>(LS_COSTS, null), BASE_COSTS),
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
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_COSTS, JSON.stringify(costs));
    }
  }, [costs]);

  // When a cost slider moves, derive profit = revenue − cost and update
  // the objective coefficient. This is the "slider that affects this
  // slider" link the user asked for: drag fuel/catering/etc. up, watch
  // the corresponding profit drop, watch the optimum and graph shift.
  const setCostFor = (i: 0 | 1 | 2, newCost: number) => {
    setCosts(prev => {
      const a = [...prev] as [number, number, number];
      a[i] = newCost;
      return a;
    });
    setObj(prev => {
      const a = [...prev] as [number, number, number];
      a[i] = BASE_REVENUES[i] - newCost;
      return a;
    });
  };

  // Solve synchronously on every render — the LP is tiny (3 vars, 6
  // constraints), simplex converges in a handful of iterations,
  // browser does it imperceptibly fast on slider drags.
  const result = useMemo<SolveView>(
    () => solveLP([...obj] as [number, number, number], [...rhs]),
    [obj, rhs],
  );

  const reset = () => {
    setObj([...BASE_OBJECTIVE]);
    setRhs(CONSTRAINTS.map(c => c.baseRhs));
    setCosts([...BASE_COSTS]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-6">

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

        {/* ── Side-by-side: graph (left, wider) + slider panels (right) ── */}
        {/* 12-col grid so we can give the graph more room than 50/50 — */}
        {/* graph is 7/12, sliders 5/12 on lg+ screens. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Graph — sticks to top while you scroll the sliders */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:sticky lg:top-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
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
            <p className="text-[10px] text-slate-500 italic mt-1">
              x₃ fixed at {Math.round(result.x[2] ?? 0).toLocaleString()} (current optimum).
            </p>
          </div>

          {/* Sliders column — cost (with profit shown inline) then RHS */}
          <div className="lg:col-span-5 space-y-4">
            {/* One paired box per variable: the cost slider sits above
                the profit slider it drives, with an explicit arrow
                connecting them. Cost up → profit down, in the same box. */}
            {VAR_NAMES.map((n, i) => {
              const costR = sliderRange(BASE_COSTS[i]);
              const objR = sliderRange(BASE_OBJECTIVE[i]);
              return (
                <div
                  key={`pair-${n}`}
                  className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-3"
                >
                  <p className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">
                    {n} — {VAR_LABELS[i]}
                  </p>

                  <SliderRow
                    label="Cost"
                    baseValue={BASE_COSTS[i]}
                    value={costs[i]}
                    min={costR.min}
                    max={costR.max}
                    step={costR.step}
                    onChange={v => setCostFor(i as 0 | 1 | 2, v)}
                  />

                  <p className="text-[10px] text-amber-300/80 italic text-center -my-1">
                    ↓ drives ↓
                  </p>

                  <SliderRow
                    label="Profit (objective coefficient)"
                    baseValue={BASE_OBJECTIVE[i]}
                    value={obj[i]}
                    min={objR.min}
                    max={objR.max}
                    step={objR.step}
                    onChange={v => setObj(prev => {
                      const next: [number, number, number] = [...prev];
                      next[i] = v;
                      return next;
                    })}
                  />
                </div>
              );
            })}

          </div>
        </div>

        {/* ── Constraints — RHS slider, utilization bar, shadow price ── */}
        {/* Each constraint card now shows three things: the RHS slider,
            the LHS/RHS utilization bar, AND the shadow price + slack +
            allowable RHS range. The shadow price is the "$X per +1 unit
            of resource" number — the heart of §8.3.3 sensitivity. */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3 ml-1">
            Constraints — drag the RHS, watch utilization. Shadow price = profit gained per +1 unit of resource.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CONSTRAINTS.map((c, i) => {
              const r = sliderRange(c.baseRhs);
              const lhs = c.coefficients.reduce((s, a, k) => s + a * (result.x[k] ?? 0), 0);
              const limit = rhs[i];
              const pct = limit > 0 ? Math.min(100, (lhs / limit) * 100) : 0;
              const binding = result.binding[i];
              const shadow = result.shadowPrices[i];
              const slack = result.slack[i];
              const range = result.rhsRanges[i];
              const opSym = c.op === '<=' ? '≤' : '≥';
              return (
                <div
                  key={c.label}
                  className={`bg-slate-900 border rounded-2xl p-4 space-y-3 ${
                    binding ? 'border-amber-500/40' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">
                      {c.label} <span className="text-slate-500 normal-case">({opSym})</span>
                      {binding && <span className="ml-2 text-amber-300 normal-case">BINDING</span>}
                    </p>
                  </div>

                  <SliderRow
                    label="RHS (resource limit)"
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

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Utilization (LHS / RHS)</span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {fmtRound(lhs)} / {fmtRound(limit)}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${binding ? 'bg-amber-500' : 'bg-cyan-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Per-constraint sensitivity row — the §8.3.3 numbers */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-800/80">
                    <div>
                      <p className="text-slate-500 uppercase tracking-wide text-[9px]">Shadow price</p>
                      <p className={`font-mono tabular-nums ${binding ? 'text-emerald-300 font-bold' : 'text-slate-400'}`}>
                        {fmtMoney(shadow)}{c.coefficients[2] !== 0 && ' / lb'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 uppercase tracking-wide text-[9px]">
                        {c.op === '<=' ? 'Slack' : 'Surplus'}
                      </p>
                      <p className="font-mono tabular-nums text-slate-300">{fmtRound(slack)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 uppercase tracking-wide text-[9px]">RHS range</p>
                      <p className="font-mono tabular-nums text-slate-300 text-[10px] leading-tight">
                        {fmtRange(range)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Per-variable sensitivity (§8.3.1 / §8.3.2) ─────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3">
            Decision-variable sensitivity — reduced cost & allowable c<sub>j</sub> range
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2 px-2">Variable</th>
                  <th className="text-right py-2 px-2">Optimal value</th>
                  <th className="text-right py-2 px-2">Current c<sub>j</sub></th>
                  <th className="text-right py-2 px-2">Reduced cost</th>
                  <th className="text-right py-2 px-2">Allowable c<sub>j</sub> range</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {VAR_NAMES.map((vn, j) => (
                  <tr key={vn} className="border-b border-slate-800/40">
                    <td className="py-2 px-2 font-sans text-slate-200">
                      <span className="text-slate-400">{vn}</span>{' '}
                      <span className="text-slate-500 text-xs">({VAR_LABELS[j]})</span>
                    </td>
                    <td className="text-right py-2 px-2 text-emerald-300 font-bold">{fmt(result.x[j])}</td>
                    <td className="text-right py-2 px-2 text-slate-300">{fmt(obj[j])}</td>
                    <td className="text-right py-2 px-2 text-slate-300">{fmt(result.reducedCosts[j])}</td>
                    <td className="text-right py-2 px-2 text-slate-300 text-[11px]">{fmtRange(result.cRanges[j])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 italic mt-3 leading-relaxed">
            Reduced cost = penalty per unit if you forced this variable into the basis (0 if already basic).
            The c<sub>j</sub> range is the interval over which the current optimal vertex stays optimal —
            slide the profit slider for any variable inside its range and the decision values shouldn&apos;t change,
            only z does.
          </p>
        </div>

        {/* ── Optimal Simplex Tableau (the visual the audience can point at) ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3">
            Optimal simplex tableau — shadow prices live in the z-row, slack columns
          </p>
          {result.status === 'optimal' && result.tableau.length > 0 ? (
            <TableauView
              tableau={result.tableau}
              rowLabels={result.tableauRowLabels}
              colLabels={result.tableauColLabels}
            />
          ) : (
            <p className="text-amber-300 text-sm">No optimal tableau (status: {result.status}).</p>
          )}
          <p className="text-[10px] text-slate-500 italic mt-3 leading-relaxed">
            Note: the lower bound x<sub>2</sub> ≥ 20 is enforced by substituting y<sub>2</sub> = x<sub>2</sub> − 20
            (so y<sub>2</sub> ≥ 0 falls out as ordinary non-negativity). The columns labeled x<sub>1</sub>, x<sub>2</sub>, x<sub>3</sub>
            above are reading directly off the substituted simplex; the optimal x<sub>2</sub> = y<sub>2</sub><sup>*</sup> + 20 = {fmt(result.x[1])}.
          </p>
        </div>

      </div>
    </div>
  );
}

// ── TableauView: render the (m+1) × (n+m+1) matrix with row/col labels ────

function TableauView({
  tableau,
  rowLabels,
  colLabels,
}: {
  tableau: number[][];
  rowLabels: string[];
  colLabels: string[];
}) {
  return (
    <table className="text-xs font-mono tabular-nums w-full min-w-max">
      <thead>
        <tr className="text-slate-400">
          <th className="text-left py-1 px-2 border-b border-slate-700">basis</th>
          {colLabels.map((cl, j) => (
            <th key={j} className="text-right py-1 px-3 border-b border-slate-700">{cl}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableau.map((row, i) => (
          <tr key={i} className={i === tableau.length - 1 ? 'bg-emerald-500/5 border-t border-emerald-500/30' : ''}>
            <td className="text-slate-300 py-1 px-2 font-bold">{rowLabels[i] ?? ''}</td>
            {row.map((v, j) => (
              <td
                key={j}
                className={`text-right py-1 px-3 ${
                  i === tableau.length - 1 && j >= 3 && j < colLabels.length - 1
                    ? 'text-emerald-300 font-bold'
                    : 'text-slate-200'
                }`}
              >
                {fmtTab(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
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

function fmtMoney(v: number): string {
  if (Math.abs(v) < 1e-9) return '$0';
  if (Math.abs(v) >= 100) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(v) >= 1) return '$' + v.toFixed(2);
  return '$' + v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function fmtRange(r: { lower: number; upper: number }): string {
  const lo = r.lower === -Infinity ? '−∞' : fmt(r.lower);
  const hi = r.upper ===  Infinity ?  '+∞' : fmt(r.upper);
  return `[${lo}, ${hi}]`;
}

// Tableau cells: short, no thousand separators (so the columns line up).
function fmtTab(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v) && Math.abs(v) < 1e6) return String(v);
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(3).replace(/\.?0+$/, '');
  return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}
