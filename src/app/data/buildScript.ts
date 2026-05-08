/**
 * buildScript.ts
 *
 * Auto-generates a TutorialScript for any WordProblem when a hand-authored
 * one (like TOY_FACTORY_SCRIPT) does not exist for it.
 *
 * Stage 1 — formulation phase only.
 *
 * Generates Phase 1 questions (variables, objective sense, objective
 * coefficients, per-constraint label / coefficients / operator / RHS) from
 * the problem definition. Phases 2–6 are intentionally NOT generated yet —
 * the walkthrough ends after formulation with a "remaining phases in
 * development" completion card. This is the deliberate Stage 1 cut.
 *
 * Pedagogical note: every question's `correct` value comes directly from
 * the problem dict. Accepted text answers include several lenient variants
 * of each description (full string, individual significant words, common
 * pluralizations) so a student typing "muffins" passes for a description
 * "muffins to bake per day". The grader normalizes by lowercasing and
 * stripping non-alphanumeric characters, so spaces / hyphens / case do
 * not matter.
 */

import type { WordProblem } from './wordProblems';
import type {
  Question,
  TutorialScript,
  PhaseMeta,
} from './tutorialScripts';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Render an x1 / x2 / x3 name with proper subscripts (x₁, x₂, x₃). */
function fmtVarName(name: string): string {
  const subs: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  };
  return name.replace(/(\d+)$/, (_, d: string) =>
    [...d].map(c => subs[c] ?? c).join(''),
  );
}

const STOPWORDS = new Set([
  'the', 'of', 'per', 'and', 'a', 'an', 'to', 'for', 'in',
  'on', 'at', 'by', 'with', 'from', 'as', 'each', 'or',
]);

/**
 * Generate a lenient list of accepted answers from a free-text description.
 * Mixes the full string, each significant word, the first 1–2 words, and
 * crude singular/plural variants. The matcher in GuidedLearnPage normalizes
 * by lowercasing + stripping non-alphanumerics, so case and spacing don't
 * have to be matched here.
 */
function generateAcceptedAnswers(description: string): string[] {
  const out = new Set<string>();
  const trimmed = description.trim();
  if (!trimmed) return [];
  out.add(trimmed);

  const words = trimmed
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w && !STOPWORDS.has(w));

  for (const w of words) {
    out.add(w);
    if (w.endsWith('s') && w.length > 3) out.add(w.slice(0, -1));
    else out.add(w + 's');
  }
  if (words.length >= 1) out.add(words[0]);
  if (words.length >= 2) out.add(words[0] + ' ' + words[1]);
  if (words.length >= 1) out.add(words[words.length - 1]);

  return [...out];
}

/** Map our '<=' | '>=' | '=' to the MC question option ids used by the framework. */
const OP_TO_ID: Record<'<=' | '>=' | '=', string> = {
  '<=': 'le',
  '>=': 'ge',
  '=': 'eq',
};

// ── Phase 1 builder ────────────────────────────────────────────────────────

function buildPhase1(problem: WordProblem): Question[] {
  const qs: Question[] = [];
  const vars = problem.variables;
  const n = vars.length;

  // 1a — Variable identification (one TextQuestion per variable)
  for (let i = 0; i < n; i++) {
    const v = vars[i];
    const xName = fmtVarName(v.name);
    qs.push({
      kind: 'text',
      id: `auto-var-${i}`,
      phase: 1,
      prompt: `What does ${xName} represent in this problem?`,
      placeholder: 'a short description',
      acceptedAnswers: generateAcceptedAnswers(v.description),
      hint: `Re-read the scenario — ${xName} is the count of ${v.description}.`,
      commit: { type: 'variable', index: i, name: v.name, description: v.description },
    });
  }

  // 1b — Objective sense
  qs.push({
    kind: 'mc',
    id: 'auto-obj-sense',
    phase: 1,
    prompt: 'Are we maximizing or minimizing the objective?',
    options: [
      { id: 'max', label: 'Maximize (more is better)' },
      { id: 'min', label: 'Minimize (less is better)' },
    ],
    correctId: problem.objectiveType,
    hint: `The problem asks us to ${
      problem.objectiveType === 'max' ? 'maximize' : 'minimize'
    } — re-read the objective sentence.`,
    commit: { type: 'objective', sense: problem.objectiveType },
    highlight: { target: 'objective-coefficients' },
  });

  // 1c — Objective coefficients (one NumberQuestion per variable)
  for (let i = 0; i < n; i++) {
    const v = vars[i];
    const c = problem.objectiveCoefficients[i];
    qs.push({
      kind: 'number',
      id: `auto-obj-c${i}`,
      phase: 1,
      prompt: `What is the objective coefficient of ${fmtVarName(v.name)} (the per-unit ${
        problem.objectiveType === 'max' ? 'profit' : 'cost'
      } of ${v.description})?`,
      placeholder: String(c),
      correct: c,
      tolerance: 1e-9,
      hint: `Look in the scenario for the per-unit ${
        problem.objectiveType === 'max' ? 'profit' : 'cost'
      } associated with ${v.description}.`,
      commit: { type: 'objective-coefficient', variableIndex: i, value: c },
    });
  }

  // 1d — Constraints, one full block (label, coefs, op, RHS) per constraint
  for (let ci = 0; ci < problem.constraints.length; ci++) {
    const c = problem.constraints[ci];
    const fallbackLabel = c.label || `Constraint ${ci + 1}`;

    qs.push({
      kind: 'text',
      id: `auto-c${ci}-label`,
      phase: 1,
      prompt: `Constraint ${ci + 1} — give it a short descriptive label.`,
      placeholder: 'a short label',
      acceptedAnswers: generateAcceptedAnswers(fallbackLabel),
      hint: `Something descriptive of the resource being limited — "${fallbackLabel}" works.`,
      commit: { type: 'constraint-started', constraintIndex: ci, label: fallbackLabel },
    });

    for (let vi = 0; vi < n; vi++) {
      qs.push({
        kind: 'number',
        id: `auto-c${ci}-coef${vi}`,
        phase: 1,
        prompt: `In constraint ${ci + 1}, what is the coefficient of ${fmtVarName(vars[vi].name)}?`,
        placeholder: String(c.coefficients[vi]),
        correct: c.coefficients[vi],
        tolerance: 1e-9,
        hint: `Each unit of ${vars[vi].description} contributes ${c.coefficients[vi]} to this constraint.`,
        commit: {
          type: 'constraint-coefficient',
          constraintIndex: ci,
          variableIndex: vi,
          value: c.coefficients[vi],
        },
        highlight: { target: 'constraint', constraintIndex: ci },
      });
    }

    qs.push({
      kind: 'mc',
      id: `auto-c${ci}-op`,
      phase: 1,
      prompt: `What's the operator for constraint ${ci + 1}?`,
      options: [
        { id: 'le', label: '≤ (at most)' },
        { id: 'ge', label: '≥ (at least)' },
        { id: 'eq', label: '= (exactly)' },
      ],
      correctId: OP_TO_ID[c.operator],
      hint: 'Pick the operator that matches the wording of the constraint.',
      commit: { type: 'constraint-operator', constraintIndex: ci, op: c.operator },
      highlight: { target: 'constraint-operators' },
    });

    qs.push({
      kind: 'number',
      id: `auto-c${ci}-rhs`,
      phase: 1,
      prompt: `What is the right-hand side value of constraint ${ci + 1}?`,
      placeholder: String(c.rhs),
      correct: c.rhs,
      tolerance: 1e-9,
      hint: `The RHS is the resource limit (or required amount). Look for "${
        c.operator === '<=' ? 'at most' : c.operator === '>=' ? 'at least' : 'exactly'
      }" wording in the scenario.`,
      commit: { type: 'constraint-rhs', constraintIndex: ci, value: c.rhs },
      highlight: { target: 'constraint-rhs' },
    });
  }

  return qs;
}

