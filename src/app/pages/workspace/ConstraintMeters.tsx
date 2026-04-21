/**
 * ConstraintMeters — each constraint as a "bucket" of resource.
 *
 * For every constraint the student has built so far, we draw a
 * horizontal capacity bar. The filled portion is the resource USED by
 * the current (x₁, x₂) choice. The tail is the UNUSED portion — that
 * unused amount IS the slack variable sᵢ.
 *
 * The point of this panel is to make the slack variable concrete
 * before it appears as an abstract identity column in the tableau.
 * When the student later sees "in row C1, the coefficients (s₁, s₂)
 * are (1, 0)", they have already seen that s₁ lives inside C1's
 * capacity bucket and that s₂ is the unused tail of a DIFFERENT
 * bucket — the identity pattern becomes a visible fact, not a rule.
 *
 * The meter also shows s₁ = 0 when C1's bucket is completely filled
 * (constraint is tight / binding). That matches what the student
 * will see on the graph: the current point landing ON a constraint
 * line means its slack is zero.
 */

import { LPDraft } from './guidedTypes';
import { colorFor, colorForFill } from './constraintColors';

interface Props {
  draft: LPDraft;
  /**
   * Current basic feasible point. For the initial tableau this is the
   * origin {x1:0, x2:0}; after each pivot it becomes the new BFS.
   * Keys are variable names ("x1", "x2", "s1", ...).
   */
  bfs: Record<string, number>;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export default function ConstraintMeters({ draft, bfs }: Props) {
  const x1 = bfs['x1'] ?? 0;
  const x2 = bfs['x2'] ?? 0;

  // Only render meters for constraints that have all their pieces set
  const ready = draft.constraints
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) =>
      c.started && c.rhs != null &&
      c.coefficients.every(v => v != null),
    );

  if (ready.length === 0) return null;

  return (
    <div className="space-y-3">
      {ready.map(({ c, idx }) => {
        const a = c.coefficients[0] as number;
        const b = c.coefficients[1] as number;
        const rhs = c.rhs as number;
        const used = a * x1 + b * x2;
        const slack = Math.max(0, rhs - used);
        const usedFrac = Math.min(1, Math.max(0, used / rhs));
        const slackFrac = 1 - usedFrac;
        const color = colorFor(idx);
        const binding = Math.abs(slack) < 1e-6;

        return (
          <div
            key={idx}
            className="bg-card/40 border rounded-xl p-3 space-y-2"
            style={{ borderColor: colorForFill(idx, 0.45) }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-[10px] uppercase tracking-wider font-bold"
                  style={{ color }}
                >
                  C{idx + 1}
                </span>
                {c.label && (
                  <span className="text-xs text-foreground/90 font-medium">{c.label}</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                capacity {fmt(rhs)}
              </span>
            </div>

            {/* The bucket bar */}
            <div className="relative h-7 rounded-md overflow-hidden border border-border/60 bg-muted/40">
              {/* Used portion */}
              <div
                className="absolute top-0 bottom-0 left-0 transition-all duration-500"
                style={{
                  width: `${usedFrac * 100}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                }}
              />
              {/* Slack portion — hatched / subtler so it reads as "empty" */}
              <div
                className="absolute top-0 bottom-0 transition-all duration-500"
                style={{
                  left: `${usedFrac * 100}%`,
                  width: `${slackFrac * 100}%`,
                  backgroundImage:
                    `repeating-linear-gradient(135deg, ${colorForFill(idx, 0.22)} 0, ${colorForFill(idx, 0.22)} 4px, transparent 4px, transparent 8px)`,
                }}
              />
              {/* Divider line between used and slack */}
              {!binding && slackFrac > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-foreground/40"
                  style={{ left: `${usedFrac * 100}%` }}
                />
              )}
            </div>

            {/* Caption: what's used, what's left over (=slack) */}
            <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
              <span className="text-muted-foreground">
                used: <span className="text-foreground font-semibold">{fmt(used)}</span>
                {a !== 0 || b !== 0 ? (
                  <span className="text-muted-foreground/70">
                    {' '}= {fmt(a)}·x₁ + {fmt(b)}·x₂ = {fmt(a * x1)} + {fmt(b * x2)}
                  </span>
                ) : null}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-bold ${binding ? 'animate-fill-pop' : ''}`}
                style={{
                  color: binding ? '#10b981' : color,
                  backgroundColor: binding ? 'rgba(16, 185, 129, 0.15)' : colorForFill(idx, 0.15),
                  border: `1px solid ${binding ? 'rgba(16, 185, 129, 0.45)' : colorForFill(idx, 0.45)}`,
                }}
              >
                s{idx + 1} = {fmt(slack)}
                {binding && <span className="ml-1 text-[9px] uppercase tracking-wider">binding</span>}
              </span>
            </div>
          </div>
        );
      })}

      <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed pt-1">
        The striped tail of each bar is the <span className="font-semibold not-italic">unused</span> capacity —
        that tail is the slack variable s<span className="align-sub text-[8px]">i</span>. When a bar fills
        completely the constraint is <span className="font-semibold not-italic">binding</span> and
        s<span className="align-sub text-[8px]">i</span> = 0.
      </p>
    </div>
  );
}
