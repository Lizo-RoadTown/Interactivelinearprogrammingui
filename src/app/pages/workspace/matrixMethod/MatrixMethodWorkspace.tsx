/**
 * MatrixMethodWorkspace — the Chapter 8 gameboard.
 *
 * Three zones, one page:
 *   Zone 1  the LP problem (read-only, top left)
 *   Zone 2  the identification workspace (top right): slots for
 *           xBV, xNBV, CB, CN, b, B, N, B⁻¹ that the student fills in
 *   Zone 3  the Table 8.1 optimal tableau being assembled (full width
 *           bottom): B⁻¹N, I block, B⁻¹b, Z-row NB, 0s, C_B B⁻¹ b
 *
 * First commit: the layout shell + all zones rendering the derived
 * values unconditionally. Step sequencing (locking slots until the
 * student earns each reveal) is the next commit. This cut exists so
 * the data pipeline (SolvedLP → derive → render) is visible and
 * verifiable end-to-end.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { findExample, ALL_EXAMPLES } from './examples';
import { derive } from './derived';
import { varLabel } from './types';
import { fmtFrac } from './matrix';

export default function MatrixMethodWorkspace() {
  const navigate = useNavigate();
  const { exampleId } = useParams<{ exampleId: string }>();
  const lp = findExample(exampleId ?? '') ?? ALL_EXAMPLES[0];
  const derived = useMemo(() => derive(lp), [lp]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card/60 backdrop-blur border-b border-border px-4 py-2.5 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Matrix Method Gameboard</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Chapter 8 · Table 8.1 · reconstruct the optimal tableau from B⁻¹
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Example</label>
          <select
            aria-label="Example problem"
            title="Example problem"
            value={lp.id}
            onChange={e => navigate(`/matrix-method/${e.target.value}`)}
            className="text-xs bg-muted/40 border border-border rounded-md px-2 py-1 focus:outline-none focus:border-primary"
          >
            {ALL_EXAMPLES.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title}</option>
            ))}
          </select>
        </div>
      </header>

      {!derived ? (
        <div className="p-8 text-center text-rose-300">
          Basis is singular — check the problem&apos;s basicVarIndices.
        </div>
      ) : (
        <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
          {/* ── Top row: Zone 1 (problem) + Zone 2 (workspace) ────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Zone1Problem lp={lp} />
            <Zone2Workspace lp={lp} derived={derived} />
          </div>

          {/* ── Bottom: Zone 3 (Table 8.1 tableau) ─────────────────────── */}
          <Zone3Tableau lp={lp} derived={derived} />
        </div>
      )}
    </div>
  );
}

// ── Zone 1: the problem, read-only ───────────────────────────────────────────

