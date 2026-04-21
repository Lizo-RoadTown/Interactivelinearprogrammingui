/**
 * tutorialScripts.ts
 *
 * Prescripted homework-style question sequences that walk a student through
 * an LP problem from blank canvas to optimal solution with sensitivity
 * insights. One script per problem for now; professor-authorable later.
 *
 * Pedagogical principle: the script IS the pedagogy. The student sees ONE
 * active question. As they answer, their answer populates the canvas
 * (formulation text, graph lines, tableau cells, ...). Previous answered
 * questions stay visible above the current one as accumulated homework work.
 * Nothing appears on the canvas except as the result of a student answer.
 */

// ── Question input shapes ────────────────────────────────────────────────────

/** Free-text answer, graded by normalized-string comparison against accepted forms. */
export interface TextQuestion {
  kind: 'text';
  id: string;
  phase: number;
  prompt: string;
  placeholder?: string;
  /** Accepted answers (case-insensitive, trimmed). */
  acceptedAnswers: string[];
  /** Shown below the prompt when the student gets it wrong. */
  hint: string;
  /** What this answer adds to the canvas. */
  commit: CommitPayload;
}

/** Fill-in-the-number question, graded with numeric tolerance. */
export interface NumberQuestion {
  kind: 'number';
  id: string;
  phase: number;
  prompt: string;
  placeholder?: string;
  correct: number;
  /** Absolute tolerance. Defaults to 1e-6 for exact, use 0.01 or similar for student precision. */
  tolerance?: number;
  hint: string;
  commit: CommitPayload;
}

/** Multiple choice question, correctness keyed by option id. */
export interface MCQuestion {
  kind: 'mc';
  id: string;
  phase: number;
  prompt: string;
  options: { id: string; label: string }[];
  correctId: string;
  /** Per-wrong-option hint, keyed by option id. Generic fallback in `hint`. */
  hint: string;
  hintPerOption?: Record<string, string>;
  commit: CommitPayload;
}

/** Composite: several numeric fields on one question (e.g., objective coefficients). */
export interface FieldsQuestion {
  kind: 'fields';
  id: string;
  phase: number;
  prompt: string;
  fields: { id: string; label: string; correct: number; tolerance?: number; placeholder?: string }[];
  hint: string;
  commit: CommitPayload;
}

export type Question = TextQuestion | NumberQuestion | MCQuestion | FieldsQuestion;

/**
 * When a question is answered correctly, this commit describes what to
 * materialize on the canvas. The renderer reads the accumulated commits
 * and draws the appropriate marks.
 */
export type CommitPayload =
  | { type: 'variable'; index: number; name: string; description: string }
  | { type: 'objective'; sense: 'max' | 'min' }
  | { type: 'objective-coefficient'; variableIndex: number; value: number }
  | { type: 'constraint-started'; constraintIndex: number; label: string }
  | { type: 'constraint-coefficient'; constraintIndex: number; variableIndex: number; value: number }
  | { type: 'constraint-operator'; constraintIndex: number; op: '<=' | '>=' | '=' }
  | { type: 'constraint-rhs'; constraintIndex: number; value: number }
  | { type: 'note'; text: string };  // free-form annotation on the canvas

export interface TutorialScript {
  id: string;
  problemId: string;  // which WordProblem this script is for
  title: string;
  questions: Question[];
}

// ── Toy Factory — formulation phase (Phase 1) ────────────────────────────────
//
// Walks the student from the word problem to a complete LP formulation.
// End state after this phase: decision variables named and described,
// objective type + coefficients committed, both constraints fully
// specified. Next phase (graph construction) is a separate script chunk.

