/**
 * MatrixFormLens — §8.2 as an interactive construction.
 *
 * The student BUILDS the matrices from the original LP, step by step:
 *   1. For each constraint, decide what auxiliary variable to add (slack,
 *      surplus+artificial, or artificial only). Click to pick.
 *   2. For each column of the standard form A matrix, decide whether it
 *      belongs to B (basis) or N (nonbasis) by clicking on it.
 *   3. For each original constraint, say whether it is binding or
 *      non-binding on the graph by clicking yes/no.
 *
 * Sections that are computed once the student has done the pick steps
 * (C_B, C_N, b vector, z* identity, full B⁻¹) reveal automatically as
 * compact reference displays — they're consequences, not decisions.
 */

import { useEffect, useMemo, useState } from 'react';
import { LPProblem, SolverResponse } from '../../../types';
import {
  Loader2, AlertCircle, CheckCircle, XCircle, Lightbulb, RotateCw,
} from 'lucide-react';

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

type AuxChoice = 'slack' | 'surplus_artificial' | 'artificial' | 'none' | null;

function fmt(v: number, places = 3): string {
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(places).replace(/\.?0+$/, '');
}

function correctAuxFor(op: '<=' | '>=' | '='): AuxChoice {
  if (op === '<=') return 'slack';
  if (op === '>=') return 'surplus_artificial';
  return 'artificial';
}

