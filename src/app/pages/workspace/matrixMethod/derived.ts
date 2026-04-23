/**
 * Derive every quantity the Matrix Method gameboard needs from a
 * SolvedLP. One function in, everything out — makes the UI a pure
 * renderer of these values.
 *
 * Names match the chalkboard / Chapter 8:
 *   CB, CN          — objective coefficients for basic / non-basic vars
 *   B,  N           — constraint columns for basic / non-basic vars
 *   Binv            — B⁻¹
 *   BinvN, Binvb    — "b*" and transformed non-basic columns
 *   zRowNB          — CB·B⁻¹N − CN
 *   zStar           — CB·B⁻¹b
 *
 * If B is singular (bad basis), the whole Derived is null.
 */

import { SolvedLP, varLabel } from './types';
import {
  selectColumns, invert, matMat, matVec, dot,
} from './matrix';

export interface Derived {
  nbvIndices: number[];          // indices into SolvedLP.variables
  basicLabels: string[];         // display labels for basic vars, basis order
  nonBasicLabels: string[];      // display labels for non-basic vars
  CB: number[];
  CN: number[];
  B: number[][];
  N: number[][];
  Binv: number[][];
  BinvN: number[][];             // transformed non-basic columns (the a* block)
  Binvb: number[];               // basic variable values at the optimum
  zRowNB: number[];              // Z-row entries for non-basic variables
  zStar: number;                 // objective value at the optimum

  /**
   * For the Step 12 two-language payoff: the pairs of
   * (coefficient, value) used in each calculation.
   *
   * direct:   (c_j of every variable, optimal value of every variable)
   * matrix:   (CB entries, Binvb entries) — reordered into basis order,
   *           and including slack contributions (which are zero because
   *           slack c = 0, but visible so the student sees how the
   *           matrix formula sums to the same number).
   *
   * Both produce zStar.
   */
  payoff: {
    direct: { label: string; coef: number; value: number }[];
    matrix: { label: string; coef: number; value: number }[];
  };
}

export function derive(lp: SolvedLP): Derived | null {
  const n = lp.variables.length;
  const m = lp.b.length;
  const allIndices = Array.from({ length: n }, (_, i) => i);

  const basicSet = new Set(lp.basicVarIndices);
  const nbvIndices = allIndices.filter(i => !basicSet.has(i));

  const basicLabels = lp.basicVarIndices.map(i => varLabel(lp.variables[i]));
  const nonBasicLabels = nbvIndices.map(i => varLabel(lp.variables[i]));

  const CB = lp.basicVarIndices.map(i => lp.variables[i].objCoef);
  const CN = nbvIndices.map(i => lp.variables[i].objCoef);

  const B = selectColumns(lp.A, lp.basicVarIndices);
  const N = selectColumns(lp.A, nbvIndices);

  const Binv = invert(B);
  if (!Binv) return null;

  const BinvN = matMat(Binv, N);
  const Binvb = matVec(Binv, lp.b);

  // Z-row non-basic entries: CB · BinvN − CN, column by column.
  const zRowNB = N[0]?.map((_c, colIdx) => {
    const BinvNcol = BinvN.map(row => row[colIdx]);
    return dot(CB, BinvNcol) - CN[colIdx];
  }) ?? [];

  const zStar = dot(CB, Binvb);

  // ── Step 12 payoff pairs ────────────────────────────────────────────
  // Direct: every variable, using its objective coefficient and its
  // value at the optimum. Non-basic vars have value 0; basic vars have
  // the value given by Binvb at their position in the basis.
  const optimalValueByIndex: Record<number, number> = {};
  for (let k = 0; k < lp.basicVarIndices.length; k++) {
    optimalValueByIndex[lp.basicVarIndices[k]] = Binvb[k];
  }
  const direct = lp.variables.map((v, i) => ({
    label: varLabel(v),
    coef: v.objCoef,
    value: optimalValueByIndex[i] ?? 0,
  }));

  // Matrix form: pair up CB entries with Binvb entries, basis order.
  const matrix = lp.basicVarIndices.map((i, k) => ({
    label: varLabel(lp.variables[i]),
    coef: CB[k],
    value: Binvb[k],
  }));

  return {
    nbvIndices,
    basicLabels,
    nonBasicLabels,
    CB,
    CN,
    B,
    N,
    Binv,
    BinvN,
    Binvb,
    zRowNB,
    zStar,
    payoff: { direct, matrix },
  };

  // `m` intentionally not used in return — kept for future sanity checks.
  void m;
}
