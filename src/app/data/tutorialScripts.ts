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
  pick: 'entering-col' | 'leaving-row';
  correctIndex: number;
  enteringCol?: number;
  hint: string;
  commit: CommitPayload;
  highlight?: QuestionHighlight;
}

/**
 * Click-the-vertex question for Phase 6. The student clicks a specific
 * corner of the feasible polygon on the graph — the click IS the answer.
 * The target vertex's dot pulses while this question is active.
 */
export interface ClickVertexQuestion {
  kind: 'click-vertex';
  id: string;
  phase: number;
  prompt: string;
  targetX: number;
  targetY: number;
  tolerance?: number;  // default 0.5 in problem units
  hint: string;
  commit: CommitPayload;
  highlight?: QuestionHighlight;
}

/**
 * Click-a-column question for the BuildB panel. The student clicks a
 * specific column of the original constraint matrix A to pull it into
 * the next slot of B.
 *
 * Column index convention: 0..n-1 are decision vars, n..n+m-1 are slacks.
 */
export interface ClickMatrixColumnQuestion {
  kind: 'click-matrix-column';
  id: string;
  phase: number;
  prompt: string;
  /** Column index in A = [A_dec | I] that the student should click. */
  targetColumn: number;
  hint: string;
  commit: CommitPayload;
  highlight?: QuestionHighlight;
}

