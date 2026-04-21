/**
 * ShadowPricesLens — §8.3.3.1, presented as a clean table with
 * business-language interpretation per constraint.
 *
 * Shadow price = change in z* per unit added to the RHS of this constraint,
 *              = (C_B · B⁻¹)[i]
 *              = 0 if the constraint is non-binding (has slack).
 */

import { useEffect, useState } from 'react';
import { LPProblem, SolverResponse } from '../../../types';
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
               : '/api';

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
  rhs_ranges: RhsRange[];
  shadow_prices: number[];
}

function fmt(v: number | null | undefined, places = 3): string {
  if (v == null || !isFinite(v)) {
    if (v === Infinity) return '+∞';
    if (v === -Infinity) return '−∞';
    return '—';
  }
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(places).replace(/\.?0+$/, '');
}

interface Props {
  problem: LPProblem | null;
  response: SolverResponse | null;
  isLoading: boolean;
  method: 'simplex' | 'big-m' | 'two-phase';
}

export default function ShadowPricesLens({ problem, response, isLoading, method }: Props) {
  const [summary, setSummary] = useState<SensitivitySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!problem || !response || response.status !== 'optimal') {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
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
        if (!cancelled) setSummary(data.result as SensitivitySummary);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [problem, response, method]);

  if (isLoading || loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />Computing shadow prices…
      </p>
    );
  }
  if (response?.status !== 'optimal') {
    return (
      <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Shadow prices require an optimal solution.</span>
      </div>
    );
  }
  if (err) {
    return (
      <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{err}
      </div>
    );
  }
  if (!summary) return <p className="text-sm text-muted-foreground italic">No data.</p>;

  return (
    <div className="space-y-4">

      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
        <p className="text-foreground font-semibold mb-1">Shadow price (§8.3.3.1)</p>
        <p>
          How much does z* change if we add 1 unit to a constraint's right-hand side?
          Computed as <code className="font-mono text-foreground">y = C_B · B⁻¹</code>.
          Non-binding constraints have shadow price 0 — adding resources is wasted.
        </p>
      </div>

      <div className="space-y-2">
        {summary.rhs_ranges.map(rr => (
          <ShadowRow key={rr.constraint_index} rr={rr} sense={summary.sense} />
        ))}
      </div>

      <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs text-accent leading-relaxed">
        <strong>Valid range:</strong> Each shadow price is valid only while the RHS stays
        within its allowable range (shown above). Outside that range, the basis changes and
        the shadow price may be different.
      </div>
    </div>
  );
}

function ShadowRow({ rr, sense }: { rr: RhsRange; sense: 'max' | 'min' }) {
  const sp = rr.shadow_price;
  const nonbinding = Math.abs(sp) < 1e-9;

  let icon: React.ReactNode;
  let color: string;
  let verdict: string;

  if (nonbinding) {
    icon = <Minus className="w-4 h-4" />;
    color = 'text-muted-foreground bg-muted/40 border-border';
    verdict = 'Non-binding (slack). Adding resources does not change z*.';
  } else if (sense === 'max') {
    if (sp > 0) {
      icon = <TrendingUp className="w-4 h-4" />;
      color = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40';
      verdict = `Binding. Each extra unit of b adds ${fmt(sp, 3)} to z*.`;
    } else {
      icon = <TrendingDown className="w-4 h-4" />;
      color = 'text-destructive bg-destructive/10 border-destructive/40';
      verdict = `Binding. Each extra unit of b reduces z* by ${fmt(-sp, 3)}.`;
    }
  } else {
    // MIN
    if (sp < 0) {
      icon = <TrendingDown className="w-4 h-4" />;
      color = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40';
      verdict = `Binding. Each extra unit of b reduces z* by ${fmt(-sp, 3)} (good for MIN).`;
    } else {
      icon = <TrendingUp className="w-4 h-4" />;
      color = 'text-destructive bg-destructive/10 border-destructive/40';
      verdict = `Binding. Each extra unit of b adds ${fmt(sp, 3)} to z* (bad for MIN).`;
    }
  }

  return (
    <div className={`border rounded-lg p-3 ${color}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-sm text-foreground">
              Constraint {rr.constraint_index}
            </span>
            <span className="font-mono text-lg font-bold">
              y_{rr.constraint_index} = {fmt(sp, 3)}
            </span>
          </div>
          <p className="text-xs mt-1">{verdict}</p>
          <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">
            Current RHS = {fmt(rr.current_rhs)}; valid for b ∈ [{fmt(rr.value_min)}, {fmt(rr.value_max)}]
          </div>
        </div>
      </div>
    </div>
  );
}