const TOY_FACTORY_PHASE1: Question[] = [

  // ── Decision variables ────────────────────────────────────────────────────
  {
    kind: 'text',
    id: 'toy-var-1',
    phase: 1,
    prompt: 'The toy company makes two products. Let x₁ be a count of one product. Which product is x₁?',
    placeholder: 'e.g. cars',
    acceptedAnswers: ['cars', 'toy cars', 'car', 'toy car'],
    hint: 'Read the problem again — the two products are toy cars and toy trucks. Pick one of them for x₁.',
    commit: { type: 'variable', index: 0, name: 'x1', description: 'toy cars produced per week' },
  },
  {
    kind: 'text',
    id: 'toy-var-2',
    phase: 1,
    prompt: 'And x₂ is a count of the other product. What does x₂ represent?',
    placeholder: 'e.g. trucks',
    acceptedAnswers: ['trucks', 'toy trucks', 'truck', 'toy truck'],
    hint: 'The other product in the problem — toy trucks.',
    commit: { type: 'variable', index: 1, name: 'x2', description: 'toy trucks produced per week' },
  },

  // ── Objective sense + coefficients ────────────────────────────────────────
  {
    kind: 'mc',
    id: 'toy-obj-sense',
    phase: 1,
    prompt: 'The problem asks about profit. Are we maximizing or minimizing?',
    options: [
      { id: 'max', label: 'Maximize (more is better)' },
      { id: 'min', label: 'Minimize (less is better)' },
    ],
    correctId: 'max',
    hint: 'The problem says "maximize total profit" — we want as much profit as possible.',
    hintPerOption: {
      min: 'Not quite. The problem says "maximize total profit." Minimization would apply if we were trying to cut costs, not grow profit.',
    },
    commit: { type: 'objective', sense: 'max' },
  },
  {
    kind: 'number',
    id: 'toy-obj-c1',
    phase: 1,
    prompt: 'Profit per toy car is how many dollars? (This is the coefficient of x₁ in the objective.)',
    placeholder: 'e.g. 15',
    correct: 15,
    tolerance: 1e-9,
    hint: 'Re-read the problem — "The profit is $15 per toy car…"',
    commit: { type: 'objective-coefficient', variableIndex: 0, value: 15 },
  },
  {
    kind: 'number',
    id: 'toy-obj-c2',
    phase: 1,
    prompt: 'And profit per toy truck? (Coefficient of x₂.)',
    placeholder: 'e.g. 20',
    correct: 20,
    tolerance: 1e-9,
    hint: '"…and $20 per toy truck."',
    commit: { type: 'objective-coefficient', variableIndex: 1, value: 20 },
  },

  // ── Constraint 1: assembly hours ──────────────────────────────────────────
  {
    kind: 'text',
    id: 'toy-c1-label',
    phase: 1,
    prompt: 'The factory has two resources to track. The first resource mentioned is "assembly time / hours." We\'ll call this constraint 1. What should we label it?',
    placeholder: 'e.g. assembly hours',
    acceptedAnswers: [
      'assembly', 'assembly hours', 'assembly time', 'hours of assembly',
      'assembly hrs', 'assembly h',
    ],
    hint: 'Short descriptive label — "assembly hours" works well.',
    commit: { type: 'constraint-started', constraintIndex: 0, label: 'Assembly hours' },
  },
  {
    kind: 'fields',
    id: 'toy-c1-coefs',
    phase: 1,
    prompt: 'Each toy car needs 2 hours of assembly; each toy truck needs 4. Fill in the coefficients for constraint 1.',
    fields: [
      { id: 'a', label: 'x₁ coefficient', correct: 2, placeholder: '2' },
      { id: 'b', label: 'x₂ coefficient', correct: 4, placeholder: '4' },
    ],
    hint: 'Each toy car is 2 assembly hours, each toy truck is 4. So: 2·x₁ + 4·x₂.',
    commit: { type: 'note', text: 'c1-coefs-set' }, // placeholder; see processAnswer
  },
  {
    kind: 'mc',
    id: 'toy-c1-op',
    phase: 1,
    prompt: 'Assembly hours used must not exceed what\'s available. Which operator?',
    options: [
      { id: 'le', label: '≤ (at most)' },
      { id: 'ge', label: '≥ (at least)' },
      { id: 'eq', label: '= (exactly)' },
    ],
    correctId: 'le',
    hint: 'The factory has 80 assembly hours total. Using MORE than that is impossible — so "at most," which is ≤.',
    commit: { type: 'constraint-operator', constraintIndex: 0, op: '<=' },
  },
  {
    kind: 'number',
    id: 'toy-c1-rhs',
    phase: 1,
    prompt: 'How many total assembly hours are available each week?',
    placeholder: 'e.g. 80',
    correct: 80,
    hint: 'The problem says "80 hours of assembly time."',
    commit: { type: 'constraint-rhs', constraintIndex: 0, value: 80 },
  },

  // ── Constraint 2: painting hours ──────────────────────────────────────────
  {
    kind: 'text',
    id: 'toy-c2-label',
    phase: 1,
    prompt: 'The second resource is painting time. Label this constraint.',
    placeholder: 'e.g. painting hours',
    acceptedAnswers: ['painting', 'painting hours', 'painting time', 'paint', 'paint hours'],
    hint: 'Short label — "painting hours" works.',
    commit: { type: 'constraint-started', constraintIndex: 1, label: 'Painting hours' },
  },
  {
    kind: 'fields',
    id: 'toy-c2-coefs',
    phase: 1,
    prompt: 'Each toy car needs 3 hours of painting; each toy truck needs 2. Fill in the coefficients.',
    fields: [
      { id: 'a', label: 'x₁ coefficient', correct: 3, placeholder: '3' },
      { id: 'b', label: 'x₂ coefficient', correct: 2, placeholder: '2' },
    ],
    hint: '3 hours of painting per car, 2 per truck. 3·x₁ + 2·x₂.',
    commit: { type: 'note', text: 'c2-coefs-set' },
  },
  {
    kind: 'mc',
    id: 'toy-c2-op',
    phase: 1,
    prompt: 'Painting hours used ≤ hours available. Which operator?',
    options: [
      { id: 'le', label: '≤ (at most)' },
      { id: 'ge', label: '≥ (at least)' },
      { id: 'eq', label: '= (exactly)' },
    ],
    correctId: 'le',
    hint: 'Same pattern as the assembly constraint — we can\'t use more than available.',
    commit: { type: 'constraint-operator', constraintIndex: 1, op: '<=' },
  },
  {
    kind: 'number',
    id: 'toy-c2-rhs',
    phase: 1,
    prompt: 'How many painting hours are available?',
    placeholder: 'e.g. 60',
    correct: 60,
    hint: '"60 hours of painting time."',
    commit: { type: 'constraint-rhs', constraintIndex: 1, value: 60 },
  },
];

export const TOY_FACTORY_SCRIPT: TutorialScript = {
  id: 'script-toy-factory-v1',
  problemId: 'wp-toy-factory',
  title: 'Toy Factory — guided walkthrough',
  questions: TOY_FACTORY_PHASE1,  // phases 2+ appended as scripts are extended
};

export const TUTORIAL_SCRIPTS: TutorialScript[] = [
  TOY_FACTORY_SCRIPT,
];

export function getScript(problemId: string): TutorialScript | undefined {
  return TUTORIAL_SCRIPTS.find(s => s.problemId === problemId);
}
