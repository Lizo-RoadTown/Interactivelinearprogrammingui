/**
 * BuildBPanel — the student assembles the basis matrix B by clicking
 * the basic-variable columns in the original constraint matrix.
 *
 * Visual layout:
 *   ┌─ Original constraint matrix (A) ──┐   ┌─ B ─┐
 *   │  x₁  x₂  s₁  s₂                    │   │     │
 *   │   2   4   1   0                    │ → │ 2 4 │
 *   │   3   2   0   1                    │   │ 3 2 │
 *   └────────────────────────────────────┘   └─────┘
 *
 * Basic-variable columns (from the selected vertex's basis) are
 * highlighted with an orange ring and a cursor-pointer; clicking one
 * "pulls" that column into the next empty slot of B. Non-basic columns
 * stay dimmed and non-interactive — this makes the meaning of B
 * literal: "it's the columns of the variables that are basic at the
 * chosen vertex."
 *
 * The reward is that when B is complete, the matrix on the right IS
 * the B used in every sensitivity formula later. The student built it.
 */

import { useState, useEffect } from 'react';
import { LPDraft } from './guidedTypes';
import { FeasibleVertex } from './DiscoveryGraph';
import { colorFor, colorForFill } from './constraintColors';

interface Props {
  draft: LPDraft;
  vertex: FeasibleVertex;
  nDecVars: number;
  /** Called once B is complete (all basic columns pulled). Receives the
   *  assembled B matrix in row-major form plus the ordered basic
   *  variable labels. */
  onBComplete?: (B: number[][], basisLabels: string[]) => void;
}

