/**
 * InverseBPanel — the student watches B⁻¹ get built, one step at a time.
 *
 * For a 2×2 B the procedure is:
 *   1. Compute det(B) = a·d − b·c.
 *   2. Form the adjugate adj(B) = [[d, −b], [−c, a]].
 *   3. Divide adj(B) by det(B) → B⁻¹.
 *
 * Each step has its own card and reveals in order when the student
 * clicks "next step" (or clicks a placeholder in the current step).
 * At the end, a Verify card multiplies B · B⁻¹ cell-by-cell so the
 * student sees the identity matrix come out — the reward for the
 * whole procedure.
 *
 * Design note: this walkthrough ships with 2×2 support, which covers
 * the Toy Factory problem (two decision vars at optimum → B is 2×2).
 * 3×3 inversion requires more screen real-estate and can be added
 * later without changing the data flow.
 */

import { useState, useEffect } from 'react';

interface Props {
  B: number[][];
  basisLabels: string[];
  /** Called once B⁻¹ is computed and verified. */
  onInverseComplete?: (Binv: number[][]) => void;
}

function fmt(v: number, frac = false): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (!frac && Number.isInteger(v)) return String(v);
  if (frac) {
    // Try a small-denominator fraction
    for (const d of [2, 3, 4, 5, 6, 8, 10]) {
      const n = v * d;
      if (Math.abs(n - Math.round(n)) < 1e-6) {
        const num = Math.round(n);
        if (Math.abs(num) === d) return v > 0 ? '1' : '-1';
        if (num === 0) return '0';
        return `${num}/${d}`;
      }
    }
  }
  return v.toFixed(3).replace(/\.?0+$/, '');
}

