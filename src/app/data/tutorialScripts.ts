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

/**
 * Interactive drag/slider question. The student moves a slider, watches
 * the graph respond live, and confirms when they think they've found
 * the target (e.g., the optimum z). Correctness = slider value within
 * tolerance of target at the moment they hit "Check."
 */
export interface DragQuestion {
  kind: 'drag';
  id: string;
  phase: number;
  prompt: string;
  /** What the slider controls — currently only 'objective-z' is supported. */
  knob: 'objective-z';
  min: number;
  max: number;
  step?: number;
  /** The value the student should settle on. */
  target: number;
  /** Absolute tolerance around target. Defaults to 0.5. */
  tolerance?: number;
  hint: string;
  commit: CommitPayload;
}

export type Question = TextQuestion | NumberQuestion | MCQuestion | FieldsQuestion | DragQuestion;

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
  // Phase 2 — graph build
  | { type: 'graph-line'; constraintIndex: number }      // reveal the line on the graph
  | { type: 'graph-side'; constraintIndex: number; side: 'below' | 'above' } // reveal which half-plane is feasible
  | { type: 'feasible-region-complete' }                  // all sides set → fill the intersection
  | { type: 'optimum-found'; zValue: number }             // student discovered the optimum via slider
  // Phase 3 — tableau setup
  | { type: 'slacks-added'; count: number }               // reveal slack columns in the tableau skeleton
  | { type: 'slack-identity-revealed' }                   // fill in s_i identity cells
  | { type: 'z-row-x-revealed' }                          // fill in Z-row decision var coefficients
  | { type: 'initial-basic-values-revealed' }             // fill in RHS column values for the basis
  | { type: 'initial-z-revealed' }                        // fill in Z-row RHS (0 at initial BFS)
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

// ── Toy Factory — graph build phase (Phase 2) ────────────────────────────────
//
// With the LP formulated, now draw it on a blank graph. One line per
// constraint, materialized when the student answers intercepts. Then
// pick the feasible side for each. The intersection shades into the
// feasible region. No objective line yet — that's the discovery moment
// in the next phase.