function Zone1Problem({ lp }: { lp: ReturnType<typeof findExample> }) {
  if (!lp) return null;
  const decisionVars = lp.variables.filter(v => v.kind === 'decision');
  const slackVars = lp.variables.filter(v => v.kind === 'slack');
  const nConstraints = lp.b.length;
  return (
    <section className="bg-card/40 border-2 border-border rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-primary/15 via-card/40 to-card/40 border-b border-border px-4 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Zone 1 · The problem</p>
        <p className="text-sm font-semibold text-foreground">{lp.title}</p>
      </div>
      <div className="p-4 space-y-3">
        {/* Objective */}
        <div className="font-mono text-sm">
          <span className="text-muted-foreground uppercase text-[10px] mr-2">{lp.sense}</span>
          z = {decisionVars.map((v, i) => (
            <span key={i}>
              {i > 0 && ' + '}
              <span className="text-emerald-200">{v.objCoef}</span>
              {varLabel(v)}
            </span>
          ))}
        </div>
        {/* Constraints */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Subject to (standard form, slacks added)</p>
          {Array.from({ length: nConstraints }, (_, r) => (
            <div key={r} className="font-mono text-sm">
              {decisionVars.map((v, i) => {
                const coef = lp.A[r][i];
                if (coef === 0) return null;
                return (
                  <span key={i}>
                    {i > 0 && coef > 0 && ' + '}
                    {coef < 0 && ' − '}
                    <span className="text-emerald-200">{Math.abs(coef)}</span>
                    {varLabel(v)}{' '}
                  </span>
                );
              })}
              {slackVars.map(v => {
                const idx = lp.variables.indexOf(v);
                const coef = lp.A[r][idx];
                if (coef === 0) return null;
                return (
                  <span key={idx}>+ <span className="text-emerald-200">{coef === 1 ? '' : coef}</span>{varLabel(v)}{' '}</span>
                );
              })}
              = <span className="text-accent font-semibold ml-1">{lp.b[r]}</span>
            </div>
          ))}
        </div>
        {/* Non-negativity */}
        <p className="text-xs text-muted-foreground italic">
          All variables assumed ≥ 0
        </p>
        {/* Given-basis call-out */}
        <div className="border-t border-border/50 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-orange-300 font-semibold">Given in the optimal solution:</p>
          <p className="font-mono text-sm text-orange-100 mt-1">
            x<sub>BV</sub> = [{lp.basicVarIndices.map(i => varLabel(lp.variables[i])).join(', ')}]
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Zone 2: identification workspace ─────────────────────────────────────────

function Zone2Workspace({
  lp, derived,
}: {
  lp: NonNullable<ReturnType<typeof findExample>>;
  derived: NonNullable<ReturnType<typeof derive>>;
}) {
  return (
    <section className="bg-card/40 border-2 border-border rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500/15 via-card/40 to-card/40 border-b border-border px-4 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-orange-300 font-bold">Zone 2 · Identification workspace</p>
        <p className="text-[11px] text-muted-foreground">Read values off Zone 1, enter them here</p>
      </div>
      <div className="p-4 space-y-4">
        {/* xBV / xNBV */}
        <div className="grid grid-cols-2 gap-3">
          <VectorSlot
            label="x_BV"
            values={derived.basicLabels.map((l, i) => ({ display: l, key: `bv-${i}` }))}
          />
          <VectorSlot
            label="x_NBV"
            values={derived.nonBasicLabels.map((l, i) => ({ display: l, key: `nbv-${i}` }))}
          />
        </div>

        {/* CB / CN / b */}
        <div className="grid grid-cols-3 gap-3">
          <VectorSlot label="C_B" values={derived.CB.map((v, i) => ({ display: fmtFrac(v), key: `cb-${i}` }))} />
          <VectorSlot label="C_N" values={derived.CN.map((v, i) => ({ display: fmtFrac(v), key: `cn-${i}` }))} />
          <VectorSlot label="b" values={lp.b.map((v, i) => ({ display: fmtFrac(v), key: `b-${i}` }))} />
        </div>

        {/* B / N */}
        <div className="grid grid-cols-2 gap-3">
          <MatrixSlot label="B" M={derived.B} />
          <MatrixSlot label="N" M={derived.N} />
        </div>

        {/* B⁻¹ */}
        <MatrixSlot label="B⁻¹" M={derived.Binv} tone="primary" />
      </div>
    </section>
  );
}

// ── Zone 3: Table 8.1 tableau ────────────────────────────────────────────────

function Zone3Tableau({
  lp, derived,
}: {
  lp: NonNullable<ReturnType<typeof findExample>>;
  derived: NonNullable<ReturnType<typeof derive>>;
}) {
  const nConstraints = lp.b.length;
  // Column display order: non-basic vars first, then basic vars (matching Table 8.1)
  const colOrder = [
    ...derived.nonBasicLabels.map((l, i) => ({ label: l, kind: 'nbv' as const, idx: i })),
    ...derived.basicLabels.map((l, i)    => ({ label: l, kind: 'bv'  as const, idx: i })),
  ];

  return (
    <section className="bg-card/40 border-2 border-emerald-500/40 rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-500/15 via-card/40 to-card/40 border-b border-border px-4 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Zone 3 · Optimal tableau (Table 8.1)</p>
        <p className="text-[11px] text-muted-foreground">Built from B⁻¹·N, I, B⁻¹b, C_B·B⁻¹N − C_N, 0, C_B·B⁻¹b</p>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="border-collapse font-mono text-sm mx-auto">
          <thead>
            <tr>
              <th className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">BV</th>
              {colOrder.map((c, i) => (
                <th
                  key={i}
                  className={`px-2 py-1.5 text-center text-xs font-semibold ${
                    c.kind === 'nbv' ? 'text-orange-200' : 'text-primary'
                  }`}
                >
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center text-xs font-semibold text-accent">RHS</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: nConstraints }, (_, r) => (
              <tr key={r}>
                <td className="px-3 py-1.5 text-xs font-semibold">
                  {derived.basicLabels[r]}
                </td>
                {colOrder.map((c, i) => {
                  let val: number;
                  if (c.kind === 'nbv') {
                    val = derived.BinvN[r][c.idx];
                  } else {
                    val = r === c.idx ? 1 : 0;
                  }
                  return <CellFilled key={i} value={val} />;
                })}
                <CellFilled value={derived.Binvb[r]} tone="accent" />
              </tr>
            ))}
            {/* Z row */}
            <tr className="border-t-2 border-primary/50">
              <td className="px-3 py-1.5 text-xs font-semibold text-primary">z</td>
              {colOrder.map((c, i) => {
                const val = c.kind === 'nbv' ? derived.zRowNB[c.idx] : 0;
                return <CellFilled key={i} value={val} />;
              })}
              <CellFilled value={derived.zStar} tone="emerald" />
            </tr>
          </tbody>
        </table>

        {/* Step 12 two-language payoff preview — full panel coming in a later commit */}
        <div className="mt-6 border-t border-border/40 pt-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-2">
            Step 12 — the two-language payoff (preview)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-muted/20 border border-border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-wider">
                Direct substitution
              </p>
              <p className="font-mono">
                z* = {derived.payoff.direct.map((p, i) => (
                  <span key={i}>{i > 0 && ' + '}{fmtFrac(p.coef)}·{p.label}*</span>
                ))}
              </p>
              <p className="font-mono text-foreground/90 mt-1">
                = {derived.payoff.direct.map((p, i) => (
                  <span key={i}>{i > 0 && ' + '}{fmtFrac(p.coef)}·({fmtFrac(p.value)})</span>
                ))}
              </p>
              <p className="font-mono font-bold text-emerald-200 mt-1">= {fmtFrac(derived.zStar)}</p>
            </div>
            <div className="bg-muted/20 border border-border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-wider">
                Matrix formula
              </p>
              <p className="font-mono">z* = C_B · B⁻¹b</p>
              <p className="font-mono text-foreground/90 mt-1">
                = [{derived.CB.map(fmtFrac).join(', ')}] · [{derived.Binvb.map(fmtFrac).join(', ')}]ᵀ
              </p>
              <p className="font-mono text-foreground/90 mt-1">
                = {derived.payoff.matrix.map((p, i) => (
                  <span key={i}>{i > 0 && ' + '}{fmtFrac(p.coef)}·{fmtFrac(p.value)}</span>
                ))}
              </p>
              <p className="font-mono font-bold text-emerald-200 mt-1">= {fmtFrac(derived.zStar)}</p>
            </div>
          </div>
          <p className="text-[11px] text-center text-muted-foreground italic mt-3">
            Same z*. Same numbers. Different languages. This is the point of the whole gameboard.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Shared slot primitives ───────────────────────────────────────────────────

function VectorSlot({
  label, values,
}: {
  label: string;
  values: { display: string; key: string }[];
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 font-mono">
        {label}
      </p>
      <div className="bg-muted/20 border border-border rounded-lg p-2 flex flex-wrap gap-1 font-mono text-xs">
        <span className="text-muted-foreground">[</span>
        {values.map((v, i) => (
          <span key={v.key} className="bg-primary/15 border border-primary/40 text-primary px-2 py-0.5 rounded font-bold">
            {v.display}
          </span>
        ))}
        <span className="text-muted-foreground">]</span>
      </div>
    </div>
  );
}

function MatrixSlot({
  label, M, tone = 'muted',
}: {
  label: string;
  M: number[][];
  tone?: 'muted' | 'primary';
}) {
  const cellCls = tone === 'primary'
    ? 'bg-primary/15 border-primary/40 text-primary'
    : 'bg-muted/40 border-border/70 text-foreground';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 font-mono">
        {label}
      </p>
      <table className="border-collapse font-mono text-xs">
        <tbody>
          {M.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td key={c} className="p-0.5">
                  <div className={`w-12 h-7 flex items-center justify-center rounded border font-bold tabular-nums ${cellCls}`}>
                    {fmtFrac(v)}
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

function CellFilled({
  value, tone = 'default',
}: {
  value: number;
  tone?: 'default' | 'accent' | 'emerald';
}) {
  const cls =
    tone === 'accent'  ? 'bg-accent/15 border-accent/40 text-accent' :
    tone === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200' :
                         'bg-muted/40 border-border/70 text-foreground/90';
  return (
    <td className="p-0.5 text-center">
      <div className={`inline-flex items-center justify-center w-12 h-7 rounded border font-bold tabular-nums text-xs ${cls}`}>
        {fmtFrac(value)}
      </div>
    </td>
  );
}
