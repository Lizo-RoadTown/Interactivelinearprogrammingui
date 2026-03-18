/**
 * varName.ts — shared variable-name normalisation helpers.
 *
 * The backend returns variable names in mixed case ("X1", "S2", "A1").
 * Tableau allVariables uses lowercase ("x1", "s2", "a1").
 * All comparisons must go through these helpers so casing never causes a mismatch.
 */

/** Lowercase + trim a variable name. Safe on undefined / null. */
export function normVar(s: string | undefined | null): string {
  return (s ?? '').toLowerCase().trim();
}

/** Case-insensitive equality check for two variable names. */
export function sameVar(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  return normVar(a) === normVar(b);
}

/**
 * Find the index of a variable name in an array, case-insensitively.
 * Returns -1 if not found.
 */
export function indexOfVar(arr: string[], target: string | undefined | null): number {
  const t = normVar(target);
  return arr.findIndex(v => normVar(v) === t);
}
