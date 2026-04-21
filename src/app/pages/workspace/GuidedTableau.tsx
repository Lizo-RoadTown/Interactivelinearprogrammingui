/**
 * GuidedTableau — the simplex tableau as a gameboard.
 *
 * Same reward idea as the LP canvas: every cell starts as a dashed "?"
 * slot; correct answers cause the appropriate cells to pop in. Distinct
 * fills are grouped into logical events (slack-identity fills 4 cells at
 * once, z-row-x fills 2 cells at once) so each "earned" moment materializes
 * a meaningful chunk of the tableau.
 *
 * Phase 3 responsibility: render the INITIAL tableau as it's being built.
 * Phase 4 will evolve the tableau as pivots are applied.
 */

import { LPDraft } from './guidedTypes';
import { colorFor, colorForFill } from './constraintColors';
import type { QuestionHighlight } from '../../data/tutorialScripts';

export interface TableauReveal {
  slacksAdded: boolean;
  slackIdentityRevealed: boolean;
  zRowXRevealed: boolean;
  initialBasicValuesRevealed: boolean;
  initialZRevealed: boolean;
}

interface Props {
  draft: LPDraft;
  reveal: TableauReveal;
  /**
   * Optional live override: the current post-pivot tableau state. When set,
   * GuidedTableau renders this matrix + basis instead of computing the initial
   * tableau from the LPDraft. Used after Phase 4 pivots.
   */
  override?: {
    matrix: number[][];
    basis: string[];
    /** Most recent pivot to pulse-highlight: { row, col } in the matrix. */
    highlightPivot?: { row: number; col: number };
  };
  /** Active question highlight — pulse-glow matching rows / columns / cells. */
  highlight?: QuestionHighlight | null;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

export default function GuidedTableau({ draft, reveal, override, highlight }: Props) {
  const nDecVars = draft.variables.length || 2;
  const nSlacks = reveal.slacksAdded ? draft.constraints.length : 0;
  const nConstraints = draft.constraints.length;

  // Variable headers
  const decVarLabels = Array.from({ length: nDecVars }, (_, i) => `x${i + 1}`);
  const slackLabels = Array.from({ length: nSlacks }, (_, i) => `s${i + 1}`);
  const allLabels = [...decVarLabels, ...slackLabels];

  // Basis labels for each constraint row — slacks initially, or override from a pivot
  const basisLabels = override
    ? override.basis
    : Array.from({ length: nConstraints }, (_, i) => (reveal.slacksAdded ? `s${i + 1}` : '?'));

  /** Get the value in row r, col c (or null if not yet revealed). */
  const cellValue = (r: number, c: number): number | null => {
    // If a post-pivot override is set, render that matrix directly.
    if (override) {
      const row = override.matrix[r];
      if (!row) return null;
      const v = row[c];
      return v == null ? null : v;
    }
    if (r < nConstraints) {
      // Constraint row
      if (c < nDecVars) {
        // Decision var coefficient — comes from the LP formulation (already committed in Phase 1)
        return draft.constraints[r]?.coefficients[c] ?? null;
      }
      const slackIdx = c - nDecVars;
      if (slackIdx < nSlacks) {
        // Slack column — identity pattern (1 if same-row, 0 otherwise)
        if (!reveal.slackIdentityRevealed) return null;
        return slackIdx === r ? 1 : 0;
      }
      // RHS column
      if (c === allLabels.length) {
        if (!reveal.initialBasicValuesRevealed) return null;
        return draft.constraints[r]?.rhs ?? null;
      }
      return null;
    }
    // Z-row (last row)
    if (c < nDecVars) {
      if (!reveal.zRowXRevealed) return null;
      return -(draft.objectiveCoefficients[c] ?? 0); // MAX convention: -c in initial Z-row
    }
    const slackIdx = c - nDecVars;
    if (slackIdx < nSlacks) {
      // Slacks are nonbasic initially — Z-row contribution is 0
      if (!reveal.zRowXRevealed) return null;
      return 0;
    }
    if (c === allLabels.length) {
      // Initial Z-RHS = 0 (no profit yet)
      if (!reveal.initialZRevealed) return null;
      return 0;
    }
    return null;
  };

  const totalCols = allLabels.length + 1; // +1 for RHS

  // Pulse targets derived from the active question highlight
  const pulseZRow = highlight?.target === 'tableau-z-row';
  const pulseSlackCols = highlight?.target === 'tableau-slack-columns';
  const pulseRhsCol = highlight?.target === 'tableau-rhs-column';
  const pulseRow = highlight?.target === 'tableau-row' ? highlight.row : -1;
  const pulseCol = highlight?.target === 'tableau-col' ? highlight.col : -1;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse font-mono text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">Basis</th>
            {allLabels.map((label, c) => {
              const isSlack = c >= nDecVars;
              const slackIdx = isSlack ? c - nDecVars : -1;
              // Slack columns get the same signature color as their owning
              // constraint. That way the student sees at a glance that the s₁
              // column "belongs to" row C1 — the identity-matrix pattern in
              // the slack block becomes visually unmissable.
              const slackColor = isSlack && reveal.slacksAdded ? colorFor(slackIdx) : null;
              return (
                <th
                  key={c}
                  className={`px-3 py-2 text-center text-xs font-semibold ${
                    isSlack
                      ? (reveal.slacksAdded ? 'animate-fill-pop' : 'text-muted-foreground/40')
                      : 'text-primary'
                  }`}
                  style={slackColor
                    ? { color: slackColor, backgroundColor: colorForFill(slackIdx, 0.12), borderBottom: `2px solid ${slackColor}` }
                    : undefined}
                >
                  {label}
                </th>
              );
            })}
            <th className="px-3 py-2 text-center text-xs font-semibold text-accent">RHS</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: nConstraints + 1 }, (_, r) => {
            const isZRow = r === nConstraints;
            // Color the basis label to match the constraint that "owns" this
            // row. The row's color is keyed by the basis variable: slack s_k
            // → constraint k's color; decision var x_k → stay neutral
            // (decision vars have no constraint ownership).
            const basisLabel = basisLabels[r] ?? '';
            const slackBasisMatch = basisLabel.match(/^s(\d+)$/);
            const rowColor = !isZRow && reveal.slacksAdded && slackBasisMatch
              ? colorFor(parseInt(slackBasisMatch[1], 10) - 1)
              : null;
            return (
              <tr key={r} className={isZRow ? 'border-t-2 border-primary/50' : ''}>
                <td
                  className={`px-3 py-2 text-xs font-semibold ${
                    isZRow ? 'text-primary' :
                    reveal.slacksAdded ? 'text-foreground' : 'text-muted-foreground/40'
                  }`}
                  style={rowColor
                    ? { color: rowColor, backgroundColor: colorForFill(parseInt(slackBasisMatch![1], 10) - 1, 0.12) }
                    : undefined}
                >
                  {isZRow ? 'z' : basisLabel}
                </td>
                {Array.from({ length: totalCols }, (_, c) => {
                  const v = cellValue(r, c);
                  const isSlackCol = c >= nDecVars && c < nDecVars + nSlacks;
                  const slackColIdx = isSlackCol ? c - nDecVars : -1;
                  const isRhsCol = c === totalCols - 1;
                  const pulse =
                    (pulseZRow && isZRow) ||
                    (pulseSlackCols && isSlackCol) ||
                    (pulseRhsCol && isRhsCol) ||
                    (pulseRow === r) ||
                    (pulseCol === c);
                  return (
                    <TableauCell
                      key={c}
                      value={v}
                      columnTint={isSlackCol && reveal.slacksAdded ? colorForFill(slackColIdx, 0.06) : null}
                      pulse={pulse}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableauCell({
  value, columnTint, pulse = false,
}: { value: number | null; columnTint?: string | null; pulse?: boolean }) {
  const tdStyle = columnTint ? { backgroundColor: columnTint } : undefined;
  const pulseCls = pulse ? ' animate-attention-pulse' : '';
  if (value === null) {
    return (
      <td className="px-2 py-1.5" style={tdStyle}>
        <div className={`inline-flex items-center justify-center w-12 h-10 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 text-muted-foreground/50 text-sm font-mono${pulseCls}`}>
          ?
        </div>
      </td>
    );
  }
  const isNeg = value < 0;
  return (
    <td className="px-2 py-1.5" style={tdStyle}>
      <div
        key={value}
        className={`inline-flex items-center justify-center w-12 h-10 rounded-lg border-2 shadow-md font-mono text-base font-bold tabular-nums animate-fill-pop${pulseCls} ${
          isNeg
            ? 'bg-amber-500/20 border-amber-500/50 text-amber-100 shadow-amber-500/20'
            : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100 shadow-emerald-500/20'
        }`}
      >
        {fmt(value)}
      </div>
    </td>
  );
}
