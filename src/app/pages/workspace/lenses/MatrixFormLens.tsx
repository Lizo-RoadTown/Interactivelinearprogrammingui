/**
 * MatrixFormLens — §8.2, rebuilt as a construction walkthrough.
 *
 * The student doesn't just see the matrices — they see HOW each is built
 * from the original LP, and for 2-variable problems the lens connects each
 * piece to what's happening on the graph (binding vs non-binding
 * constraints, which slacks are basic, etc).
 *
 * Reading order:
 *   1. Standard form — original LP with slacks/surplus/artificial added
 *   2. Full A matrix — every column visible, basic columns highlighted
 *   3. B = basic columns of A
 *   4. N = nonbasic columns of A
 *   5. B⁻¹ — where it comes from and how to read it
 *   6. Graphical connection (2-var only): binding vs non-binding
 *   7. C_B, C_N, b — origin of each
 *   8. z* = C_B · B⁻¹ · b — identity closes the loop
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
  all_vars: string[];
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

/** Build the full A matrix from the summary: for each variable in all_vars,
 *  pull the column from either B or N. */
function reconstructA(summary: SensitivitySummary): number[][] {
  const m = summary.b.length;
  const nTotal = summary.all_vars.length - 1; // last is 'RHS'
  const A: number[][] = Array.from({ length: m }, () => Array(nTotal).fill(0));
  for (let j = 0; j < nTotal; j++) {
    const v = summary.all_vars[j];
    const basisIdx = summary.basis_vars.findIndex(bv => bv.toLowerCase() === v.toLowerCase());
    const nonbasicIdx = summary.nonbasic_vars.findIndex(nv => nv.toLowerCase() === v.toLowerCase());
    for (let i = 0; i < m; i++) {
      if (basisIdx >= 0) A[i][j] = summary.B[i][basisIdx];
      else if (nonbasicIdx >= 0) A[i][j] = summary.N[i][nonbasicIdx];
    }
  }
  return A;
}

/** Map each ORIGINAL constraint to the slack variable introduced for it
 *  (assumes <=-constraints in order get s1, s2, …). */
function slacksForConstraints(problem: LPProblem, allVars: string[]): (string | null)[] {
  const result: (string | null)[] = [];
  let slackCount = 0;
  for (const c of problem.constraints) {
    if (c.operator === '<=') {
      slackCount++;
      const name = `s${slackCount}`;
      result.push(allVars.find(v => v.toLowerCase() === name) ?? null);
    } else {
      // surplus / artificial — more complex, skip for now
      result.push(null);
    }
  }
  return result;
}

// ── Primitive display components ─────────────────────────────────────────────

