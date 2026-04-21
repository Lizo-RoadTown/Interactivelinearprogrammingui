/**
 * SensitivityLens — slider-first Chapter 8 explorer.
 *
 * The pedagogy: let the student DRAG values and SEE the consequences, not
 * answer quiz questions about them. Three sections:
 *
 *   1. OF coefficient sliders — one per decision variable. Drag within the
 *      colored band and the current basis stays optimal. Live z* recompute.
 *   2. RHS sliders — one per constraint. Colored band = feasibility-preserving
 *      range. Shadow price visible for each. Live z* recompute.
 *   3. Actions (§8.3.5 / §8.3.6) — buttons to add activity / add constraint.
 *      These open small forms since they're not slider-shaped.
 *
 * All live updates use the closed-form sensitivity formulas from the summary
 * (B⁻¹, shadow prices, C_B, xB). No backend calls per drag — the range of
 * validity comes pre-computed from /api/sensitivity {op: 'summary'}.
 */

import { useEffect, useMemo, useState } from 'react';
import { LPProblem, SolverResponse } from '../../../types';
import { Loader2, AlertCircle, Sliders, TrendingUp, Info } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
               : '/api';

// ── Types mirroring backend summary ──────────────────────────────────────────

interface CoefficientRange {
  variable: string;
  current_value: number;
  is_basic: boolean;
  delta_min: number | null;
  delta_max: number | null;
  value_min: number | null;
  value_max: number | null;
}

interface RhsRange {
  constraint_index: number;
  current_rhs: number;
  delta_min: number | null;
  delta_max: number | null;
  value_min: number | null;
  value_max: number | null;
  shadow_price: number;
}

