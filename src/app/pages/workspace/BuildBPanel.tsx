/**
 * BuildBPanel — the B-matrix gameboard for Phase 6.
 *
 * Every cell of B starts as a dashed "?" slot. The script fires a
 * click-matrix-column question that asks the student to click one
 * specific column of A; the matching column of A gets an attention
 * pulse (principle 8). Clicking the right column commits
 * { s-reveal, key: 'b-col-N' } which unlocks B's N-th column. Wrong
 * clicks produce warm feedback through the normal answer pipeline.
 *
 * Principles met:
 *   1  Empty ? slots until earned
 *   2  Per-column fine-grained reveals (b-col-0, b-col-1, ...)
 *   3  Principle-first prompts (authored in the script)
 *   4  Click IS the answer (no typing)
 *   7  Pop animation on reveal (fly-in-from-left)
 *   8  Attention pulse on the target column in A
 *   9  Color-binding: slack columns keep their signature color
 *  10  Transforms prior work (uses constraints student built in Phase 1)
 *  11  Clues, not answers (which variables are basic is a clue from
 *      the VertexBasisPanel above)
 *  12  Cross-reference: clicking a column fills B in place (one panel)
 */

import { LPDraft } from './guidedTypes';
import { FeasibleVertex } from './DiscoveryGraph';
import { colorFor, colorForFill } from './constraintColors';

interface Props {
  draft: LPDraft;
  vertex: FeasibleVertex;
  nDecVars: number;
  reveals: Set<string>;
  /** When a click-matrix-column question is active, the column in A at
   *  this index gets the attention pulse. null = no active question. */
  activeTargetColumn?: number | null;
  /** Called whenever any column is clicked (right or wrong). */
  onColumnClick?: (columnIdx: number) => void;
}