function Matrix({
  title, m, colLabels, rowLabels, highlightedCols = new Set(),
  subtle = false,
}: {
  title: string;
  m: number[][];
  colLabels?: string[];
  rowLabels?: string[];
  highlightedCols?: Set<number>;
  subtle?: boolean;
}) {
  if (!m || m.length === 0 || m[0].length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 font-mono">{title}</h4>
      <table className="text-xs font-mono border-collapse">
        <thead>
          {colLabels && (
            <tr>
              {rowLabels && <td />}
              {colLabels.map((l, i) => (
                <td
                  key={i}
                  className={`px-2 py-0.5 text-center text-[10px] ${
                    highlightedCols.has(i) ? 'text-primary font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {l}
                </td>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {m.map((row, ri) => (
            <tr key={ri}>
              {rowLabels && (
                <td className="pr-2 text-muted-foreground text-[10px] text-right">{rowLabels[ri] ?? ''}</td>
              )}
              {row.map((v, ci) => (
                <td
                  key={ci}
                  className={`px-2 py-0.5 border text-center transition-colors ${
                    highlightedCols.has(ci)
                      ? 'bg-primary/15 border-primary/50 text-foreground font-semibold'
                      : (subtle ? 'bg-muted/20 border-border/60 text-muted-foreground' : 'bg-muted/40 border-border text-foreground')
                  }`}
                >
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

function Vector({
  title, v, labels, horizontal = false, highlightAll = false,
}: {
  title: string;
  v: number[];
  labels?: string[];
  horizontal?: boolean;
  highlightAll?: boolean;
}) {
  if (!v || v.length === 0) return null;
  const cellCls = highlightAll
    ? 'bg-accent/20 border border-accent/40 text-foreground'
    : 'bg-muted/40 border border-border text-foreground';
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 font-mono">{title}</h4>
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
                <td key={i} className={`px-2 py-0.5 text-center ${cellCls}`}>{fmt(val, 3)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : (
        <table className="text-xs font-mono border-collapse">
          <tbody>
            {v.map((val, i) => (
              <tr key={i}>
                {labels && <td className="pr-2 text-muted-foreground text-[10px]">{labels[i] ?? ''}</td>}
                <td className={`px-2 py-0.5 text-center ${cellCls}`}>{fmt(val, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

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
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading matrix form…</p>;
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
  if (!summary || !problem) return <p className="text-sm text-muted-foreground italic">No data.</p>;

  const m = summary.b.length;
  const constraintLabels = Array.from({ length: m }, (_, i) => `C${i + 1}`);
  const A = reconstructA(summary);
  const allVarLabels = summary.all_vars.slice(0, -1); // drop 'RHS'
  const basicColIndices = new Set(
    allVarLabels
      .map((v, i) => summary.basis_vars.some(bv => bv.toLowerCase() === v.toLowerCase()) ? i : -1)
      .filter(i => i >= 0)
  );

  const constraintSlacks = slacksForConstraints(problem, summary.all_vars);

  return (
    <div className="space-y-5">

      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
        <p className="text-foreground font-semibold mb-1">§8.2 — How the matrices are built</p>
        <p>
          Every sensitivity result comes from the same raw materials: the constraint
          coefficients, the basis, and the OF coefficients. This lens walks through
          building each matrix from the original LP, so you can reproduce them on paper.
        </p>
      </div>

      {/* ── 1. Standard form ───────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          1. Standard form
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Rewrite every inequality as an equality by adding a slack, surplus, or artificial
          variable. The result has one equation per constraint — every variable becomes a
          column of a big matrix <code className="font-mono text-foreground">A</code>.
        </p>
        <div className="bg-muted/40 border border-border rounded-lg p-3 font-mono text-xs space-y-1">
          {problem.constraints.map((c, i) => {
            const slackName = constraintSlacks[i];
            const aux = slackName ? ` + ${slackName}` : '';
            const varsStr = c.coefficients
              .map((coef, vi) => {
                if (Math.abs(coef) < 1e-10) return '';
                const sign = coef < 0 ? ' − ' : (vi > 0 ? ' + ' : '');
                const mag = Math.abs(coef);
                const coefStr = mag === 1 ? '' : fmt(mag);
                return `${sign}${coefStr}${problem.variables[vi]}`;
              })
              .filter(Boolean)
              .join('')
              .replace(/^\s*\+\s*/, '');
            return (
              <div key={c.id} className="flex items-baseline gap-2">
                <span className="text-muted-foreground text-[10px] w-6 shrink-0">C{i + 1}:</span>
                <span className="text-foreground">{varsStr}{aux} = {fmt(c.rhs)}</span>
                {slackName && (
                  <span className="text-[10px] text-muted-foreground italic ml-auto">added {slackName}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. Full A matrix ──────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          2. The full constraint matrix A
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each row is a constraint; each column is a variable. Highlighted columns are the
          ones whose variable is currently in the basis — those form <code className="font-mono text-foreground">B</code>.
          The rest form <code className="font-mono text-foreground">N</code>.
        </p>
        <Matrix
          title="A (entire constraint matrix — rows = constraints, columns = all variables)"
          m={A}
          colLabels={allVarLabels}
          rowLabels={constraintLabels}
          highlightedCols={basicColIndices}
        />
      </section>

      {/* ── 3. B ──────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          3. Extract B (the basic columns)
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Pull out the highlighted columns above, in basis order:{' '}
          <code className="font-mono text-foreground">B = A<sub>·,[{summary.basis_vars.join(', ')}]</sub></code>.
        </p>
        <Matrix
          title="B"
          m={summary.B}
          colLabels={summary.basis_vars}
          rowLabels={constraintLabels}
        />
      </section>

      {/* ── 4. N ──────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          4. Extract N (the nonbasic columns)
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Everything that wasn&apos;t pulled into <code className="font-mono text-foreground">B</code>:
          <code className="font-mono text-foreground"> N = A<sub>·,[{summary.nonbasic_vars.join(', ')}]</sub></code>.
        </p>
        <Matrix
          title="N"
          m={summary.N}
          colLabels={summary.nonbasic_vars}
          rowLabels={constraintLabels}
          subtle
        />
      </section>

      {/* ── 5. B⁻¹ ────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          5. B⁻¹ (the key to every sensitivity formula)
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          To invert <code className="font-mono text-foreground">B</code> by hand, row-reduce{' '}
          <code className="font-mono text-foreground">[B | I]</code> until the left side is{' '}
          <code className="font-mono text-foreground">I</code>; the right side becomes{' '}
          <code className="font-mono text-foreground">B⁻¹</code>. Shortcut: in a standard-Simplex
          problem, <strong className="text-foreground">B⁻¹ sits in the optimal tableau under the
          original slack columns</strong> — the columns that started as <code className="font-mono text-foreground">I</code>{' '}
          in the initial tableau are transformed into <code className="font-mono text-foreground">B⁻¹</code> by
          the end.
        </p>
        <Matrix
          title="B⁻¹"
          m={summary.B_inv}
          colLabels={constraintLabels}
          rowLabels={summary.basis_vars}
        />
      </section>

      {/* ── 6. Graphical connection (2-var only) ───────────────────────────── */}
      {problem.variables.length === 2 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            6. What this means on the graph
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            For 2-variable problems, the basis tells you which constraint lines meet at the
            optimal vertex. A slack variable in the basis with a <em>positive</em> value means
            its constraint has room to spare (non-binding). A slack at zero (nonbasic) means
            the constraint line passes exactly through the optimal point (binding).
          </p>
          <div className="bg-muted/40 border border-border rounded-lg divide-y divide-border">
            {problem.constraints.map((c, i) => {
              const slackName = constraintSlacks[i];
              if (!slackName) {
                return (
                  <div key={c.id} className="px-3 py-2 text-xs">
                    <span className="font-mono text-muted-foreground">C{i + 1}</span>{' '}
                    <span className="text-muted-foreground italic">({c.operator} — slack/surplus analysis skipped for this type)</span>
                  </div>
                );
              }
              const basicIdx = summary.basis_vars.findIndex(bv => bv.toLowerCase() === slackName.toLowerCase());
              const isBasic = basicIdx >= 0;
              const slackValue = isBasic ? summary.xB[basicIdx] : 0;
              const binding = !isBasic || Math.abs(slackValue) < 1e-9;
              return (
                <div key={c.id} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-primary">C{i + 1}</span>
                    <span className="text-muted-foreground ml-2">slack = </span>
                    <span className="font-mono text-foreground">{slackName}</span>
                    <span className="text-muted-foreground ml-1">= {fmt(slackValue)}</span>
                  </div>
                  {binding ? (
                    <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 rounded px-2 py-0.5 shrink-0">
                      binding — line hits the vertex
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-muted/60 text-muted-foreground border border-border rounded px-2 py-0.5 shrink-0">
                      non-binding — slack of {fmt(slackValue)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground italic leading-relaxed mt-2">
            Exactly <strong className="text-foreground">m binding constraints</strong> pass
            through the optimum (where <strong>m</strong> is the number of constraints — but
            with decision-variable non-negativity giving the axes, the optimal vertex is
            typically at the intersection of 2 binding lines for 2-variable problems).
          </p>
        </section>
      )}

      {/* ── 7. C_B, C_N, b ────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          7. Cost vectors and RHS
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <code className="font-mono text-foreground">C_B</code> pulls the OF coefficients of
          the basic variables (slacks contribute 0 to the OF in standard form);{' '}
          <code className="font-mono text-foreground">C_N</code> does the same for the
          nonbasic ones; <code className="font-mono text-foreground">b</code> is the right-hand
          side of the original constraints.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Vector title="C_B" v={summary.CB} labels={summary.basis_vars} horizontal />
          <Vector title="C_N" v={summary.CN} labels={summary.nonbasic_vars} horizontal />
        </div>
        <Vector title="b" v={summary.b} labels={constraintLabels} />
      </section>

      {/* ── 8. z* identity ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          8. The identity that closes the loop
        </h3>
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 font-mono text-sm text-center">
          <div className="text-muted-foreground text-xs mb-1">x_B = B⁻¹ · b</div>
          <div className="text-muted-foreground text-xs mb-3">z* = C_B · B⁻¹ · b</div>
          <div className="text-xl font-bold text-accent">z* = {fmt(summary.z_star, 4)}</div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Now open the Sensitivity lens. Every slider there uses{' '}
          <code className="font-mono text-foreground">B⁻¹</code> and the shadow prices{' '}
          <code className="font-mono text-foreground">y = C_B · B⁻¹</code> from above to
          compute its live result — no re-solve needed within the allowable range.
        </p>
      </section>
    </div>
  );
}
