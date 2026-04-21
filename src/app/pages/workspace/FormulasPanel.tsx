/**
 * FormulasPanel — the payoff of Phase 6. The student has B and B⁻¹;
 * now they use the four matrix formulas from the chapter's Table 8.1
 * to reconstruct every region of the optimal simplex tableau:
 *
 *   Non-basic columns in the optimal table :  B⁻¹ · N
 *   RHS column (basic var values)         :  B⁻¹ · b
 *   Z-row non-basic entries               :  C_B · B⁻¹ · N  −  C_N
 *   Objective value (Z-row RHS)           :  C_B · B⁻¹ · b
 *
 * Each formula is its own revealable step with a cell-by-cell
 * computation. As each step completes, its result snaps into the
 * matching region of a "reconstructed optimal tableau" at the bottom.
 * At the end, that tableau IS the same tableau the student built by
 * pivoting back in Phase 4 — two paths, one answer.
 */

import { useState, useMemo } from 'react';
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
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  // Try small-denominator fraction
  for (const d of [2, 3, 4, 5, 6, 8]) {
    const n = v * d;
    if (Math.abs(n - Math.round(n)) < 1e-6) {
      const num = Math.round(n);
      if (Math.abs(num) === d) return v > 0 ? '1' : '-1';
      if (num === 0) return '0';
      return `${num}/${d}`;
    }
  }
  return v.toFixed(3).replace(/\.?0+$/, '');
}

