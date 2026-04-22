/**
 * GuidedTableau — the simplex tableau as an interactive gameboard.
 *
 * Phase 3 responsibility: render the INITIAL tableau as it's being built
 * — every cell starts as a dashed "?" slot; correct answers cause the
 * appropriate cells to pop in.
 *
 * Phase 4 responsibility: let the student DRIVE pivots by clicking.
 *   - clickMode='entering-col' — Z-row cells with a negative value are
 *     clickable. Clicking one picks that variable to enter the basis.
 *     Ratios for the picked column automatically appear in a right-hand
 *     "min ratio" column so the student doesn't do the division in their
 *     head.
 *   - clickMode='leaving-row' — each basis row becomes clickable along
 *     the selected entering column. Clicking a row picks that variable
 *     to leave the basis. The cell at the intersection of the picked
 *     column and row IS the pivot element.
 *
 * The tableau itself is the input. The student reads it, clicks it, and
 * the rest of the view responds.
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
  override?: {
    matrix: number[][];
    basis: string[];
    highlightPivot?: { row: number; col: number };
  };
  highlight?: QuestionHighlight | null;

  // ── Interactive pivot props ────────────────────────────────────────────
  /** Which kind of click the current question wants, if any. */
  clickMode?: 'entering-col' | 'leaving-row' | null;
  /** Column currently picked as entering (persists for leaving-row step). */
  selectedCol?: number | null;
  /** Row currently picked as leaving. */
  selectedRow?: number | null;
  /** Called when the student clicks a cell eligible for the current mode. */
  onPick?: (index: number) => void;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

