/**
 * ConstraintMeter — one constraint rendered as a two-segment bar.
 *
 *   ┌──────────────┬──────────────────────────────────────┐
 *   │ used  0      │    unused  (s₁)  80                  │
 *   └──────────────┴──────────────────────────────────────┘
 *   0 ─────────────────────────────────── capacity 80
 *
 * Both segments are visible and labeled with their number, so the
 * student can read "how much used vs how much unused" off the bar at
 * a glance. At the origin the unused side fills the whole bar with
 * "80" printed inside it — so slack is the thing that occupies the
 * bar with its own value on display, not an absent quantity.
 *
 * This component is now per-constraint so it can be embedded INLINE
 * under each constraint row in the formulation card. The old grouped
 * wrapper was keeping the meter disconnected from the equation it
 * was visualizing.
 */

import { colorFor, colorForFill } from './constraintColors';
import type { QuestionHighlight } from '../../data/tutorialScripts';

interface SingleProps {
  /** 0-indexed constraint identity (drives color + s_i label). */
  constraintIndex: number;
  /** Decision-variable coefficients of this constraint. */
  coefficients: number[];
  /** Right-hand side (capacity). */
  rhs: number;
  /** Current basic feasible solution keyed by variable name. */
  bfs: Record<string, number>;
  /** Active question highlight, for pulse glow targeting this meter. */
  highlight?: QuestionHighlight | null;
  /** Omit the explanatory footnote — useful when rendered inline. */
  compact?: boolean;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export default function ConstraintMeter({
  constraintIndex, coefficients, rhs, bfs, highlight, compact = false,
}: SingleProps) {
  const idx = constraintIndex;
  const x1 = bfs['x1'] ?? 0;
  const x2 = bfs['x2'] ?? 0;
  const a = coefficients[0] ?? 0;
  const b = coefficients[1] ?? 0;
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

  return (
    <div
      className={`space-y-1.5${pulseMeter ? ' animate-attention-pulse' : ''}`}
    >
      {/* The two-segment bar */}
      <div className="relative h-9 rounded-md overflow-hidden border border-border/60 flex">
        {/* Used segment — bright solid color, value printed inside */}
        <div
          className="relative flex items-center justify-center transition-all duration-500"
          style={{ width: `${usedFrac * 100}%`, backgroundColor: color }}
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
          style={{ width: `${slackFrac * 100}%`, backgroundColor: colorForFill(idx, 0.22) }}
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

        {!binding && !empty && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 pointer-events-none"
            style={{ left: `${usedFrac * 100}%` }}
          />
        )}
      </div>

      {/* Scale row (0 ─── capacity) + numeric readout */}
      <div className="flex items-baseline justify-between gap-2 text-[10px] tabular-nums">
        <span className="text-muted-foreground">0</span>
        {(a !== 0 || b !== 0) && (
          <span className="text-muted-foreground">
            {fmt(a)}·x₁ + {fmt(b)}·x₂ = {fmt(a * x1)} + {fmt(b * x2)} ={' '}
            <span className="text-foreground font-semibold">{fmt(used)}</span>
          </span>
        )}
        <span className="text-muted-foreground">{fmt(rhs)}</span>
      </div>

      {/* Binding flag */}
      {binding && (
        <div
          className={`text-center text-[10px] font-bold py-0.5 rounded animate-fill-pop${pulseTail ? ' animate-attention-pulse' : ''}`}
          style={{
            color: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
          }}
        >
          BINDING — s{idx + 1} = 0 (all {fmt(rhs)} used)
        </div>
      )}

      {!compact && empty && (
        <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed">
          Bright side is <span className="font-semibold not-italic">used</span>; muted side is
          the <span className="font-semibold not-italic">unused</span> tail — that tail is s{idx + 1}.
        </p>
      )}
    </div>
  );
}
