/**
 * ConstraintMeters — each constraint drawn as two contrasting segments.
 *
 *   ┌──────────────┬──────────────────────────────────────┐
 *   │ used  0      │    unused  (s₁)  80                  │
 *   └──────────────┴──────────────────────────────────────┘
 *   0 ─────────────────────────────────── capacity 80
 *
 * The point is that BOTH segments are visible and labeled with their
 * number, so the student can read "how much used vs how much unused"
 * off the bar at a glance. At the origin the used segment is a thin
 * anchor on the left and the unused segment fills the rest with "80"
 * printed inside it — so slack is not a stripe, it's the thing that
 * occupies most of the bar with its own value on display.
 *
 * When production grows, the divider moves right, the bright "used"
 * segment gets bigger, and the dim "unused (slack)" segment shrinks
 * proportionally. When a constraint becomes binding, the slack side
 * disappears and the whole bar lights up with "binding — s_i = 0".
 */

import { LPDraft } from './guidedTypes';
import { colorFor, colorForFill } from './constraintColors';
import type { QuestionHighlight } from '../../data/tutorialScripts';

interface Props {
  draft: LPDraft;
  bfs: Record<string, number>;
  highlight?: QuestionHighlight | null;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export default function ConstraintMeters({ draft, bfs, highlight }: Props) {
  const x1 = bfs['x1'] ?? 0;
  const x2 = bfs['x2'] ?? 0;

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
        const empty = used < 1e-9;

        const pulseMeter =
          highlight?.target === 'meter' && highlight.constraintIndex === idx;
        const pulseTail =
          (highlight?.target === 'meter-tail' && highlight.constraintIndex === idx) ||
          highlight?.target === 'meter-tails-all';

        // Two segments so each has its own label visible inside it; the
        // widths track used/slack. Text fades when segment is too narrow.
        const usedSegmentStyle = {
          width: `${usedFrac * 100}%`,
          backgroundColor: color,
        };
        const slackSegmentStyle = {
          width: `${slackFrac * 100}%`,
          backgroundColor: colorForFill(idx, 0.22),
        };

        return (
          <div
            key={idx}
            className={`bg-card/40 border rounded-xl p-3 space-y-2${pulseMeter ? ' animate-attention-pulse' : ''}`}
            style={{ borderColor: colorForFill(idx, 0.45) }}
          >
            {/* Header */}
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
                total capacity <span className="text-foreground font-semibold">{fmt(rhs)}</span>
              </span>
            </div>

            {/* The two-segment bar */}
            <div className="relative h-10 rounded-md overflow-hidden border border-border/60 flex">
              {/* Used segment — bright solid color, value printed inside */}
              <div
                className="relative flex items-center justify-center transition-all duration-500"
                style={usedSegmentStyle}
                aria-label={`used ${fmt(used)} of ${fmt(rhs)}`}
              >
                {usedFrac > 0.12 && (
                  <span className="text-[11px] font-bold text-white tabular-nums drop-shadow">
                    used {fmt(used)}
                  </span>
                )}
              </div>

              {/* Unused (slack) segment — muted same-hue color, value printed inside */}
              <div
                className={`relative flex items-center justify-center transition-all duration-500${pulseTail ? ' animate-attention-pulse' : ''}`}
                style={slackSegmentStyle}
                aria-label={`unused (slack s${idx + 1}) ${fmt(slack)}`}
              >
                {slackFrac > 0.18 && (
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color }}
                  >
                    unused (s{idx + 1}) = {fmt(slack)}
                  </span>
                )}
              </div>

              {/* Divider marker between used and slack */}
              {!binding && !empty && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 pointer-events-none"
                  style={{ left: `${usedFrac * 100}%` }}
                />
              )}
            </div>

            {/* Scale row (0 ─── capacity) + current numeric readout */}
            <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
              <span className="text-muted-foreground">0</span>
              <span className="text-muted-foreground">
                {a !== 0 || b !== 0 ? (
                  <span>
                    <span className="text-foreground/80">used = </span>
                    {fmt(a)}·x₁ + {fmt(b)}·x₂ = {fmt(a * x1)} + {fmt(b * x2)} ={' '}
                    <span className="text-foreground font-semibold">{fmt(used)}</span>
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground">{fmt(rhs)}</span>
            </div>

            {/* Binding badge when the constraint is tight */}
            {binding && (
              <div
                className={`text-center text-[11px] font-bold py-1 rounded animate-fill-pop${pulseTail ? ' animate-attention-pulse' : ''}`}
                style={{
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                }}
              >
                BINDING — s{idx + 1} = 0 (all {fmt(rhs)} hours used)
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed pt-1">
        Each bar has two pieces: the bright side is what&apos;s being
        <span className="font-semibold not-italic"> used</span>, the muted side is what&apos;s left
        <span className="font-semibold not-italic"> unused</span>. The unused side is the slack
        variable s<span className="align-sub text-[8px]">i</span>. Together they always add to
        the total capacity.
      </p>
    </div>
  );
}