const TOY_FACTORY_PHASE2: Question[] = [

  // ── Constraint 1: assembly — draw the line ────────────────────────────────
  {
    kind: 'number',
    id: 'toy-g-c1-x1int',
    phase: 2,
    prompt: 'Constraint 1 is 2x₁ + 4x₂ ≤ 80. To draw its line, find where it crosses the x₁-axis. Set x₂ = 0, then solve 2x₁ = 80. What is x₁?',
    placeholder: 'e.g. 40',
    correct: 40,
    hint: 'Set x₂ = 0 in 2x₁ + 4x₂ = 80 → 2x₁ = 80 → x₁ = ?',
    commit: { type: 'note', text: 'c1-x1int' }, // commit handled by-id below
  },
  {
    kind: 'number',
    id: 'toy-g-c1-x2int',
    phase: 2,
    prompt: 'And where does it cross the x₂-axis? Set x₁ = 0 in 2x₁ + 4x₂ = 80.',
    placeholder: 'e.g. 20',
    correct: 20,
    hint: '4x₂ = 80 → x₂ = ?',
    commit: { type: 'graph-line', constraintIndex: 0 },
  },
  {
    kind: 'mc',
    id: 'toy-g-c1-side',
    phase: 2,
    prompt: 'C1 says 2x₁ + 4x₂ ≤ 80 — which side of the line satisfies the constraint?',
    options: [
      { id: 'below', label: 'The side containing (0,0) — the origin' },
      { id: 'above', label: 'The side away from the origin' },
    ],
    correctId: 'below',
    hint: 'Quick test: plug (0,0) in. 2·0 + 4·0 = 0. Is 0 ≤ 80? Yes — so the origin side is feasible.',
    commit: { type: 'graph-side', constraintIndex: 0, side: 'below' },
  },

  // ── Constraint 2: painting — draw the line ────────────────────────────────
  {
    kind: 'number',
    id: 'toy-g-c2-x1int',
    phase: 2,
    prompt: 'Now constraint 2 is 3x₁ + 2x₂ ≤ 60. Where does it cross the x₁-axis?',
    placeholder: 'e.g. 20',
    correct: 20,
    hint: 'Set x₂ = 0 → 3x₁ = 60 → x₁ = ?',
    commit: { type: 'note', text: 'c2-x1int' },
  },
  {
    kind: 'number',
    id: 'toy-g-c2-x2int',
    phase: 2,
    prompt: 'And where does C2 cross the x₂-axis?',
    placeholder: 'e.g. 30',
    correct: 30,
    hint: 'Set x₁ = 0 → 2x₂ = 60 → x₂ = ?',
    commit: { type: 'graph-line', constraintIndex: 1 },
  },
  {
    kind: 'mc',
    id: 'toy-g-c2-side',
    phase: 2,
    prompt: 'Same question for C2 — which side of the line is feasible?',
    options: [
      { id: 'below', label: 'The origin side' },
      { id: 'above', label: 'Away from the origin' },
    ],
    correctId: 'below',
    hint: 'Same test: at the origin 3·0 + 2·0 = 0 ≤ 60 ✓ — origin side is feasible.',
    commit: { type: 'graph-side', constraintIndex: 1, side: 'below' },
  },

  // Marker question — clicking "Reveal feasible region" completes phase 2
  {
    kind: 'mc',
    id: 'toy-g-feasible',
    phase: 2,
    prompt: 'Both constraints are drawn. The feasible region is the set of points that satisfy ALL constraints — where the two half-planes overlap plus x₁,x₂ ≥ 0. Ready to see it?',
    options: [
      { id: 'yes', label: 'Show me the feasible region' },
    ],
    correctId: 'yes',
    hint: '',
    commit: { type: 'feasible-region-complete' },
  },

  // ── Phase 2b: discover the optimum by dragging the objective line ─────────
  {
    kind: 'drag',
    id: 'toy-g-optimum',
    phase: 2,
    prompt: 'Drag the orange line (z = 15x₁ + 20x₂) outward. Push it as FAR as you can while it still touches the blue feasible region. Where can you stop?',
    knob: 'objective-z',
    min: 0,
    max: 600,
    step: 5,
    target: 450,
    tolerance: 7.5,
    hint: 'Push the line outward (increase z). At some point it will leave the feasible region entirely — stop just before that. That moment is the max.',
    commit: { type: 'optimum-found', zValue: 450 },
  },
  {
    kind: 'mc',
    id: 'toy-g-past-optimum',
    phase: 2,
    prompt: 'Now push the slider PAST 450 and watch the line. What\'s happening?',
    options: [
      { id: 'stays-inside', label: 'The line stays inside the feasible region' },
      { id: 'leaves', label: 'The line leaves the feasible region — no (x₁, x₂) in the factory constraints can achieve z > 450' },
      { id: 'region-grows', label: 'The feasible region grows to accommodate the higher z' },
    ],
    correctId: 'leaves',
    hint: 'Take another look at the graph as you slide past 450. The orange line moves OUTWARD, but the feasible region (blue) stays put. If the line is entirely outside the blue, there\'s no feasible solution at that z.',
    commit: { type: 'note', text: 'understood-why-450-is-max' },
  },
];

// ── Toy Factory — Phase 3: build the initial simplex tableau ────────────────