export default function GuidedTableau({
  draft, reveal, override, highlight,
  clickMode = null, selectedCol = null, selectedRow = null, onPick,
}: Props) {
  const nDecVars = draft.variables.length || 2;
  const nSlacks = reveal.slacksAdded ? draft.constraints.length : 0;
  const nConstraints = draft.constraints.length;

  const decVarLabels = Array.from({ length: nDecVars }, (_, i) => `x${i + 1}`);
  const slackLabels = Array.from({ length: nSlacks }, (_, i) => `s${i + 1}`);
  const allLabels = [...decVarLabels, ...slackLabels];

  const basisLabels = override
    ? override.basis
    : Array.from({ length: nConstraints }, (_, i) => (reveal.slacksAdded ? `s${i + 1}` : '?'));

  const cellValue = (r: number, c: number): number | null => {
    if (override) {
      const row = override.matrix[r];
      if (!row) return null;
      const v = row[c];
      return v == null ? null : v;
    }
    if (r < nConstraints) {
      if (c < nDecVars) {
        return draft.constraints[r]?.coefficients[c] ?? null;
      }
      const slackIdx = c - nDecVars;
      if (slackIdx < nSlacks) {
        if (!reveal.slackIdentityRevealed) return null;
        return slackIdx === r ? 1 : 0;
      }
      if (c === allLabels.length) {
        if (!reveal.initialBasicValuesRevealed) return null;
        return draft.constraints[r]?.rhs ?? null;
      }
      return null;
    }
    if (c < nDecVars) {
      if (!reveal.zRowXRevealed) return null;
      return -(draft.objectiveCoefficients[c] ?? 0);
    }
    const slackIdx = c - nDecVars;
    if (slackIdx < nSlacks) {
      if (!reveal.zRowXRevealed) return null;
      return 0;
    }
    if (c === allLabels.length) {
      if (!reveal.initialZRevealed) return null;
      return 0;
    }
    return null;
  };

  const totalCols = allLabels.length + 1; // +1 for RHS
  const rhsCol = totalCols - 1;
  const zRowIdx = nConstraints;

  // Pulse targets from QuestionHighlight
  const pulseZRow = highlight?.target === 'tableau-z-row';
  const pulseSlackCols = highlight?.target === 'tableau-slack-columns';
  const pulseRhsCol = highlight?.target === 'tableau-rhs-column';
  const pulseRow = highlight?.target === 'tableau-row' ? highlight.row :
                   highlight?.target === 'constraint' ? highlight.constraintIndex : -1;
  const pulseCol = highlight?.target === 'tableau-col' ? highlight.col : -1;

  // Ratio column is shown whenever an entering column has been selected
  // OR when the question is asking the student to pick the leaving row
  // (so they can read the ratios). Computed from cellValue / RHS; only
  // positive entries in the entering column produce a valid ratio.
  const showRatios = selectedCol != null && selectedCol < allLabels.length;
  const ratios: (number | null)[] = Array.from({ length: nConstraints }, (_, r) => {
    if (selectedCol == null) return null;
    const v = cellValue(r, selectedCol);
    const rhs = cellValue(r, rhsCol);
    if (v == null || rhs == null) return null;
    if (v <= 1e-9) return null;       // non-positive entries skip the ratio test
    return rhs / v;
  });
  // Identify the minimum positive ratio (the leaving-row recommendation)
  let minRatioIdx = -1;
  ratios.forEach((rv, r) => {
    if (rv == null) return;
    if (minRatioIdx === -1 || rv < (ratios[minRatioIdx] ?? Infinity) - 1e-9) {
      minRatioIdx = r;
    }
  });

  // Which Z-row columns are clickable as the entering variable?
  // (negative entries; non-RHS)
  const isEnteringClickable = (c: number): boolean => {
    if (clickMode !== 'entering-col') return false;
    if (c >= allLabels.length) return false;
    const v = cellValue(zRowIdx, c);
    return v != null && v < -1e-9;
  };
  // Which rows are clickable as the leaving row given selectedCol?
  const isLeavingClickable = (r: number): boolean => {
    if (clickMode !== 'leaving-row') return false;
    if (r >= nConstraints) return false;
    if (selectedCol == null) return false;
    const v = cellValue(r, selectedCol);
    return v != null && v > 1e-9;
  };

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse font-mono text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">Basis</th>
            {allLabels.map((label, c) => {
              const isSlack = c >= nDecVars;
              const slackIdx = isSlack ? c - nDecVars : -1;
              const slackColor = isSlack && reveal.slacksAdded ? colorFor(slackIdx) : null;
              const isSelectedHdr = selectedCol === c;
              return (
                <th
                  key={c}
                  className={`px-3 py-2 text-center text-xs font-semibold ${
                    isSlack
                      ? (reveal.slacksAdded ? 'animate-fill-pop' : 'text-muted-foreground/40')
                      : 'text-primary'
                  }${isSelectedHdr ? ' ring-2 ring-orange-400/70 rounded-t' : ''}`}
                  style={slackColor
                    ? { color: slackColor, backgroundColor: colorForFill(slackIdx, 0.12), borderBottom: `2px solid ${slackColor}` }
                    : undefined}
                >
                  {label}
                </th>
              );
            })}
            <th className="px-3 py-2 text-center text-xs font-semibold text-accent">RHS</th>
            {showRatios && (
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-orange-300 uppercase tracking-wider">
                RHS ÷ {allLabels[selectedCol!]}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: nConstraints + 1 }, (_, r) => {
            const isZRow = r === zRowIdx;
            const basisLabel = basisLabels[r] ?? '';
            const slackBasisMatch = basisLabel.match(/^s(\d+)$/);
            const rowColor = !isZRow && reveal.slacksAdded && slackBasisMatch
              ? colorFor(parseInt(slackBasisMatch[1], 10) - 1)
              : null;
            const isSelRow = selectedRow === r && !isZRow;
            const rowRingCls = isSelRow ? ' ring-2 ring-orange-400/70' : '';

            return (
              <tr key={r} className={`${isZRow ? 'border-t-2 border-primary/50' : ''}${rowRingCls}`}>
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
                  const isRhsCol = c === rhsCol;
                  const isSelCol = selectedCol === c;
                  const pulse =
                    (pulseZRow && isZRow) ||
                    (pulseSlackCols && isSlackCol) ||
                    (pulseRhsCol && isRhsCol) ||
                    (pulseRow === r) ||
                    (pulseCol === c);
                  // Click targeting: a Z-row cell in entering mode, or a
                  // basis row cell (in the selected entering column) in
                  // leaving mode.
                  const clickable =
                    (isEnteringClickable(c) && isZRow) ||
                    (isLeavingClickable(r) && c === selectedCol);
                  const pivotCell = selectedCol === c && selectedRow === r && !isZRow;
                  return (
                    <TableauCell
                      key={c}
                      value={v}
                      columnTint={isSlackCol && reveal.slacksAdded ? colorForFill(slackColIdx, 0.06) : null}
                      selectedCol={isSelCol}
                      pulse={pulse}
                      clickable={clickable}
                      pivotCell={pivotCell}
                      onClick={clickable ? () => {
                        if (clickMode === 'entering-col' && isZRow) onPick?.(c);
                        else if (clickMode === 'leaving-row' && !isZRow) onPick?.(r);
                      } : undefined}
                    />
                  );
                })}
                {/* Ratio column for this row */}
                {showRatios && (
                  <RatioCell
                    isZRow={isZRow}
                    ratio={isZRow ? null : ratios[r]}
                    isWinner={!isZRow && minRatioIdx === r}
                    clickable={isLeavingClickable(r)}
                    onClick={isLeavingClickable(r) ? () => onPick?.(r) : undefined}
                    selected={selectedRow === r}
                  />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Click-mode hint strip */}
      {clickMode === 'entering-col' && (
        <p className="text-[11px] text-muted-foreground mt-2 pl-1">
          <span className="text-orange-300 font-semibold">Select the most negative value in the Z-row.</span>
          {' '}That variable will enter the basis and push z up the fastest.
        </p>
      )}
      {clickMode === 'leaving-row' && selectedCol != null && (
        <p className="text-[11px] text-muted-foreground mt-2 pl-1">
          <span className="text-orange-300 font-semibold">Select the row with the smallest positive ratio.</span>
          {' '}That constraint binds first as {allLabels[selectedCol]} grows — so its basic variable leaves.
        </p>
      )}
    </div>
  );
}