export default function FormulasPanel({
  draft, vertex, B, Binv, basisLabels, nDecVars,
}: Props) {
  const nConstraints = draft.constraints.length;
  const isMax = (draft.objectiveType ?? 'max') === 'max';

  // ── Determine non-basic variables (in order: dec vars then slacks) ────
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

  // ── Build N (columns of non-basic variables from full A) ──────────────
  const N = useMemo(() => {
    return draft.constraints.map((_, r) =>
      nonBasicLabels.map(label => {
        if (label.startsWith('x')) {
          const i = parseInt(label.slice(1), 10) - 1;
          return draft.constraints[r].coefficients[i] ?? 0;
        }
        const i = parseInt(label.slice(1), 10) - 1;
        return r === i ? 1 : 0;
      }),
    );
  }, [draft, nonBasicLabels]);

  // ── Build b (original RHS) ────────────────────────────────────────────
  const b = useMemo(
    () => draft.constraints.map(c => c.rhs ?? 0),
    [draft],
  );

  // ── C_B and C_N (OF coefficients in original problem order) ───────────
  const objCoef = (label: string): number => {
    if (label.startsWith('x')) {
      const i = parseInt(label.slice(1), 10) - 1;
      return draft.objectiveCoefficients[i] ?? 0;
    }
    return 0;
  };
  const CB = basisLabels.map(objCoef);
  const CN = nonBasicLabels.map(objCoef);

  // ── Compute each formula's output ─────────────────────────────────────
  const BinvN = useMemo(() => {
    // (m x m) · (m x k) = (m x k)
    return Binv.map((row) =>
      N[0].map((_c, k) => row.reduce((s, _v, j) => s + row[j] * N[j][k], 0)),
    );
  }, [Binv, N]);

  const Binvb = useMemo(
    () => Binv.map(row => row.reduce((s, v, i) => s + v * b[i], 0)),
    [Binv, b],
  );

  const CB_BinvN = useMemo(
    () => BinvN[0].map((_, k) => CB.reduce((s, v, i) => s + v * BinvN[i][k], 0)),
    [CB, BinvN],
  );

  const zNonBasic = useMemo(() => {
    // For MAX: Z-row = C_B·B⁻¹N − C_N (optimality: all >= 0)
    // For MIN: same expression but optimality: all <= 0
    return CB_BinvN.map((v, k) => v - CN[k]);
  }, [CB_BinvN, CN]);

  const zStar = useMemo(
    () => CB.reduce((s, v, i) => s + v * Binvb[i], 0),
    [CB, Binvb],
  );

  // ── Step progression ──────────────────────────────────────────────────
  const [step, setStep] = useState(0); // 0..3
  const advance = () => setStep(s => Math.min(s + 1, 4));

  return (
    <div className="bg-card/40 border-2 border-primary/40 rounded-xl p-4 space-y-3 animate-fill-pop">
      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
        Apply the four formulas — rebuild the optimal tableau from B⁻¹
      </p>
      <p className="text-[11px] text-foreground/90 leading-relaxed">
        From the chapter&apos;s Table 8.1, four matrix expressions fill four
        regions of the optimal tableau. Each uses{' '}
        <span className="font-mono font-bold text-primary">B⁻¹</span> you
        just computed.
      </p>

      {/* ── Formula 1: B⁻¹ · N ─────────────────────────────────────────── */}
      <FormulaCard
        active={step === 0}
        done={step > 0}
        label={<>1. Non-basic columns = <span className="font-mono font-bold">B⁻¹ · N</span></>}
        onAdvance={step === 0 ? advance : undefined}
      >
        <p className="text-[11px] text-muted-foreground mb-1">
          N is the columns of non-basic variables ({nonBasicLabels.join(', ')}) from the original problem.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <MatrixDisplay rows={Binv} label="B⁻¹" />
          <span className="text-muted-foreground">·</span>
          <MatrixDisplay rows={N} label="N" colLabels={nonBasicLabels} />
          <span className="text-muted-foreground text-xl">=</span>
          <MatrixDisplay rows={BinvN} label="B⁻¹N" colLabels={nonBasicLabels} emphasize />
        </div>
      </FormulaCard>

      {/* ── Formula 2: B⁻¹ · b ─────────────────────────────────────────── */}
      <FormulaCard
        active={step === 1}
        done={step > 1}
        dimmed={step < 1}
        label={<>2. Basic-variable values = <span className="font-mono font-bold">B⁻¹ · b</span></>}
        onAdvance={step === 1 ? advance : undefined}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <MatrixDisplay rows={Binv} label="B⁻¹" />
          <span className="text-muted-foreground">·</span>
          <MatrixDisplay rows={b.map(v => [v])} label="b" />
          <span className="text-muted-foreground text-xl">=</span>
          <MatrixDisplay rows={Binvb.map(v => [v])} label="B⁻¹b" rowLabels={basisLabels} emphasize />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 italic">
          These are the values of your basic variables at the vertex.
          Check: they match {basisLabels.map((l, i) => `${l}=${fmt(Binvb[i])}`).join(', ')}.
        </p>
      </FormulaCard>

      {/* ── Formula 3: C_B · B⁻¹ · N − C_N  (Z-row non-basics) ─────────── */}
      <FormulaCard
        active={step === 2}
        done={step > 2}
        dimmed={step < 2}
        label={<>3. Z-row non-basic entries = <span className="font-mono font-bold">C_B · B⁻¹N − C_N</span></>}
        onAdvance={step === 2 ? advance : undefined}
      >
        <p className="text-[11px] text-muted-foreground mb-1">
          C_B = [{CB.map(fmt).join(', ')}] (coefficients of basic vars {basisLabels.join(', ')});
          C_N = [{CN.map(fmt).join(', ')}] (coefficients of non-basic vars).
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs">C_B · B⁻¹N =</span>
          <VectorInline values={CB_BinvN} emphasize />
          <span className="text-muted-foreground">−</span>
          <VectorInline values={CN} />
          <span className="text-muted-foreground text-xl">=</span>
          <VectorInline values={zNonBasic} colLabels={nonBasicLabels} emphasize />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 italic">
          For {isMax ? 'MAX' : 'MIN'}, the optimality condition is every entry {isMax ? '≥ 0' : '≤ 0'} —
          {zNonBasic.every(v => (isMax ? v >= -1e-9 : v <= 1e-9))
            ? <span className="text-emerald-300"> ✓ satisfied.</span>
            : <span className="text-rose-300"> ✗ not satisfied — this vertex is not optimal.</span>}
        </p>
      </FormulaCard>

      {/* ── Formula 4: C_B · B⁻¹ · b  (z*) ─────────────────────────────── */}
      <FormulaCard
        active={step === 3}
        done={step > 3}
        dimmed={step < 3}
        label={<>4. Objective value z* = <span className="font-mono font-bold">C_B · B⁻¹b</span></>}
        onAdvance={step === 3 ? advance : undefined}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs">z* =</span>
          <VectorInline values={CB} />
          <span className="text-muted-foreground">·</span>
          <VectorInline values={Binvb} vertical />
          <span className="text-muted-foreground text-xl">=</span>
          <span className="px-3 py-1 rounded bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-200 font-mono font-bold text-lg tabular-nums">
            {fmt(zStar)}
          </span>
        </div>
      </FormulaCard>

      {/* ── Reconstructed tableau ──────────────────────────────────────── */}
      {step >= 4 && (
        <ReconstructedTableau
          basisLabels={basisLabels}
          nonBasicLabels={nonBasicLabels}
          BinvN={BinvN}
          Binvb={Binvb}
          zNonBasic={zNonBasic}
          zStar={zStar}
          nDecVars={nDecVars}
          nConstraints={nConstraints}
        />
      )}

      {step >= 4 && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2 text-[11px] text-emerald-100 leading-relaxed animate-fill-pop">
          That reconstructed tableau matches the one you built by pivoting in Phase 4.
          Two paths — row operations OR the four matrix formulas — lead to the same optimal table.
          Next step: use these same formulas to answer &quot;what if&quot; questions.
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function FormulaCard({
  active, done, dimmed = false, label, children, onAdvance,
}: {
  active: boolean;
  done: boolean;
  dimmed?: boolean;
  label: React.ReactNode;
  children: React.ReactNode;
  onAdvance?: () => void;
}) {
  const border = done
    ? 'border-emerald-500/30 bg-emerald-500/5'
    : active
      ? 'border-orange-400/60 bg-orange-500/5'
      : 'border-border/40 bg-muted/10';
  const dimCls = dimmed ? 'opacity-50' : '';
  return (
    <div className={`rounded-lg border p-3 space-y-2 transition-all ${border} ${dimCls}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground">{label}</p>
        {done && <span className="text-[10px] text-emerald-300">✓</span>}
      </div>
      {children}
      {onAdvance && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAdvance}
            className="text-[11px] px-2 py-1 rounded bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30"
          >
            compute →
          </button>
        </div>
      )}
    </div>
  );
}

function MatrixDisplay({
  rows, label, colLabels, rowLabels, emphasize = false,
}: {
  rows: number[][];
  label?: string;
  colLabels?: string[];
  rowLabels?: string[];
  emphasize?: boolean;
}) {
  const cellCls = emphasize
    ? 'bg-primary/15 border-primary/60 text-primary animate-fly-in-from-left'
    : 'bg-muted/40 border-border/70 text-foreground/90';
  return (
    <div>
      {label && <p className="text-[10px] text-muted-foreground text-center mb-0.5 font-mono font-semibold">{label}</p>}
      <table className="border-collapse font-mono text-sm">
        {colLabels && (
          <thead>
            <tr>
              {rowLabels && <th></th>}
              {colLabels.map((l, i) => (
                <th key={i} className="text-[10px] text-muted-foreground px-1 pb-0.5">{l}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {rowLabels && (
                <td className="pr-2 text-[10px] text-muted-foreground tabular-nums font-semibold">
                  {rowLabels[r]}
                </td>
              )}
              {row.map((v, c) => (
                <td key={c} className="p-0.5">
                  <div className={`w-10 h-8 flex items-center justify-center rounded border-2 font-bold text-xs tabular-nums ${cellCls}`}>
                    {fmt(v)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VectorInline({
  values, colLabels, vertical = false, emphasize = false,
}: {
  values: number[];
  colLabels?: string[];
  vertical?: boolean;
  emphasize?: boolean;
}) {
  const cellCls = emphasize
    ? 'bg-primary/15 border-primary/60 text-primary animate-fly-in-from-left'
    : 'bg-muted/40 border-border/70 text-foreground/90';
  if (vertical) {
    return (
      <table className="border-collapse font-mono text-sm">
        <tbody>
          {values.map((v, i) => (
            <tr key={i}>
              <td className="p-0.5">
                <div className={`w-10 h-8 flex items-center justify-center rounded border-2 font-bold text-xs tabular-nums ${cellCls}`}>
                  {fmt(v)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div>
      {colLabels && (
        <div className="flex gap-0.5 mb-0.5">
          {colLabels.map((l, i) => (
            <span key={i} className="w-10 text-center text-[10px] text-muted-foreground">{l}</span>
          ))}
        </div>
      )}
      <div className="flex gap-0.5">
        {values.map((v, i) => (
          <div key={i} className={`w-10 h-8 flex items-center justify-center rounded border-2 font-bold text-xs tabular-nums ${cellCls}`}>
            {fmt(v)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReconstructedTableau({
  basisLabels, nonBasicLabels, BinvN, Binvb, zNonBasic, zStar,
  nDecVars, nConstraints,
}: {
  basisLabels: string[];
  nonBasicLabels: string[];
  BinvN: number[][];
  Binvb: number[];
  zNonBasic: number[];
  zStar: number;
  nDecVars: number;
  nConstraints: number;
}) {
  // Assemble a single-column-order tableau: x1, x2, s1, s2 | RHS
  const allVars = [
    ...Array.from({ length: nDecVars }, (_, i) => `x${i + 1}`),
    ...Array.from({ length: nConstraints }, (_, i) => `s${i + 1}`),
  ];

  const cellAt = (rowLabel: string | 'z', colLabel: string): number => {
    if (rowLabel === 'z') {
      // Z-row: basic positions = 0; non-basic = zNonBasic; RHS handled separately
      const nbIdx = nonBasicLabels.indexOf(colLabel);
      if (nbIdx >= 0) return zNonBasic[nbIdx];
      return 0;
    }
    // Basic row: in its own column 1, in other basic columns 0, in non-basic columns from BinvN
    const rowIdx = basisLabels.indexOf(rowLabel);
    if (rowIdx < 0) return 0;
    if (colLabel === rowLabel) return 1;
    const nbIdx = nonBasicLabels.indexOf(colLabel);
    if (nbIdx >= 0) return BinvN[rowIdx][nbIdx];
    return 0; // other basic cols
  };

  return (
    <div className="border-t border-border/40 pt-3">
      <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-2">
        Reconstructed optimal tableau
      </p>
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
                const val = cellAt(bLabel, v);
                return (
                  <td key={v} className="p-0.5 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-8 rounded border font-mono text-xs font-bold tabular-nums bg-emerald-500/10 border-emerald-500/40 text-emerald-100 animate-fly-in-from-left">
                      {fmt(val)}
                    </div>
                  </td>
                );
              })}
              <td className="p-0.5 text-center">
                <div className="inline-flex items-center justify-center w-10 h-8 rounded border font-mono text-xs font-bold tabular-nums bg-accent/10 border-accent/40 text-accent animate-fly-in-from-left">
                  {fmt(Binvb[rIdx])}
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-primary/50">
            <td className="px-2 py-1 text-xs font-semibold text-primary">z</td>
            {allVars.map(v => {
              const val = cellAt('z', v);
              return (
                <td key={v} className="p-0.5 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-8 rounded border font-mono text-xs font-bold tabular-nums bg-emerald-500/10 border-emerald-500/40 text-emerald-100 animate-fly-in-from-left">
                    {fmt(val)}
                  </div>
                </td>
              );
            })}
            <td className="p-0.5 text-center">
              <div className="inline-flex items-center justify-center w-10 h-8 rounded border font-mono text-xs font-bold tabular-nums bg-emerald-500/15 border-emerald-500/50 text-emerald-200 animate-fly-in-from-left">
                {fmt(zStar)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