interface ColumnInfo {
  idx: number;           // position in the combined A = [A_dec | I] matrix
  label: string;         // 'x1' | 'x2' | 's1' | 's2' | ...
  values: number[];      // column of length m (one per constraint)
  isDecisionVar: boolean;
  slackIdx: number;      // -1 if not a slack
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Build the ordered list of basic variable names at a vertex. Order
 * convention: decision variables first (in index order), then slacks
 * (in constraint-index order). This is consistent with how every
 * sensitivity formula later indexes into B.
 */
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

export default function BuildBPanel({ draft, vertex, nDecVars, onBComplete }: Props) {
  const nConstraints = draft.constraints.length;

  // Build the A = [A_dec | I_m] column list
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

  // Which column indices are basic at this vertex?
  const basicIndices = new Set<number>();
  for (let i = 0; i < nDecVars; i++) {
    if (!vertex.zeroDecisionVars.includes(i)) basicIndices.add(i);
  }
  for (let i = 0; i < nConstraints; i++) {
    if (!vertex.tightConstraints.includes(i)) basicIndices.add(nDecVars + i);
  }

  // Expected basis labels (ordered). The student pulls columns in this
  // order — deviations are accepted but we recommend the canonical order.
  const orderedBasisLabels = basisLabelsAtVertex(vertex, nDecVars, nConstraints);

  // Local state: which columns have been pulled into B so far (in click order)
  const [pulled, setPulled] = useState<number[]>([]);
  // Reset when vertex changes
  useEffect(() => { setPulled([]); }, [vertex.x, vertex.y]);

  const allPulled = pulled.length === basicIndices.size;

  // Fire completion callback once all basic columns are pulled.
  // Using a memo-less check — pulled identity changes each time.
  useEffect(() => {
    if (allPulled && onBComplete) {
      const B = columns[0].values.map((_, rowIdx) =>
        pulled.map(colIdx => columns[colIdx].values[rowIdx]),
      );
      const labels = pulled.map(colIdx => columns[colIdx].label);
      onBComplete(B, labels);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPulled, pulled.join(',')]);

  const handlePull = (colIdx: number) => {
    if (pulled.includes(colIdx)) return;
    if (!basicIndices.has(colIdx)) return;
    setPulled(p => [...p, colIdx]);
  };

  const reset = () => setPulled([]);

  return (
    <div className="bg-card/40 border-2 border-primary/40 rounded-xl p-4 space-y-4 animate-fill-pop">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
          Build B — the basis matrix
        </p>
        {pulled.length > 0 && !allPulled && (
          <button
            type="button"
            onClick={reset}
            className="text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted"
          >
            start over
          </button>
        )}
      </div>
      <p className="text-[11px] text-foreground/90 leading-relaxed">
        The matrix <span className="font-mono font-bold text-primary">B</span> is just
        the columns of the original constraints that correspond to the variables
        that are <span className="font-semibold">basic</span> at this vertex.
        Click each <span className="text-orange-300 font-semibold">highlighted</span> column on the
        left to pull it into <span className="font-mono font-bold text-primary">B</span> on the right.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-start">

        {/* ── A matrix ──────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
            Original constraint matrix{' '}
            <span className="font-mono text-foreground">A</span> = [A<sub>dec</sub> | I]
          </p>
          <table className="border-collapse font-mono text-sm">
            <thead>
              <tr>
                <th className="px-1 text-[10px] text-muted-foreground"></th>
                {columns.map(col => {
                  const highlight = basicIndices.has(col.idx) && !pulled.includes(col.idx);
                  const done = pulled.includes(col.idx);
                  const slackColor = col.slackIdx >= 0 ? colorFor(col.slackIdx) : null;
                  return (
                    <th
                      key={col.idx}
                      onClick={() => handlePull(col.idx)}
                      className={`px-2 py-1 text-center text-xs font-semibold select-none ${
                        highlight ? 'cursor-pointer text-orange-300' :
                        done ? 'text-muted-foreground/50 line-through' :
                        'text-muted-foreground'
                      }`}
                      style={slackColor && !done ? { color: slackColor } : undefined}
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
                    const highlight = basicIndices.has(col.idx) && !pulled.includes(col.idx);
                    const done = pulled.includes(col.idx);
                    const slackColor = col.slackIdx >= 0 ? colorFor(col.slackIdx) : null;
                    const baseBg = done
                      ? 'bg-muted/10 border-border/40 text-muted-foreground/40'
                      : highlight
                        ? 'bg-orange-500/10 border-orange-400/60 text-orange-100 cursor-pointer hover:scale-105 ring-2 ring-orange-400/60 animate-attention-pulse'
                        : 'bg-muted/40 border-border/60 text-foreground/70';
                    return (
                      <td
                        key={col.idx}
                        onClick={() => handlePull(col.idx)}
                        className="p-0.5"
                      >
                        <div
                          className={`w-10 h-9 flex items-center justify-center rounded border text-sm font-bold tabular-nums transition-transform ${baseBg}`}
                          style={slackColor && highlight ? { borderColor: slackColor } : undefined}
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

        {/* ── Arrow ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center pt-6 text-muted-foreground/80 text-2xl">
          →
        </div>

        {/* ── B matrix (being assembled) ──────────────────────────── */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
            <span className="font-mono text-primary font-bold">B</span>
            {allPulled && <span className="text-emerald-300 ml-1">✓ complete</span>}
          </p>
          <table className="border-collapse font-mono text-sm">
            <thead>
              <tr>
                <th className="px-1 text-[10px]"></th>
                {Array.from({ length: basicIndices.size }, (_, slotIdx) => {
                  const filled = pulled[slotIdx];
                  const expectedLabel = orderedBasisLabels[slotIdx];
                  const actualLabel = filled != null ? columns[filled].label : null;
                  const col = filled != null ? columns[filled] : null;
                  const slackColor = col?.slackIdx != null && col.slackIdx >= 0 ? colorFor(col.slackIdx) : null;
                  return (
                    <th
                      key={slotIdx}
                      className="px-2 py-1 text-center text-xs font-semibold"
                      style={slackColor ? { color: slackColor } : undefined}
                    >
                      {actualLabel ?? (
                        <span className="text-muted-foreground/50 italic">
                          ({expectedLabel})
                        </span>
                      )}
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
                  {Array.from({ length: basicIndices.size }, (_, slotIdx) => {
                    const filled = pulled[slotIdx];
                    const col = filled != null ? columns[filled] : null;
                    const v = col?.values[rowIdx];
                    const slackColor = col?.slackIdx != null && col.slackIdx >= 0 ? colorFor(col.slackIdx) : null;
                    return (
                      <td key={slotIdx} className="p-0.5">
                        {v != null ? (
                          <div
                            className="w-10 h-9 flex items-center justify-center rounded border-2 border-primary/60 bg-primary/15 text-primary text-sm font-bold tabular-nums animate-fly-in-from-left"
                            style={slackColor ? { borderColor: colorForFill(col!.slackIdx, 0.6), color: slackColor } : undefined}
                          >
                            {fmt(v)}
                          </div>
                        ) : (
                          <div className="w-10 h-9 flex items-center justify-center rounded border-2 border-dashed border-border/50 bg-muted/10 text-muted-foreground/40 text-sm">
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

      {/* Status / next-step callout */}
      {!allPulled && (
        <p className="text-[10px] text-muted-foreground italic">
          {pulled.length} / {basicIndices.size} basic columns pulled.
          Recommended order: {orderedBasisLabels.join(', ')}
        </p>
      )}
      {allPulled && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2 text-[11px] text-emerald-100 leading-relaxed animate-fill-pop">
          You&apos;ve built <span className="font-mono font-bold">B</span>. This matrix
          is the <span className="font-semibold">single object</span> that the entire
          sensitivity chapter revolves around — the shadow price, the allowable
          ranges, the reduced costs all come from operations involving{' '}
          <span className="font-mono font-bold">B⁻¹</span>. Next step: invert it.
        </div>
      )}
    </div>
  );
}