function TableauCell({
  value, columnTint, pulse = false, clickable = false, pivotCell = false,
  selectedCol = false, onClick,
}: {
  value: number | null;
  columnTint?: string | null;
  pulse?: boolean;
  clickable?: boolean;
  pivotCell?: boolean;
  selectedCol?: boolean;
  onClick?: () => void;
}) {
  const tdStyle = columnTint ? { backgroundColor: columnTint } : undefined;
  const pulseCls = pulse ? ' animate-attention-pulse' : '';
  const colCls = selectedCol ? ' bg-orange-400/10' : '';
  if (value === null) {
    return (
      <td className={`px-2 py-1.5${colCls}`} style={tdStyle}>
        <div className={`inline-flex items-center justify-center w-12 h-10 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 text-muted-foreground/50 text-sm font-mono${pulseCls}`}>
          ?
        </div>
      </td>
    );
  }
  const isNeg = value < 0;
  const baseCellCls = isNeg
    ? 'bg-amber-500/20 border-amber-500/50 text-amber-100 shadow-amber-500/20'
    : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100 shadow-emerald-500/20';
  const clickableCls = clickable ? ' cursor-pointer hover:scale-110 hover:brightness-125 ring-2 ring-orange-400/60 animate-attention-pulse' : '';
  const pivotCls = pivotCell ? ' !bg-orange-500/35 !border-orange-400 ring-4 ring-orange-400/70' : '';
  return (
    <td className={`px-2 py-1.5${colCls}`} style={tdStyle} onClick={onClick}>
      <div
        key={value}
        className={`inline-flex items-center justify-center w-12 h-10 rounded-lg border-2 shadow-md font-mono text-base font-bold tabular-nums transition-transform ${baseCellCls}${clickableCls}${pivotCls}${pulseCls} ${clickable ? '' : 'animate-fly-in-from-left'}`}
      >
        {fmt(value)}
      </div>
    </td>
  );
}

function RatioCell({
  isZRow, ratio, isWinner, clickable, onClick, selected,
}: {
  isZRow: boolean;
  ratio: number | null;
  isWinner: boolean;
  clickable: boolean;
  onClick?: () => void;
  selected: boolean;
}) {
  if (isZRow) {
    return <td className="px-2 py-1.5" />;
  }
  if (ratio == null) {
    return (
      <td className="px-2 py-1.5 text-center">
        <span className="text-[11px] text-muted-foreground/60 italic">—</span>
      </td>
    );
  }
  const winnerCls = isWinner
    ? 'bg-orange-500/25 border-orange-400/70 text-orange-100 ring-2 ring-orange-400/60'
    : 'bg-muted/40 border-border text-foreground/80';
  const clickableCls = clickable ? ' cursor-pointer hover:scale-110 hover:brightness-125' : '';
  const selectedCls = selected ? ' ring-4 ring-orange-400/80' : '';
  return (
    <td className="px-2 py-1.5 text-center" onClick={onClick}>
      <div
        className={`inline-flex items-center justify-center min-w-[3rem] h-10 px-2 rounded-lg border-2 font-mono text-sm font-bold tabular-nums transition-transform ${winnerCls}${clickableCls}${selectedCls}`}
      >
        {ratio.toFixed(ratio < 10 ? 1 : 0)}
      </div>
    </td>
  );
}
