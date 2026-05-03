/**
 * AirlineModel.tsx — one-off page for the team's final-presentation LP.
 *
 *   Max  z = 300 x1 + 1980 x2 + 0.335 x3
 *   s.t. 3.8 x1 + 11.1 x2          ≤ 2,688      (cabin space)
 *        240 x1 + 340 x2 + x3      ≤ 120,000    (weight)
 *                          x3      ≤ 126,000    (cargo capacity)
 *        x1 + x2                   ≤ 420        (passenger limit)
 *               x2                 ≤ 22         (business demand)
 *        x1, x2, x3 ≥ 0
 *
 * 3-variable LP, so we can't draw a 2D feasible region. Instead the page
 * shows a constraint-utilization chart: one horizontal bar per constraint,
 * filled to (LHS / RHS) with a "BINDING" badge when LHS == RHS. Sliders
 * for objective coefficients and RHS values trigger a debounced re-solve
 * via /api/solve, and the chart + optimum readout update live.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { ArrowLeft, RotateCcw, Loader2 } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
                                     : '/api';

// ── The LP, as code ─────────────────────────────────────────────────────────

interface ConstraintDef {
  label: string;
  coefficients: [number, number, number]; // x1, x2, x3
  baseRhs: number;
}

const VAR_NAMES = ['x1', 'x2', 'x3'] as const;
const VAR_LABELS = ['Coach passengers', 'Business passengers', 'Cargo (lb)'] as const;

const BASE_OBJECTIVE: [number, number, number] = [300, 1980, 0.335];

const CONSTRAINTS: ConstraintDef[] = [
  { label: 'Cabin space',     coefficients: [3.8, 11.1, 0], baseRhs: 2688 },
  { label: 'Weight',          coefficients: [240, 340, 1],  baseRhs: 120000 },
  { label: 'Cargo capacity',  coefficients: [0, 0, 1],      baseRhs: 126000 },
  { label: 'Passenger limit', coefficients: [1, 1, 0],      baseRhs: 420 },
  { label: 'Business demand', coefficients: [0, 1, 0],      baseRhs: 22 },
];

// Slider ranges: ±50% around baseline (rounded so the number on the
// slider doesn't look noisy). RHS sliders skip "Cargo capacity" because
// it's already huge and the optimum is bounded elsewhere.
function sliderRange(value: number): { min: number; max: number; step: number } {
  const span = Math.max(Math.abs(value) * 0.5, 1);
  const step = span > 100 ? 1 : span > 10 ? 0.1 : 0.01;
  const niceStep = step >= 1 ? Math.max(1, Math.round(span / 100)) : step;
  return {
    min: Math.max(0, +(value - span).toFixed(2)),
    max: +(value + span).toFixed(2),
    step: niceStep,
  };
}

// ── Page ────────────────────────────────────────────────────────────────────

interface SolveResult {
  status: 'optimal' | 'infeasible' | 'unbounded';
  z: number | null;
  x: number[];           // length 3
  bindingConstraints: boolean[]; // length CONSTRAINTS.length
}

export default function AirlineModel() {
  const [obj, setObj] = useState<[number, number, number]>([...BASE_OBJECTIVE]);
  const [rhs, setRhs] = useState<number[]>(CONSTRAINTS.map(c => c.baseRhs));
  const [result, setResult] = useState<SolveResult | null>(null);
  const [solving, setSolving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Debounced solve. Each slider drag fires many setObj/setRhs in quick
  // succession; we wait 250ms after the last change before hitting the
  // backend, so we don't blast the solver on every tick.
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void solve(); }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj, rhs]);

  const solve = async () => {
    setSolving(true);
    setErrMsg(null);
    try {
      const body = {
        objectiveType: 'max',
        objectiveCoefficients: obj,
        variables: [...VAR_NAMES],
        variableSigns: VAR_NAMES.map(() => 'nonneg'),
        constraints: CONSTRAINTS.map((c, i) => ({
          id: `c${i + 1}`,
          coefficients: [...c.coefficients],
          operator: '<=',
          rhs: rhs[i],
        })),
      };
      const res = await fetch(`${API_BASE}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Solver returned ${res.status}`);
      const data = await res.json();
      const x: number[] = VAR_NAMES.map(name => data.optimalSolution?.[name] ?? 0);
      const binding = CONSTRAINTS.map((c, i) => {
        const lhs = c.coefficients.reduce((s, a, k) => s + a * x[k], 0);
        return Math.abs(lhs - rhs[i]) < 1e-4 * Math.max(1, rhs[i]);
      });
      setResult({
        status: data.status,
        z: data.optimalValue ?? null,
        x,
        bindingConstraints: binding,
      });
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setSolving(false);
    }
  };

  const reset = () => {
    setObj([...BASE_OBJECTIVE]);
    setRhs(CONSTRAINTS.map(c => c.baseRhs));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-6 sm:p-8 space-y-6">

        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <Button onClick={reset} variant="outline" size="sm" className="text-slate-300">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to baseline
          </Button>
        </div>

        <header>
          <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">Final presentation — airline model</p>
          <h1 className="text-2xl font-bold mt-1">The Model</h1>
          <pre className="mt-3 text-sm font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
{`Max z = ${fmt(obj[0])} x1 + ${fmt(obj[1])} x2 + ${fmt(obj[2])} x3

  3.8 x1 + 11.1 x2            ≤ ${fmt(rhs[0])}        (cabin space)
  240 x1 + 340 x2 +    x3     ≤ ${fmt(rhs[1])}    (weight)
                       x3     ≤ ${fmt(rhs[2])}    (cargo capacity)
  x1 + x2                     ≤ ${fmt(rhs[3])}         (passenger limit)
        x2                    ≤ ${fmt(rhs[4])}          (business demand)
  x1, x2, x3 ≥ 0`}
          </pre>
        </header>

        {/* ── Optimum readout ─────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-cyan-300 font-bold">Current optimum</p>
            {solving && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
          </div>
          {errMsg ? (
            <p className="text-rose-300 text-sm">Couldn&apos;t solve: {errMsg}</p>
          ) : result == null ? (
            <p className="text-slate-400 text-sm">Solving…</p>
          ) : result.status !== 'optimal' ? (
            <p className="text-amber-300 text-sm">Status: <strong>{result.status}</strong></p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {VAR_NAMES.map((n, i) => (
                <div key={n} className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{VAR_LABELS[i]}</p>
                  <p className="text-xl font-bold text-slate-100 tabular-nums">{n}* = {fmtRound(result.x[i])}</p>
                </div>
              ))}
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3 font-mono">
                <p className="text-[10px] text-emerald-300 uppercase tracking-wider">Profit</p>
                <p className="text-xl font-bold text-emerald-200 tabular-nums">z* = {fmtRound(result.z ?? 0)}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Constraint utilization chart ─────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">
            Constraint utilization (LHS ÷ RHS)
          </p>
          <div className="space-y-3">
            {CONSTRAINTS.map((c, i) => {
              const lhs = result
                ? c.coefficients.reduce((s, a, k) => s + a * (result.x[k] ?? 0), 0)
                : 0;
              const limit = rhs[i];
              const pct = limit > 0 ? Math.min(100, (lhs / limit) * 100) : 0;
              const binding = result?.bindingConstraints[i] ?? false;
              return (
                <div key={c.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-semibold">{c.label}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {fmtRound(lhs)} / {fmtRound(limit)}
                      {binding && <span className="ml-2 text-amber-300 font-semibold">BINDING</span>}
                    </span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${binding ? 'bg-amber-500' : 'bg-cyan-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sliders — Objective coefficients ─────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Objective coefficients — what each variable contributes to profit
          </p>
          {VAR_NAMES.map((n, i) => {
            const r = sliderRange(BASE_OBJECTIVE[i]);
            return (
              <SliderRow
                key={n}
                label={`${n} — ${VAR_LABELS[i]}`}
                baseValue={BASE_OBJECTIVE[i]}
                value={obj[i]}
                min={r.min}
                max={r.max}
                step={r.step}
                onChange={v => setObj(prev => {
                  const next: [number, number, number] = [...prev];
                  next[i] = v;
                  return next;
                })}
              />
            );
          })}
        </div>

        {/* ── Sliders — Constraint RHS ────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Constraint right-hand sides — resource availability
          </p>
          {CONSTRAINTS.map((c, i) => {
            const r = sliderRange(c.baseRhs);
            return (
              <SliderRow
                key={c.label}
                label={c.label}
                baseValue={c.baseRhs}
                value={rhs[i]}
                min={r.min}
                max={r.max}
                step={r.step}
                onChange={v => setRhs(prev => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                })}
              />
            );
          })}
        </div>

        <p className="text-xs text-slate-500 italic leading-relaxed">
          Drag a single slider in a small range and watch z* change at a constant rate — that rate
          is the shadow price (RHS sliders) or the reduced-cost margin (objective sliders). When the
          rate visibly changes, you&apos;ve crossed the allowable range and the optimal basis has
          flipped.
        </p>
      </div>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function SliderRow({
  label, baseValue, value, min, max, step, onChange,
}: {
  label: string;
  baseValue: number;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const changed = Math.abs(value - baseValue) > 1e-9;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-slate-300 font-semibold">{label}</span>
        <span className="font-mono tabular-nums text-slate-200">
          <span className="text-base font-bold">{fmt(value)}</span>
          {changed && (
            <span className="text-slate-500 ml-2 text-[10px]">
              (baseline {fmt(baseValue)}, {value > baseValue ? '+' : ''}{fmt(value - baseValue)})
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 tabular-nums w-14 text-right">{fmt(min)}</span>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-5 accent-cyan-500 cursor-pointer"
        />
        <span className="text-[10px] text-slate-500 tabular-nums w-14">{fmt(max)}</span>
      </div>
    </div>
  );
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return v.toLocaleString('en-US');
  if (Math.abs(v) >= 100) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return v.toFixed(3).replace(/\.?0+$/, '');
}

function fmtRound(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}
