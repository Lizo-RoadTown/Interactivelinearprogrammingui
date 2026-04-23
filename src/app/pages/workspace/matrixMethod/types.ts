/**
 * Data model for the Matrix Method gameboard (Chapter 8, Table 8.1).
 *
 * The student works on a SolvedLP — an LP whose optimal basis is
 * already known (that's the premise of Chapter 8: "given the optimal
 * basic variables, reconstruct the optimal tableau via B⁻¹"). The
 * gameboard walks through the 12 steps in order, and the final Zone 3
 * tableau is reconstructed from these matrix formulas.
 */

/**
 * A single variable in the LP.
 *   kind: 'decision' for x₁, x₂, …
 *   kind: 'slack'    for s₁, s₂, …
 * index is 1-based for display (x₁, not x₀).
 */
export interface LPVariable {
  kind: 'decision' | 'slack';
  index: number;           // 1-based; label = `${kind === 'decision' ? 'x' : 's'}${index}`
  objCoef: number;         // coefficient in the objective function (0 for slacks in standard form)
}

/**
 * An LP with a known optimal basis — the input to the Matrix Method
 * gameboard. The constraint matrix A is the FULL augmented matrix:
 * rows = constraints, columns = all variables (decision vars then
 * slacks), values = the coefficient of that variable in that
 * constraint. Slack columns form an identity; decision columns are
 * the raw coefficients from the problem statement.
 */
export interface SolvedLP {
  id: string;
  title: string;
  sense: 'max' | 'min';

  /** All variables in display order: decision first, then slacks. */
  variables: LPVariable[];

  /** Full constraint matrix A: m rows, n columns (n = decision + slack). */
  A: number[][];

  /** RHS vector, length m. */
  b: number[];

  /**
   * Indices into `variables` identifying the optimal basic variables.
   * The Matrix Method gameboard presents these as X_BV in the order
   * given here — the student derives B, CB, B⁻¹, etc. from this list.
   */
  basicVarIndices: number[];

  /** Human-readable scenario text for Zone 1 display. */
  scenario?: string;
}

/** Convenience: the label for a variable (e.g. "x₁" or "s₂"). */
export function varLabel(v: LPVariable): string {
  const sub = SUBSCRIPTS[v.index] ?? String(v.index);
  return (v.kind === 'decision' ? 'x' : 's') + sub;
}

const SUBSCRIPTS: Record<number, string> = {
  1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅',
  6: '₆', 7: '₇', 8: '₈', 9: '₉', 10: '₁₀',
};

/**
 * Step identifier for the 12-step sequencer. Presented in display order.
 */
export type StepId =
  | 'identify-bv'
  | 'identify-nbv'
  | 'build-B'
  | 'build-N'
  | 'identify-b'
  | 'identify-CB-CN'
  | 'compute-Binv'
  | 'compute-BinvN'
  | 'fill-identity'
  | 'compute-Binvb'
  | 'compute-zrow-nbv'
  | 'fill-zrow-bv'
  | 'compute-zstar';