export type Question =
  | TextQuestion | NumberQuestion | MCQuestion | FieldsQuestion | DragQuestion
  | ClickTableauQuestion | ClickVertexQuestion | ClickMatrixColumnQuestion;

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
  // Phase 6 — sensitivity gameboard reveals. Each correct answer in the
  // sensitivity walkthrough commits a reveal-key that unlocks one cell of
  // the corresponding gameboard panel (basis list / B / B⁻¹ / formulas).
  // Same mechanic as the Phase 3 tableau: "?" slots wait until earned.
  | { type: 's-reveal'; key: string }
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

  // ── Piece 1: earn the basis at the optimum vertex ─────────────────────
  // Three steps:
  //   1. CLICK the optimum vertex on the graph (the click IS the answer).
  //   2. MC: identify the BASIC variables (reveals Basic slots).
  //   3. MC: identify the NON-BASIC variables (reveals Non-basic slots).
  // Fine-grained reveals (principle 2), click-is-the-answer (principle 4),
  // principle-first prompts (principle 3), clues not answers (principle 11).
  {
    kind: 'click-vertex',
    id: 'toy-s-click-optimum',
    phase: 6,
    prompt: 'PRINCIPLE: every corner of the feasible region IS a basis (a choice of which variables are > 0). Dots just appeared at each corner of your feasible polygon. CLICK the optimum vertex — the corner where both constraints are tight and you landed at z* = 450.',
    targetX: 10,
    targetY: 15,
    tolerance: 0.5,
    hint: 'Look for the corner where both the rose C1 line and the violet C2 line cross. That\'s (10, 15).',
    commit: { type: 'note', text: 's-vertex-optimum-clicked' },
  },
  {
    kind: 'mc',
    id: 'toy-s-basic-optimum',
    phase: 6,
    prompt: 'Good — you\'re at (10, 15). Look at the Vertex Basis panel\'s clues AND the inline capacity meters under the Canvas. The clues list tells you which slacks are 0 here; the meters show each constraint fully used with s_i = 0 BINDING. PRINCIPLE: basic variables are the ones that are > 0 at this vertex. Which two variables are BASIC here?',
    options: [
      { id: 'x1-x2', label: '{ x₁, x₂ } — both are > 0 here, so they\'re basic' },
      { id: 's1-s2', label: '{ s₁, s₂ }' },
      { id: 'x1-s1', label: '{ x₁, s₁ }' },
      { id: 'x2-s2', label: '{ x₂, s₂ }' },
    ],
    correctId: 'x1-x2',
    hint: 'The clue list and the meters both tell you s₁ = 0 and s₂ = 0. So the slacks are NON-basic. The only variables > 0 are x₁ = 10 and x₂ = 15 — those are basic.',
    commit: { type: 's-reveal', key: 'basis-basic-10,15' },
  },
  {
    kind: 'mc',
    id: 'toy-s-nonbasic-optimum',
    phase: 6,
    prompt: 'Now the other side. The clue list in the Vertex Basis panel explicitly names which slacks are 0 here, and the capacity meters under the Canvas confirm it — each meter is fully used and shows s_i = 0 with a BINDING badge. PRINCIPLE: non-basic = set to 0. Which two variables are NON-BASIC at (10, 15)?',
    options: [
      { id: 's1-s2', label: '{ s₁, s₂ } — both constraints are tight, so both slacks equal 0' },
      { id: 'x1-x2', label: '{ x₁, x₂ }' },
      { id: 'x1-s1', label: '{ x₁, s₁ }' },
      { id: 'x2-s2', label: '{ x₂, s₂ }' },
    ],
    correctId: 's1-s2',
    hint: 'Check the clue list in the Vertex Basis panel — it lists s₁ and s₂ as the slacks that equal 0 here (because C1 and C2 are tight). The meters under the Canvas show the same thing. Variables set to 0 are non-basic.',
    commit: { type: 's-reveal', key: 'basis-nonbasic-10,15' },
  },

  // ── Piece 2: build B by clicking basic columns in A ─────────────────────
  {
    kind: 'click-matrix-column',
    id: 'toy-s-b-col-0',
    phase: 6,
    prompt: 'PRINCIPLE: B is just the columns of A that correspond to the basic variables. Your basis is { x₁, x₂ }. Slot 1 of B takes the x₁ column from the original constraints. CLICK the x₁ column in the A matrix to pull it in.',
    targetColumn: 0,
    hint: 'x₁ is the first column of A. Its entries are the coefficients of x₁ in C1 and C2 — the 2 and the 3.',
    commit: { type: 's-reveal', key: 'b-col-0' },
  },
  {
    kind: 'click-matrix-column',
    id: 'toy-s-b-col-1',
    phase: 6,
    prompt: 'Slot 2 of B takes the x₂ column. CLICK the x₂ column in A.',
    targetColumn: 1,
    hint: 'x₂ is the second column of A. Entries: the 4 (C1) and the 2 (C2).',
    commit: { type: 's-reveal', key: 'b-col-1' },
  },

  // ── Piece 3: compute B⁻¹ one cell at a time ────────────────────────────
  // B = [[2, 4], [3, 2]]
  // det(B) = 2·2 − 4·3 = −8
  // adj(B) = [[d, -b], [-c, a]] = [[2, -4], [-3, 2]]
  // B⁻¹ = adj / det = [[-0.25, 0.5], [0.375, -0.25]]
  {
    kind: 'number',
    id: 'toy-s-det',
    phase: 6,
    prompt: 'PRINCIPLE: for a 2×2 matrix B = [[a, b], [c, d]], det(B) = a·d − b·c. Your B = [[2, 4], [3, 2]]. Compute det(B).',
    placeholder: 'e.g. -8',
    correct: -8,
    hint: '2·2 − 4·3 = 4 − 12 = −8.',
    commit: { type: 's-reveal', key: 's-det' },
  },
  {
    kind: 'number',
    id: 'toy-s-adj-0-0',
    phase: 6,
    prompt: 'The adjugate swaps the diagonal and negates the off-diagonal. adj(B) top-left = d. What\'s d?',
    placeholder: 'e.g. 2',
    correct: 2,
    hint: 'd is B\'s bottom-right entry, which is 2.',
    commit: { type: 's-reveal', key: 's-adj-0-0' },
  },
  {
    kind: 'number',
    id: 'toy-s-adj-0-1',
    phase: 6,
    prompt: 'adj(B) top-right = −b. What\'s −b?',
    placeholder: 'e.g. -4',
    correct: -4,
    hint: 'b is B\'s top-right (4). Negate it → −4.',
    commit: { type: 's-reveal', key: 's-adj-0-1' },
  },
  {
    kind: 'number',
    id: 'toy-s-adj-1-0',
    phase: 6,
    prompt: 'adj(B) bottom-left = −c. What\'s −c?',
    placeholder: 'e.g. -3',
    correct: -3,
    hint: 'c is B\'s bottom-left (3). Negate → −3.',
    commit: { type: 's-reveal', key: 's-adj-1-0' },
  },
  {
    kind: 'number',
    id: 'toy-s-adj-1-1',
    phase: 6,
    prompt: 'adj(B) bottom-right = a. What\'s a?',
    placeholder: 'e.g. 2',
    correct: 2,
    hint: 'a is B\'s top-left, which is 2.',
    commit: { type: 's-reveal', key: 's-adj-1-1' },
  },
  {
    kind: 'number',
    id: 'toy-s-binv-0-0',
    phase: 6,
    prompt: 'PRINCIPLE: B⁻¹ = adj(B) / det(B). Top-left of adj is 2; det is −8. Compute B⁻¹ top-left = 2 / (−8).',
    placeholder: 'e.g. -0.25',
    correct: -0.25,
    tolerance: 0.01,
    hint: '2 / (−8) = −0.25 (or −1/4).',
    commit: { type: 's-reveal', key: 's-binv-0-0' },
  },
  {
    kind: 'number',
    id: 'toy-s-binv-0-1',
    phase: 6,
    prompt: 'B⁻¹ top-right = −4 / (−8). What is it?',
    placeholder: 'e.g. 0.5',
    correct: 0.5,
    tolerance: 0.01,
    hint: '−4 / (−8) = 0.5.',
    commit: { type: 's-reveal', key: 's-binv-0-1' },
  },
  {
    kind: 'number',
    id: 'toy-s-binv-1-0',
    phase: 6,
    prompt: 'B⁻¹ bottom-left = −3 / (−8). What is it?',
    placeholder: 'e.g. 0.375',
    correct: 0.375,
    tolerance: 0.01,
    hint: '−3 / (−8) = 3/8 = 0.375.',
    commit: { type: 's-reveal', key: 's-binv-1-0' },
  },
  {
    kind: 'number',
    id: 'toy-s-binv-1-1',
    phase: 6,
    prompt: 'B⁻¹ bottom-right = 2 / (−8). What is it?',
    placeholder: 'e.g. -0.25',
    correct: -0.25,
    tolerance: 0.01,
    hint: '2 / (−8) = −0.25.',
    commit: { type: 's-reveal', key: 's-binv-1-1' },
  },

  // ── Piece 4: apply the four formulas, one cell at a time ───────────────
  // B⁻¹ = [[-0.25, 0.5], [0.375, -0.25]]
  // N = [[1, 0], [0, 1]]  (non-basic s₁, s₂ columns; identity)
  // B⁻¹N = B⁻¹
  //   (0,0) = -0.25, (0,1) = 0.5
  //   (1,0) = 0.375, (1,1) = -0.25
  {
    kind: 'number',
    id: 'toy-s-binvN-0-0',
    phase: 6,
    prompt: 'PRINCIPLE: the non-basic columns of the optimal tableau are B⁻¹·N. N is the columns of the non-basic variables (s₁ and s₂) from A — both are identity columns. So B⁻¹·N = B⁻¹·I = B⁻¹. What\'s entry (1, 1) of B⁻¹·N — the s₁ entry in the first basic row?',
    placeholder: 'e.g. -0.25',
    correct: -0.25,
    tolerance: 0.01,
    hint: 'Since N is the identity, B⁻¹N = B⁻¹. Row 1, column 1 of B⁻¹ is −0.25.',
    commit: { type: 's-reveal', key: 's-binvN-0-0' },
  },
  {
    kind: 'number',
    id: 'toy-s-binvN-0-1',
    phase: 6,
    prompt: 'Entry (1, 2) of B⁻¹·N — row 1, column s₂.',
    placeholder: 'e.g. 0.5',
    correct: 0.5,
    tolerance: 0.01,
    hint: 'Row 1, column 2 of B⁻¹ = 0.5.',
    commit: { type: 's-reveal', key: 's-binvN-0-1' },
  },
  {
    kind: 'number',
    id: 'toy-s-binvN-1-0',
    phase: 6,
    prompt: 'Entry (2, 1) of B⁻¹·N — row 2, column s₁.',
    placeholder: 'e.g. 0.375',
    correct: 0.375,
    tolerance: 0.01,
    hint: 'Row 2, column 1 of B⁻¹ = 0.375.',
    commit: { type: 's-reveal', key: 's-binvN-1-0' },
  },
  {
    kind: 'number',
    id: 'toy-s-binvN-1-1',
    phase: 6,
    prompt: 'Entry (2, 2) of B⁻¹·N — row 2, column s₂.',
    placeholder: 'e.g. -0.25',
    correct: -0.25,
    tolerance: 0.01,
    hint: 'Row 2, column 2 of B⁻¹ = −0.25.',
    commit: { type: 's-reveal', key: 's-binvN-1-1' },
  },

  // B⁻¹·b gives the basic-variable values. b = [80, 60].
  //   Row 1: -0.25*80 + 0.5*60 = -20 + 30 = 10   → x₁*
  //   Row 2:  0.375*80 + (-0.25)*60 = 30 - 15 = 15 → x₂*
  {
    kind: 'number',
    id: 'toy-s-binvb-0',
    phase: 6,
    prompt: 'PRINCIPLE: B⁻¹·b gives the values of the basic variables at this vertex. b = (80, 60). Row 1 of B⁻¹·b = (−0.25)·80 + (0.5)·60. Compute it — this should equal x₁*.',
    placeholder: 'e.g. 10',
    correct: 10,
    tolerance: 0.01,
    hint: '−0.25·80 = −20. 0.5·60 = 30. Sum = 10. (And x₁* = 10 — matches the vertex coord.)',
    commit: { type: 's-reveal', key: 's-binvb-0' },
  },
  {
    kind: 'number',
    id: 'toy-s-binvb-1',
    phase: 6,
    prompt: 'Row 2 of B⁻¹·b = (0.375)·80 + (−0.25)·60. Compute it — this should equal x₂*.',
    placeholder: 'e.g. 15',
    correct: 15,
    tolerance: 0.01,
    hint: '0.375·80 = 30. −0.25·60 = −15. Sum = 15. (x₂* = 15.)',
    commit: { type: 's-reveal', key: 's-binvb-1' },
  },

  // C_B·B⁻¹N − C_N gives the Z-row non-basic entries.
  // C_B = [15, 20], C_N = [0, 0].
  // col s₁ of B⁻¹N = (−0.25, 0.375) → 15·(−0.25) + 20·(0.375) = −3.75 + 7.5 = 3.75
  // col s₂ of B⁻¹N = (0.5, −0.25) → 15·0.5 + 20·(−0.25) = 7.5 − 5 = 2.5
  {
    kind: 'number',
    id: 'toy-s-zrow-0',
    phase: 6,
    prompt: 'PRINCIPLE: the Z-row non-basic entry under s₁ is C_B · (column s₁ of B⁻¹N) − C_N[s₁]. C_B = (15, 20). Column s₁ of B⁻¹N = (−0.25, 0.375). Compute the Z-row entry under s₁ — this IS the shadow price of C1.',
    placeholder: 'e.g. 3.75',
    correct: 3.75,
    tolerance: 0.01,
    hint: '15·(−0.25) + 20·(0.375) = −3.75 + 7.5 = 3.75. Subtract C_N[s₁] = 0 → 3.75.',
    commit: { type: 's-reveal', key: 's-zrow-0' },
  },
  {
    kind: 'number',
    id: 'toy-s-zrow-1',
    phase: 6,
    prompt: 'Same formula for s₂. Column s₂ of B⁻¹N = (0.5, −0.25). Compute the Z-row entry under s₂.',
    placeholder: 'e.g. 2.5',
    correct: 2.5,
    tolerance: 0.01,
    hint: '15·0.5 + 20·(−0.25) = 7.5 − 5 = 2.5. This is the shadow price of C2.',
    commit: { type: 's-reveal', key: 's-zrow-1' },
  },

  // z* = C_B · B⁻¹b = 15·10 + 20·15 = 150 + 300 = 450
  {
    kind: 'number',
    id: 'toy-s-zstar',
    phase: 6,
    prompt: 'PRINCIPLE: z* = C_B · B⁻¹b. C_B = (15, 20); B⁻¹b = (10, 15). Compute z*.',
    placeholder: 'e.g. 450',
    correct: 450,
    tolerance: 0.01,
    hint: '15·10 + 20·15 = 150 + 300 = 450. This matches the z* you found in Phase 5.',
    commit: { type: 's-reveal', key: 's-zstar' },
  },

  // ── Piece 5: verification + apply the shadow price to a scenario ───────
  {
    kind: 'mc',
    id: 'toy-s-matches',
    phase: 6,
    prompt: 'The Reconstructed optimal tableau below the four formulas should now be complete. Compare it to the tableau you built by pivoting in Phase 4 — do the numbers match?',
    options: [
      { id: 'yes', label: 'Yes — same x₁*, x₂*, z*, same Z-row shadow prices. Two paths, one answer.' },
      { id: 'no', label: 'No — they\'re different.' },
      { id: 'sort-of', label: 'Some numbers match, others don\'t.' },
    ],
    correctId: 'yes',
    hint: 'That\'s the whole point of Chapter 8: the optimal tableau is a position in (B, B⁻¹, N, b, c) space. Matrix algebra reconstructs it directly.',
    commit: { type: 'note', text: 's-tableaus-match' },
  },
  {
    kind: 'number',
    id: 'toy-s-scenario',
    phase: 6,
    prompt: 'NOW the manager\'s question. You know the shadow price of C1 is 3.75 (the Z-row entry under s₁). If we bumped b₁ from 80 to 85 (5 extra assembly hours), what\'s the new z* — assuming we stay inside the allowable range?',
    placeholder: 'e.g. 468.75',
    correct: 468.75,
    tolerance: 0.01,
    hint: 'z_new = z_old + shadow_price · Δb = 450 + 3.75·5 = 450 + 18.75 = 468.75.',
    commit: { type: 'note', text: 's-shadow-applied' },
  },
  {
    kind: 'mc',
    id: 'toy-s-range-wrap',
    phase: 6,
    prompt: '3.75 only holds WITHIN the allowable range. If you pushed b₁ far enough that the optimal vertex jumped to a new corner, what would change?',
    options: [
      { id: 'basis-change', label: 'The basis would change. A different set of variables would be basic. The old B⁻¹ wouldn\'t apply; we\'d need to form a new B and invert it.' },
      { id: 'infeasible', label: 'The problem becomes infeasible.' },
      { id: 'stays-same', label: 'Nothing changes — the rate is always 3.75.' },
    ],
    correctId: 'basis-change',
    hint: 'Outside the allowable range, a different vertex becomes optimal. Different vertex → different basis → different B → different B⁻¹ → different shadow price.',
    commit: { type: 'note', text: 's-range-understood' },
  },

  // ── Piece 6: SCENARIOS — transform a constraint and watch every tool
  //    react together. The Sensitivity Playground panel at the bottom has
  //    sliders for each constraint\'s RHS and each variable\'s objective
  //    coefficient. A single slider move updates, at the same time:
  //      • the graph (constraint line moves or objective tilts),
  //      • the inline capacity meters (used/unused shifts),
  //      • the Formulas panel (B⁻¹b and Z-row recompute),
  //      • the reconstructed optimal tableau below the formulas.
  //    That is the alignment: one action, every tool in sync.

  {
    kind: 'number',
    id: 'toy-scenario-1-small-b',
    phase: 6,
    prompt: 'SCENARIO: Your supervisor says "we can get 5 more assembly hours — is it worth buying?" Drag C1\'s RHS slider in the Sensitivity Playground to 85 (Δ = +5). Watch what happens to every view. What is the new z*? Read it from the Formulas panel (z* cell) OR compute it using the shadow price.',
    placeholder: 'e.g. 468.75',
    correct: 468.75,
    tolerance: 0.01,
    hint: 'Inside the allowable range, z* = 450 + shadow·Δb₁ = 450 + 3.75·5 = 468.75. The Formulas panel\'s z* cell now reads 468.75 live.',
    commit: { type: 'note', text: 'scenario-1-answered' },
  },
  {
    kind: 'mc',
    id: 'toy-scenario-1-observe',
    phase: 6,
    prompt: 'Look at the graph, the inline meters, and the Formulas panel. Did the optimal MIX (x₁*, x₂*) change, stay exactly the same, or shift slightly?',
    options: [
      { id: 'shifted', label: 'It shifted slightly — x₁* and x₂* are new numbers, but the BASIS ({x₁, x₂}) is the same. Same corner geometry, different coordinates.' },
      { id: 'same', label: 'Exactly the same — still (10, 15).' },
      { id: 'flipped', label: 'The mix flipped to a completely different corner.' },
    ],
    correctId: 'shifted',
    hint: 'The Formulas panel\'s B⁻¹·b cells now read (8.75, 16.875) — the same BASIS but new values, because the right-hand side changed. On the graph the optimum dot slid along C2, still at the C1∩C2 corner. All four tools agree.',
    commit: { type: 'note', text: 'scenario-1-observed' },
  },

  {
    kind: 'mc',
    id: 'toy-scenario-2-large-b',
    phase: 6,
    prompt: 'SCENARIO: "We can get 50 more assembly hours — huge increase!" Drag C1\'s RHS slider all the way to 130 (Δ = +50). Watch every view carefully. Does the OLD corner (10, 15) survive, or does a different vertex take over?',
    options: [
      { id: 'flipped', label: 'A different vertex takes over. The Formulas panel\'s B⁻¹·b shows a negative entry (infeasible!), the graph\'s optimum dot jumped, and C1 is no longer binding — it became "meaningless" at the new corner.' },
      { id: 'stayed', label: 'The corner stayed at (10, 15).' },
      { id: 'infeasible', label: 'The problem is infeasible now.' },
    ],
    correctId: 'flipped',
    hint: 'The Formulas panel shows B⁻¹·b = (−2.5, 33.75) — the −2.5 means "old basis no longer feasible." The graph shows the optimum jumped to (0, 30). C1 is now loose (s₁ > 0) — at this new corner C1 doesn\'t bind any more. This is what "outside the allowable range" feels like.',
    commit: { type: 'note', text: 'scenario-2-observed' },
  },

  {
    kind: 'mc',
    id: 'toy-scenario-3-small-c',
    phase: 6,
    prompt: 'SCENARIO: "Market shift — truck profit drops from $20 to $18." Reset the sliders (use the "reset to baseline" link). Then drag x₂\'s profit slider to 18. Observe the objective line on the graph and the Formulas panel. What changed?',
    options: [
      { id: 'z-only', label: 'The optimal MIX stayed at (10, 15), but z* dropped. The objective line on the graph tilted slightly, and the Formulas panel\'s Z-row and z* cells updated, but B⁻¹·b is unchanged (same RHS).' },
      { id: 'mix-flipped', label: 'The mix flipped to a different corner.' },
      { id: 'nothing', label: 'Nothing changed.' },
    ],
    correctId: 'z-only',
    hint: '18 is inside c₂\'s allowable range [10, 30]. The objective line tilts but (10, 15) is still the highest point on it. Only z changes: new z* = 15·10 + 18·15 = 420. The BASIS is unchanged.',
    commit: { type: 'note', text: 'scenario-3-observed' },
  },

  {
    kind: 'mc',
    id: 'toy-scenario-4-large-c',
    phase: 6,
    prompt: 'SCENARIO: "Market crash — truck profit falls all the way to $8." Keep dragging x₂\'s profit down to 8. Now what happens to the optimal mix?',
    options: [
      { id: 'flipped', label: 'The mix flipped — a different corner is now optimal. The objective line tilted past the edge of the allowable range and now points to a different vertex.' },
      { id: 'same', label: 'Still (10, 15) — c changes never affect the mix.' },
      { id: 'infeasible', label: 'Infeasible.' },
    ],
    correctId: 'flipped',
    hint: '8 is outside c₂\'s allowable range [10, 30]. Below 10, producing trucks is no longer worth the opportunity cost. The optimum flips to (20, 0) — all cars, no trucks. z* = 15·20 + 8·0 = 300.',
    commit: { type: 'note', text: 'scenario-4-observed' },
  },

  // ── Synthesis ──────────────────────────────────────────────────────────
  {
    kind: 'mc',
    id: 'toy-scenario-synthesis',
    phase: 6,
    prompt: 'PATTERN: you\'ve now seen four scenarios — two small changes that preserved the optimal mix, and two large changes that flipped it. What\'s the single thing that determines which category a change falls into?',
    options: [
      { id: 'allowable-range', label: 'The ALLOWABLE RANGE — a window of values around each parameter. Inside the window, the current basis stays optimal (only z changes). Outside it, a different vertex takes over.' },
      { id: 'size-absolute', label: 'The absolute size of the change (bigger = always flips).' },
      { id: 'sign', label: 'Whether the change is positive or negative.' },
    ],
    correctId: 'allowable-range',
    hint: 'The window depends on the specific parameter: for b₁ the range is [40, 120]; for c₂ it\'s [10, 30]. Some parameters have wide windows, some narrow. The boundary is always where a Formulas-panel cell crosses zero (B⁻¹b going negative → infeasibility, or Z-row going negative → non-optimality).',
    commit: { type: 'note', text: 'scenario-synthesis' },
  },
  {
    kind: 'mc',
    id: 'toy-scenario-unified',
    phase: 6,
    prompt: 'FINAL: when you perturb a parameter, every tool responds simultaneously — the graph, the meters, the Formulas panel, the tableau. What does that tell you about what a "tableau" actually is?',
    options: [
      { id: 'one-object', label: 'The optimal tableau is ONE object expressed in multiple languages — algebraic (B⁻¹ applied to data), geometric (a vertex with tight constraints), physical (resource capacities used/unused). The tools aren\'t separate; they\'re aligned views of the same transformation.' },
      { id: 'formula-only', label: 'It\'s only the algebra — the graph is a separate thing.' },
      { id: 'graph-only', label: 'It\'s only the graph — the tableau is a separate thing.' },
    ],
    correctId: 'one-object',
    hint: 'That\'s why a single slider move updates everything at once: they\'re not parallel; they\'re the same object. This is how sensitivity analysis becomes a tool you can USE — you can predict the outcome of a change before committing to it.',
    commit: { type: 'note', text: 'scenario-unified' },
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
