/**
 * VertexBasisPanel — the "basis gameboard" for Phase 6.
 *
 * Same pattern as the Phase 3 tableau: start with empty "?" slots and
 * fill them only when the student has EARNED each reveal by answering
 * a question correctly. The panel does NOT spoil the answer by showing
 * the basis as soon as a vertex is clicked.
 *
 * What the panel shows at each stage:
 *   - Before any vertex is clicked: "click a corner to begin".
 *   - After a vertex is clicked (but no basis revealed yet): the vertex
 *     coordinates and which constraints are tight / which decision vars
 *     are on an axis. These are OBSERVATIONS the student can make from
 *     the graph — they aren't the answer yet.
 *   - Once a 'basis-identified' reveal key is set for the chosen vertex,
 *     the Basic / Non-basic lists fill in.
 *
 * Reveal key shape: 'basis-{x},{y}' — unique per vertex so the student
 * has to re-earn the reveal if they jump to a different corner.
 */

import { FeasibleVertex } from './DiscoveryGraph';
import { LPDraft } from './guidedTypes';
import { colorFor } from './constraintColors';

interface Props {
  draft: LPDraft;
  vertex: FeasibleVertex | null;
  nDecVars: number;
  /** Set of reveal keys that have been earned via correct answers. */
  reveals: Set<string>;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

function revealKeyFor(vertex: FeasibleVertex): string {
  return `basis-${Math.round(vertex.x * 100) / 100},${Math.round(vertex.y * 100) / 100}`;
}

/** Exported so Phase 6 script / answer handlers can form the key when
 *  committing a reveal for the currently clicked vertex. */
export function basisRevealKey(x: number, y: number): string {
  return `basis-${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
}

export default function VertexBasisPanel({ draft, vertex, nDecVars, reveals }: Props) {
  if (!vertex) {
    return (
      <div className="bg-card/40 border border-dashed border-border/60 rounded-xl p-4 text-center">
        <p className="text-[11px] text-muted-foreground italic">
          Click any corner of the feasible region on the graph — each corner is a
          {' '}<span className="font-semibold not-italic">basis</span>.
        </p>
      </div>
    );
  }

  const nConstraints = draft.constraints.length;
  const allDecLabels = Array.from({ length: nDecVars }, (_, i) => `x${i + 1}`);
  const allSlackLabels = Array.from({ length: nConstraints }, (_, i) => `s${i + 1}`);

  const x1 = vertex.x;
  const x2 = vertex.y;

  const basicRevealed = reveals.has(`basis-basic-${revealKeyFor(vertex).slice(6)}`);
  const nonBasicRevealed = reveals.has(`basis-nonbasic-${revealKeyFor(vertex).slice(6)}`);

  const nonBasicDecVars = vertex.zeroDecisionVars;
  const nonBasicSlacks = vertex.tightConstraints;
  const basicDecVars = Array.from({ length: nDecVars }, (_, i) => i)
    .filter(i => !nonBasicDecVars.includes(i));
  const basicSlacks = Array.from({ length: nConstraints }, (_, i) => i)
    .filter(i => !nonBasicSlacks.includes(i));

  const basicLabels = basicRevealed
    ? [
        ...basicDecVars.map(i => ({ label: allDecLabels[i], color: null as string | null })),
        ...basicSlacks.map(i => ({ label: allSlackLabels[i], color: colorFor(i) })),
      ]
    : null;
  const nonBasicLabels = nonBasicRevealed
    ? [
        ...nonBasicDecVars.map(i => ({ label: allDecLabels[i], color: null as string | null })),
        ...nonBasicSlacks.map(i => ({ label: allSlackLabels[i], color: colorFor(i) })),
      ]
    : null;

  // Number of slots to show as "?" when not revealed. The basis has size
  // equal to the number of constraints; so does the non-basic set's size
  // relative to total vars.
  const basisSize = nConstraints;
  const totalVars = nDecVars + nConstraints;
  const nonBasicSize = totalVars - basisSize;

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

      {/* Observations the student can make directly from the graph — these
          are cues, not answers. The basis below still needs to be earned. */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">At this corner you can see…</p>
        <ul className="text-[11px] space-y-1">
          {vertex.tightConstraints.map(i => {
            const c = draft.constraints[i];
            const color = colorFor(i);
            return (
              <li key={`tight-${i}`} className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span>
                  <span className="font-semibold" style={{ color }}>C{i + 1}</span>
                  {c?.label && <span className="text-muted-foreground"> ({c.label})</span>}
                  {' '}is tight (the point is ON that line)
                </span>
              </li>
            );
          })}
          {vertex.zeroDecisionVars.map(i => (
            <li key={`zero-${i}`} className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              <span>
                <span className="font-mono font-semibold text-primary">x{i + 1}</span>
                {' '}= 0 (the point is on its axis)
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Basic vs Non-basic split — slots are "?" until revealed */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-1.5">
            Basic (in solution)
          </p>
          <div className="space-y-1">
            {basicLabels
              ? basicLabels.map(({ label, color }) => (
                  <div
                    key={label}
                    className="flex items-center px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/40 font-mono text-xs animate-fill-pop"
                  >
                    <span style={color ? { color } : { color: 'rgb(16, 185, 129)' }} className="font-semibold">
                      {label}
                    </span>
                  </div>
                ))
              : Array.from({ length: basisSize }, (_, i) => (
                  <div
                    key={`unk-${i}`}
                    className="flex items-center justify-center px-2 py-1 rounded bg-muted/20 border-2 border-dashed border-border/60 font-mono text-xs text-muted-foreground/50"
                  >
                    ?
                  </div>
                ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
            Non-basic (= 0)
          </p>
          <div className="space-y-1">
            {nonBasicLabels
              ? nonBasicLabels.map(({ label, color }) => (
                  <div
                    key={label}
                    className="flex items-center px-2 py-1 rounded bg-muted/40 border border-border font-mono text-xs animate-fill-pop"
                  >
                    <span style={color ? { color } : undefined} className="font-semibold text-muted-foreground">
                      {label}
                    </span>
                  </div>
                ))
              : Array.from({ length: nonBasicSize }, (_, i) => (
                  <div
                    key={`unk-${i}`}
                    className="flex items-center justify-center px-2 py-1 rounded bg-muted/20 border-2 border-dashed border-border/60 font-mono text-xs text-muted-foreground/50"
                  >
                    ?
                  </div>
                ))}
          </div>
        </div>
      </div>

      {(!basicRevealed || !nonBasicRevealed) && (
        <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed">
          The slots will fill in once you identify the basis. Use the clues above —
          which variables must be 0 here (non-basic) and which are &gt; 0 (basic)?
        </p>
      )}
    </div>
  );
}
