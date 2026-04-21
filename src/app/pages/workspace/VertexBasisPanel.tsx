/**
 * VertexBasisPanel — shows the algebraic information about the feasible-
 * polygon vertex the student just clicked. This is the bridge between
 * the graph (where the student has built intuition about where vertices
 * are) and the matrix form of the simplex (where each vertex IS a choice
 * of basis).
 *
 * The goal of this panel for Phase 6: make the student see, for a
 * specific clicked vertex, exactly which variables are basic at that
 * corner and WHY. Tight constraints → their slacks are 0 → those slacks
 * are NON-basic. Decision variables on axes (x_i = 0) → those x_i are
 * NON-basic. Everything else in the problem is basic. That set of basic
 * variables is what we'll call B in the next step.
 */

import { FeasibleVertex } from './DiscoveryGraph';
import { LPDraft } from './guidedTypes';
import { colorFor, colorForFill } from './constraintColors';

interface Props {
  draft: LPDraft;
  vertex: FeasibleVertex | null;
  /** How many decision variables the problem has. */
  nDecVars: number;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

export default function VertexBasisPanel({ draft, vertex, nDecVars }: Props) {
  if (!vertex) {
    return (
      <div className="bg-card/40 border border-dashed border-border/60 rounded-xl p-4 text-center">
        <p className="text-[11px] text-muted-foreground italic">
          Click any corner of the feasible region on the graph — each corner is
          a <span className="font-semibold not-italic">basis</span>.
        </p>
      </div>
    );
  }

  const nConstraints = draft.constraints.length;
  const allDecLabels = Array.from({ length: nDecVars }, (_, i) => `x${i + 1}`);
  const allSlackLabels = Array.from({ length: nConstraints }, (_, i) => `s${i + 1}`);

  // At this vertex:
  //   - Decision vars listed in zeroDecisionVars are 0 → non-basic
  //   - Constraints listed in tightConstraints have slack = 0 → those
  //     slacks are non-basic
  // Everything else is basic. We also want to show each variable's
  // value at this vertex for the "tableau RHS" readout.
  const x1 = vertex.x;
  const x2 = vertex.y;
  const decVarValues = [x1, x2];
  const slackValues = draft.constraints.map(c => {
    if (c.rhs == null) return 0;
    const a = c.coefficients[0] ?? 0;
    const b = c.coefficients[1] ?? 0;
    return c.rhs - (a * x1 + b * x2);
  });

  const nonBasicDecVars = vertex.zeroDecisionVars;
  const nonBasicSlacks = vertex.tightConstraints;
  const basicDecVars = Array.from({ length: nDecVars }, (_, i) => i)
    .filter(i => !nonBasicDecVars.includes(i));
  const basicSlacks = Array.from({ length: nConstraints }, (_, i) => i)
    .filter(i => !nonBasicSlacks.includes(i));

  const basicLabels = [
    ...basicDecVars.map(i => ({ label: allDecLabels[i], value: decVarValues[i], color: null as string | null })),
    ...basicSlacks.map(i => ({ label: allSlackLabels[i], value: slackValues[i], color: colorFor(i) })),
  ];
  const nonBasicLabels = [
    ...nonBasicDecVars.map(i => ({ label: allDecLabels[i], value: 0 as number, color: null as string | null })),
    ...nonBasicSlacks.map(i => ({ label: allSlackLabels[i], value: 0 as number, color: colorFor(i) })),
  ];

  return (
    <div className="bg-card/40 border-2 border-orange-400/50 rounded-xl p-4 space-y-3 animate-fill-pop">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-orange-300 font-bold">
          Vertex at ({fmt(x1)}, {fmt(x2)})
        </p>
        <p className="text-[10px] text-muted-foreground italic">
          every vertex IS a basis
        </p>
      </div>

      {/* Which constraints are tight here — the "why" behind the basis */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">At this corner…</p>
        <ul className="text-[11px] space-y-1">
          {vertex.tightConstraints.map(i => {
            const c = draft.constraints[i];
            const color = colorFor(i);
            return (
              <li key={`tight-${i}`} className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>
                  <span className="font-semibold" style={{ color }}>C{i + 1}</span>
                  {c?.label && <span className="text-muted-foreground"> ({c.label})</span>}
                  {' '}is <span className="font-semibold text-foreground">tight</span> →
                  its slack <span className="font-mono font-semibold" style={{ color }}>s{i + 1}</span> = 0
                </span>
              </li>
            );
          })}
          {vertex.zeroDecisionVars.map(i => (
            <li key={`zero-${i}`} className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              <span>
                <span className="font-mono font-semibold text-primary">x{i + 1}</span>
                {' '}is on its axis → <span className="font-mono font-semibold text-primary">x{i + 1}</span> = 0
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Basic vs Non-basic split — the whole point of the panel */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-1.5">
            Basic (in solution)
          </p>
          <div className="space-y-1">
            {basicLabels.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">(none)</p>
            ) : basicLabels.map(({ label, value, color }) => (
              <div
                key={label}
                className="flex items-center justify-between px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/40 font-mono text-xs"
              >
                <span style={color ? { color } : { color: 'rgb(16, 185, 129)' }} className="font-semibold">
                  {label}
                </span>
                <span className="text-foreground tabular-nums">= {fmt(value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
            Non-basic (= 0)
          </p>
          <div className="space-y-1">
            {nonBasicLabels.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">(none)</p>
            ) : nonBasicLabels.map(({ label, color }) => (
              <div
                key={label}
                className="flex items-center justify-between px-2 py-1 rounded bg-muted/40 border border-border font-mono text-xs"
                style={color ? { borderColor: colorForFill(Number(label.slice(1)) - 1, 0.35) } : undefined}
              >
                <span style={color ? { color } : undefined} className="font-semibold text-muted-foreground">
                  {label}
                </span>
                <span className="text-muted-foreground tabular-nums">= 0</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed">
        The <span className="font-semibold not-italic">basis</span> is the set of variables
        {' '}that are &gt; 0 at this corner. Choosing a basis = choosing a vertex. In the
        {' '}next step we&apos;ll pull the matching columns out of the original problem to
        {' '}form the matrix <span className="font-mono font-semibold">B</span> — that matrix
        {' '}is what the whole sensitivity chapter is built on.
      </p>
    </div>
  );
}
