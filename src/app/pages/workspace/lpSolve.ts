/**
 * Tiny 2D LP solver — enumerates corner points of the feasible region and
 * picks the one with the best objective value. Used by the sensitivity
 * playground so we can recompute the optimum live as the student drags
 * RHS or objective sliders.
 *
 * Assumptions:
 *  - 2 decision variables (x₁, x₂) with non-negativity x_i ≥ 0.
 *  - All constraints are ≤.
 *
 * Returns null if the feasible region is empty.
 */

import { LPDraft } from './guidedTypes';

export interface LPSolution {
  x1: number;
  x2: number;
  z: number;
}

export function solveLP2D(draft: LPDraft, sense: 'max' | 'min' = 'max'): LPSolution | null {
  const c1 = draft.objectiveCoefficients[0];
  const c2 = draft.objectiveCoefficients[1];
  if (c1 == null || c2 == null) return null;

  const lines = draft.constraints
    .map(c => ({ a: c.coefficients[0], b: c.coefficients[1], rhs: c.rhs }))
    .filter(l => l.a != null && l.b != null && l.rhs != null) as {
      a: number; b: number; rhs: number;
    }[];
  if (lines.length === 0) return null;

  // Axis "lines": x₂ = 0 and x₁ = 0. These provide the non-negativity
  // boundaries when intersected with constraint lines.
  const axisLines = [
    { a: 0, b: 1, rhs: 0 },  // x₂ = 0
    { a: 1, b: 0, rhs: 0 },  // x₁ = 0
  ];
  const all = [...lines, ...axisLines];

  const corners: LPSolution[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const L1 = all[i], L2 = all[j];
      const det = L1.a * L2.b - L2.a * L1.b;
      if (Math.abs(det) < 1e-9) continue;
      const x = (L1.rhs * L2.b - L2.rhs * L1.b) / det;
      const y = (L1.a * L2.rhs - L2.a * L1.rhs) / det;
      if (x < -1e-6 || y < -1e-6) continue;
      // Feasibility against all ≤ constraints
      const feasible = lines.every(l => l.a * x + l.b * y <= l.rhs + 1e-6);
      if (!feasible) continue;
      const z = c1 * x + c2 * y;
      corners.push({ x1: x, x2: y, z });
    }
  }
  if (corners.length === 0) return null;

  return corners.reduce((best, c) =>
    sense === 'max'
      ? (c.z > best.z + 1e-9 ? c : best)
      : (c.z < best.z - 1e-9 ? c : best),
    corners[0],
  );
}

/** Apply per-constraint RHS deltas and per-variable objective-coefficient
 *  deltas to a draft, returning a new draft. Used to compute a "live"
 *  draft for the sensitivity playground without mutating the original. */
export function applyPerturbation(
  draft: LPDraft,
  rhsDelta: number[],
  objDelta: number[],
): LPDraft {
  return {
    ...draft,
    objectiveCoefficients: draft.objectiveCoefficients.map((c, i) =>
      c == null ? c : c + (objDelta[i] ?? 0),
    ),
    constraints: draft.constraints.map((c, i) => ({
      ...c,
      coefficients: [...c.coefficients],
      rhs: c.rhs == null ? c.rhs : c.rhs + (rhsDelta[i] ?? 0),
    })),
  };
}
