/**
 * FormulasPanel — the four-formula gameboard for Phase 6.
 *
 * Every output cell in every formula starts as a "?" slot. The student
 * computes each formula by hand and types the result; correct answers
 * commit s-reveal keys that pop the cell in. The reconstructed optimal
 * tableau at the bottom assembles itself as those reveals accumulate.
 *
 * Reveal-key shapes:
 *   s-binvN-{r}-{c}      — (r,c) of B⁻¹·N     (non-basic columns)
 *   s-binvb-{r}           — r-th entry of B⁻¹·b  (basic var value)
 *   s-zrow-{c}            — c-th entry of C_B·B⁻¹N − C_N (Z-row non-basic)
 *   s-zstar               — C_B·B⁻¹b (z*)
 *
 * Principles met:
 *   1  Empty slots until earned
 *   2  Per-cell reveals
 *   3  Principle-first prompts in the script
 *   5  Typing when calculation is the point
 *   7  Pop animation on reveal
 *   9  Color-binding — slack columns keep their signature color
 *  10  Uses B⁻¹ earned in Slice 3
 *  11  Formulas shown as structure; numbers are clues the student
 *      confirms or refutes by computing
 */

import { useMemo } from 'react';
import { LPDraft } from './guidedTypes';
import { FeasibleVertex } from './DiscoveryGraph';
import { colorFor, colorForFill } from './constraintColors';

interface Props {
  draft: LPDraft;
  vertex: FeasibleVertex;
  B: number[][];
  Binv: number[][];
  basisLabels: string[];
  nDecVars: number;
  reveals: Set<string>;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  for (const d of [2, 3, 4, 5, 6, 8]) {
    const n = v * d;
    if (Math.abs(n - Math.round(n)) < 1e-6) {
      const num = Math.round(n);
      if (num === 0) return '0';
      if (Math.abs(num) === d) return v > 0 ? '1' : '-1';
      return `${num}/${d}`;
    }
  }
  return v.toFixed(3).replace(/\.?0+$/, '');
}

