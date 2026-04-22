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

/**
 * Build the canonical basis ordering at a vertex: decision vars first
 * (in index order), then slacks (in constraint-index order).
 */
export function basisLabelsAtVertex(
  zeroDecisionVars: number[],
  tightConstraints: number[],
  nDecVars: number,
  nConstraints: number,
): string[] {
  const basic: string[] = [];
  for (let i = 0; i < nDecVars; i++) {
    if (!zeroDecisionVars.includes(i)) basic.push(`x${i + 1}`);
  }
  for (let i = 0; i < nConstraints; i++) {
    if (!tightConstraints.includes(i)) basic.push(`s${i + 1}`);
  }
  return basic;
}

/**
 * Construct the full simplex tableau at an arbitrary vertex (basis).
 * This is the Phase 6 core operation: every vertex of the feasible
 * polygon IS a basis; every basis IS a tableau. Clicking a different
 * vertex on the graph should produce a different tableau here.
 *
 * Returns { matrix, basis } in the same shape used by the pivot-applied
 * commit: matrix is (m+1) × (n+1) with basic rows + z-row, columns in
 * all-vars order (decision vars then slacks) followed by RHS; basis is
 * length m.
 *
 * Only supports 2×2 basis for now (the Toy Factory problem). Larger
 * bases need a general matrix inverse.
 */
export function tableauAtVertex(
  draft: LPDraft,
  vertex: { x: number; y: number; zeroDecisionVars: number[]; tightConstraints: number[] },
  nDecVars: number,
): { matrix: number[][]; basis: string[] } | null {
  const nConstraints = draft.constraints.length;
  const basis = basisLabelsAtVertex(
    vertex.zeroDecisionVars,
    vertex.tightConstraints,
    nDecVars,
    nConstraints,
  );
  const nBasis = basis.length;
  if (nBasis !== 2 || nConstraints !== 2) return null;

  // Get the column of A for any variable label (x_i or s_i).
  const colForLabel = (label: string): number[] => {
    if (label.startsWith('x')) {
      const i = parseInt(label.slice(1), 10) - 1;
      return draft.constraints.map(c => c.coefficients[i] ?? 0);
    }
    const i = parseInt(label.slice(1), 10) - 1;
    return draft.constraints.map((_, r) => (r === i ? 1 : 0));
  };

  // B (m×m) with basic-variable columns
  const BCols = basis.map(colForLabel);
  const B: number[][] = Array.from({ length: nConstraints }, (_, r) =>
    BCols.map(col => col[r]),
  );
  const a = B[0][0], b = B[0][1], c = B[1][0], d = B[1][1];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return null;
  const Binv: number[][] = [[d / det, -b / det], [-c / det, a / det]];

  // RHS vector and B⁻¹·b
  const bVec = draft.constraints.map(ci => ci.rhs ?? 0);
  const Binvb = Binv.map(row => row.reduce((s, _v, i) => s + row[i] * bVec[i], 0));

  // All variable columns in full-A order
  const allLabels = [
    ...Array.from({ length: nDecVars }, (_, i) => `x${i + 1}`),
    ...Array.from({ length: nConstraints }, (_, i) => `s${i + 1}`),
  ];
  const allAColumns = allLabels.map(colForLabel);

  // Each basic row r: tableau[r][col] = (B⁻¹ row r) · (A column col)
  const basicRows: number[][] = Array.from({ length: nBasis }, (_, r) =>
    allAColumns.map(aCol => Binv[r].reduce((s, v, j) => s + v * aCol[j], 0)),
  );
  // Append RHS (B⁻¹·b entry)
  const basicRowsFull = basicRows.map((row, r) => [...row, Binvb[r]]);

  // Z-row: for each column, C_B · (column c in basic-row tableau) − c_c
  const objCoef = (label: string): number => {
    if (label.startsWith('x')) {
      const i = parseInt(label.slice(1), 10) - 1;
      return draft.objectiveCoefficients[i] ?? 0;
    }
    return 0;
  };
  const CB = basis.map(objCoef);
  const zRow = allLabels.map((label, cIdx) => {
    const colValsInTableau = basicRows.map(row => row[cIdx]);
    const CBdot = CB.reduce((s, v, i) => s + v * colValsInTableau[i], 0);
    return CBdot - objCoef(label);
  });
  const zStar = CB.reduce((s, v, i) => s + v * Binvb[i], 0);
  const zRowFull = [...zRow, zStar];

  return { matrix: [...basicRowsFull, zRowFull], basis };
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