interface SensitivitySummary {
  sense: 'max' | 'min';
  basis_vars: string[];
  nonbasic_vars: string[];
  decision_vars: string[];
  B_inv: number[][];
  xB: number[];
  z_star: number;
  shadow_prices: number[];
  coefficient_ranges: CoefficientRange[];
  rhs_ranges: RhsRange[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, places = 3): string {
  if (v == null) return '—';
  if (!isFinite(v)) return v > 0 ? '+∞' : '−∞';
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(places).replace(/\.?0+$/, '');
}

/** Apply ALL current slider deltas and report the new z* (basis preserved). */
function computeLiveZStar(
  summary: SensitivitySummary,
  coeffDeltas: Record<string, number>,
  rhsDeltas: Record<number, number>,
): number {
  // z_new = z_star + Σ_i (Δ c_i_basic · xB_i_of_that_basic)
  //                + Σ_j shadow_price_j · Δb_j
  let z = summary.z_star;

  // OF coefficient delta for basic variables → shifts z by delta × its value
  for (const cr of summary.coefficient_ranges) {
    if (!cr.is_basic) continue; // nonbasic coefficient change doesn't affect z (value is 0)
    const d = coeffDeltas[cr.variable] ?? 0;
    const basisIdx = summary.basis_vars.indexOf(cr.variable);
    if (basisIdx >= 0) {
      z += d * summary.xB[basisIdx];
    }
  }

  // RHS delta → shifts z by delta × shadow price
  for (const rr of summary.rhs_ranges) {
    const d = rhsDeltas[rr.constraint_index] ?? 0;
    z += d * rr.shadow_price;
  }

  return z;
}

/** Which §8.3 subsection is being explored, given the current delta set? */
function classifyOperation(
  coeffDeltas: Record<string, number>,
  rhsDeltas: Record<number, number>,
  summary: SensitivitySummary,
): { section: string; label: string } | null {
  const activeCoeffs = Object.entries(coeffDeltas).filter(([, v]) => Math.abs(v) > 1e-9);
  const activeRhs = Object.entries(rhsDeltas).filter(([, v]) => Math.abs(v) > 1e-9);

  if (activeCoeffs.length === 0 && activeRhs.length === 0) return null;

  if (activeRhs.length > 0 && activeCoeffs.length === 0) {
    return { section: '§8.3.3', label: 'Changing a constraint RHS' };
  }

  if (activeCoeffs.length === 1 && activeRhs.length === 0) {
    const [varName] = activeCoeffs[0];
    const cr = summary.coefficient_ranges.find(r => r.variable === varName);
    if (cr?.is_basic) return { section: '§8.3.1', label: 'Changing the OF coefficient of a basic variable' };
    return { section: '§8.3.2', label: 'Changing the OF coefficient of a nonbasic variable' };
  }

  return { section: 'Multiple', label: 'Multiple simultaneous changes' };
}

/** Is any slider's current delta outside the allowable basis-preserving range? */
function anyOutOfRange(
  summary: SensitivitySummary,
  coeffDeltas: Record<string, number>,
  rhsDeltas: Record<number, number>,
): string | null {
  for (const cr of summary.coefficient_ranges) {
    const d = coeffDeltas[cr.variable] ?? 0;
    if (cr.delta_min != null && d < cr.delta_min - 1e-9) return `${cr.variable}'s coefficient is below the allowable range`;
    if (cr.delta_max != null && d > cr.delta_max + 1e-9) return `${cr.variable}'s coefficient is above the allowable range`;
  }
  for (const rr of summary.rhs_ranges) {
    const d = rhsDeltas[rr.constraint_index] ?? 0;
    if (rr.delta_min != null && d < rr.delta_min - 1e-9) return `constraint ${rr.constraint_index} RHS is below the allowable range`;
    if (rr.delta_max != null && d > rr.delta_max + 1e-9) return `constraint ${rr.constraint_index} RHS is above the allowable range`;
  }
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  problem: LPProblem | null;
  response: SolverResponse | null;
  isLoading: boolean;
  method: 'simplex' | 'big-m' | 'two-phase';
}

export default function SensitivityLens({ problem, response, isLoading, method }: Props) {
  const [summary, setSummary] = useState<SensitivitySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Per-slider deltas (student-controlled values relative to current)
  const [coeffDeltas, setCoeffDeltas] = useState<Record<string, number>>({});
  const [rhsDeltas, setRhsDeltas] = useState<Record<number, number>>({});

  // Fetch summary whenever the LP changes and is optimal
  useEffect(() => {
    if (!problem || !response || response.status !== 'optimal') {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setLoadingSummary(true);
    setSummaryError(null);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/sensitivity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem: {
              objectiveType: problem.objectiveType,
              objectiveCoefficients: problem.objectiveCoefficients,
              variables: problem.variables,
              variableSigns: problem.variableSigns,
              constraints: problem.constraints,
              method,
            },
            operation: 'summary',
            params: {},
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(body.detail ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setSummary(data.result as SensitivitySummary);
          setCoeffDeltas({});
          setRhsDeltas({});
        }
      } catch (e) {
        if (!cancelled) setSummaryError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();
    return () => { cancelled = true; };
  }, [problem, response, method]);

  const liveZ = useMemo(() => {
    if (!summary) return null;
    return computeLiveZStar(summary, coeffDeltas, rhsDeltas);
  }, [summary, coeffDeltas, rhsDeltas]);

  const outOfRange = useMemo(() => {
    if (!summary) return null;
    return anyOutOfRange(summary, coeffDeltas, rhsDeltas);
  }, [summary, coeffDeltas, rhsDeltas]);

  const classification = useMemo(() => {
    if (!summary) return null;
    return classifyOperation(coeffDeltas, rhsDeltas, summary);
  }, [summary, coeffDeltas, rhsDeltas]);

  const resetAll = () => {
    setCoeffDeltas({});
    setRhsDeltas({});
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Solving LP…</p>;
  }
  if (!problem) {
    return <p className="text-sm text-muted-foreground italic">Load an LP to explore sensitivity.</p>;
  }
  if (response?.status !== 'optimal') {
    return (
      <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Sensitivity requires an optimal solution. Current status: {response?.status ?? 'not solved'}.</span>
      </div>
    );
  }
  if (loadingSummary) {
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Computing sensitivity summary…</p>;
  }
  if (summaryError) {
    return (
      <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{summaryError}</span>
      </div>
    );
  }
  if (!summary) {
    return <p className="text-sm text-muted-foreground italic">No sensitivity data.</p>;
  }

  return (
    <div className="space-y-5 text-sm">

      {/* Live readout */}
      <div className={`rounded-lg p-4 border ${outOfRange
        ? 'bg-amber-500/10 border-amber-500/40'
        : 'bg-emerald-500/10 border-emerald-500/40'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Live z*</p>
            <p className={`text-3xl font-bold font-mono ${outOfRange ? 'text-amber-200' : 'text-emerald-300'}`}>
              {liveZ != null ? fmt(liveZ, 4) : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Original: {fmt(summary.z_star, 4)} · Δz = {liveZ != null ? fmt(liveZ - summary.z_star, 3) : '—'}
            </p>
          </div>
          {(Object.keys(coeffDeltas).length > 0 || Object.keys(rhsDeltas).length > 0) && (
            <button
              onClick={resetAll}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
            >
              reset all
            </button>
          )}
        </div>
        {classification && (
          <div className="mt-3 text-[11px] text-foreground bg-card border border-border rounded px-2 py-1 inline-block">
            <span className="font-mono text-accent mr-2">{classification.section}</span>
            {classification.label}
          </div>
        )}
        {outOfRange && (
          <div className="mt-3 text-xs text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>Out of allowable range:</strong> {outOfRange}. The basis would change —
              the live z* shown stops being valid at the band edges.
            </span>
          </div>
        )}
      </div>

      {/* Objective coefficient sliders */}
      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sliders className="w-3 h-3" />
          Objective coefficients
        </h3>
        <div className="space-y-3">
          {summary.coefficient_ranges.map(cr => (
            <CoefficientSlider
              key={cr.variable}
              range={cr}
              delta={coeffDeltas[cr.variable] ?? 0}
              onChange={d => setCoeffDeltas(prev => ({ ...prev, [cr.variable]: d }))}
              sense={summary.sense}
            />
          ))}
        </div>
      </section>

      {/* RHS sliders */}
      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" />
          Constraint RHS (+ shadow prices)
        </h3>
        <div className="space-y-3">
          {summary.rhs_ranges.map(rr => (
            <RhsSlider
              key={rr.constraint_index}
              range={rr}
              delta={rhsDeltas[rr.constraint_index] ?? 0}
              onChange={d => setRhsDeltas(prev => ({ ...prev, [rr.constraint_index]: d }))}
            />
          ))}
        </div>
      </section>

      {/* Help */}
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs text-accent leading-relaxed flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div>
          <strong>How to use:</strong> Drag any slider within the colored band — the current
          optimal basis stays valid there, so z* updates instantly using the formula{' '}
          <code className="font-mono text-foreground">Δz = Σ Δb · shadow_price + Σ Δc · xB</code>.
          Outside the band, the basis would change and the LP needs to be re-solved.
        </div>
      </div>
    </div>
  );
}

// ── Sub-components: sliders ──────────────────────────────────────────────────

function CoefficientSlider({
  range, delta, onChange, sense,
}: {
  range: CoefficientRange;
  delta: number;
  onChange: (d: number) => void;
  sense: 'max' | 'min';
}) {
  // Practical slider extent — go a bit beyond the allowable range so the
  // student can SEE the cliff, but not infinite.
  const PAD_FACTOR = 0.5;
  const [minDelta, maxDelta] = practicalSliderExtent(range.delta_min, range.delta_max);
  const span = Math.max(1, maxDelta - minDelta);
  const pad = span * PAD_FACTOR;
  const sliderMin = minDelta - pad;
  const sliderMax = maxDelta + pad;
  const step = niceStep(sliderMax - sliderMin);

  const newValue = range.current_value + delta;
  const bandLeftPct = ((Math.max(minDelta, sliderMin) - sliderMin) / (sliderMax - sliderMin)) * 100;
  const bandRightPct = ((sliderMax - Math.min(maxDelta, sliderMax)) / (sliderMax - sliderMin)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs">
          <span className="font-mono text-primary">{range.variable}</span>
          {range.is_basic
            ? <span className="text-[9px] text-emerald-400 ml-1.5">basic</span>
            : <span className="text-[9px] text-muted-foreground ml-1.5">nonbasic</span>}
          <span className="text-muted-foreground ml-2">coefficient:</span>
          <span className="font-mono text-foreground ml-1.5">{fmt(newValue, 3)}</span>
          {Math.abs(delta) > 1e-9 && (
            <span className="text-[10px] text-amber-400 ml-2">
              Δ = {delta > 0 ? '+' : ''}{fmt(delta, 3)}
            </span>
          )}
        </div>
      </div>
      <div className="relative">
        {/* Allowed band */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-primary/30 rounded-full pointer-events-none"
          style={{ left: `${bandLeftPct}%`, right: `${bandRightPct}%` }}
        />
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={step}
          value={delta}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-5 bg-transparent appearance-none cursor-pointer
                     [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted
                     [&::-webkit-slider-runnable-track]:h-1
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                     [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-card
                     [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:-mt-1.5
                     [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-moz-range-track]:h-1
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-card"
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>allowable: {fmt(range.value_min ?? -Infinity)} ≤ c ≤ {fmt(range.value_max ?? Infinity)}</span>
        <button
          onClick={() => onChange(0)}
          className="hover:text-foreground underline underline-offset-2"
        >
          reset
        </button>
      </div>
    </div>
  );
}

function RhsSlider({
  range, delta, onChange,
}: {
  range: RhsRange;
  delta: number;
  onChange: (d: number) => void;
}) {
  const [minDelta, maxDelta] = practicalSliderExtent(range.delta_min, range.delta_max);
  const span = Math.max(1, maxDelta - minDelta);
  const pad = span * 0.5;
  const sliderMin = minDelta - pad;
  const sliderMax = maxDelta + pad;
  const step = niceStep(sliderMax - sliderMin);

  const newValue = range.current_rhs + delta;
  const bandLeftPct = ((Math.max(minDelta, sliderMin) - sliderMin) / (sliderMax - sliderMin)) * 100;
  const bandRightPct = ((sliderMax - Math.min(maxDelta, sliderMax)) / (sliderMax - sliderMin)) * 100;

  const isBinding = Math.abs(range.shadow_price) > 1e-9;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs">
          <span className="font-mono text-primary">C{range.constraint_index}</span>
          <span className="text-muted-foreground ml-2">RHS:</span>
          <span className="font-mono text-foreground ml-1.5">{fmt(newValue, 3)}</span>
          {Math.abs(delta) > 1e-9 && (
            <span className="text-[10px] text-amber-400 ml-2">
              Δ = {delta > 0 ? '+' : ''}{fmt(delta, 3)}
            </span>
          )}
        </div>
        <div className="text-[10px] text-right">
          <div className={isBinding ? 'text-emerald-400' : 'text-muted-foreground'}>
            shadow = {fmt(range.shadow_price, 3)}
          </div>
          <div className="text-muted-foreground">
            {isBinding ? 'binding' : 'non-binding (slack)'}
          </div>
        </div>
      </div>
      <div className="relative">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-accent/30 rounded-full pointer-events-none"
          style={{ left: `${bandLeftPct}%`, right: `${bandRightPct}%` }}
        />
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={step}
          value={delta}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-5 bg-transparent appearance-none cursor-pointer
                     [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted
                     [&::-webkit-slider-runnable-track]:h-1
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent
                     [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-card
                     [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:-mt-1.5
                     [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-moz-range-track]:h-1
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-card"
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>allowable: {fmt(range.value_min ?? -Infinity)} ≤ b ≤ {fmt(range.value_max ?? Infinity)}</span>
        <button
          onClick={() => onChange(0)}
          className="hover:text-foreground underline underline-offset-2"
        >
          reset
        </button>
      </div>
    </div>
  );
}

// ── Slider math helpers ──────────────────────────────────────────────────────

function practicalSliderExtent(min: number | null, max: number | null): [number, number] {
  const DEFAULT_EXTENT = 10;
  let a = min ?? -DEFAULT_EXTENT;
  let b = max ??  DEFAULT_EXTENT;
  if (!isFinite(a)) a = b - DEFAULT_EXTENT;
  if (!isFinite(b)) b = a + DEFAULT_EXTENT;
  if (a === b) { a -= DEFAULT_EXTENT / 2; b += DEFAULT_EXTENT / 2; }
  return [a, b];
}

function niceStep(span: number): number {
  if (span <= 5)   return 0.1;
  if (span <= 20)  return 0.5;
  if (span <= 200) return 1;
  return 5;
}
