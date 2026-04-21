/**
 * MatrixFormLens — §8.2 "here are the matrices" lens.
 *
 * Shows B, B⁻¹, N, C_B, C_N, b, xB and z* from the optimal basis.
 * Non-interactive: this is the "look at the structure" lens — great
 * for the textbook moment where students realize that the tableau they've
 * been computing is a projection of these matrices.
 */

import { useEffect, useState } from 'react';
import { LPProblem, SolverResponse } from '../../../types';
import { Loader2, AlertCircle } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
               : '/api';

interface SensitivitySummary {
  sense: 'max' | 'min';
  basis_vars: string[];
  nonbasic_vars: string[];
  decision_vars: string[];
  B: number[][];
  B_inv: number[][];
  N: number[][];
  CB: number[];
  CN: number[];
  b: number[];
  xB: number[];
  z_star: number;
}

function fmt(v: number, places = 3): string {
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(places).replace(/\.?0+$/, '');
}

function Matrix({ title, m, colLabels, rowLabels }: {
  title: string;
  m: number[][];
  colLabels?: string[];
  rowLabels?: string[];
}) {
  if (!m || m.length === 0 || m[0].length === 0) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1 font-mono">{title}</h4>
        <div className="text-xs text-muted-foreground italic">(empty)</div>
      </div>
    );
  }
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-1 font-mono">{title}</h4>
      <table className="text-xs font-mono border-collapse">
        <thead>
          {colLabels && (
            <tr>
              <td />
              {colLabels.map((l, i) => (
                <td key={i} className="px-2 py-0.5 text-muted-foreground text-center text-[10px]">{l}</td>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {m.map((row, ri) => (
            <tr key={ri}>
              {rowLabels && (
                <td className="pr-2 text-muted-foreground text-[10px]">{rowLabels[ri] ?? ''}</td>
              )}
              {row.map((v, ci) => (
                <td key={ci} className="px-2 py-0.5 bg-muted/40 border border-border text-foreground text-center">
                  {fmt(v, 3)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vector({ title, v, labels, horizontal = false }: {
  title: string;
  v: number[];
  labels?: string[];
  horizontal?: boolean;
}) {
  if (!v || v.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-1 font-mono">{title}</h4>
      {horizontal ? (
        <table className="text-xs font-mono border-collapse">
          <tbody>
            {labels && (
              <tr>
                {labels.map((l, i) => (
                  <td key={i} className="px-2 py-0.5 text-muted-foreground text-center text-[10px]">{l}</td>
                ))}
              </tr>
            )}
            <tr>
              {v.map((val, i) => (
                <td key={i} className="px-2 py-0.5 bg-muted/40 border border-border text-foreground text-center">
                  {fmt(val, 3)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : (
        <table className="text-xs font-mono border-collapse">
          <tbody>
            {v.map((val, i) => (
              <tr key={i}>
                {labels && (
                  <td className="pr-2 text-muted-foreground text-[10px]">{labels[i] ?? ''}</td>
                )}
                <td className="px-2 py-0.5 bg-muted/40 border border-border text-foreground text-center">
                  {fmt(val, 3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface Props {
  problem: LPProblem | null;
  response: SolverResponse | null;
  isLoading: boolean;
  method: 'simplex' | 'big-m' | 'two-phase';
}

export default function MatrixFormLens({ problem, response, isLoading, method }: Props) {
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
        <Loader2 className="w-4 h-4 animate-spin" />Loading matrix form…
      </p>
    );
  }
  if (response?.status !== 'optimal') {
    return (
      <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Matrix form requires an optimal solution.</span>
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

  // Nonbasic rows of N: these columns come from the original constraints.
  // Row labels are the constraint labels (C1, C2, ...)
  const m = summary.b.length;
  const constraintLabels = Array.from({ length: m }, (_, i) => `C${i + 1}`);

  return (
    <div className="space-y-5">

      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
        <p className="text-foreground font-semibold mb-1">§8.2 — Simplex matrix form</p>
        <p>
          From the optimal basis alone, you can reconstruct the entire optimal tableau. Every
          value you've been computing is a projection of the matrices below.
        </p>
      </div>

      <Vector
        title="x_B (basic variables, in basis order)"
        v={summary.xB}
        labels={summary.basis_vars}
      />

      <Matrix
        title="B (columns of basic variables from the original A matrix)"
        m={summary.B}
        colLabels={summary.basis_vars}
        rowLabels={constraintLabels}
      />

      <Matrix
        title="B⁻¹ (the key to every sensitivity formula)"
        m={summary.B_inv}
        colLabels={constraintLabels}
        rowLabels={summary.basis_vars}
      />

      <Matrix
        title="N (columns of nonbasic variables from A)"
        m={summary.N}
        colLabels={summary.nonbasic_vars}
        rowLabels={constraintLabels}
      />

      <Vector
        title="C_B (OF coefficients of basic variables)"
        v={summary.CB}
        labels={summary.basis_vars}
        horizontal
      />

      <Vector
        title="C_N (OF coefficients of nonbasic variables)"
        v={summary.CN}
        labels={summary.nonbasic_vars}
        horizontal
      />

      <Vector
        title="b (original right-hand side)"
        v={summary.b}
        labels={constraintLabels}
      />

      <div className="bg-muted/40 border border-border rounded-lg px-3 py-2 font-mono text-sm">
        <span className="text-muted-foreground">z*</span> = C_B · B⁻¹ · b ={' '}
        <span className="text-accent font-semibold">{fmt(summary.z_star, 4)}</span>
      </div>

      <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs text-accent leading-relaxed">
        <strong>What to do with these:</strong> Open the Sensitivity lens — every slider there
        uses B⁻¹ and the shadow prices (y = C_B · B⁻¹) to compute live results.
      </div>
    </div>
  );
}