// ── Phase metadata (Phase 1 active, 2–6 stubbed as "in development") ───────

function phasesMeta(): PhaseMeta[] {
  return [
    {
      phase: 1,
      title: 'Formulate the LP',
      goal: 'Translate the word problem into decision variables, an objective, and constraints.',
      why: 'Formulation is the first step of every LP. Without it, no algorithm has anything to solve.',
      tool: 'Plain reading + structured question prompts.',
      wrap: 'Phase 1 complete — your LP is fully specified. The remaining phases (graph build, tableau setup, simplex pivots, matrix form, sensitivity) are in development for auto-generated walkthroughs and are not part of this run.',
    },
    {
      phase: 2,
      title: 'Graph the feasible region (in development)',
      goal: 'Draw each constraint line, pick the feasible side, find the optimum visually.',
      why: 'For 2-variable LPs, the graphical method makes the feasible region and optimum vertex tangible.',
      tool: 'Live graph with line-by-line construction.',
      wrap: 'In development.',
    },
    {
      phase: 3,
      title: 'Set up the simplex tableau (in development)',
      goal: 'Standardize the LP with slack variables; build the initial tableau.',
      why: 'The simplex method works on a tableau, not directly on the formulation.',
      tool: 'Tableau builder with slack / basis reveals.',
      wrap: 'In development.',
    },
    {
      phase: 4,
      title: 'Run the simplex pivots (in development)',
      goal: 'Pick the entering column, the leaving row; apply the pivot until optimal.',
      why: 'Simplex is the workhorse of LP. Each pivot is a step toward the optimum.',
      tool: 'Click-tableau interactions, ratio tests, post-pivot animations.',
      wrap: 'In development.',
    },
    {
      phase: 5,
      title: 'Read the matrix form (in development)',
      goal: 'Build B and B⁻¹ from the optimal tableau; identify C_B, C_N, x_B.',
      why: 'Matrix form is the bridge from solving the LP to analyzing it.',
      tool: 'Matrix-method gameboard.',
      wrap: 'In development.',
    },
    {
      phase: 6,
      title: 'Sensitivity analysis (in development)',
      goal: 'Compute shadow prices, allowable RHS ranges, allowable c-ranges.',
      why: 'Sensitivity tells us what each unit of resource is worth at the margin.',
      tool: 'Live sensitivity report + perturbation sliders.',
      wrap: 'In development.',
    },
  ];
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a TutorialScript for any WordProblem when no hand-authored
 * script exists. Stage 1 — Phase 1 (formulation) only; phases 2–6 are
 * present in metadata as "in development" stubs but contain no questions.
 *
 * The generated script's id is prefixed with `auto-` so the rendering
 * code can detect it and show a "Phase 1 done; remainder in development"
 * completion card instead of the toy-factory specific celebration.
 */
export function buildScript(problem: WordProblem): TutorialScript {
  return {
    id: `auto-${problem.id}`,
    problemId: problem.id,
    title: `${problem.title} — formulation walkthrough`,
    questions: buildPhase1(problem),
    phasesMeta: phasesMeta(),
  };
}