const TOY_FACTORY_PHASE3: Question[] = [
  {
    kind: 'mc',
    id: 'toy-t-what-to-add',
    phase: 3,
    prompt: 'You solved the graph by dragging. Now let\'s do the same answer the algebraic way — with the simplex method. First step: the simplex only works with equations, not inequalities. What do we add to a ≤ constraint to turn it into an equation?',
    options: [
      { id: 'slack',     label: 'A slack variable (+s) — absorbs unused capacity' },
      { id: 'surplus',   label: 'A surplus variable (−e)' },
      { id: 'artificial', label: 'An artificial variable (+a)' },
    ],
    correctId: 'slack',
    hint: 'Think about what "≤" means: "left side can be SMALLER than right side." If left is smaller by 3, we add 3 to make it equal. That 3 is slack — unused capacity.',
    commit: { type: 'note', text: 'know-to-add-slacks' },
  },
  {
    kind: 'number',
    id: 'toy-t-slack-count',
    phase: 3,
    prompt: 'The Toy Factory has two ≤ constraints. How many slack variables will we need?',
    placeholder: 'e.g. 2',
    correct: 2,
    hint: 'One slack per ≤ constraint.',
    commit: { type: 'slacks-added', count: 2 },
  },
  {
    kind: 'mc',
    id: 'toy-t-slack-identity',
    phase: 3,
    prompt: 'Each slack only "belongs" to its own constraint. So s₁ appears in C1\'s equation with coefficient 1 and in C2\'s equation with coefficient 0. In the tableau, the slack columns form an identity matrix. In row C1, what are the coefficients (s₁, s₂)?',
    options: [
      { id: 'one-zero', label: '(1, 0) — s₁ appears in C1, s₂ does not' },
      { id: 'zero-one', label: '(0, 1)' },
      { id: 'one-one',  label: '(1, 1)' },
      { id: 'zero-zero', label: '(0, 0)' },
    ],
    correctId: 'one-zero',
    hint: 'Row C1\'s equation: 2x₁ + 4x₂ + s₁ = 80. Only s₁ shows up in C1 — s₂ belongs to C2.',
    commit: { type: 'slack-identity-revealed' },
  },
  {
    kind: 'mc',
    id: 'toy-t-zrow-sign',
    phase: 3,
    prompt: 'The Z-row represents the equation z − 15x₁ − 20x₂ = 0, rearranged from z = 15x₁ + 20x₂. In the initial tableau, what are the Z-row coefficients for (x₁, x₂)?',
    options: [
      { id: 'neg-neg', label: '(−15, −20) — the NEGATIVE of the objective coefficients' },
      { id: 'pos-pos', label: '(15, 20) — same as the objective' },
      { id: 'neg-pos', label: '(−15, 20)' },
      { id: 'pos-neg', label: '(15, −20)' },
    ],
    correctId: 'neg-neg',
    hint: 'For MAX, moving the objective to the left side of the equation z − 15x₁ − 20x₂ = 0 makes the x coefficients negative. The simplex will drive them toward zero.',
    commit: { type: 'z-row-x-revealed' },
  },
  {
    kind: 'number',
    id: 'toy-t-initial-s1',
    phase: 3,
    prompt: 'At the initial BFS we have x₁ = x₂ = 0 (the origin). From C1: 2(0) + 4(0) + s₁ = 80. What is s₁?',
    placeholder: 'e.g. 80',
    correct: 80,
    hint: 'Simplify: 0 + 0 + s₁ = 80, so s₁ = ?',
    commit: { type: 'note', text: 'initial-s1' },
  },
  {
    kind: 'number',
    id: 'toy-t-initial-s2',
    phase: 3,
    prompt: 'Same logic for C2: 3(0) + 2(0) + s₂ = 60. What is s₂?',
    placeholder: 'e.g. 60',
    correct: 60,
    hint: 's₂ takes up all of C2\'s capacity because nothing is being produced yet.',
    commit: { type: 'initial-basic-values-revealed' },
  },
  {
    kind: 'number',
    id: 'toy-t-initial-z',
    phase: 3,
    prompt: 'And the initial objective value: z = 15(0) + 20(0) = ?',
    placeholder: 'e.g. 0',
    correct: 0,
    hint: 'Nothing produced → no profit yet. z = 0.',
    commit: { type: 'initial-z-revealed' },
  },
];

export const TOY_FACTORY_SCRIPT: TutorialScript = {
  id: 'script-toy-factory-v1',
  problemId: 'wp-toy-factory',
  title: 'Toy Factory — guided walkthrough',
  questions: [
    ...TOY_FACTORY_PHASE1,
    ...TOY_FACTORY_PHASE2,
    ...TOY_FACTORY_PHASE3,
  ],
};

export const TUTORIAL_SCRIPTS: TutorialScript[] = [
  TOY_FACTORY_SCRIPT,
];

export function getScript(problemId: string): TutorialScript | undefined {
  return TUTORIAL_SCRIPTS.find(s => s.problemId === problemId);
}