export default function FormulasPanel({
  draft, vertex, B, Binv, basisLabels, nDecVars, reveals,
}: Props) {
  const nConstraints = draft.constraints.length;

  const nonBasicLabels = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < nDecVars; i++) {
      if (vertex.zeroDecisionVars.includes(i)) arr.push(`x${i + 1}`);
    }
    for (let i = 0; i < nConstraints; i++) {
      if (vertex.tightConstraints.includes(i)) arr.push(`s${i + 1}`);
    }
    return arr;
  }, [vertex, nDecVars, nConstraints]);

  const N = useMemo(() =>
    draft.constraints.map((_, r) =>
      nonBasicLabels.map(label => {
        if (label.startsWith('x')) {
          const i = parseInt(label.slice(1), 10) - 1;
          return draft.constraints[r].coefficients[i] ?? 0;
        }
        const i = parseInt(label.slice(1), 10) - 1;
        return r === i ? 1 : 0;
      }),
    ),
    [draft, nonBasicLabels],
  );

  const b = useMemo(
    () => draft.constraints.map(c => c.rhs ?? 0),
    [draft],
  );

  const objCoef = (label: string): number => {
    if (label.startsWith('x')) {
      const i = parseInt(label.slice(1), 10) - 1;
      return draft.objectiveCoefficients[i] ?? 0;
    }
    return 0;
  };
  const CB = basisLabels.map(objCoef);
  const CN = nonBasicLabels.map(objCoef);

  const BinvN = useMemo(() =>
    Binv.map((row) =>
      N[0].map((_c, k) => row.reduce((s, _v, j) => s + row[j] * N[j][k], 0)),
    ),
    [Binv, N],
  );
  const Binvb = useMemo(
    () => Binv.map(row => row.reduce((s, v, i) => s + v * b[i], 0)),
    [Binv, b],
  );
  const zNonBasic = useMemo(() => {
    const CB_BinvN = BinvN[0].map((_, k) => CB.reduce((s, v, i) => s + v * BinvN[i][k], 0));
    return CB_BinvN.map((v, k) => v - CN[k]);
  }, [CB, CN, BinvN]);
  const zStar = useMemo(
    () => CB.reduce((s, v, i) => s + v * Binvb[i], 0),
    [CB, Binvb],
  );

  const isBinvNRevealed = (r: number, c: number) => reveals.has(`s-binvN-${r}-${c}`);
  const isBinvbRevealed = (r: number) => reveals.has(`s-binvb-${r}`);
  const isZRowRevealed = (c: number) => reveals.has(`s-zrow-${c}`);
  const isZStarRevealed = reveals.has('s-zstar');

  const allRevealed =
    BinvN.every((row, r) => row.every((_, c) => isBinvNRevealed(r, c))) &&
    Binvb.every((_, r) => isBinvbRevealed(r)) &&
    zNonBasic.every((_, c) => isZRowRevealed(c)) &&
    isZStarRevealed;

  return (
    <div className="bg-card/40 border-2 border-primary/40 rounded-xl p-4 space-y-4 animate-fill-pop">
      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
        Apply the four formulas — each cell is a computation you earn
      </p>
      <p className="text-[11px] text-foreground/90 leading-relaxed">
        From Table 8.1 of the chapter, four matrix expressions fill four regions of
        the optimal tableau. Each uses <span className="font-mono font-bold text-primary">B⁻¹</span>
        {' '}you just computed. The script will walk you through computing each output cell;
        every correct answer pops the cell into place.
      </p>

      {/* Formula 1: B⁻¹ · N */}
      <FormulaBlock label={<>1. Non-basic columns = <span className="font-mono font-bold">B⁻¹ · N</span></>}>
        <div className="flex items-center gap-2 flex-wrap">
          <MatrixBox rows={Binv} />
          <span>·</span>
          <MatrixBox rows={N} colLabels={nonBasicLabels} />
          <span className="text-xl">=</span>
          <SlotMatrixWithLabels
            rows={BinvN}
            isRevealed={isBinvNRevealed}
            colLabels={nonBasicLabels}
            tone="primary"
          />
        </div>
      </FormulaBlock>

      {/* Formula 2: B⁻¹ · b */}
      <FormulaBlock label={<>2. Basic-var values = <span className="font-mono font-bold">B⁻¹ · b</span></>}>
        <div className="flex items-center gap-2 flex-wrap">
          <MatrixBox rows={Binv} />
          <span>·</span>
          <MatrixBox rows={b.map(v => [v])} />
          <span className="text-xl">=</span>
          <SlotVector
            values={Binvb}
            isRevealed={isBinvbRevealed}
            rowLabels={basisLabels}
            tone="accent"
          />
        </div>
      </FormulaBlock>

      {/* Formula 3: Z-row non-basics */}
      <FormulaBlock label={<>3. Z-row non-basic = <span className="font-mono font-bold">C_B · B⁻¹N − C_N</span></>}>
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <span className="whitespace-nowrap">C_B = [{CB.map(fmt).join(', ')}]</span>
          <span className="whitespace-nowrap">C_N = [{CN.map(fmt).join(', ')}]</span>
          <span>⇒</span>
          <SlotVectorHoriz
            values={zNonBasic}
            isRevealed={isZRowRevealed}
            colLabels={nonBasicLabels}
            tone="primary"
          />
        </div>
      </FormulaBlock>

      {/* Formula 4: z* */}
      <FormulaBlock label={<>4. Objective value z* = <span className="font-mono font-bold">C_B · B⁻¹b</span></>}>
        <div className="flex items-center gap-2 flex-wrap text-sm font-mono">
          <span>z* =</span>
          <SlotCell revealed={isZStarRevealed} value={zStar} tone="emerald" big />
        </div>
      </FormulaBlock>

      {/* Reconstructed optimal tableau — assembles from revealed cells */}
      <div className="border-t border-border/40 pt-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-2">
          Reconstructed optimal tableau
        </p>
        <ReconstructedTableau
          basisLabels={basisLabels}
          nonBasicLabels={nonBasicLabels}
          BinvN={BinvN}
          Binvb={Binvb}
          zNonBasic={zNonBasic}
          zStar={zStar}
          nDecVars={nDecVars}
          nConstraints={nConstraints}
          isBinvNRevealed={isBinvNRevealed}
          isBinvbRevealed={isBinvbRevealed}
          isZRowRevealed={isZRowRevealed}
          isZStarRevealed={isZStarRevealed}
        />
      </div>

      {allRevealed && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2 text-[11px] text-emerald-100 leading-relaxed animate-fill-pop">
          The reconstructed tableau matches the one you built by pivoting in Phase 4.
          Two paths — row operations OR the four matrix formulas — produce the same
          optimal table. Next: use these formulas to answer &quot;what if&quot; questions.
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function FormulaBlock({
  label, children,
}: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground">{label}</p>
      {children}
    </div>
  );
}

function MatrixBox({
  rows, colLabels,
}: { rows: number[][]; colLabels?: string[] }) {
  return (
    <table className="border-collapse font-mono text-sm">
      {colLabels && (
        <thead>
          <tr>
            {colLabels.map((l, i) => (
              <th key={i} className="text-center text-[10px] text-muted-foreground px-1 pb-0.5">{l}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((v, c) => (
              <td key={c} className="p-0.5">
                <div className="w-9 h-8 flex items-center justify-center rounded border bg-muted/40 border-border/60 text-foreground/80 font-bold text-xs tabular-nums">
                  {fmt(v)}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SlotMatrixWithLabels({
  rows, isRevealed, colLabels, tone,
}: {
  rows: number[][];
  isRevealed: (r: number, c: number) => boolean;
  colLabels?: string[];
  tone: 'primary' | 'accent';
}) {
  return (
    <table className="border-collapse font-mono text-sm">
      {colLabels && (
        <thead>
          <tr>
            {colLabels.map((l, i) => (
              <th key={i} className="text-center text-[10px] text-muted-foreground px-1 pb-0.5">{l}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((v, c) => (
              <td key={c} className="p-0.5">
                <SlotCell revealed={isRevealed(r, c)} value={v} tone={tone} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SlotVector({
  values, isRevealed, rowLabels, tone,
}: {
  values: number[];
  isRevealed: (r: number) => boolean;
  rowLabels?: string[];
  tone: 'primary' | 'accent';
}) {
  return (
    <table className="border-collapse font-mono text-sm">
      <tbody>
        {values.map((v, r) => (
          <tr key={r}>
            {rowLabels && (
              <td className="pr-2 text-[10px] text-muted-foreground tabular-nums font-semibold">
                {rowLabels[r]}
              </td>
            )}
            <td className="p-0.5">
              <SlotCell revealed={isRevealed(r)} value={v} tone={tone} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SlotVectorHoriz({
  values, isRevealed, colLabels, tone,
}: {
  values: number[];
  isRevealed: (c: number) => boolean;
  colLabels?: string[];
  tone: 'primary' | 'accent';
}) {
  return (
    <div>
      {colLabels && (
        <div className="flex gap-0.5 mb-0.5">
          {colLabels.map((l, i) => (
            <span key={i} className="w-9 text-center text-[10px] text-muted-foreground">{l}</span>
          ))}
        </div>
      )}
      <div className="flex gap-0.5">
        {values.map((v, c) => (
          <SlotCell key={c} revealed={isRevealed(c)} value={v} tone={tone} />
        ))}
      </div>
    </div>
  );
}

function SlotCell({
  revealed, value, tone, big = false,
}: {
  revealed: boolean;
  value: number;
  tone: 'primary' | 'accent' | 'emerald';
  big?: boolean;
}) {
  const size = big ? 'px-3 h-9 text-base' : 'w-9 h-8 text-xs';
  if (!revealed) {
    return (
      <div className={`${size} min-w-[2.25rem] flex items-center justify-center rounded border-2 border-dashed border-border/60 bg-muted/20 text-muted-foreground/50 font-mono`}>
        ?
      </div>
    );
  }
  const cls =
    tone === 'primary' ? 'bg-primary/15 border-primary/60 text-primary' :
    tone === 'accent' ? 'bg-accent/15 border-accent/60 text-accent' :
    'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
  return (
    <div className={`${size} min-w-[2.25rem] flex items-center justify-center rounded border-2 font-bold tabular-nums animate-fly-in-from-left ${cls}`}>
      {fmt(value)}
    </div>
  );
}

function ReconstructedTableau({
  basisLabels, nonBasicLabels, BinvN, Binvb, zNonBasic, zStar,
  nDecVars, nConstraints,
  isBinvNRevealed, isBinvbRevealed, isZRowRevealed, isZStarRevealed,
}: {
  basisLabels: string[];
  nonBasicLabels: string[];
  BinvN: number[][];
  Binvb: number[];
  zNonBasic: number[];
  zStar: number;
  nDecVars: number;
  nConstraints: number;
  isBinvNRevealed: (r: number, c: number) => boolean;
  isBinvbRevealed: (r: number) => boolean;
  isZRowRevealed: (c: number) => boolean;
  isZStarRevealed: boolean;
}) {
  const allVars = [
    ...Array.from({ length: nDecVars }, (_, i) => `x${i + 1}`),
    ...Array.from({ length: nConstraints }, (_, i) => `s${i + 1}`),
  ];

  const cellAt = (rowLabel: string | 'z', colLabel: string): { val: number; revealed: boolean } => {
    if (rowLabel === 'z') {
      const nbIdx = nonBasicLabels.indexOf(colLabel);
      if (nbIdx >= 0) return { val: zNonBasic[nbIdx], revealed: isZRowRevealed(nbIdx) };
      return { val: 0, revealed: true }; // basic columns are always 0 in z-row
    }
    const rowIdx = basisLabels.indexOf(rowLabel);
    if (rowIdx < 0) return { val: 0, revealed: true };
    if (colLabel === rowLabel) return { val: 1, revealed: true };
    const nbIdx = nonBasicLabels.indexOf(colLabel);
    if (nbIdx >= 0) return { val: BinvN[rowIdx][nbIdx], revealed: isBinvNRevealed(rowIdx, nbIdx) };
    return { val: 0, revealed: true }; // other basic columns
  };

  return (
    <table className="border-collapse font-mono text-sm">
      <thead>
        <tr>
          <th className="px-2 py-1 text-[10px] text-muted-foreground font-semibold text-left">BV</th>
          {allVars.map(v => {
            const isSlack = v.startsWith('s');
            const slackIdx = isSlack ? parseInt(v.slice(1), 10) - 1 : -1;
            const color = isSlack ? colorFor(slackIdx) : undefined;
            return (
              <th
                key={v}
                className="px-2 py-1 text-xs font-semibold text-center"
                style={color ? { color, backgroundColor: colorForFill(slackIdx, 0.1) } : { color: 'hsl(var(--primary))' }}
              >
                {v}
              </th>
            );
          })}
          <th className="px-2 py-1 text-xs font-semibold text-center text-accent">RHS</th>
        </tr>
      </thead>
      <tbody>
        {basisLabels.map((bLabel, rIdx) => (
          <tr key={rIdx}>
            <td className="px-2 py-1 text-xs font-semibold text-foreground">{bLabel}</td>
            {allVars.map(v => {
              const { val, revealed } = cellAt(bLabel, v);
              return (
                <td key={v} className="p-0.5 text-center">
                  {revealed ? (
                    <div className="inline-flex items-center justify-center w-9 h-8 rounded border font-mono text-xs font-bold tabular-nums bg-emerald-500/10 border-emerald-500/40 text-emerald-100 animate-fly-in-from-left">
                      {fmt(val)}
                    </div>
                  ) : (
                    <div className="inline-flex items-center justify-center w-9 h-8 rounded border-2 border-dashed border-border/50 bg-muted/20 text-muted-foreground/50 text-xs font-mono">
                      ?
                    </div>
                  )}
                </td>
              );
            })}
            <td className="p-0.5 text-center">
              {isBinvbRevealed(rIdx) ? (
                <div className="inline-flex items-center justify-center w-9 h-8 rounded border font-mono text-xs font-bold tabular-nums bg-accent/10 border-accent/40 text-accent animate-fly-in-from-left">
                  {fmt(Binvb[rIdx])}
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-9 h-8 rounded border-2 border-dashed border-border/50 bg-muted/20 text-muted-foreground/50 text-xs font-mono">?</div>
              )}
            </td>
          </tr>
        ))}
        <tr className="border-t-2 border-primary/50">
          <td className="px-2 py-1 text-xs font-semibold text-primary">z</td>
          {allVars.map(v => {
            const { val, revealed } = cellAt('z', v);
            return (
              <td key={v} className="p-0.5 text-center">
                {revealed ? (
                  <div className="inline-flex items-center justify-center w-9 h-8 rounded border font-mono text-xs font-bold tabular-nums bg-emerald-500/10 border-emerald-500/40 text-emerald-100 animate-fly-in-from-left">
                    {fmt(val)}
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-9 h-8 rounded border-2 border-dashed border-border/50 bg-muted/20 text-muted-foreground/50 text-xs font-mono">?</div>
                )}
              </td>
            );
          })}
          <td className="p-0.5 text-center">
            {isZStarRevealed ? (
              <div className="inline-flex items-center justify-center w-9 h-8 rounded border font-mono text-xs font-bold tabular-nums bg-emerald-500/15 border-emerald-500/50 text-emerald-200 animate-fly-in-from-left">
                {fmt(zStar)}
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-9 h-8 rounded border-2 border-dashed border-border/50 bg-muted/20 text-muted-foreground/50 text-xs font-mono">?</div>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
