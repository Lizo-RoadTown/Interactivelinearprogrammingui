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
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

export default function GuidedTableau({ draft, reveal }: Props) {
  const nDecVars = draft.variables.length || 2;
  const nSlacks = reveal.slacksAdded ? draft.constraints.length : 0;
  const nConstraints = draft.constraints.length;

  // Variable headers
  const decVarLabels = Array.from({ length: nDecVars }, (_, i) => `x${i + 1}`);
  const slackLabels = Array.from({ length: nSlacks }, (_, i) => `s${i + 1}`);
  const allLabels = [...decVarLabels, ...slackLabels];

  // Basis labels for each constraint row (initial basis = slack variables)
  const basisLabels = Array.from({ length: nConstraints }, (_, i) =>
    reveal.slacksAdded ? `s${i + 1}` : '?'
  );

  /** Get the value in row r, col c (or null if not yet revealed). */
  const cellValue = (r: number, c: number): number | null => {
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

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse font-mono text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">Basis</th>
            {allLabels.map((label, c) => {
              const isSlack = c >= nDecVars;
              return (
                <th
                  key={c}
                  className={`px-3 py-2 text-center text-xs font-semibold ${
                    isSlack
                      ? (reveal.slacksAdded ? 'text-accent animate-fill-pop' : 'text-muted-foreground/40')
                      : 'text-primary'
                  }`}
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
            return (
              <tr key={r} className={isZRow ? 'border-t-2 border-primary/50' : ''}>
                <td className={`px-3 py-2 text-xs font-semibold ${
                  isZRow ? 'text-primary' :
                  reveal.slacksAdded ? 'text-foreground' : 'text-muted-foreground/40'
                }`}>
                  {isZRow ? 'z' : basisLabels[r]}
                </td>
                {Array.from({ length: totalCols }, (_, c) => {
                  const v = cellValue(r, c);
                  return <TableauCell key={c} value={v} />;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableauCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <td className="px-2 py-1.5">
        <div className="inline-flex items-center justify-center w-12 h-10 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 text-muted-foreground/50 text-sm font-mono">
          ?
        </div>
      </td>
    );
  }
  const isNeg = value < 0;
  return (
    <td className="px-2 py-1.5">
      <div
        key={value}  // forces remount + anim replay when it changes
        className={`inline-flex items-center justify-center w-12 h-10 rounded-lg border-2 shadow-md font-mono text-base font-bold tabular-nums animate-fill-pop ${
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