interface ColumnInfo {
  idx: number;
  label: string;
  values: number[];
  isDecisionVar: boolean;
  slackIdx: number;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

/** Canonical basis order: decision vars first (by index), then slacks
 *  (by constraint index). Used to decide which A-column belongs in each
 *  B-slot, so the script can author b-col-0, b-col-1, ... consistently. */
export function basisLabelsAtVertex(vertex: FeasibleVertex, nDecVars: number, nConstraints: number): string[] {
  const basicDec: string[] = [];
  for (let i = 0; i < nDecVars; i++) {
    if (!vertex.zeroDecisionVars.includes(i)) basicDec.push(`x${i + 1}`);
  }
  const basicSlack: string[] = [];
  for (let i = 0; i < nConstraints; i++) {
    if (!vertex.tightConstraints.includes(i)) basicSlack.push(`s${i + 1}`);
  }
  return [...basicDec, ...basicSlack];
}

export default function BuildBPanel({
  draft, vertex, nDecVars, reveals, activeTargetColumn = null, onColumnClick,
}: Props) {
  const nConstraints = draft.constraints.length;
  const basisSize = nConstraints;
  const basisLabels = basisLabelsAtVertex(vertex, nDecVars, nConstraints);

  // A's column list
  const columns: ColumnInfo[] = [];
  for (let v = 0; v < nDecVars; v++) {
    columns.push({
      idx: v,
      label: `x${v + 1}`,
      values: draft.constraints.map(c => c.coefficients[v] ?? 0),
      isDecisionVar: true,
      slackIdx: -1,
    });
  }
  for (let s = 0; s < nConstraints; s++) {
    columns.push({
      idx: nDecVars + s,
      label: `s${s + 1}`,
      values: draft.constraints.map((_, i) => (i === s ? 1 : 0)),
      isDecisionVar: false,
      slackIdx: s,
    });
  }

  // Map basis label → A column index (so we know which column fills each slot)
  const labelToAIdx = (label: string): number => {
    if (label.startsWith('x')) return parseInt(label.slice(1), 10) - 1;
    return nDecVars + (parseInt(label.slice(1), 10) - 1);
  };
  const slotSourceCol = (slotIdx: number): number => labelToAIdx(basisLabels[slotIdx]);

  // Which slots have been revealed?
  const revealedSlots: boolean[] = Array.from(
    { length: basisSize },
    (_, i) => reveals.has(`b-col-${i}`),
  );
  // Derived: which A columns have been "used"? Gray them out.
  const usedAColumns = new Set(
    revealedSlots
      .map((rev, i) => (rev ? slotSourceCol(i) : -1))
      .filter(x => x >= 0),
  );

  return (
    <div className="bg-card/40 border-2 border-primary/40 rounded-xl p-4 space-y-4 animate-fill-pop">
      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
        Build B — pull each basic column out of A
      </p>
      <p className="text-[11px] text-foreground/90 leading-relaxed">
        <span className="font-mono font-bold text-primary">B</span> is the matrix of
        columns of the <span className="font-semibold">basic</span> variables from A
        (which you identified above). Each slot of B takes one column. When a question
        asks for a specific column, the target column below will pulse — click it to
        fill the next slot of B.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-start">

        {/* ── A matrix ──────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
            Original constraint matrix <span className="font-mono text-foreground">A</span>
            {' '}= [A<sub>dec</sub> | I]
          </p>
          <table className="border-collapse font-mono text-sm">
            <thead>
              <tr>
                <th className="px-1 text-[10px] text-muted-foreground"></th>
                {columns.map(col => {
                  const isTarget = activeTargetColumn === col.idx;
                  const isUsed = usedAColumns.has(col.idx);
                  const slackColor = col.slackIdx >= 0 ? colorFor(col.slackIdx) : null;
                  const cls = isUsed
                    ? 'text-muted-foreground/40 line-through'
                    : isTarget
                      ? 'cursor-pointer text-orange-300'
                      : 'cursor-pointer text-muted-foreground hover:text-foreground';
                  return (
                    <th
                      key={col.idx}
                      onClick={isUsed ? undefined : () => onColumnClick?.(col.idx)}
                      className={`px-2 py-1 text-center text-xs font-semibold select-none ${cls}`}
                      style={slackColor && !isUsed ? { color: slackColor } : undefined}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: nConstraints }, (_, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="pr-2 text-[10px] text-muted-foreground tabular-nums font-semibold">
                    C{rowIdx + 1}
                  </td>
                  {columns.map(col => {
                    const isTarget = activeTargetColumn === col.idx;
                    const isUsed = usedAColumns.has(col.idx);
                    const slackColor = col.slackIdx >= 0 ? colorFor(col.slackIdx) : null;
                    const cellClass = isUsed
                      ? 'bg-muted/10 border-border/40 text-muted-foreground/40'
                      : isTarget
                        ? 'bg-orange-500/15 border-orange-400/70 text-orange-100 cursor-pointer ring-2 ring-orange-400/70 animate-attention-pulse'
                        : 'bg-muted/40 border-border/60 text-foreground/80 cursor-pointer hover:brightness-125';
                    return (
                      <td
                        key={col.idx}
                        onClick={isUsed ? undefined : () => onColumnClick?.(col.idx)}
                        className="p-0.5"
                      >
                        <div
                          className={`w-10 h-9 flex items-center justify-center rounded border-2 text-sm font-bold tabular-nums transition-transform ${cellClass}`}
                          style={slackColor && isTarget ? { borderColor: slackColor } : undefined}
                        >
                          {fmt(col.values[rowIdx])}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── arrow ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center pt-6 text-muted-foreground/80 text-2xl">
          →
        </div>

        {/* ── B gameboard ──────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
            <span className="font-mono text-primary font-bold">B</span>
            {revealedSlots.every(Boolean) && <span className="text-emerald-300 ml-1">✓ complete</span>}
          </p>
          <table className="border-collapse font-mono text-sm">
            <thead>
              <tr>
                <th className="px-1 text-[10px]"></th>
                {Array.from({ length: basisSize }, (_, slotIdx) => {
                  const label = basisLabels[slotIdx];
                  const filled = revealedSlots[slotIdx];
                  const aIdx = slotSourceCol(slotIdx);
                  const col = columns[aIdx];
                  const slackColor = col?.slackIdx >= 0 ? colorFor(col.slackIdx) : null;
                  return (
                    <th
                      key={slotIdx}
                      className="px-2 py-1 text-center text-xs font-semibold"
                      style={slackColor && filled ? { color: slackColor } : undefined}
                    >
                      {filled
                        ? <span>{label}</span>
                        : <span className="text-muted-foreground/50 italic">(slot {slotIdx + 1})</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: nConstraints }, (_, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="pr-2 text-[10px] text-muted-foreground tabular-nums font-semibold">
                    C{rowIdx + 1}
                  </td>
                  {Array.from({ length: basisSize }, (_, slotIdx) => {
                    const filled = revealedSlots[slotIdx];
                    const aIdx = slotSourceCol(slotIdx);
                    const col = columns[aIdx];
                    const slackColor = col?.slackIdx >= 0 ? colorFor(col.slackIdx) : null;
                    return (
                      <td key={slotIdx} className="p-0.5">
                        {filled ? (
                          <div
                            className="w-10 h-9 flex items-center justify-center rounded border-2 border-primary/60 bg-primary/15 text-primary text-sm font-bold tabular-nums animate-fly-in-from-left"
                            style={slackColor ? { borderColor: colorForFill(col.slackIdx, 0.6), color: slackColor } : undefined}
                          >
                            {fmt(col.values[rowIdx])}
                          </div>
                        ) : (
                          <div className="w-10 h-9 flex items-center justify-center rounded border-2 border-dashed border-border/50 bg-muted/20 text-muted-foreground/50 text-sm font-mono">
                            ?
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!revealedSlots.every(Boolean) && activeTargetColumn == null && (
        <p className="text-[10px] text-muted-foreground italic">
          {revealedSlots.filter(Boolean).length} / {basisSize} columns pulled. Waiting for the next question.
        </p>
      )}
      {revealedSlots.every(Boolean) && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2 text-[11px] text-emerald-100 leading-relaxed animate-fill-pop">
          You&apos;ve built <span className="font-mono font-bold">B</span>. Next step: compute{' '}
          <span className="font-mono font-bold">B⁻¹</span> — the single object every sensitivity
          formula uses.
        </div>
      )}
    </div>
  );
}
