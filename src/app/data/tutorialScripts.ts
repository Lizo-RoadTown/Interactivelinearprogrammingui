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

/**
 * Attention highlight — when set on a question, the named element in the
 * right-column visuals pulses/glows until the student answers. Acts as
 * a visible finger pointing from the prompt to the thing the prompt is
 * about ("how many ≤ constraints are there?" → ≤ operators pulse).
 */
export type QuestionHighlight =
  | { target: 'constraint-operators' }                          // all ≤/≥ operator boxes
  | { target: 'constraint-rhs' }                                // all RHS value boxes
  | { target: 'objective-coefficients' }                        // objective-row coefficient slots
  | { target: 'meter'; constraintIndex: number }                // one full capacity meter
  | { target: 'meter-tail'; constraintIndex: number }           // the unused (slack) tail of one meter
  | { target: 'meter-tails-all' }                               // all slack tails across all meters
  | { target: 'tableau-row'; row: number }                      // a tableau row (basis row)
  | { target: 'tableau-col'; col: number }                      // a tableau column
  | { target: 'tableau-z-row' }                                 // the Z-row specifically
  | { target: 'tableau-slack-columns' }                         // every slack column together
  | { target: 'tableau-rhs-column' }                            // the RHS column
  // Constraint-wide: lights up the same constraint everywhere at once —
  // Canvas row card, the line on the graph, its inline meter, and its
  // row in the tableau. Connects "this row of thing you see" across all
  // three views of the same constraint.
  | { target: 'constraint'; constraintIndex: number };


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
  /** Optional visual element(s) to pulse-highlight while this question is active. */
  highlight?: QuestionHighlight;
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
  highlight?: QuestionHighlight;
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
  highlight?: QuestionHighlight;
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
  highlight?: QuestionHighlight;
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
  highlight?: QuestionHighlight;
}

/**
 * Interactive tableau click question. The tableau itself becomes the
 * input: the student clicks a column header (to pick the entering
 * variable) or a basis row (to pick the leaving variable). The rest of
 * the tableau responds immediately — ratios appear when a column is
 * picked, the matching row highlights when clicked — so the student is
 * *reading the tableau* rather than being quizzed about it.
 */
export interface ClickTableauQuestion {
  kind: 'click-tableau';
  id: string;
  phase: number;
  prompt: string;
  /**
   * What kind of pick this question wants:
   *  - 'entering-col' → click a column header (column index in the full
   *    coefficient matrix, i.e. 0..n-1 where n = decVars + slacks)
   *  - 'leaving-row' → click a basis row (0..m-1)
   */
  pick: 'entering-col' | 'leaving-row';
  /** The correct index (column for entering, row for leaving). */
  correctIndex: number;
  /** When pick is 'leaving-row', which entering column's ratios to show. */
  enteringCol?: number;
  hint: string;
  commit: CommitPayload;
  highlight?: QuestionHighlight;
}

export type Question =
  | TextQuestion | NumberQuestion | MCQuestion | FieldsQuestion | DragQuestion
  | ClickTableauQuestion;

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
  // Phase 4 — simplex pivots (full post-pivot tableau carried in the commit)
  | {
      type: 'pivot-applied';
      pivotNumber: number;                                 // 1-indexed
      entering: string;
      leaving: string;
      matrix: number[][];                                  // (m+1) × (n+1) post-pivot
      basis: string[];                                     // length m
      zValue: number;                                      // new z* so far
      bfs: Record<string, number>;                         // new BFS point, e.g. {x1: 0, x2: 20}
    }
  | { type: 'note'; text: string };  // free-form annotation on the canvas

/**
 * Per-phase narration — framing cards that bracket each phase of the
 * walkthrough. intro appears above the first question of the phase
 * ("here's what we're doing, why it matters, which tool shines"); wrap
 * appears once the phase is complete ("what transformed, what to
 * remember, how it connects to the next phase").
 */
export interface PhaseMeta {
  phase: number;
  title: string;           // short name shown as header
  goal: string;            // what the step does, one line
  why: string;             // why it matters, one line
  tool: string;            // which tool shines in this phase
  wrap: string;            // closing thought after phase is done
}

