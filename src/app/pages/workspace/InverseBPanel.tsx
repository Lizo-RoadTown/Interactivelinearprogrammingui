/**
 * InverseBPanel — the B⁻¹ gameboard.
 *
 * Every computed value is a dashed "?" slot that only pops in once the
 * student has entered the correct number. The determinant is one cell;
 * the adjugate is a 2×2 of cells; B⁻¹ itself is a 2×2 of cells. Each
 * cell has a per-cell reveal key, so questions fill them one at a time.
 *
 * Principles met:
 *   1  Empty ? slots
 *   2  Per-cell reveals (s-det, s-adj-r-c, s-binv-r-c)
 *   3  Principle-first prompts in the script
 *   5  Typing when calculation is the point
 *   7  Pop animation on reveal
 *   8  Active cell pulses (driven by question's highlight field)
 *   9  Color-binding of emphasized cells
 *  10  Uses B the student built in Slice 2
 *  11  Formula labels shown above matrices, not the answers
 *
 * Supports 2×2 only for the current Toy Factory basis. 3×3 is a
 * future addition.
 */

interface Props {
  B: number[][];
  basisLabels: string[];
  reveals: Set<string>;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  for (const d of [2, 3, 4, 5, 6, 8, 10]) {
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

export default function InverseBPanel({ B, basisLabels, reveals }: Props) {
  const n = B.length;
  if (!(n === 2 && B[0].length === 2)) {
    return (
      <div className="bg-card/40 border border-border rounded-xl p-4">
        <p className="text-[11px] text-muted-foreground italic">
          Inverse walkthrough currently supports 2×2 B matrices only.
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

  const isDetRevealed = reveals.has('s-det');
  const isAdjRevealed = (r: number, cc: number) => reveals.has(`s-adj-${r}-${cc}`);
  const isBinvRevealed = (r: number, cc: number) => reveals.has(`s-binv-${r}-${cc}`);

  return (
    <div className="bg-card/40 border-2 border-primary/40 rounded-xl p-4 space-y-4 animate-fill-pop">
      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
        Compute B⁻¹ — each entry is a calculation you earn
      </p>

      {/* Recap of B */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] text-muted-foreground">B =</span>
        <MatrixBox rows={B} colLabels={basisLabels} />
      </div>

      {/* Determinant */}
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
        <p className="text-[11px] font-semibold text-foreground">
          Step 1: determinant — <span className="font-mono">det(B) = a·d − b·c</span>
        </p>
        <div className="flex items-center gap-2 flex-wrap text-sm font-mono">
          <span>det(B) =</span>
          <NumCell value={a} />
          <span>·</span>
          <NumCell value={d} />
          <span>−</span>
          <NumCell value={b} />
          <span>·</span>
          <NumCell value={c} />
          <span>=</span>
          <SlotCell
            revealed={isDetRevealed}
            value={det}
            tone={det === 0 ? 'rose' : 'emerald'}
          />
        </div>
        {det === 0 && isDetRevealed && (
          <p className="text-[11px] text-rose-300">
            det(B) = 0 → B is singular, this basis is not valid.
          </p>
        )}
      </div>

      {/* Adjugate */}
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
        <p className="text-[11px] font-semibold text-foreground">
          Step 2: adjugate — swap diagonal, negate off-diagonal
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground">B =</span>
          <MatrixBox rows={B} />
          <span className="text-muted-foreground text-xl">→</span>
          <span className="text-[11px] text-muted-foreground">adj(B) =</span>
          <MatrixBoxSlots
            rows={adj}
            isRevealed={isAdjRevealed}
            tone="orange"
          />
        </div>
      </div>

      {/* B⁻¹ */}
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
        <p className="text-[11px] font-semibold text-foreground">
          Step 3: divide each adj entry by det(B) → B⁻¹
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            (1 / {isDetRevealed ? fmt(det) : '?'}) ·
          </span>
          <MatrixBoxSlots rows={adj} isRevealed={isAdjRevealed} tone="orange" />
          <span className="text-muted-foreground text-xl">=</span>
          <span className="text-[11px] text-muted-foreground">B⁻¹ =</span>
          <MatrixBoxSlots
            rows={Binv}
            isRevealed={isBinvRevealed}
            colLabels={basisLabels}
            tone="primary"
          />
        </div>
      </div>

      {[0, 1].every(r => [0, 1].every(c => isBinvRevealed(r, c))) && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2 text-[11px] text-emerald-100 leading-relaxed animate-fill-pop">
          You&apos;ve built <span className="font-mono font-bold">B⁻¹</span>. This is
          the object the four sensitivity formulas use. Next step: apply them.
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function MatrixBox({ rows, colLabels }: { rows: number[][]; colLabels?: string[] }) {
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
                <div className="w-10 h-8 flex items-center justify-center rounded border-2 bg-muted/40 border-border/70 text-foreground/90 font-bold text-xs tabular-nums">
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

function MatrixBoxSlots({
  rows, isRevealed, colLabels, tone,
}: {
  rows: number[][];
  isRevealed: (r: number, c: number) => boolean;
  colLabels?: string[];
  tone: 'orange' | 'primary';
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

function NumCell({ value }: { value: number }) {
  return (
    <span className="px-2 py-0.5 rounded bg-muted/40 border border-border tabular-nums font-bold">
      {fmt(value)}
    </span>
  );
}

function SlotCell({
  revealed, value, tone,
}: {
  revealed: boolean;
  value: number;
  tone: 'orange' | 'primary' | 'emerald' | 'rose';
}) {
  if (!revealed) {
    return (
      <div className="w-10 h-8 flex items-center justify-center rounded border-2 border-dashed border-border/60 bg-muted/20 text-muted-foreground/50 text-sm font-mono">
        ?
      </div>
    );
  }
  const cls =
    tone === 'orange' ? 'bg-orange-500/15 border-orange-400/70 text-orange-100' :
    tone === 'primary' ? 'bg-primary/15 border-primary/60 text-primary' :
    tone === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200' :
    'bg-rose-500/15 border-rose-500/50 text-rose-200';
  return (
    <div className={`w-10 h-8 flex items-center justify-center rounded border-2 font-bold text-xs tabular-nums animate-fly-in-from-left ${cls}`}>
      {fmt(value)}
    </div>
  );
}
