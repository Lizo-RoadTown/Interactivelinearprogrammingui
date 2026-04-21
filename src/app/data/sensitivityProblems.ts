/**
 * Chapter 8 — Sensitivity Analysis word problem bank.
 *
 * Each problem REFERENCES an existing Simplex word problem (by ID from
 * wordProblems.ts) as its starting point. The sensitivity question is then
 * layered on top: "You already solved X — now management asks …"
 *
 * Pedagogy (parallel to wordProblems.ts):
 *   1. Word problem: context + "management asks" question
 *   2. Formulation: student identifies which §8.3.X operation this is
 *   3. Tableau-based solving: student clicks/types through the matrix math
 *   4. Graphical reveal: animated slider showing the Δ effect
 *   5. Debrief: plain-English answer grounded in the computation
 */

export type SensitivityOperation =
  /** §8.3.1 — change OF coefficient of a BASIC variable */
  | 'of_coeff_basic'
  /** §8.3.2 — change OF coefficient of a NONBASIC variable */
  | 'of_coeff_nonbasic'
  /** §8.3.3 — change RHS of a constraint (+ §8.3.3.1 shadow price interpretation) */
  | 'rhs_range'
  /** §8.3.4 — change technological coefficient of a NONBASIC variable (stretch/bonus) */
  | 'tech_coeff_nonbasic'
  /** §8.3.5 — add a new decision variable (new activity) */
  | 'add_activity'
  /** §8.3.6 — add a new constraint */
  | 'add_constraint';

export const SECTION_LABEL: Record<SensitivityOperation, string> = {
  of_coeff_basic:      '§8.3.1',
  of_coeff_nonbasic:   '§8.3.2',
  rhs_range:           '§8.3.3',
  tech_coeff_nonbasic: '§8.3.4',
  add_activity:        '§8.3.5',
  add_constraint:      '§8.3.6',
};

export const OPERATION_LABEL: Record<SensitivityOperation, string> = {
  of_coeff_basic:      'Change OF coefficient of a basic variable',
  of_coeff_nonbasic:   'Change OF coefficient of a nonbasic variable',
  rhs_range:           'Change the RHS of a constraint',
  tech_coeff_nonbasic: 'Change a technological coefficient of a nonbasic variable',
  add_activity:        'Add a new activity (new decision variable)',
  add_constraint:      'Add a new constraint',
};

export const OPERATION_SHORT_WHY: Record<SensitivityOperation, string> = {
  of_coeff_basic:
    'A basic variable has its unit cost/profit change. This shifts C_B, which affects every nonbasic reduced cost and the OF value.',
  of_coeff_nonbasic:
    'A nonbasic variable has its unit cost/profit change. This shifts only that one reduced cost — the OF value and all other columns stay put.',
  rhs_range:
    'A constraint has its right-hand side change (resource availability rises or falls). Basic variable values shift via B⁻¹; feasibility may be lost.',
  tech_coeff_nonbasic:
    'A nonbasic variable has its constraint coefficients change (e.g. recipe for a product is updated).',
  add_activity:
    'A brand new decision variable is proposed (e.g. introduce a new product). Check its reduced cost — does it deserve to enter the basis?',
  add_constraint:
    'A brand new constraint is added to the problem (e.g. a new regulation). Check if the current solution still satisfies it.',
};

/** Describes a specific change to apply in the problem. */
export interface SensitivityChange {
  /** For of_coeff_*, rhs_range, tech_coeff_nonbasic: which variable/constraint. */
  target?: {
    /** 'x1', 'x2', etc for variable-targeted ops; constraint index (1-based) for rhs_range. */
    name: string;
  };
  /** Δ (parametric delta) or new value. String form so it reads naturally in the prompt. */
  description: string;
  /** Numeric Δ for the animated slider reveal. Omit for add_activity / add_constraint. */
  delta?: number;
  /** For add_activity: the new column and OF coefficient. */
  newActivity?: {
    aVector: number[];
    cCoefficient: number;
    label: string;
  };
  /** For add_constraint: coefficients, operator, RHS. */
  newConstraint?: {
    coefficients: number[];
    operator: '<=' | '>=' | '=';
    rhs: number;
  };
}