export interface TutorialScript {
  id: string;
  problemId: string;  // which WordProblem this script is for
  title: string;
  questions: Question[];
  /** Optional phase narration; if absent, no intro/wrap cards are shown. */
  phasesMeta?: PhaseMeta[];
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
    highlight: { target: 'constraint-operators' },
  },
  {
    kind: 'mc',
    id: 'toy-t-slack-owns',
    phase: 3,
    prompt: 'Look at the two capacity meters on the right — each constraint is a bucket, and the striped tail is its slack. C1\'s bucket holds assembly-hours (s₁ is unused hours). C2\'s bucket holds wood (s₂ is unused wood). Does "unused hours" belong inside the wood balance?',
    options: [
      { id: 'no',     label: 'No — each slack lives inside its own bucket. Unused hours has nothing to do with the wood budget.' },
      { id: 'yes',    label: 'Yes — all slacks share capacity.' },
      { id: 'maybe',  label: 'Only if the problem has more constraints.' },
    ],
    correctId: 'no',
    hint: 'Pour unused hours into the wood bucket and nothing changes — they are different resources. s₁ is meaningful only inside C1.',
    commit: { type: 'note', text: 'slack-ownership-understood' },
    highlight: { target: 'meter-tails-all' },
  },
  {
    kind: 'mc',
    id: 'toy-t-slack-identity',
    phase: 3,
    prompt: 'Now read that ownership off as a row of numbers. In row C1\'s equation (2x₁ + 4x₂ + ? s₁ + ? s₂ = 80), how much of each slack appears? Look at which slack the C1 meter "owns."',
    options: [
      { id: 'one-zero', label: '(1, 0) — s₁ lives in C1 (coefficient 1); s₂ is in C2\'s meter, not here (coefficient 0).' },
      { id: 'zero-one', label: '(0, 1)' },
      { id: 'one-one',  label: '(1, 1)' },
      { id: 'zero-zero', label: '(0, 0)' },
    ],
    correctId: 'one-zero',
    hint: 'Watch the C1 meter: s₁ fills C1\'s tail — it\'s C1\'s slack (coeff 1). s₂ belongs to C2\'s meter entirely (coeff 0 in this row). Same pattern in row C2, flipped: (0, 1). Together those two rows form the identity block in the tableau.',
    commit: { type: 'slack-identity-revealed' },
    highlight: { target: 'meter', constraintIndex: 0 },
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
    highlight: { target: 'tableau-z-row' },
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
    highlight: { target: 'meter-tail', constraintIndex: 0 },
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
    highlight: { target: 'meter-tail', constraintIndex: 1 },
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

// ── Toy Factory — Phase 4: simplex pivots ───────────────────────────────────
//
// Two pivots take the student from z=0 (origin BFS) to z=450 at (10, 15).
// Hard-coded post-pivot states in commit payloads; for a second example
// problem the backend solver will provide them.

// Pivot 1 result: x₂ enters, s₁ leaves.
//   Tableau becomes:
//     x₂ | 0.5  1    0.25  0    | 20
//     s₂ | 2    0   -0.5   1    | 20
//     z  | -5   0    5     0    | 400
const PIVOT1_MATRIX: number[][] = [
  [0.5,  1,  0.25,  0,  20],
  [2,    0, -0.5,   1,  20],
  [-5,   0,  5,     0,  400],
];
const PIVOT1_BASIS = ['x2', 's2'];

// Pivot 2 result: x₁ enters, s₂ leaves.
//   Tableau becomes:
//     x₂ | 0  1  0.375  -0.25 | 15
//     x₁ | 1  0 -0.25    0.5  | 10
//     z  | 0  0  3.75    2.5  | 450
const PIVOT2_MATRIX: number[][] = [
  [0,  1,  0.375, -0.25, 15],
  [1,  0, -0.25,   0.5,  10],
  [0,  0,  3.75,   2.5,  450],
];
const PIVOT2_BASIS = ['x2', 'x1'];

const TOY_FACTORY_PHASE4: Question[] = [

  // ── Pivot 1: principle → click the tableau ─────────────────────────────
  //
  // Column indices in the initial tableau: 0=x1, 1=x2, 2=s1, 3=s2. Rows: 0=C1, 1=C2.
  // The picks use raw column/row indices because the student is clicking on the
  // tableau itself — no option IDs, no typing.
  {
    kind: 'click-tableau',
    id: 'toy-p1-entering',
    phase: 4,
    prompt: 'PRINCIPLE: every pivot picks the variable that will grow z the fastest — that\'s the MOST NEGATIVE value in the z-row. Find it in the tableau and click it.',
    pick: 'entering-col',
    correctIndex: 1, // x2 column
    hint: 'The z-row is (−15, −20, 0, 0). Which one is smallest? −20 wins → click the −20 under x₂.',
    commit: { type: 'note', text: 'p1-entering-picked' },
    highlight: { target: 'tableau-z-row' },
  },
  {
    kind: 'click-tableau',
    id: 'toy-p1-leaving',
    phase: 4,
    prompt: 'PRINCIPLE: we can grow x₂ only until one of the constraints binds. The ratios RHS ÷ (x₂ coefficient) tell you how far each row can stretch before it binds. Click the row with the SMALLEST positive ratio — that constraint binds first, so its variable leaves.',
    pick: 'leaving-row',
    enteringCol: 1,   // continue showing x₂ ratios
    correctIndex: 0,  // row C1 (s1 leaves at ratio 20)
    hint: 'Ratios: row s₁ has 80/4 = 20, row s₂ has 60/2 = 30. 20 is smaller — that means s₁ leaves.',
    commit: {
      type: 'pivot-applied',
      pivotNumber: 1,
      entering: 'x2',
      leaving: 's1',
      matrix: PIVOT1_MATRIX,
      basis: PIVOT1_BASIS,
      zValue: 400,
      bfs: { x1: 0, x2: 20 },
    },
  },

  // ── Pivot 2 ─────────────────────────────────────────────────────────────
  {
    kind: 'click-tableau',
    id: 'toy-p2-entering',
    phase: 4,
    prompt: 'The pivot moved us: new BFS (0, 20), z = 400. The z-row is now (−5, 0, 5, 0). Is z optimal yet? No — there\'s still a negative value, meaning some variable can still grow z. Click the most negative z-row entry.',
    pick: 'entering-col',
    correctIndex: 0, // x1 column
    hint: 'Only x₁ has a negative z-row entry (−5). Click the −5 under x₁.',
    commit: { type: 'note', text: 'p2-entering-picked' },
    highlight: { target: 'tableau-z-row' },
  },
  {
    kind: 'click-tableau',
    id: 'toy-p2-leaving',
    phase: 4,
    prompt: 'Same ratio test, now for the x₁ column. Click the row with the smallest positive ratio — that\'s the constraint that stops x₁ from growing further.',
    pick: 'leaving-row',
    enteringCol: 0,
    correctIndex: 1,  // row s2 (ratio 10 < 40)
    hint: 'x₂ row: 20 / 0.5 = 40. s₂ row: 20 / 2 = 10. 10 < 40 → s₂ leaves.',
    commit: {
      type: 'pivot-applied',
      pivotNumber: 2,
      entering: 'x1',
      leaving: 's2',
      matrix: PIVOT2_MATRIX,
      basis: PIVOT2_BASIS,
      zValue: 450,
      bfs: { x1: 10, x2: 15 },
    },
  },

  // ── Optimal check ────────────────────────────────────────────────────────
  {
    kind: 'mc',
    id: 'toy-p-optimal',
    phase: 4,
    prompt: 'New Z-row is (0, 0, 3.75, 2.5). Are there ANY negative values left?',
    options: [
      { id: 'no',  label: 'No — every Z-row entry is ≥ 0. We\'re OPTIMAL.' },
      { id: 'yes', label: 'Yes, there are still negative entries' },
    ],
    correctId: 'no',
    hint: 'Check each Z-row value: 0 ≥ 0, 0 ≥ 0, 3.75 ≥ 0, 2.5 ≥ 0. All non-negative → no improvement possible → optimal.',
    commit: { type: 'note', text: 'optimal-recognized' },
  },
];

// ── Toy Factory — Phase 5: read the answer + bridge back to the graph ───────
//
// The algebra just landed the student at the optimal tableau. Phase 5
// reads the answer straight off the RHS, translates it to plain English
// ("make 10 cars and 15 trucks"), and explicitly links the algebraic
// solution to the vertex the student discovered graphically in Phase 2b.
// This is the closing circle — "both methods gave the same answer."

const TOY_FACTORY_PHASE5: Question[] = [
  {
    kind: 'fields',
    id: 'toy-r-read-xs',
    phase: 5,
    prompt: 'Read the final solution directly off the tableau. The basic variables are x₂ and x₁, and their values are in the RHS column (15 in row x₂, 10 in row x₁). What are (x₁, x₂)?',
    fields: [
      { id: 'x1', label: 'x₁', correct: 10, placeholder: '10' },
      { id: 'x2', label: 'x₂', correct: 15, placeholder: '15' },
    ],
    hint: 'Look at the final tableau\'s RHS column. Row x₂ has 15. Row x₁ has 10.',
    commit: { type: 'note', text: 'optimal-xs-read' },
  },
  {
    kind: 'number',
    id: 'toy-r-read-z',
    phase: 5,
    prompt: 'And the optimal objective value z* is in the Z-row RHS. What is z*?',
    placeholder: 'e.g. 450',
    correct: 450,
    hint: 'Look at the Z-row\'s RHS cell.',
    commit: { type: 'note', text: 'optimal-z-read' },
  },
  {
    kind: 'mc',
    id: 'toy-r-translation',
    phase: 5,
    prompt: 'Translate the algebra back into the business decision. What should the toy factory do?',
    options: [
      { id: 'make-10-15', label: 'Make 10 toy cars and 15 toy trucks per week. Weekly profit = $450.' },
      { id: 'make-15-10', label: 'Make 15 toy cars and 10 toy trucks per week.' },
      { id: 'make-20-30', label: 'Make 20 cars and 30 trucks (more of both).' },
      { id: 'close',      label: 'Close the factory.' },
    ],
    correctId: 'make-10-15',
    hint: 'x₁ is toy cars, x₂ is toy trucks. You just found x₁ = 10, x₂ = 15 with z = 450.',
    commit: { type: 'note', text: 'business-translation' },
  },
  {
    kind: 'mc',
    id: 'toy-r-bridge',
    phase: 5,
    prompt: 'Back in Phase 2, when you dragged the objective line outward, it stopped when z = 450 at (10, 15). Now the simplex pivots gave you the same answer. Why do both methods land in the same place?',
    options: [
      { id: 'same-place', label: 'They\'re two ways to find the same optimum. The graph finds it geometrically (farthest corner in the improvement direction); the tableau finds it algebraically (walk corner to corner until Z-row is non-negative).' },
      { id: 'coincidence', label: 'Coincidence — they usually give different answers.' },
      { id: 'different-methods', label: 'They\'re different methods for different kinds of problems.' },
    ],
    correctId: 'same-place',
    hint: 'Every simplex pivot walks you from one corner of the feasible region to an adjacent corner with a better z. The optimum is always at a corner — that\'s the vertex the objective-line drag also found.',
    commit: { type: 'note', text: 'bridge-understood' },
  },
];

// ── Toy Factory — Phase 6: a taste of sensitivity analysis ──────────────────
//
// The student has the optimal answer. Real managers then ask "what if…"
// questions: what if the truck profit drops? what if we get more
// assembly hours? This phase plants those questions and points the student
// to the interactive Sensitivity lens in the free workspace.

const TOY_FACTORY_PHASE6: Question[] = [
  {
    kind: 'mc',
    id: 'toy-s-concept',
    phase: 6,
    prompt: 'Managers rarely leave a solution alone — they ask: "what if the truck profit drops from $20 to $12? What if we could get 10 more assembly hours?" That\'s sensitivity analysis. What does it actually compute?',
    options: [
      { id: 'ranges', label: 'How much each parameter (profits, capacities) can change before the optimal MIX shifts.' },
      { id: 'resolve', label: 'A completely new LP for every tiny change.' },
      { id: 'nothing', label: 'Nothing — once an LP is solved it\'s fixed forever.' },
    ],
    correctId: 'ranges',
    hint: 'The point of sensitivity: reuse the optimal tableau you just built to quickly answer "does the answer still hold if X changes?" — without re-solving.',
    commit: { type: 'note', text: 'sensitivity-concept' },
  },
  {
    kind: 'mc',
    id: 'toy-s-shadow',
    phase: 6,
    prompt: 'The Z-row of your final tableau is (0, 0, 3.75, 2.5). Those last two numbers — 3.75 under s₁ and 2.5 under s₂ — are the SHADOW PRICES of the two constraints. What does 3.75 mean?',
    options: [
      { id: 'per-unit', label: 'If the assembly-hours limit rises by 1 (from 80 to 81), profit rises by $3.75.' },
      { id: 'per-car', label: 'Each toy car costs $3.75 to make.' },
      { id: 'slack', label: 'There are 3.75 unused assembly hours.' },
    ],
    correctId: 'per-unit',
    hint: 'Shadow price = marginal value of a resource. One more hour of assembly is worth $3.75 in extra profit (within the allowable range).',
    commit: { type: 'note', text: 'shadow-price-understood' },
  },
];

const TOY_FACTORY_PHASES_META: PhaseMeta[] = [
  {
    phase: 1,
    title: 'Locate the constraints',
    goal: 'Turn the word problem into variables, an objective, and inequality constraints.',
    why: 'Every later step depends on this — a wrong constraint here means we optimize the wrong problem.',
    tool: 'The formulation canvas — the constraints you write here stay with you for the rest of the walkthrough.',
    wrap: 'You now have the LP in inequality form. Every next phase is a transformation of these same constraints.',
  },
  {
    phase: 2,
    title: 'See the constraints as a region',
    goal: 'Draw each constraint as a line and pick the feasible side; their intersection is the feasible region. Drag the objective to find where it touches the region last — that\'s the optimum.',
    why: 'Geometry gives you intuition: "feasibility" becomes a region you can see, "optimum" becomes a corner you can point at.',
    tool: 'The graph — powerful when the problem is 2D; in higher dimensions you can\'t draw it and need the tableau instead.',
    wrap: 'You found the optimum geometrically. Next we\'ll get the same answer algebraically — and the same constraints are coming with us.',
  },
  {
    phase: 3,
    title: 'Pin ≤ to = by adding slack',
    goal: 'Rewrite each inequality as an equation by adding a slack variable — the unused amount. Lay the coefficients out as the initial tableau.',
    why: 'Algorithms need equations, not inequalities. Slack is the thing that absorbs the leftover space so the equation still holds at any feasible point.',
    tool: 'The inline meter on each constraint — it grounds the equation in what each side means physically (used vs unused).',
    wrap: 'Every tableau row you\'re about to see is one of these equations. When we pivot, we\'ll be moving through the feasible region using these rows.',
  },
  {
    phase: 4,
    title: 'Walk the vertices with pivots',
    goal: 'Each pivot picks the most profitable non-basic variable, moves it into the basis, and pushes out the constraint that hits its limit first — you slide along one edge of the feasible region to the next vertex.',
    why: 'This is deterministic. The simplex will always land on the optimum in a finite number of pivots.',
    tool: 'The tableau — each pivot is just row operations on the grid; scales to any size problem.',
    wrap: 'Two pivots carried us from (0,0) with z = 0 to (10,15) with z = 450 — the same point you found by dragging.',
  },
  {
    phase: 5,
    title: 'Read the answer off the final tableau',
    goal: 'When no non-basic variable can improve z, we\'re at the optimum. The RHS column of each basic row IS the optimal value of that variable.',
    why: 'Being able to stop and read the answer off the grid is the whole point of the algorithm.',
    tool: 'The tableau — again. The final tableau carries both the answer (RHS column) and sensitivity info (Z-row slacks).',
    wrap: 'You just solved the same LP two different ways and got the same answer. That\'s a good reality check.',
  },
  {
    phase: 6,
    title: 'Perturb and see',
    goal: 'What if the assembly-hours limit rises? What if the truck profit drops? Sensitivity analysis tells you how much each parameter can change without changing the optimal MIX.',
    why: 'Real-world numbers are estimates. The optimal mix is only useful if it\'s stable to the inputs being slightly wrong.',
    tool: 'The final tableau\'s Z-row under each slack — those numbers are the shadow prices (marginal value of loosening a constraint).',
    wrap: 'You now have the full toolkit: formulate, visualize, standardize, pivot, read, perturb.',
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
    ...TOY_FACTORY_PHASE4,
    ...TOY_FACTORY_PHASE5,
    ...TOY_FACTORY_PHASE6,
  ],
  phasesMeta: TOY_FACTORY_PHASES_META,
};

export const TUTORIAL_SCRIPTS: TutorialScript[] = [
  TOY_FACTORY_SCRIPT,
];

export function getScript(problemId: string): TutorialScript | undefined {
  return TUTORIAL_SCRIPTS.find(s => s.problemId === problemId);
}
