/**
 * HighlightedScenario.tsx
 * =======================
 * Renders word problem text with colored highlights that correspond to the
 * current formulation step. As the student moves through vars → objective →
 * constraints, the relevant portions of the scenario text light up so they
 * can see WHERE in the problem each piece of the formulation comes from.
 */

import { ScenarioHighlights } from '../data/wordProblems';

/** Which highlights are currently active. */
export interface ActiveHighlights {
  vars?: boolean;
  objective?: boolean;
  /** Index of the constraint currently being worked on, or 'all' to show all. */
  constraintIdx?: number | 'all';
}

interface Props {
  scenario: string;
  highlights?: ScenarioHighlights;
  active: ActiveHighlights;
}

// Constraint colors cycle through these
const CONSTRAINT_COLORS = [
  'bg-emerald-200 text-emerald-900',  // C1
  'bg-amber-200 text-amber-900',      // C2
  'bg-rose-200 text-rose-900',        // C3
  'bg-sky-200 text-sky-900',          // C4
  'bg-violet-200 text-violet-900',    // C5
];

const VARS_COLOR = 'bg-indigo-200 text-indigo-900';
const OBJ_COLOR = 'bg-purple-200 text-purple-900';

interface Span {
  start: number;
  end: number;
  cls: string;
  label?: string;
}

export default function HighlightedScenario({ scenario, highlights, active }: Props) {
  if (!highlights) {
    // No highlights defined — render plain text
    return <p className="text-sm text-gray-800 leading-relaxed">{scenario}</p>;
  }

  // Collect all active spans
  const spans: Span[] = [];

  if (active.vars) {
    for (const sub of highlights.vars) {
      findAllOccurrences(scenario, sub).forEach(start => {
        spans.push({ start, end: start + sub.length, cls: VARS_COLOR });
      });
    }
  }

  if (active.objective) {
    for (const sub of highlights.objective) {
      findAllOccurrences(scenario, sub).forEach(start => {
        spans.push({ start, end: start + sub.length, cls: OBJ_COLOR });
      });
    }
  }

  if (active.constraintIdx !== undefined) {
    const indices = active.constraintIdx === 'all'
      ? highlights.constraints.map((_, i) => i)
      : [active.constraintIdx];

    for (const ci of indices) {
      const subs = highlights.constraints[ci];
      if (!subs) continue;
      const color = CONSTRAINT_COLORS[ci % CONSTRAINT_COLORS.length];
      for (const sub of subs) {
        findAllOccurrences(scenario, sub).forEach(start => {
          spans.push({ start, end: start + sub.length, cls: color, label: `C${ci + 1}` });
        });
      }
    }
  }

  // Sort by start position, then by length (longer first to handle overlaps)
  spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Remove overlapping spans (keep first/longest)
  const merged: Span[] = [];
  let lastEnd = -1;
  for (const span of spans) {
    if (span.start >= lastEnd) {
      merged.push(span);
      lastEnd = span.end;
    }
  }

  // Build React elements
  const elements: React.ReactNode[] = [];
  let pos = 0;

  for (const span of merged) {
    // Text before this highlight
    if (span.start > pos) {
      elements.push(scenario.slice(pos, span.start));
    }
    // Highlighted span
    elements.push(
      <mark
        key={`${span.start}-${span.end}`}
        className={`${span.cls} rounded px-0.5 font-medium`}
      >
        {scenario.slice(span.start, span.end)}
      </mark>
    );
    pos = span.end;
  }

  // Remaining text
  if (pos < scenario.length) {
    elements.push(scenario.slice(pos));
  }

  return <p className="text-sm text-gray-800 leading-relaxed">{elements}</p>;
}

/** Find all occurrences of `sub` in `text` (case-sensitive). */
function findAllOccurrences(text: string, sub: string): number[] {
  const results: number[] = [];
  let idx = text.indexOf(sub);
  while (idx !== -1) {
    results.push(idx);
    idx = text.indexOf(sub, idx + 1);
  }
  return results;
}