export interface SensitivityProblem {
  id: string;
  /** The simplex word problem this extends. Must exist in wordProblems.ts. */
  baseProblemId: string;
  /** Short title for the browser tile. */
  title: string;
  /** Teacher-framing: which §8.3 operation this problem exemplifies. */
  operation: SensitivityOperation;
  /** The "management asks" scenario text shown after the base problem is solved. */
  managementAsks: string;
  /** The specific change to apply. */
  change: SensitivityChange;
  /** Hint shown during the "identify the operation" step if the student guesses wrong. */
  operationHint: string;
  /** Plain-English debrief text shown at the end, with placeholders filled by the runtime. */
  debriefTemplate: string;
  /** Difficulty for the browser tier. */
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

// ─────────────────────────────────────────────────────────────────────────────
// Problem bank — start small. More added as each §8.3 operation is built out.
// ─────────────────────────────────────────────────────────────────────────────

export const SENSITIVITY_PROBLEMS: SensitivityProblem[] = [

  // §8.3.1 — OF coefficient of a basic variable
  {
    id: 'sens-toy-truck-profit-drop',
    baseProblemId: 'wp-toy-factory',
    title: 'Toy Factory — truck profit drops',
    operation: 'of_coeff_basic',
    difficulty: 'Beginner',
    managementAsks:
      'Your supplier is raising the cost of truck parts. As a result, profit per toy truck ' +
      'will drop from $20 to $12. Before you change your production schedule, management ' +
      'wants to know: does the optimal product mix stay the same? What is the new weekly profit?',
    change: {
      target: { name: 'x2' },
      description: 'Profit per truck changes from $20 to $12 per unit (Δ = −8).',
      delta: -8,
    },
    operationHint:
      'Look at the current basis. Which variable is basic — x₁ (cars) or x₂ (trucks)? ' +
      'If trucks are basic, changing their OF coefficient changes C_B, which affects every ' +
      'nonbasic reduced cost. That is §8.3.1.',
    debriefTemplate:
      'The allowable range for the x₂ coefficient is [{lower}, {upper}]. Because the new ' +
      'value (12) is {withinOrOutside} this range, the optimal mix {staysOrChanges}. ' +
      'New weekly profit: {newZ}.',
  },

  // §8.3.3 — change RHS of a constraint
  {
    id: 'sens-bakery-extra-flour',
    baseProblemId: 'wp-bakery',
    title: 'Bakery — buy extra flour?',
    operation: 'rhs_range',
    difficulty: 'Beginner',
    managementAsks:
      'A supplier is offering an extra 10 lbs of flour for a flat $15 fee. Management wants ' +
      'to know: given your current solution, how much is an additional pound of flour ' +
      'actually worth? Is buying the extra flour a good deal?',
    change: {
      target: { name: 'c1' },
      description: 'Increase constraint 1 (flour) RHS by 10 lbs.',
      delta: 10,
    },
    operationHint:
      'A constraint right-hand side is changing. This is §8.3.3. The shadow price (§8.3.3.1) ' +
      'tells you exactly how much 1 extra lb of flour is worth in profit.',
    debriefTemplate:
      'The shadow price of constraint 1 is {shadowPrice}. Over 10 additional lbs that\u2019s ' +
      '{totalGain} in extra revenue, minus the $15 cost = {netGain}. ' +
      'The optimal range for the RHS is [{lower}, {upper}], so the shadow price is valid ' +
      'only while the new RHS stays in that range.',
  },

  // §8.3.5 — add a new activity
  {
    id: 'sens-farm-add-rye',
    baseProblemId: 'wp-farm',
    title: 'Farm — should we add a rye crop?',
    operation: 'add_activity',
    difficulty: 'Intermediate',
    managementAsks:
      'A seed dealer is pitching rye as a new crop option. Rye uses 2 units of water per ' +
      'acre (and no other resources) and would earn $150/acre profit. Should you add rye ' +
      'to your portfolio, or is your current corn/soybean mix still best?',
    change: {
      target: { name: 'x3' },
      description: 'New activity x₃ (rye): column [0, 2]ᵀ, profit $150/acre.',
      newActivity: {
        aVector: [0, 2],
        cCoefficient: 150,
        label: 'rye',
      },
    },
    operationHint:
      'A new decision variable is being proposed. This is §8.3.5. The test: does this new ' +
      'variable have a profitable reduced cost? Compute c̄ = C_B·B⁻¹·a_new − c_new.',
    debriefTemplate:
      'The reduced cost of rye is {reducedCost}. Because it {positiveOrNegative}, rye ' +
      '{shouldOrShouldNot} enter the basis, so {plantOrSkip} rye.',
  },

];

export function getSensitivityProblem(id: string): SensitivityProblem | undefined {
  return SENSITIVITY_PROBLEMS.find(p => p.id === id);
}