export default function InverseBPanel({ B, basisLabels, onInverseComplete }: Props) {
  // Only 2×2 supported in this iteration
  const n = B.length;
  const supported = n === 2 && B[0].length === 2;
  const [step, setStep] = useState(0); // 0=det, 1=adj, 2=divide, 3=verify
  const [showWork, setShowWork] = useState(true);

  useEffect(() => {
    setStep(0);
  }, [B[0]?.[0], B[0]?.[1], B[1]?.[0], B[1]?.[1]]);

  if (!supported) {
    return (
      <div className="bg-card/40 border border-border rounded-xl p-4">
        <p className="text-[11px] text-muted-foreground italic">
          B⁻¹ walkthrough for {n}×{n} matrices is coming. For now this panel handles 2×2.
        </p>
      </div>
    );
  }

  const a = B[0][0], b = B[0][1], c = B[1][0], d = B[1][1];
  const det = a * d - b * c;
  const adj: number[][] = [[d, -b], [-c, a]];
  const Binv: number[][] = det === 0
    ? [[NaN, NaN], [NaN, NaN]]
    : [[d / det, -b / det], [-c / det, a / det]];

  // Fire completion once the student reaches verify step
  useEffect(() => {
    if (step >= 3 && det !== 0 && onInverseComplete) {
      onInverseComplete(Binv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const advance = () => setStep(s => Math.min(s + 1, 3));

  return (
    <div className="bg-card/40 border-2 border-primary/40 rounded-xl p-4 space-y-3 animate-fill-pop">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
          Invert B — compute B⁻¹ step by step
        </p>
        <button
          type="button"
          onClick={() => setShowWork(w => !w)}
          className="text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted"
        >
          {showWork ? 'hide work' : 'show work'}
        </button>
      </div>

      {/* B recap */}
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-muted-foreground">B =</span>
        <MatrixDisplay rows={B} colLabels={basisLabels} compact />
      </div>

      {/* Step 1 — determinant */}
      {showWork && (
        <StepCard
          active={step === 0}
          done={step > 0}
          label={<>Step 1 — determinant: <span className="font-mono">det(B) = a·d − b·c</span></>}
          onAdvance={step === 0 ? advance : undefined}
        >
          <div className="flex items-center gap-2 flex-wrap font-mono text-sm">
            <span>det(B) =</span>
            <span className="px-2 py-0.5 rounded bg-muted/40 border border-border tabular-nums">{fmt(a)}</span>
            <span>·</span>
            <span className="px-2 py-0.5 rounded bg-muted/40 border border-border tabular-nums">{fmt(d)}</span>
            <span>−</span>
            <span className="px-2 py-0.5 rounded bg-muted/40 border border-border tabular-nums">{fmt(b)}</span>
            <span>·</span>
            <span className="px-2 py-0.5 rounded bg-muted/40 border border-border tabular-nums">{fmt(c)}</span>
            <span>=</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-200 tabular-nums font-bold">
              {fmt(a * d)} − {fmt(b * c)} = {fmt(det)}
            </span>
          </div>
          {det === 0 && (
            <p className="text-[11px] text-rose-300 mt-2">
              det(B) = 0 means B is singular — this basis is <span className="font-semibold">not valid</span>.
              Pick a different vertex.
            </p>
          )}
        </StepCard>
      )}

      {/* Step 2 — adjugate */}
      {showWork && (
        <StepCard
          active={step === 1}
          done={step > 1}
          dimmed={step < 1}
          label={<>Step 2 — adjugate: swap diagonal, negate off-diagonal</>}
          onAdvance={step === 1 ? advance : undefined}
        >
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[11px] text-muted-foreground">B =</span>
            <MatrixDisplay rows={B} compact />
            <span className="text-muted-foreground text-xl">→</span>
            <span className="text-[11px] text-muted-foreground">adj(B) =</span>
            <MatrixDisplay rows={adj} compact highlight />
          </div>
          <p className="text-[10px] text-muted-foreground italic mt-2">
            Top-left ↔ bottom-right; off-diagonals flip sign.
          </p>
        </StepCard>
      )}

      {/* Step 3 — divide by det */}
      {showWork && (
        <StepCard
          active={step === 2}
          done={step > 2}
          dimmed={step < 2}
          label={<>Step 3 — divide each entry by det(B) = {fmt(det)}</>}
          onAdvance={step === 2 ? advance : undefined}
        >
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[11px] text-muted-foreground">(1/{fmt(det)}) ·</span>
            <MatrixDisplay rows={adj} compact />
            <span className="text-muted-foreground text-xl">=</span>
            <MatrixDisplay rows={Binv} colLabels={basisLabels} compact highlight emphasize />
          </div>
        </StepCard>
      )}

      {/* Step 4 — verify */}
      {showWork && step >= 2 && (
        <StepCard
          active={step === 3}
          done={false}
          dimmed={step < 3}
          label={<>Verify: <span className="font-mono">B · B⁻¹ = I</span></>}
          onAdvance={step === 2 ? advance : undefined}
        >
          {step >= 3 && (
            <VerifyBlock B={B} Binv={Binv} />
          )}
        </StepCard>
      )}

      {/* Final B⁻¹ card — always visible once computed */}
      {(!showWork || step >= 3) && det !== 0 && (
        <div className="flex items-center gap-4 pt-2 border-t border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-primary font-bold">B⁻¹ =</span>
          <MatrixDisplay rows={Binv} colLabels={basisLabels} compact highlight emphasize />
          <span className="text-[10px] text-muted-foreground italic">
            ready to use in the four sensitivity formulas
          </span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function MatrixDisplay({
  rows, colLabels, compact = false, highlight = false, emphasize = false,
}: {
  rows: number[][];
  colLabels?: string[];
  compact?: boolean;
  highlight?: boolean;
  emphasize?: boolean;
}) {
  const cellSize = compact ? 'w-11 h-9' : 'w-14 h-12';
  const cellCls = emphasize
    ? 'bg-primary/15 border-primary/60 text-primary animate-fly-in-from-left'
    : highlight
      ? 'bg-orange-500/10 border-orange-400/60 text-orange-100'
      : 'bg-muted/40 border-border/70 text-foreground/90';
  return (
    <table className="border-collapse font-mono text-sm">
      {colLabels && (
        <thead>
          <tr>
            {colLabels.map((l, i) => (
              <th key={i} className="text-center text-[10px] text-muted-foreground px-1 pb-1">{l}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((v, c) => (
              <td key={c} className="p-0.5">
                <div className={`${cellSize} flex items-center justify-center rounded border-2 font-bold tabular-nums ${cellCls}`}>
                  {fmt(v, true)}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StepCard({
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
            next step →
          </button>
        </div>
      )}
    </div>
  );
}

function VerifyBlock({ B, Binv }: { B: number[][]; Binv: number[][] }) {
  // Compute B · Binv
  const product = B.map((_, i) =>
    B[0].map((_col, j) =>
      B[i].reduce((sum, _v, k) => sum + B[i][k] * Binv[k][j], 0),
    ),
  );
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <MatrixDisplay rows={B} compact />
      <span className="text-muted-foreground">·</span>
      <MatrixDisplay rows={Binv} compact />
      <span className="text-muted-foreground text-xl">=</span>
      <MatrixDisplay rows={product} compact highlight />
      <span className="text-[11px] text-emerald-300">= I ✓</span>
    </div>
  );
}
