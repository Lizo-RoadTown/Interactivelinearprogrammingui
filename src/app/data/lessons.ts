import { LPProblem } from '../types';

export type LessonDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type LessonMethod = 'simplex' | 'big-m' | 'two-phase';

export interface LessonHints {
  initial?: string;
  select_pivot?: string;
  after_pivot?: string;
  optimal?: string;
  phase1_initial?: string;
  phase1_complete?: string;
  phase2_initial?: string;
  infeasible?: string;
  unbounded?: string;
}

export interface QuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  number: number;
  title: string;
  chapter: string;
  difficulty: LessonDifficulty;
  description: string;
  learningObjectives: string[];
  problem: LPProblem;
  method: LessonMethod;
  intro: string;
  hints: LessonHints;
  pivotQuiz?: QuizQuestion;
}

export const LESSONS: Lesson[] = [
  {
    id: 'l1-graphical',
    number: 1,
    title: 'Graphical Method',
    chapter: 'Chapter 3',
    difficulty: 'Beginner',
    description:
      'Visualize the feasible region and find the optimal corner point for a 2-variable LP problem.',
    learningObjectives: [
      'Graph constraint lines and shade the feasible region',
      'Identify all corner (extreme) points',
      'Evaluate the objective function at each corner',
      'Understand why the optimum always occurs at a corner',
    ],
    problem: {
      objectiveType: 'max',
      objectiveCoefficients: [2, 3],
      variables: ['x1', 'x2'],
      variableSigns: ['nonneg', 'nonneg'],
      constraints: [
        { id: 'c1', coefficients: [1, 1], operator: '<=', rhs: 4 },
        { id: 'c2', coefficients: [1, 3], operator: '<=', rhs: 6 },
      ],
    },
    method: 'simplex',
    intro:
      'The graphical method solves LP problems with exactly 2 decision variables by drawing the constraint lines and shading the feasible region. The optimal solution always occurs at a corner (vertex) of this region. The simplex algorithm moves along edges of the feasible polygon from corner to corner until no further improvement is possible. Watch the graph on the right to see this geometric interpretation.',
    hints: {
      initial:
        'The graph shows the feasible region — the shaded polygon where all constraints are satisfied simultaneously. The simplex method starts at the origin (0, 0), which is the initial BFS with z = 0. The two negative Z-row entries (−2 and −3) indicate both x₁ and x₂ can improve the objective.',
      select_pivot:
        'The most negative Z-row entry (−3 for x₂) corresponds to the steepest edge direction in the feasible polygon. Moving along that edge gives the most improvement per unit. Geometrically, we are choosing which edge of the feasible region to walk along.',
      after_pivot:
        'We moved to a new corner of the feasible region — notice the highlighted point on the graph. The objective value z has increased. We are walking along the boundary of the feasible polygon toward the optimum.',
      optimal:
        'All Z-row coefficients are ≥ 0 — no further improvement is possible. We are at the optimal corner. The objective line (shown in green) is tangent to the feasible region at exactly this point.',
    },
    pivotQuiz: {
      question:
        'The initial Z-row has entries [−2, −3, 0, 0] for [x₁, x₂, s₁, s₂]. Which variable should enter the basis?',
      choices: [
        'x₁ — coefficient −2',
        'x₂ — coefficient −3 (most negative)',
        's₁ — coefficient 0',
        's₂ — coefficient 0',
      ],
      correctIndex: 1,
      explanation:
        'x₂ has the most negative Z-row coefficient (−3), meaning each unit of x₂ added improves z by 3. This is the Dantzig rule: always choose the most negative entry in the Z-row as the entering variable.',
    },
  },

  {
    id: 'l2-simplex-max',
    number: 2,
    title: 'Simplex Method — Maximization',
    chapter: 'Chapter 4',
    difficulty: 'Beginner',
    description:
      'Apply the full simplex algorithm to a 3-constraint maximization problem using slack variables.',
    learningObjectives: [
      'Convert ≤ constraints to equalities by adding slack variables',
      'Set up the initial simplex tableau',
      'Apply the Dantzig rule: enter the variable with the most negative Z-row coefficient',
      'Apply the minimum-ratio test to find the leaving variable',
      'Repeat until all Z-row entries are non-negative',
    ],
    problem: {
      objectiveType: 'max',
      objectiveCoefficients: [3, 2],
      variables: ['x1', 'x2'],
      variableSigns: ['nonneg', 'nonneg'],
      constraints: [
        { id: 'c1', coefficients: [2, 1], operator: '<=', rhs: 18 },
        { id: 'c2', coefficients: [2, 3], operator: '<=', rhs: 42 },
        { id: 'c3', coefficients: [3, 1], operator: '<=', rhs: 24 },
      ],
    },
    method: 'simplex',
    intro:
      'Standard-form maximization: all constraints are ≤ and all variables are ≥ 0. Each ≤ constraint gets one slack variable (s₁, s₂, s₃) added to convert it to an equality. The initial BFS sets all decision variables to zero, making all slacks equal to their respective RHS values. The objective row is written as z − 3x₁ − 2x₂ = 0.',
    hints: {
      initial:
        'Initial basis: {s₁, s₂, s₃} at the origin (x₁ = x₂ = 0, z = 0). Both x₁ (Z-row = −3) and x₂ (Z-row = −2) are negative, meaning both can improve z. The most negative wins: x₁ enters first.',
      select_pivot:
        'Entering variable (Dantzig rule): most negative Z-row entry. Leaving variable (min-ratio test): compute RHS ÷ (positive entries in entering column), take the minimum. The row with the minimum ratio is the pivot row — that basic variable leaves.',
      after_pivot:
        'After row operations, the entering variable\'s column becomes a unit vector. The new objective value z = T[z-row, RHS] has increased. Check whether any Z-row entries are still negative — if so, another pivot is needed.',
      optimal:
        'Optimal! All Z-row entries ≥ 0. Read the solution: for each basic variable, its value is the corresponding RHS entry; non-basic variables = 0. The optimal z* is in the Z-row RHS cell.',
    },
    pivotQuiz: {
      question:
        'In the initial tableau, x₁ enters (Z-row = −3). The x₁ column is [2, 2, 3]ᵀ and the RHS is [18, 42, 24]ᵀ. What does the ratio test give?',
      choices: [
        '18/2 = 9, 42/2 = 21, 24/3 = 8 → minimum = 8 in Row 3 (s₃ leaves)',
        '18/2 = 9, 42/2 = 21, 24/3 = 8 → minimum = 9 in Row 1 (s₁ leaves)',
        '18/3 = 6, 42/3 = 14, 24/1 = 24 → minimum = 6 in Row 1 (s₁ leaves)',
        'We skip the ratio test and choose the row with the largest pivot element',
      ],
      correctIndex: 0,
      explanation:
        'Ratios: 18/2 = 9, 42/2 = 21, 24/3 = 8. The minimum is 8 (Row 3), so s₃ leaves the basis and x₁ enters. The pivot element is 3 (row 3, x₁ column).',
    },
  },

  {
    id: 'l3-simplex-min',
    number: 3,
    title: 'Simplex Method — Minimization',
    chapter: 'Chapter 4',
    difficulty: 'Intermediate',
    description:
      'Solve a minimization problem with ≥ constraints using Big-M surplus and artificial variables.',
    learningObjectives: [
      'Recognize that ≥ constraints require surplus + artificial variables',
      'Add a Big-M penalty for each artificial in the objective',
      'Understand how MIN simplex works: pivot on most negative reduced cost',
      'Verify that all artificials are zero at optimality (problem is feasible)',
    ],
    problem: {
      objectiveType: 'min',
      objectiveCoefficients: [2, 3],
      variables: ['x1', 'x2'],
      variableSigns: ['nonneg', 'nonneg'],
      constraints: [
        { id: 'c1', coefficients: [1, 2], operator: '>=', rhs: 4 },
        { id: 'c2', coefficients: [1, 1], operator: '>=', rhs: 3 },
      ],
    },
    method: 'big-m',
    intro:
      'Minimization with ≥ constraints: the feasible region is now an unbounded set above the constraint lines rather than below. We cannot use the origin as a starting BFS (it violates the ≥ constraints), so we add artificial variables a₁ and a₂ to start the algorithm. Big-M penalizes them in the objective (+M·a for MIN), driving them to zero. Surplus variables s₁ and s₂ measure how much each constraint is exceeded.',
    hints: {
      initial:
        'For each ≥ constraint: x₁ + 2x₂ ≥ 4 becomes x₁ + 2x₂ − s₁ + a₁ = 4. The artificial a₁ starts in the basis at value 4. The Z-row includes +M for each artificial (penalty for MIN). Initial z is huge (M·4 + M·3 = 7M) — the algorithm will reduce this by driving artificials to zero.',
      select_pivot:
        'We want to bring real decision variables into the basis and push out the artificials. The most negative Z-row entry (after M-coefficient elimination from the initial basis) points to the best entering variable.',
      after_pivot:
        'Progress! Each pivot that removes an artificial from the basis brings us closer to the true feasible region. Watch z decrease as the M penalties disappear.',
      optimal:
        'Optimal MIN solution reached. Verify: all artificial variables are nonbasic (= 0). The displayed z* is the true minimum — no M-term remains. If any artificial were still positive, the original problem would be infeasible.',
    },
    pivotQuiz: {
      question:
        'In a MIN problem with Big-M, artificial a₁ has a Z-row coefficient of M − 2 after row operations. What does this mean for entering a₁?',
      choices: [
        'a₁ should enter — it has the most negative reduced cost',
        'a₁ is at its optimal value of zero and need not move',
        'Entering a₁ would increase z by M − 2, which is bad for minimization',
        'There is an error; artificials always have Z-row coefficient = 0',
      ],
      correctIndex: 2,
      explanation:
        'In MIN, entering a variable increases z by its Z-row coefficient. Since M is huge, M − 2 is a large positive number — entering a₁ would massively increase z. The solver correctly avoids it and keeps it nonbasic at zero.',
    },
  },

  {
    id: 'l4-bigm',
    number: 4,
    title: 'Big-M Method',
    chapter: 'Chapter 5',
    difficulty: 'Intermediate',
    description:
      'Handle mixed constraints (≤ and ≥) in a single-phase simplex with large-M penalty variables.',
    learningObjectives: [
      'Add slack variables for ≤ constraints',
      'Add surplus + artificial variables for ≥ constraints',
      'Construct the Big-M augmented objective (−M per artificial for MAX)',
      'Recognize infeasibility: positive artificial at optimality',
    ],
    problem: {
      objectiveType: 'max',
      objectiveCoefficients: [5, 4],
      variables: ['x1', 'x2'],
      variableSigns: ['nonneg', 'nonneg'],
      constraints: [
        { id: 'c1', coefficients: [6, 4], operator: '<=', rhs: 24 },
        { id: 'c2', coefficients: [1, 2], operator: '>=', rhs: 2 },
      ],
    },
    method: 'big-m',
    intro:
      'The Big-M method handles any mix of ≤, ≥, and = constraints in one unified simplex run. For ≤: add slack s. For ≥: subtract surplus s, add artificial a. For =: add artificial a only. Artificials are penalized with −M (for MAX) in the objective, so the optimizer is forced to zero them out before improving the real objective.',
    hints: {
      initial:
        'This problem has one ≤ and one ≥ constraint. The ≤ gets slack s₁ (free, no penalty). The ≥ gets surplus s₂ and artificial a₁ (penalty −M in MAX objective). After eliminating a₁ from the Z-row (it starts basic), notice the large negative entry for a₁\'s column — the algorithm wants to get rid of it.',
      select_pivot:
        'The most negative Z-row entry after M-cleaning is the entering variable. Priority goes to removing the artificial — once a₁ leaves the basis, we are in the true feasible region solving the original MAX problem.',
      after_pivot:
        'Once the artificial a₁ is nonbasic (= 0), we are in the original feasible region. The remaining pivots are standard MAX simplex optimizing 5x₁ + 4x₂ subject to the real constraints.',
      optimal:
        'Optimal! a₁ = 0 confirms feasibility. The optimal solution satisfies both original constraints. The −M term has no effect at the end since a₁ = 0.',
    },
    pivotQuiz: {
      question:
        'For MAX with Big-M, adding artificial a₁ for the ≥ constraint, what is a₁\'s coefficient in the objective function?',
      choices: [
        '+M  (reward artificials to keep them in)',
        '−M  (penalize artificials to force them to zero)',
        '0   (artificials are ignored by the objective)',
        '+1  (unit cost)',
      ],
      correctIndex: 1,
      explanation:
        'In MAX, the penalty is −M: z = 5x₁ + 4x₂ − M·a₁. Having a₁ > 0 reduces z severely, so the optimizer drives a₁ to zero. In MIN it would be +M for the same reason.',
    },
  },

  {
    id: 'l5-twophase',
    number: 5,
    title: 'Two-Phase Method',
    chapter: 'Chapter 5',
    difficulty: 'Advanced',
    description:
      'Find a basic feasible solution in Phase I (minimize artificials), then optimize in Phase II.',
    learningObjectives: [
      'Understand why Two-Phase avoids Big-M numerical precision issues',
      'Phase I: set up and solve the auxiliary LP (minimize sum of artificials)',
      'Interpret Phase I results: w* = 0 means feasible; w* > 0 means infeasible',
      'Phase II: remove artificial columns, restore original objective, continue simplex',
    ],
    problem: {
      objectiveType: 'max',
      objectiveCoefficients: [1, 2],
      variables: ['x1', 'x2'],
      variableSigns: ['nonneg', 'nonneg'],
      constraints: [
        { id: 'c1', coefficients: [1, 1], operator: '=', rhs: 4 },
        { id: 'c2', coefficients: [1, 3], operator: '<=', rhs: 8 },
      ],
    },
    method: 'two-phase',
    intro:
      'The Two-Phase method is an alternative to Big-M that avoids numerical issues with extremely large M values. Phase I constructs an auxiliary LP: minimize w = sum of artificial variables. If the Phase I minimum w* = 0, all artificials can be removed and we have a genuine BFS. Phase II then solves the original problem starting from that BFS with the original objective restored.',
    hints: {
      phase1_initial:
        'Phase I objective: minimize w = a₁ (the only artificial, from the = constraint). The Z-row here reflects this auxiliary objective, not the original profit. We are not maximizing revenue yet — we are just finding a feasible corner point. The = constraint requires an artificial since neither the origin nor any slack gives a feasible start.',
      select_pivot:
        'Standard Dantzig rule applies to the Phase I tableau. We pivot to reduce w toward zero. Once w = 0, the artificial is out of the basis and we have our BFS.',
      phase1_complete:
        'Phase I complete! w* = 0 means all artificials are zero — we have a genuine basic feasible solution that satisfies all original constraints. The artificial column is now removed and the original MAX objective is restored for Phase II.',
      phase2_initial:
        'Phase II begins with the BFS found in Phase I. The Z-row is recomputed: z = x₁ + 2x₂, adjusted for the current basis using row operations. Standard simplex now optimizes the original objective.',
      after_pivot:
        'Standard simplex pivot in Phase II — same rules as always. The objective z = x₁ + 2x₂ is increasing toward optimality.',
      optimal:
        'Optimal solution found by the Two-Phase method. The process guaranteed: (1) Phase I found a genuine BFS (w* = 0), (2) Phase II found the optimum from there using standard simplex.',
    },
    pivotQuiz: {
      question:
        'Why does the Two-Phase method sometimes outperform Big-M numerically?',
      choices: [
        'Two-Phase always uses fewer pivots than Big-M',
        'Big-M requires choosing M "large enough" — too large causes floating-point rounding errors',
        'Two-Phase uses approximate arithmetic which is faster on computers',
        'Two-Phase always finds a smaller (better) optimal value',
      ],
      correctIndex: 1,
      explanation:
        'With Big-M, if M is too small the penalty is insufficient; if too large, floating-point arithmetic loses precision when computing M + small. Two-Phase uses only unit coefficients in Phase I (no M at all), avoiding this issue entirely.',
    },
  },

  {
    id: 'l6-special',
    number: 6,
    title: 'Special Cases',
    chapter: 'Chapter 6',
    difficulty: 'Advanced',
    description:
      'Explore alternative optimal solutions, degeneracy, unbounded objectives, and infeasibility.',
    learningObjectives: [
      'Identify alternative optimal solutions: nonbasic variable with zero reduced cost at optimality',
      'Recognize degeneracy: basic variable with RHS = 0 (zero-valued basic variable)',
      'Detect unboundedness: no positive entries in the entering variable\'s column',
      'Understand why cycling can occur in degenerate problems and how Bland\'s Rule prevents it',
    ],
    problem: {
      objectiveType: 'max',
      objectiveCoefficients: [2, 4],
      variables: ['x1', 'x2'],
      variableSigns: ['nonneg', 'nonneg'],
      constraints: [
        { id: 'c1', coefficients: [1, 2], operator: '<=', rhs: 8 },
        { id: 'c2', coefficients: [1, 1], operator: '<=', rhs: 6 },
      ],
    },
    method: 'simplex',
    intro:
      'Not every LP behaves "normally." This lesson demonstrates alternative optimal solutions: the objective z = 2x₁ + 4x₂ has the same coefficient ratio (1:2) as the constraint x₁ + 2x₂ ≤ 8. When the objective is parallel to an active constraint boundary, the optimal face is an edge rather than a single point — infinitely many optimal solutions exist between two optimal corners.',
    hints: {
      initial:
        'Notice: z = 2x₁ + 4x₂. The constraint x₁ + 2x₂ ≤ 8 has coefficients [1, 2] which is proportional to [2, 4] — the objective coefficients. This means the iso-profit line is parallel to that constraint boundary. An alert! Alternative optima are likely.',
      select_pivot:
        'Standard pivot selection applies. The algorithm will reach the optimum correctly. At optimality, watch the Z-row carefully — a zero coefficient for any nonbasic decision variable is the algebraic signature of alternative optimal solutions.',
      after_pivot:
        'Notice the objective value. If at the optimal, a nonbasic variable has reduced cost = 0, we could pivot again and arrive at a different corner with the same z*.',
      optimal:
        'OPTIMAL REACHED. Examine the final Z-row: if any nonbasic decision variable has a zero reduced cost, there are alternative optimal solutions. The entire edge connecting the two optimal corners is optimal — infinitely many solutions. The system will flag this for you.',
    },
    pivotQuiz: {
      question:
        'At the optimal tableau, nonbasic variable x₁ has Z-row coefficient = 0. What does this indicate?',
      choices: [
        'x₁ is basic with value 0 (this is degeneracy, not an alternative)',
        'The problem is unbounded — x₁ can increase without limit',
        'Pivoting x₁ into the basis would give the same z* — there are infinitely many optimal solutions',
        'Z-row coefficient 0 is always present for slack variables; this is normal',
      ],
      correctIndex: 2,
      explanation:
        'A nonbasic decision variable with zero reduced cost means entering it via a pivot would change the BFS without changing the objective value z*. The optimal face is an edge, not just a corner — infinitely many convex combinations of the two endpoint corners are also optimal.',
    },
  },
];
