/**
 * SensitivityControls — the interactive perturbation panel for Phase 6.
 *
 * For each constraint, a slider lets the student drag its RHS around a
 * range centered on the original value. For each decision variable, a
 * slider lets them drag that variable's objective coefficient. As the
 * sliders move, the graph above recomputes the feasible region and the
 * optimum marker live; underneath the sliders a readout reports the
 * current optimal (x₁*, x₂*) and z*, and the delta from the baseline
 * optimum.
 *
 * The constant slopes the student sees while dragging within a small
 * range IS the shadow price (for RHS) or reduced-cost margin (for the
 * objective). When the slope visibly changes at some value, that's the
 * edge of the allowable range — the current basis has lost its
 * optimality.
 */

import { useMemo } from 'react';
import { LPDraft } from './guidedTypes';
import { colorFor, colorForFill } from './constraintColors';
import { solveLP2D, applyPerturbation, LPSolution } from './lpSolve';

interface Props {
  draft: LPDraft;
  rhsDelta: number[];
  objDelta: number[];
  onRhsDelta: (idx: number, delta: number) => void;
  onObjDelta: (idx: number, delta: number) => void;
  onReset: () => void;
  /** The baseline optimum (at rhsDelta=0, objDelta=0). */
  baseline: LPSolution | null;
}

function fmt(v: number, precise = false): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (!precise && Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

function fmtSigned(v: number): string {
  if (Math.abs(v) < 1e-9) return '+0';
  return (v > 0 ? '+' : '') + fmt(v, true);
}

export default function SensitivityControls({
  draft, rhsDelta, objDelta, onRhsDelta, onObjDelta, onReset, baseline,
}: Props) {
  const liveDraft = useMemo(
    () => applyPerturbation(draft, rhsDelta, objDelta),
    [draft, rhsDelta, objDelta],
  );
  const liveOpt = useMemo(() => solveLP2D(liveDraft, 'max'), [liveDraft]);

  const anyPerturbation =
    rhsDelta.some(v => Math.abs(v) > 1e-9) ||
    objDelta.some(v => Math.abs(v) > 1e-9);

  return (
    <div className="bg-card/40 border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Sensitivity playground — perturb the problem live
        </p>
        {anyPerturbation && (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] text-orange-300 hover:text-orange-200 underline decoration-dotted"
          >
            reset to baseline
          </button>
        )}
      </div>

      {/* RHS sliders — one per constraint */}
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground">Drag each resource capacity (RHS):</p>
        {draft.constraints.map((c, idx) => {
          if (c.rhs == null) return null;
          const base = c.rhs;
          const range = Math.max(20, Math.round(base * 0.5));
          const curDelta = rhsDelta[idx] ?? 0;
          const curRhs = base + curDelta;
          const color = colorFor(idx);
          return (
            <div key={`rhs-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span style={{ color }} className="font-semibold">
                  C{idx + 1}{c.label ? ` — ${c.label}` : ''}
                </span>
                <span className="tabular-nums text-foreground/90">
                  RHS = <span className="font-bold">{fmt(curRhs)}</span>
                  {Math.abs(curDelta) > 1e-9 && (
                    <span className="text-muted-foreground ml-2">(baseline {fmt(base)}, {fmtSigned(curDelta)})</span>
                  )}
                </span>
              </div>
              <input
                type="range"
                aria-label={`C${idx + 1} RHS`}
                title={`C${idx + 1} right-hand side`}
                min={base - range}
                max={base + range}
                step={1}
                value={curRhs}
                onChange={(e) => onRhsDelta(idx, Number(e.target.value) - base)}
                className="w-full h-5 cursor-pointer"
                style={{ accentColor: color, backgroundColor: colorForFill(idx, 0.15) }}
              />
            </div>
          );
        })}
      </div>

      {/* Objective coefficient sliders — one per decision variable */}
      <div className="space-y-3 border-t border-border/40 pt-3">
        <p className="text-[10px] text-muted-foreground">Drag each variable&apos;s profit coefficient:</p>
        {draft.variables.map((v, idx) => {
          const base = draft.objectiveCoefficients[idx];
          if (base == null) return null;
          const range = Math.max(10, Math.round(base * 0.8));
          const curDelta = objDelta[idx] ?? 0;
          const curC = base + curDelta;
          return (
            <div key={`obj-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-primary">
                  x{idx + 1} profit{v.description ? ` (per ${v.description.split(' ')[1] ?? 'unit'})` : ''}
                </span>
                <span className="tabular-nums text-foreground/90">
                  c<sub>{idx + 1}</sub> = <span className="font-bold">{fmt(curC)}</span>
                  {Math.abs(curDelta) > 1e-9 && (
                    <span className="text-muted-foreground ml-2">(baseline {fmt(base)}, {fmtSigned(curDelta)})</span>
                  )}
                </span>
              </div>
              <input
                type="range"
                aria-label={`x${idx + 1} profit coefficient`}
                title={`x${idx + 1} objective coefficient`}
                min={Math.max(0, base - range)}
                max={base + range}
                step={1}
                value={curC}
                onChange={(e) => onObjDelta(idx, Number(e.target.value) - base)}
                className="w-full h-5 accent-primary cursor-pointer"
              />
            </div>
          );
        })}
      </div>

      {/* Live readout */}
      <div className="border-t border-border/40 pt-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Current optimum
          </span>
          {baseline && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              baseline z* = <span className="text-foreground font-semibold">{fmt(baseline.z)}</span>
            </span>
          )}
        </div>
        {liveOpt ? (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2 font-mono text-sm text-emerald-100 tabular-nums">
            (x₁*, x₂*) = (<span className="font-bold">{fmt(liveOpt.x1, true)}</span>,{' '}
            <span className="font-bold">{fmt(liveOpt.x2, true)}</span>), z* ={' '}
            <span className="font-bold text-lg">{fmt(liveOpt.z, true)}</span>
            {baseline && anyPerturbation && (
              <span className="ml-3 text-[11px] text-muted-foreground">
                Δz = <span className={liveOpt.z > baseline.z ? 'text-emerald-300' : 'text-rose-300'}>
                  {fmtSigned(liveOpt.z - baseline.z)}
                </span>
              </span>
            )}
          </div>
        ) : (
          <div className="bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2 text-sm text-rose-200">
            Infeasible — your changes pushed the feasible region below 0.
          </div>
        )}
        {anyPerturbation && baseline && liveOpt && (
          <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed pt-1">
            As you drag a single slider in a small range, Δz changes at a <span className="not-italic font-semibold">constant rate</span> —
            that rate is the <span className="not-italic font-semibold">shadow price</span> (for RHS) or the
            <span className="not-italic font-semibold"> reduced-cost margin</span> (for profit). When the rate
            visibly changes, you&apos;ve crossed the allowable range and the optimal basis has flipped to a new vertex.
          </p>
        )}
      </div>
    </div>
  );
}