function reconstructA(summary: SensitivitySummary): number[][] {
  const m = summary.b.length;
  const nTotal = summary.all_vars.length - 1;
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

function slacksForConstraints(problem: LPProblem, allVars: string[]): (string | null)[] {
  const result: (string | null)[] = [];
  let slackCount = 0;
  for (const c of problem.constraints) {
    if (c.operator === '<=') {
      slackCount++;
      const name = `s${slackCount}`;
      result.push(allVars.find(v => v.toLowerCase() === name) ?? null);
    } else {
      result.push(null);
    }
  }
  return result;
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

  // ── Interactive step state ──────────────────────────────────────────────
  // Step 1: what aux variable does each constraint get?
  const [auxChoices, setAuxChoices] = useState<AuxChoice[]>([]);
  // Step 2: which columns of A did the student select as "in basis"?
  const [pickedBasicCols, setPickedBasicCols] = useState<Set<number>>(new Set());
  // Step 3: per constraint — is it binding? null = not answered, true = binding, false = not
  const [bindingAnswers, setBindingAnswers] = useState<(boolean | null)[]>([]);
  // Step-level attempt counters for escalation
  const [auxAttempts, setAuxAttempts] = useState(0);
  const [basisAttempts, setBasisAttempts] = useState(0);

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

  // Reset interactive state when the LP changes
  useEffect(() => {
    if (!problem) return;
    setAuxChoices(problem.constraints.map(() => null));
    setBindingAnswers(problem.constraints.map(() => null));
    setPickedBasicCols(new Set());
    setAuxAttempts(0);
    setBasisAttempts(0);
  }, [problem?.constraints.length, problem?.constraints.map(c => c.id).join(',')]);

  // ── Derived state ────────────────────────────────────────────────────────

  const allAuxCorrect = useMemo(() => {
    if (!problem) return false;
    return problem.constraints.every((c, i) => auxChoices[i] === correctAuxFor(c.operator));
  }, [problem, auxChoices]);

  const correctBasicCols = useMemo(() => {
    if (!summary) return new Set<number>();
    const cols = new Set<number>();
    const allVarLabels = summary.all_vars.slice(0, -1);
    allVarLabels.forEach((v, i) => {
      if (summary.basis_vars.some(bv => bv.toLowerCase() === v.toLowerCase())) cols.add(i);
    });
    return cols;
  }, [summary]);

  const allBasicColsPicked = useMemo(() => {
    if (!summary) return false;
    if (pickedBasicCols.size !== correctBasicCols.size) return false;
    for (const c of correctBasicCols) if (!pickedBasicCols.has(c)) return false;
    return true;
  }, [pickedBasicCols, correctBasicCols, summary]);

  const allBindingAnswered = useMemo(() => {
    return bindingAnswers.every(v => v !== null);
  }, [bindingAnswers]);

  const bindingCorrectness = useMemo(() => {
    if (!problem || !summary) return [] as boolean[];
    const slacks = slacksForConstraints(problem, summary.all_vars);
    return problem.constraints.map((c, i) => {
      const slack = slacks[i];
      if (!slack) return true; // skip if not mappable
      const basicIdx = summary.basis_vars.findIndex(bv => bv.toLowerCase() === slack.toLowerCase());
      const isBasic = basicIdx >= 0;
      const slackValue = isBasic ? summary.xB[basicIdx] : 0;
      const isBinding = !isBasic || Math.abs(slackValue) < 1e-9;
      return bindingAnswers[i] === isBinding;
    });
  }, [problem, summary, bindingAnswers]);

  // ── Render ───────────────────────────────────────────────────────────────

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
  const allVarLabels = summary.all_vars.slice(0, -1);

  return (
    <div className="space-y-5">

      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
        <p className="text-foreground font-semibold mb-1">§8.2 — Build the matrices yourself</p>
        <p>
          The matrices B, B⁻¹, N, C_B, C_N, and b are the connective tissue between the word
          problem, the tableau, and the graph. Build them here and see exactly where each piece
          comes from.
        </p>
      </div>

      {/* ══ STEP 1: Standard form (interactive) ═══════════════════════════════ */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          Step 1 — Standard form
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every inequality needs to become an equation before it can become a matrix row. For
          each constraint, pick what to add:
        </p>
        <div className="space-y-2">
          {problem.constraints.map((c, i) => {
            const choice = auxChoices[i];
            const correct = correctAuxFor(c.operator);
            const isCorrect = choice === correct;
            const varsStr = c.coefficients
              .map((coef, vi) => {
                if (Math.abs(coef) < 1e-10) return '';
                const sign = coef < 0 ? ' − ' : (vi > 0 ? ' + ' : '');
                const mag = Math.abs(coef);
                const coefStr = mag === 1 ? '' : fmt(mag);
                return `${sign}${coefStr}${problem.variables[vi]}`;
              })
              .filter(Boolean).join('').replace(/^\s*\+\s*/, '');

            return (
              <div key={c.id} className={`border rounded-lg p-3 space-y-2 ${
                choice === null ? 'border-border bg-muted/40' :
                isCorrect ? 'border-emerald-500/40 bg-emerald-500/10' :
                'border-destructive/40 bg-destructive/10'
              }`}>
                <div className="font-mono text-xs flex items-baseline gap-2">
                  <span className="text-muted-foreground w-6">C{i + 1}:</span>
                  <span className="text-foreground">{varsStr} {c.operator === '<=' ? '≤' : c.operator === '>=' ? '≥' : '='} {fmt(c.rhs)}</span>
                </div>
                {choice !== null && isCorrect && (
                  <div className="font-mono text-xs flex items-baseline gap-2">
                    <span className="text-muted-foreground w-6"></span>
                    <span className="text-foreground">{varsStr}{' '}
                      {correct === 'slack' && <span className="text-accent">+ s{i + 1}</span>}
                      {correct === 'surplus_artificial' && <span><span className="text-accent">− e + a</span></span>}
                      {correct === 'artificial' && <span className="text-accent">+ a</span>}
                      {correct === 'none' && null}
                      {' '}= {fmt(c.rhs)}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {(['slack', 'surplus_artificial', 'artificial', 'none'] as const).map(opt => {
                    const label =
                      opt === 'slack' ? '+ slack (s)' :
                      opt === 'surplus_artificial' ? '− surplus + artificial (−e + a)' :
                      opt === 'artificial' ? '+ artificial (a)' :
                      'nothing';
                    const isPicked = choice === opt;
                    const isOptCorrect = isPicked && opt === correct;
                    const isOptWrong = isPicked && opt !== correct;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const next = [...auxChoices];
                          next[i] = opt;
                          setAuxChoices(next);
                          if (opt !== correct) setAuxAttempts(a => a + 1);
                        }}
                        disabled={isCorrect}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          isOptCorrect ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 font-medium' :
                          isOptWrong ? 'bg-destructive/20 border-destructive/50 text-destructive' :
                          'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {choice !== null && !isCorrect && (
                  <p className="text-[11px] text-destructive flex items-start gap-1">
                    <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>
                      {c.operator === '<=' && 'For ≤: add a slack (+s) to turn "left ≤ right" into "left + s = right".'}
                      {c.operator === '>=' && 'For ≥: subtract a surplus (−e) AND add an artificial (+a). The surplus absorbs excess; the artificial gives a starting BFS.'}
                      {c.operator === '='  && 'For =: add an artificial (+a) only. No slack or surplus — you need an initial basis, not extra slack.'}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {auxAttempts >= 2 && !allAuxCorrect && (
          <details className="bg-accent/10 border border-accent/30 rounded-lg" open>
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-accent flex items-center gap-1.5 select-none">
              <Lightbulb className="w-3 h-3" />
              Walk me through this step
            </summary>
            <p className="px-3 pb-3 text-xs text-accent leading-relaxed whitespace-pre-line">
              The rule is mechanical, by constraint type:{'\n'}
              {'  '}≤  becomes  = by adding a SLACK variable (+s). The slack takes up the "gap" between left and right.{'\n'}
              {'  '}≥  becomes  = by subtracting a SURPLUS (−e) and adding an ARTIFICIAL (+a). Surplus absorbs the excess on the left; artificial gives simplex somewhere to start.{'\n'}
              {'  '}=  gets just an ARTIFICIAL (+a). No slack/surplus — the equation is already tight.
            </p>
          </details>
        )}
        {allAuxCorrect && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-2 text-xs text-emerald-200 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            All constraints standardized. The full standard-form LP has {allVarLabels.length} variables.
          </div>
        )}
      </section>

      {/* ══ STEP 2: A matrix + basis picker ═══════════════════════════════════ */}
      {allAuxCorrect && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            Step 2 — Click the columns of A that form B
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            B is the m × m matrix of columns corresponding to the <em>basic</em> variables at
            the current optimum. In this solution the basis is{' '}
            <span className="font-mono text-primary">{summary.basis_vars.join(', ')}</span>.
            Click the columns below whose variable is in the basis.
          </p>
          <div className="overflow-x-auto pb-1">
            <table className="text-xs font-mono border-collapse">
              <thead>
                <tr>
                  <td />
                  {allVarLabels.map((v, j) => {
                    const picked = pickedBasicCols.has(j);
                    const isCorrect = correctBasicCols.has(j);
                    const isRight = picked && isCorrect;
                    const isWrong = picked && !isCorrect;
                    return (
                      <td key={j} className="px-1 pb-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPickedBasicCols(prev => {
                              const next = new Set(prev);
                              if (next.has(j)) next.delete(j);
                              else {
                                next.add(j);
                                if (!correctBasicCols.has(j)) setBasisAttempts(a => a + 1);
                              }
                              return next;
                            });
                          }}
                          disabled={allBasicColsPicked}
                          className={`px-2 py-0.5 rounded text-center transition-all ${
                            isRight ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 font-semibold' :
                            isWrong ? 'bg-destructive/20 border border-destructive/50 text-destructive' :
                            'bg-muted/60 border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                          }`}
                        >
                          {v}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {A.map((row, ri) => (
                  <tr key={ri}>
                    <td className="pr-2 text-muted-foreground text-[10px] text-right">{constraintLabels[ri]}</td>
                    {row.map((v, ci) => {
                      const picked = pickedBasicCols.has(ci);
                      const isCorrect = correctBasicCols.has(ci);
                      const cls = picked && isCorrect
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100'
                        : picked && !isCorrect
                          ? 'bg-destructive/10 border-destructive/40 text-destructive'
                          : 'bg-muted/40 border-border text-foreground';
                      return (
                        <td key={ci} className={`px-2 py-0.5 border text-center ${cls}`}>
                          {fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {basisAttempts >= 2 && !allBasicColsPicked && (
            <details className="bg-accent/10 border border-accent/30 rounded-lg" open>
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-accent flex items-center gap-1.5 select-none">
                <Lightbulb className="w-3 h-3" />
                Walk me through this step
              </summary>
              <p className="px-3 pb-3 text-xs text-accent leading-relaxed">
                Look at the Solution lens (or the final tableau) to see which variables are
                currently basic. For this LP they are{' '}
                <span className="font-mono text-foreground">{summary.basis_vars.join(', ')}</span>.
                Click those column headers above. Every other column goes into N (not clicked here).
              </p>
            </details>
          )}
          {allBasicColsPicked && (
            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-2 text-xs text-emerald-200 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              B has been extracted. The highlighted columns are the m × m matrix that drives every sensitivity calculation.
            </div>
          )}
          {allBasicColsPicked && (
            <button
              type="button"
              onClick={() => { setPickedBasicCols(new Set()); setBasisAttempts(0); }}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              <RotateCw className="w-3 h-3 inline mr-0.5" /> try again
            </button>
          )}
        </section>
      )}

      {/* ══ STEP 3: Binding check on the graph (2-var only) ══════════════════ */}
      {allBasicColsPicked && problem.variables.length === 2 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            Step 3 — For each constraint, is it binding on the graph?
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A constraint is <strong className="text-foreground">binding</strong> when its line
            passes through the optimal vertex — its slack is 0. <strong className="text-foreground">Non-binding</strong>{' '}
            means there&apos;s room to spare. Look at the graph lens (on the right), compare the
            optimal vertex to each constraint line, and answer:
          </p>
          <div className="space-y-2">
            {problem.constraints.map((c, i) => {
              const ans = bindingAnswers[i];
              const correct = bindingCorrectness[i];
              return (
                <div key={c.id} className={`border rounded-lg p-3 ${
                  ans === null ? 'border-border bg-muted/40' :
                  correct ? 'border-emerald-500/40 bg-emerald-500/10' :
                  'border-destructive/40 bg-destructive/10'
                }`}>
                  <div className="font-mono text-xs text-foreground mb-2">
                    <span className="text-muted-foreground">C{i + 1}:</span> {
                      c.coefficients.map((coef, vi) => {
                        if (Math.abs(coef) < 1e-10) return '';
                        const sign = coef < 0 ? ' − ' : (vi > 0 ? ' + ' : '');
                        const mag = Math.abs(coef);
                        const coefStr = mag === 1 ? '' : fmt(mag);
                        return `${sign}${coefStr}${problem.variables[vi]}`;
                      }).filter(Boolean).join('').replace(/^\s*\+\s*/, '')
                    } {c.operator === '<=' ? '≤' : c.operator === '>=' ? '≥' : '='} {fmt(c.rhs)}
                  </div>
                  <div className="flex gap-1.5">
                    {([true, false] as const).map(val => {
                      const isPicked = ans === val;
                      return (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => {
                            const next = [...bindingAnswers];
                            next[i] = val;
                            setBindingAnswers(next);
                          }}
                          disabled={ans !== null && correct}
                          className={`text-xs px-3 py-1 rounded-full border ${
                            isPicked && correct ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 font-medium' :
                            isPicked && !correct ? 'bg-destructive/20 border-destructive/50 text-destructive' :
                            'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          }`}
                        >
                          {val ? 'Binding' : 'Not binding'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {allBindingAnswered && bindingCorrectness.every(Boolean) && (
            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-2 text-xs text-emerald-200 flex items-start gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 mt-0.5" />
              <span>
                Excellent. Exactly the binding constraints have their slack at 0 (and therefore
                nonbasic); non-binding constraints have a positive slack (therefore basic).
                Binding + basis membership of slacks is the same fact told two ways.
              </span>
            </div>
          )}
        </section>
      )}

      {/* ══ STEP 4 & beyond — revealed reference once the interactive steps are done ══ */}
      {allBasicColsPicked && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            Result — the matrices you built
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <CompactMatrix title="B" m={summary.B} colLabels={summary.basis_vars} rowLabels={constraintLabels} />
            <CompactMatrix title="B⁻¹" m={summary.B_inv} colLabels={constraintLabels} rowLabels={summary.basis_vars} />
          </div>
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            To compute B⁻¹ by hand: row-reduce [B | I] until the left block is I; the right
            block becomes B⁻¹. Shortcut for standard-Simplex problems: <strong className="text-foreground">B⁻¹ sits in
            the final tableau under the original slack columns</strong> — the columns that started
            as I transform into B⁻¹ by the end.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <CompactMatrix title="N" m={summary.N} colLabels={summary.nonbasic_vars} rowLabels={constraintLabels} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <CompactVector title="C_B" v={summary.CB} labels={summary.basis_vars} />
            <CompactVector title="C_N" v={summary.CN} labels={summary.nonbasic_vars} />
            <CompactVector title="b" v={summary.b} labels={constraintLabels} />
          </div>

          <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground font-mono mb-1">x_B = B⁻¹ · b</div>
            <div className="text-[10px] text-muted-foreground font-mono mb-2">z* = C_B · B⁻¹ · b</div>
            <div className="text-lg font-bold text-accent font-mono">z* = {fmt(summary.z_star, 4)}</div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Now open the <strong className="text-foreground">Sensitivity</strong> lens. Every slider there is powered
            by the B⁻¹ you just extracted and the shadow prices y = C_B · B⁻¹.
          </p>
        </section>
      )}
    </div>
  );
}

// ── Compact primitives ───────────────────────────────────────────────────────

function CompactMatrix({ title, m, colLabels, rowLabels }: {
  title: string; m: number[][]; colLabels?: string[]; rowLabels?: string[];
}) {
  if (!m || m.length === 0 || m[0].length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-1 font-mono">{title}</h4>
      <table className="text-[10px] font-mono border-collapse">
        {colLabels && (
          <thead>
            <tr>
              {rowLabels && <td />}
              {colLabels.map((l, i) => (
                <td key={i} className="px-1 text-muted-foreground text-center">{l}</td>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {m.map((row, ri) => (
            <tr key={ri}>
              {rowLabels && <td className="pr-1 text-muted-foreground text-right">{rowLabels[ri]}</td>}
              {row.map((v, ci) => (
                <td key={ci} className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground text-center">
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

function CompactVector({ title, v, labels }: {
  title: string; v: number[]; labels?: string[];
}) {
  if (!v || v.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground mb-1 font-mono">{title}</h4>
      <table className="text-[10px] font-mono border-collapse">
        <tbody>
          {labels && (
            <tr>
              {labels.map((l, i) => (
                <td key={i} className="px-1 text-muted-foreground text-center">{l}</td>
              ))}
            </tr>
          )}
          <tr>
            {v.map((val, i) => (
              <td key={i} className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground text-center">
                {fmt(val, 3)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
