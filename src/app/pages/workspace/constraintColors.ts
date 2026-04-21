/**
 * Shared constraint color palette.
 *
 * Each constraint gets a signature color that follows it everywhere the
 * student might look: the line on the graph, the horizontal meter, the
 * slack column in the tableau, and the basis label. That way when the
 * student sees "the teal column is all zeros except in the teal row"
 * they are seeing the identity-matrix fact visually instead of
 * memorizing it as a rule.
 *
 * Colors deliberately avoid emerald (used for the optimum marker),
 * amber (objective line), and cyan (feasible region fill) so there is
 * no semantic collision.
 */

export const CONSTRAINT_COLORS = [
  '#f43f5e',  // C1 — rose
  '#a855f7',  // C2 — violet
  '#0ea5e9',  // C3 — sky (future multi-constraint problems)
  '#14b8a6',  // C4 — teal
  '#f59e0b',  // C5 — amber (only if objective line is off-screen)
];

export function colorFor(constraintIdx: number): string {
  return CONSTRAINT_COLORS[constraintIdx % CONSTRAINT_COLORS.length];
}

/** Translucent version for fills/backgrounds (CSS rgba via hex). */
export function colorForFill(constraintIdx: number, alpha: number): string {
  const hex = colorFor(constraintIdx);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
