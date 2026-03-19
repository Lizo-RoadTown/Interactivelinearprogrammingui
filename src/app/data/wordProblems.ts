/**
 * Word problem bank for Practice Mode.
 * Each problem stores the scenario text, correct LP formulation, method,
 * formulation hints (one per step), and solving hints (per step type).
 */

import { Constraint } from '../types';
import { LessonHints } from './lessons';

export type WPDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type WPCategory =
  | 'Product Mix'
  | 'Resource Allocation'
  | 'Diet / Nutrition'
  | 'Production Planning'
  | 'Special Cases';
export type WPMethod = 'simplex' | 'big-m' | 'two-phase';

export interface WPVariable {
  name: string;        // 'x1', 'x2', 'x3'
  description: string; // 'toy cars produced per week'
}

export interface FormulationHints {
  variables: string;      // hint for "what are the variables?" step
  objective: string;      // hint for objective type + coefficients
  constraints: string[];  // one hint per constraint
  method: string;         // hint for method selection
}

/**
 * Scenario text highlights — substrings to color-code at each formulation step.
 * Each array entry is a literal substring of the scenario text.
 * Color semantics:
 *   vars        → indigo    (decision variable mentions)
 *   objective   → purple    (objective coefficients + direction)
 *   constraints → indexed colors per constraint (green, amber, rose, blue, …)
 */
export interface ScenarioHighlights {
  vars: string[];                // substrings about the decision variables
  objective: string[];           // substrings about the objective function
  constraints: string[][];       // constraints[i] = substrings for constraint i
}

export interface WordProblem {
  id: string;
  title: string;
  category: WPCategory;
  difficulty: WPDifficulty;
  numVars: number;
  scenario: string;

  // ── Correct answers (used for checking student formulation) ──────────────
  variables: WPVariable[];
  objectiveType: 'max' | 'min';
  objectiveCoefficients: number[];
  constraints: Constraint[];
  method: WPMethod;

  // ── Guidance ─────────────────────────────────────────────────────────────
  formulationHints: FormulationHints;
  methodExplanation: string;
  solvingHints: LessonHints;

  specialCaseNote?: string; // shown as a banner when solving special-case problems

  // ── Scenario text highlights ───────────────────────────────────────────────
  highlights?: ScenarioHighlights;
}

// ─────────────────────────────────────────────────────────────────────────────

export const WORD_PROBLEMS: WordProblem[] = [

  // ── 1: Toy Factory — Simplex MAX, 2 vars, Beginner ───────────────────────
  {
    id: 'wp-toy-factory',
    title: 'Toy Factory',
    category: 'Product Mix',
    difficulty: 'Beginner',
    numVars: 2,
    scenario:
      'A toy company makes toy cars and toy trucks. Each toy car requires ' +
      '2 hours of assembly and 3 hours of painting. Each toy truck requires ' +
      '4 hours of assembly and 2 hours of painting. The factory has 80 hours ' +
      'of assembly time and 60 hours of painting time available each week. ' +
      'The profit is $15 per toy car and $20 per toy truck. ' +
      'How many of each should be produced weekly to maximize total profit?',
    variables: [
      { name: 'x1', description: 'toy cars produced per week' },
      { name: 'x2', description: 'toy trucks produced per week' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [15, 20],
    constraints: [
      { id: 'c1', coefficients: [2, 4], operator: '<=', rhs: 80, label: 'Assembly hours' },
      { id: 'c2', coefficients: [3, 2], operator: '<=', rhs: 60, label: 'Painting hours' },
    ],
    method: 'simplex',
    formulationHints: {
      variables:
        'The company makes two products. Let x1 represent one product and x2 the other. ' +
        'Variables should count how many of each product is made.',
      objective:
        'We want to make as much money as possible — that means we are MAXimizing. ' +
        'The profit per unit of each product becomes the objective coefficients.',
      constraints: [
        'The first constraint is about assembly hours. How many assembly hours does each product use? ' +
        'What is the total available? Write: (hours per car) × x1 + (hours per truck) × x2 ≤ (total available).',
        'The second constraint is about painting hours. Same structure: ' +
        '(hours per car) × x1 + (hours per truck) × x2 ≤ (total available).',
      ],
      method:
        'Look at your constraints — are they all ≤? If every constraint is ≤ and all variables are ≥ 0, ' +
        'the standard Simplex method works perfectly. No artificial variables are needed.',
    },
    methodExplanation:
      'Both constraints are ≤ type, so we can add slack variables and use the standard Simplex method ' +
      'directly. The initial BFS is at the origin (x1 = x2 = 0) with all slacks in the basis.',
    solvingHints: {
      initial:
        'Initial tableau is set up. Slack variables s1 (assembly) and s2 (painting) are in the basis. ' +
        'x1 = x2 = 0, z = 0. Both Z-row entries are negative, meaning both products can improve profit.',
      select_pivot:
        'Dantzig rule: pick the most negative Z-row coefficient as the entering variable. ' +
        'Then use the ratio test: divide each positive entry in that column into the RHS. ' +
        'The minimum positive ratio gives the leaving variable.',
      after_pivot:
        'A pivot was completed. The objective has increased — we moved to a better corner of the ' +
        'feasible region. Check if any Z-row entries are still negative.',
      optimal:
        'All Z-row entries ≥ 0. Read the solution: basic variables take their RHS values, ' +
        'nonbasic variables = 0. Optimal profit z* is in the Z-row RHS cell.',
    },
    highlights: {
      vars: ['toy cars', 'toy trucks'],
      objective: ['$15 per toy car and $20 per toy truck', 'maximize total profit'],
      constraints: [
        ['2 hours of assembly', '4 hours of assembly', '80 hours of assembly time'],
        ['3 hours of painting', '2 hours of painting', '60 hours of painting time'],
      ],
    },
  },

  // ── 2: Bakery — Simplex MAX, 2 vars, Beginner ────────────────────────────
  {
    id: 'wp-bakery',
    title: 'Bakery Production',
    category: 'Product Mix',
    difficulty: 'Beginner',
    numVars: 2,
    scenario:
      'A bakery makes cakes (x1) and pastry batches (x2) each day. Each cake requires ' +
      '3 lbs of flour and 2 eggs. Each pastry batch requires 1 lb of flour and 4 eggs. ' +
      'The bakery has 30 lbs of flour and 40 eggs available daily. ' +
      'Revenue is $12 per cake and $9 per pastry batch. ' +
      'How many cakes and pastry batches should be made daily to maximize revenue?',
    variables: [
      { name: 'x1', description: 'cakes baked per day' },
      { name: 'x2', description: 'pastry batches made per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [12, 9],
    constraints: [
      { id: 'c1', coefficients: [3, 1], operator: '<=', rhs: 30, label: 'Flour (lbs)' },
      { id: 'c2', coefficients: [2, 4], operator: '<=', rhs: 40, label: 'Eggs' },
    ],
    method: 'simplex',
    formulationHints: {
      variables:
        'Two products are being made. x1 and x2 represent how many of each product is produced daily.',
      objective:
        'We want to earn as much revenue as possible — MAXimize. ' +
        'The coefficients come from the revenue per unit of each product.',
      constraints: [
        'First, flour. Each cake uses 3 lbs, each pastry batch uses 1 lb, and 30 lbs are available: ' +
        '3x1 + 1x2 ≤ 30.',
        'Second, eggs. Each cake uses 2 eggs, each batch uses 4 eggs, 40 eggs available: ' +
        '2x1 + 4x2 ≤ 40.',
      ],
      method:
        'Both constraints are ≤. Standard Simplex handles this case directly.',
    },
    methodExplanation:
      'All ≤ constraints, all variables ≥ 0. Add slack variables s1 and s2. ' +
      'Standard Simplex, no artificial variables needed.',
    solvingHints: {
      initial:
        'Initial BFS: x1 = x2 = 0, s1 = 30 (all flour unused), s2 = 40 (all eggs unused), z = 0. ' +
        'Z-row shows −12 and −9 — both products would improve revenue.',
      select_pivot:
        'x1 has the more negative Z-row coefficient (−12). Apply the ratio test: ' +
        '30/3 = 10, 40/2 = 20. Minimum ratio is 10 (row 1), so s1 leaves.',
      after_pivot:
        'x1 entered the basis. z increased. Check if any Z-row coefficients are still negative.',
      optimal:
        'Optimal revenue reached. Read x1 and x2 from the basis — those are the production quantities.',
    },
    highlights: {
      vars: ['cakes (x1)', 'pastry batches (x2)'],
      objective: ['$12 per cake and $9 per pastry batch', 'maximize revenue'],
      constraints: [
        ['3 lbs of flour', '1 lb of flour', '30 lbs of flour'],
        ['2 eggs', '4 eggs', '40 eggs'],
      ],
    },
  },

  // ── 3: Farm Planning — Simplex MAX, 2 vars, Beginner ─────────────────────
  {
    id: 'wp-farm',
    title: 'Farm Crop Planning',
    category: 'Resource Allocation',
    difficulty: 'Beginner',
    numVars: 2,
    scenario:
      'A farmer has 100 acres available and wants to plant corn (x1) and soybeans (x2). ' +
      'Each acre of corn requires 3 hours of seasonal labor and yields $200 profit. ' +
      'Each acre of soybeans requires 2 hours and yields $150 profit. ' +
      'The farmer has 240 hours of labor available. Due to crop rotation rules, ' +
      'at most 60 acres can be planted with corn. ' +
      'How should the farmer allocate acreage to maximize total profit?',
    variables: [
      { name: 'x1', description: 'acres planted with corn' },
      { name: 'x2', description: 'acres planted with soybeans' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [200, 150],
    constraints: [
      { id: 'c1', coefficients: [1, 1], operator: '<=', rhs: 100, label: 'Total acreage' },
      { id: 'c2', coefficients: [3, 2], operator: '<=', rhs: 240, label: 'Labor hours' },
      { id: 'c3', coefficients: [1, 0], operator: '<=', rhs: 60, label: 'Corn rotation limit' },
    ],
    method: 'simplex',
    formulationHints: {
      variables:
        'The farmer is deciding how many acres to devote to each crop. x1 = corn acres, x2 = soybean acres.',
      objective:
        'MAXimize profit. Each acre of corn yields $200, each soybean acre yields $150.',
      constraints: [
        'Total land: x1 + x2 ≤ 100 (only 100 acres available).',
        'Labor: each corn acre takes 3 hrs, each soybean acre takes 2 hrs, 240 hrs total: 3x1 + 2x2 ≤ 240.',
        'Rotation limit: at most 60 acres of corn: x1 ≤ 60. Write this as 1·x1 + 0·x2 ≤ 60.',
      ],
      method:
        'Three ≤ constraints. Standard Simplex with three slack variables.',
    },
    methodExplanation:
      'All three constraints are ≤. Three slack variables are added. Standard Simplex method applies.',
    solvingHints: {
      initial:
        'Three constraints → three slacks (s1, s2, s3). Initial BFS at the origin, z = 0. ' +
        'Both −200 and −150 in the Z-row indicate both crops are profitable — corn is more so.',
      select_pivot:
        'x1 (corn) enters first — most negative Z-row value (−200). ' +
        'Ratio test across three rows to find the leaving variable.',
      after_pivot:
        'Basis changed. z increased. Still negative Z-row entries? Another pivot needed.',
      optimal:
        'Optimal allocation found. Check which constraints are binding (slack = 0) — ' +
        'those resources are fully used.',
    },
    highlights: {
      vars: ['corn (x1)', 'soybeans (x2)'],
      objective: ['$200 profit', '$150 profit', 'maximize total profit'],
      constraints: [
        ['100 acres available'],
        ['3 hours of seasonal labor', '2 hours', '240 hours of labor available'],
        ['at most 60 acres can be planted with corn'],
      ],
    },
  },

  // ── 4: Electronics — Simplex MAX, 2 vars, Intermediate ───────────────────
  {
    id: 'wp-electronics',
    title: 'Electronics Manufacturer',
    category: 'Product Mix',
    difficulty: 'Intermediate',
    numVars: 2,
    scenario:
      'An electronics company manufactures smartphones (x1) and tablets (x2). ' +
      'Each smartphone requires 2 hours of assembly and 1 hour of quality testing. ' +
      'Each tablet requires 3 hours of assembly and 2 hours of testing. ' +
      'Available daily: 120 assembly hours and 70 testing hours. ' +
      'Profit is $80 per smartphone and $150 per tablet. ' +
      'How many units of each should be produced daily to maximize profit?',
    variables: [
      { name: 'x1', description: 'smartphones produced per day' },
      { name: 'x2', description: 'tablets produced per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [80, 150],
    constraints: [
      { id: 'c1', coefficients: [2, 3], operator: '<=', rhs: 120, label: 'Assembly hours' },
      { id: 'c2', coefficients: [1, 2], operator: '<=', rhs: 70, label: 'Testing hours' },
    ],
    method: 'simplex',
    formulationHints: {
      variables:
        'Two products: x1 = smartphones per day, x2 = tablets per day.',
      objective:
        'Maximize profit. $80 per smartphone (coefficient on x1), $150 per tablet (coefficient on x2).',
      constraints: [
        'Assembly: each smartphone uses 2 hrs, each tablet uses 3 hrs, 120 hrs available.',
        'Testing: each smartphone uses 1 hr, each tablet uses 2 hrs, 70 hrs available.',
      ],
      method:
        'All ≤ constraints → standard Simplex.',
    },
    methodExplanation:
      'Both constraints are ≤ type. Add slacks s1 and s2. Standard Simplex method.',
    solvingHints: {
      initial:
        'x1 = x2 = 0, z = 0. Both products profitable: Z-row shows −80 and −150. ' +
        'Tablets (x2) have the larger magnitude — likely enters first.',
      select_pivot:
        'Most negative Z-row entry determines the entering column. ' +
        'Ratio test picks the leaving row.',
      after_pivot:
        'Progress toward optimum. Objective increased. Check for remaining negative Z-row entries.',
      optimal:
        'Optimal production mix found.',
    },
    highlights: {
      vars: ['smartphones (x1)', 'tablets (x2)'],
      objective: ['$80 per smartphone and $150 per tablet', 'maximize profit'],
      constraints: [
        ['2 hours of assembly', '3 hours of assembly', '120 assembly hours'],
        ['1 hour of quality testing', '2 hours of testing', '70 testing hours'],
      ],
    },
  },

  // ── 5: Three-Product Factory — Simplex MAX, 3 vars, Intermediate ─────────
  {
    id: 'wp-three-product',
    title: 'Three-Product Factory',
    category: 'Product Mix',
    difficulty: 'Intermediate',
    numVars: 3,
    scenario:
      'A factory makes three products: A (x1), B (x2), and C (x3). ' +
      'Machine time per unit: A needs 2 hrs, B needs 1 hr, C needs 3 hrs. Total: 60 hrs available. ' +
      'Labor per unit: A needs 1 hr, B needs 2 hrs, C needs 1 hr. Total: 40 hrs available. ' +
      'Raw material per unit: A needs 1 unit, B needs 1 unit, C needs 2 units. Total: 30 units available. ' +
      'Profit per unit: $5 for A, $8 for B, $6 for C. ' +
      'How much of each product should be made to maximize total profit?',
    variables: [
      { name: 'x1', description: 'units of Product A produced' },
      { name: 'x2', description: 'units of Product B produced' },
      { name: 'x3', description: 'units of Product C produced' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [5, 8, 6],
    constraints: [
      { id: 'c1', coefficients: [2, 1, 3], operator: '<=', rhs: 60, label: 'Machine time' },
      { id: 'c2', coefficients: [1, 2, 1], operator: '<=', rhs: 40, label: 'Labor hours' },
      { id: 'c3', coefficients: [1, 1, 2], operator: '<=', rhs: 30, label: 'Raw materials' },
    ],
    method: 'simplex',
    formulationHints: {
      variables:
        'Three products → three decision variables. x1, x2, x3 represent units of each product made.',
      objective:
        'Maximize total profit. Coefficient for each variable is its profit per unit.',
      constraints: [
        'Machine time: 2x1 + 1x2 + 3x3 ≤ 60 (hours each product consumes).',
        'Labor: 1x1 + 2x2 + 1x3 ≤ 40.',
        'Raw material: 1x1 + 1x2 + 2x3 ≤ 30.',
      ],
      method:
        'All ≤ constraints and all variables ≥ 0. Standard Simplex handles 3-variable problems the ' +
        'same way as 2-variable ones — the tableau just has more columns. Note: the graph view is not ' +
        'available for 3-variable problems.',
    },
    methodExplanation:
      'Standard Simplex: all ≤ constraints, three slack variables added. ' +
      'No graph is shown for 3-variable problems, but the tableau works identically.',
    solvingHints: {
      initial:
        'Three constraints → three slacks. Initial BFS at the origin, all decision variables = 0. ' +
        'The most negative Z-row entry is −8 (for x2, Product B), so B enters first.',
      select_pivot:
        'Apply the Dantzig rule across 3 variable columns and ratio test across 3 rows.',
      after_pivot:
        'With 3 variables there may be 2–3 pivots to reach optimality.',
      optimal:
        'Optimal production quantities found. Some products may be zero (not worth producing at optimum).',
    },
    highlights: {
      vars: ['A (x1)', 'B (x2)', 'C (x3)'],
      objective: ['$5 for A, $8 for B, $6 for C', 'maximize total profit'],
      constraints: [
        ['A needs 2 hrs, B needs 1 hr, C needs 3 hrs. Total: 60 hrs available'],
        ['A needs 1 hr, B needs 2 hrs, C needs 1 hr. Total: 40 hrs available'],
        ['A needs 1 unit, B needs 1 unit, C needs 2 units. Total: 30 units available'],
      ],
    },
  },

  // ── 6: Nutrition Diet — Big-M MIN, 2 vars, Intermediate ─────────────────
  {
    id: 'wp-nutrition',
    title: 'Nutrition Diet Plan',
    category: 'Diet / Nutrition',
    difficulty: 'Intermediate',
    numVars: 2,
    scenario:
      'A nutritionist needs to design a daily supplement plan using two products. ' +
      'Supplement A (x1, servings) costs $2/serving and provides 4g protein, 2g fiber. ' +
      'Supplement B (x2, servings) costs $3/serving and provides 2g protein, 6g fiber. ' +
      'The daily plan must provide at least 16g of protein and at least 18g of fiber. ' +
      'How many servings of each supplement should be taken to minimize daily cost?',
    variables: [
      { name: 'x1', description: 'servings of Supplement A per day' },
      { name: 'x2', description: 'servings of Supplement B per day' },
    ],
    objectiveType: 'min',
    objectiveCoefficients: [2, 3],
    constraints: [
      { id: 'c1', coefficients: [4, 2], operator: '>=', rhs: 16, label: 'Protein requirement' },
      { id: 'c2', coefficients: [2, 6], operator: '>=', rhs: 18, label: 'Fiber requirement' },
    ],
    method: 'big-m',
    formulationHints: {
      variables:
        'Two supplements → x1 = servings of A per day, x2 = servings of B per day.',
      objective:
        'We want to spend as little as possible → MINimize cost. ' +
        'Cost per serving becomes the objective coefficient.',
      constraints: [
        'Protein: must have AT LEAST 16g. This is a ≥ constraint: 4x1 + 2x2 ≥ 16.',
        'Fiber: must have AT LEAST 18g. Another ≥: 2x1 + 6x2 ≥ 18. ' +
        'You can simplify by dividing by 2: x1 + 3x2 ≥ 9.',
      ],
      method:
        'Your constraints are ≥ type. The origin (0, 0) violates both — it\'s not a feasible starting ' +
        'point. We need artificial variables to find an initial BFS. That means Big-M (or Two-Phase).',
    },
    methodExplanation:
      'Both constraints are ≥. Each gets a surplus variable (subtracted) and an artificial variable ' +
      '(added) to create the initial BFS. The Big-M method penalizes artificials in the MIN objective ' +
      'with +M, forcing them to zero.',
    solvingHints: {
      initial:
        'Artificials a1 and a2 start in the basis. The Z-row has been adjusted to eliminate the basic ' +
        'artificials. The large positive M-coefficients will drive the algorithm toward feasibility first.',
      select_pivot:
        'For MIN Big-M: enter the variable with the most negative reduced cost (Z-row coefficient). ' +
        'The goal is to bring real variables in and push artificials out.',
      after_pivot:
        'Watch the artificials: as they leave the basis, we move into the true feasible region.',
      optimal:
        'MIN optimum reached. Both artificials should be nonbasic at zero. ' +
        'If any artificial is still positive, the original problem is infeasible.',
    },
    highlights: {
      vars: ['Supplement A (x1, servings)', 'Supplement B (x2, servings)'],
      objective: ['$2/serving', '$3/serving', 'minimize daily cost'],
      constraints: [
        ['4g protein', '2g protein', 'at least 16g of protein'],
        ['2g fiber', '6g fiber', 'at least 18g of fiber'],
      ],
    },
  },

  // ── 7: Production Contract — Big-M MAX, 2 vars, Intermediate ─────────────
  {
    id: 'wp-contract',
    title: 'Production Contract',
    category: 'Production Planning',
    difficulty: 'Intermediate',
    numVars: 2,
    scenario:
      'A manufacturer makes regular widgets (x1) and premium widgets (x2). ' +
      'Each regular widget uses 2 kg of raw material and 1 labor hour. ' +
      'Each premium widget uses 3 kg and 2 hours. ' +
      'Available: 120 kg raw material and 60 labor hours per day. ' +
      'The company has a contract requiring at least 10 premium widgets per day. ' +
      'Profit is $8 per regular widget and $15 per premium. Maximize daily profit.',
    variables: [
      { name: 'x1', description: 'regular widgets per day' },
      { name: 'x2', description: 'premium widgets per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [8, 15],
    constraints: [
      { id: 'c1', coefficients: [2, 3], operator: '<=', rhs: 120, label: 'Raw material (kg)' },
      { id: 'c2', coefficients: [1, 2], operator: '<=', rhs: 60, label: 'Labor hours' },
      { id: 'c3', coefficients: [0, 1], operator: '>=', rhs: 10, label: 'Contract minimum (premium)' },
    ],
    method: 'big-m',
    formulationHints: {
      variables:
        'Two products: x1 = regular widgets/day, x2 = premium widgets/day.',
      objective:
        'Maximize profit: $8 per regular (x1), $15 per premium (x2).',
      constraints: [
        'Raw material: 2x1 + 3x2 ≤ 120.',
        'Labor: x1 + 2x2 ≤ 60.',
        'Contract minimum: must produce at least 10 premium widgets. This is a ≥ constraint: ' +
        '0·x1 + 1·x2 ≥ 10.',
      ],
      method:
        'You have a ≥ constraint (the contract minimum). The origin violates this constraint, ' +
        'so an artificial variable is needed for that row. Big-M handles mixed constraint types.',
    },
    methodExplanation:
      'Two ≤ constraints (get slack variables) and one ≥ constraint (gets surplus + artificial). ' +
      'Big-M penalizes the artificial with −M in the MAX objective.',
    solvingHints: {
      initial:
        'Mixed constraint types: s1 and s2 are slacks for the ≤ rows, s3 is surplus and a1 is ' +
        'artificial for the ≥ row. Initial basis: {s1, s2, a1}. Z-row has been M-adjusted.',
      select_pivot:
        'The algorithm will first drive a1 to zero (entering x2 to satisfy the contract), ' +
        'then optimize the real objective.',
      after_pivot:
        'Once a1 leaves the basis (x2 ≥ 10 satisfied), standard MAX simplex continues.',
      optimal:
        'Optimal solution satisfies all constraints including the contract. ' +
        'Verify: x2 should be ≥ 10 in the solution.',
    },
    highlights: {
      vars: ['regular widgets (x1)', 'premium widgets (x2)'],
      objective: ['$8 per regular widget and $15 per premium', 'Maximize daily profit'],
      constraints: [
        ['2 kg of raw material', '3 kg', '120 kg raw material'],
        ['1 labor hour', '2 hours', '60 labor hours'],
        ['at least 10 premium widgets per day'],
      ],
    },
  },

  // ── 8: Advertising Mix — Big-M MAX, 2 vars, Intermediate ─────────────────
  {
    id: 'wp-advertising',
    title: 'Advertising Campaign',
    category: 'Resource Allocation',
    difficulty: 'Intermediate',
    numVars: 2,
    scenario:
      'A marketing team plans an ad campaign with two channels: TV (x1, thousands of $) ' +
      'and social media (x2, thousands of $). ' +
      'Expected return: $6,000 per $1k TV spend, $8,000 per $1k social spend. ' +
      'Total budget cap: $20,000 (x1 + x2 ≤ 20). ' +
      'Brand guidelines require at least $5,000 on TV (x1 ≥ 5). ' +
      'Social media cap: at most $12,000 (x2 ≤ 12). ' +
      'Maximize total expected return.',
    variables: [
      { name: 'x1', description: 'TV budget (thousands of dollars)' },
      { name: 'x2', description: 'social media budget (thousands of dollars)' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [6, 8],
    constraints: [
      { id: 'c1', coefficients: [1, 1], operator: '<=', rhs: 20, label: 'Total budget ($k)' },
      { id: 'c2', coefficients: [1, 0], operator: '>=', rhs: 5, label: 'Minimum TV ($k)' },
      { id: 'c3', coefficients: [0, 1], operator: '<=', rhs: 12, label: 'Social media cap ($k)' },
    ],
    method: 'big-m',
    formulationHints: {
      variables:
        'Two budget allocations: x1 = TV spend (thousands), x2 = social spend (thousands).',
      objective:
        'Maximize return. Coefficients are the return rate per thousand dollars spent on each channel.',
      constraints: [
        'Total budget: x1 + x2 ≤ 20 (cannot exceed $20k total).',
        'Brand minimum: must spend at least $5k on TV. This is ≥: 1·x1 + 0·x2 ≥ 5.',
        'Social cap: x2 ≤ 12 (social media capped at $12k).',
      ],
      method:
        'Mixed constraint types (≤ and ≥). The ≥ constraint needs an artificial variable → Big-M.',
    },
    methodExplanation:
      'Two ≤ constraints get slacks, the ≥ constraint gets a surplus + artificial. ' +
      'Big-M penalizes the artificial in the MAX objective.',
    solvingHints: {
      initial:
        'Slacks for ≤ rows, surplus + artificial for the ≥ row. ' +
        'The algorithm first satisfies the brand minimum (drives a1 out), then maximizes return.',
      select_pivot:
        'Standard Dantzig rule after M-row cleanup.',
      after_pivot:
        'Each pivot improves the objective while maintaining feasibility.',
      optimal:
        'Optimal allocation satisfies all budget constraints. Note the social media and TV amounts in the solution.',
    },
    highlights: {
      vars: ['TV (x1, thousands of $)', 'social media (x2, thousands of $)'],
      objective: ['$6,000 per $1k TV spend, $8,000 per $1k social spend', 'Maximize total expected return'],
      constraints: [
        ['Total budget cap: $20,000 (x1 + x2 ≤ 20)'],
        ['at least $5,000 on TV (x1 ≥ 5)'],
        ['at most $12,000 (x2 ≤ 12)'],
      ],
    },
  },

  // ── 9: Hospital Staffing — Big-M MIN, 3 vars, Advanced ───────────────────
  {
    id: 'wp-hospital',
    title: 'Hospital Shift Staffing',
    category: 'Production Planning',
    difficulty: 'Advanced',
    numVars: 3,
    scenario:
      'A hospital needs to staff three shifts: morning (x1), afternoon (x2), evening (x3). ' +
      'Cost per nurse: $300/morning shift, $400/afternoon, $350/evening. ' +
      'Minimum staffing: at least 8 nurses in the morning, at least 6 in the afternoon, ' +
      'at least 4 in the evening. ' +
      'Total capacity: at most 25 nurses total (break room limit). ' +
      'Evening is capped at 10 nurses maximum. ' +
      'Minimize total daily staffing cost.',
    variables: [
      { name: 'x1', description: 'morning shift nurses' },
      { name: 'x2', description: 'afternoon shift nurses' },
      { name: 'x3', description: 'evening shift nurses' },
    ],
    objectiveType: 'min',
    objectiveCoefficients: [300, 400, 350],
    constraints: [
      { id: 'c1', coefficients: [1, 0, 0], operator: '>=', rhs: 8, label: 'Morning minimum' },
      { id: 'c2', coefficients: [0, 1, 0], operator: '>=', rhs: 6, label: 'Afternoon minimum' },
      { id: 'c3', coefficients: [0, 0, 1], operator: '>=', rhs: 4, label: 'Evening minimum' },
      { id: 'c4', coefficients: [1, 1, 1], operator: '<=', rhs: 25, label: 'Total capacity' },
      { id: 'c5', coefficients: [0, 0, 1], operator: '<=', rhs: 10, label: 'Evening maximum' },
    ],
    method: 'big-m',
    formulationHints: {
      variables:
        'Three shifts → three variables: x1 = morning nurses, x2 = afternoon nurses, x3 = evening nurses.',
      objective:
        'Minimize cost. Each shift\'s cost per nurse is the objective coefficient.',
      constraints: [
        'Morning minimum: x1 ≥ 8.',
        'Afternoon minimum: x2 ≥ 6.',
        'Evening minimum: x3 ≥ 4.',
        'Total capacity: x1 + x2 + x3 ≤ 25.',
        'Evening cap: x3 ≤ 10.',
      ],
      method:
        'Three ≥ constraints need artificial variables. Mixed with two ≤ constraints. Big-M method.',
    },
    methodExplanation:
      'Three ≥ constraints each require a surplus and artificial variable. ' +
      'The two ≤ constraints get slacks. Big-M adds +M to each artificial in the MIN objective. ' +
      'No graph is available for 3-variable problems.',
    solvingHints: {
      initial:
        'Three artificials in initial basis. The algorithm will satisfy all minimum staffing ' +
        'requirements (drive artificials to zero) before minimizing actual cost.',
      select_pivot:
        'In a MIN problem, enter the column with the most negative Z-row value (after M-row cleanup).',
      after_pivot:
        'Each pivot that removes an artificial means one more staffing requirement is satisfied.',
      optimal:
        'Optimal staffing found. All ≥ constraints satisfied (artificials = 0). ' +
        'Cost is minimized subject to all constraints.',
    },
    highlights: {
      vars: ['morning (x1)', 'afternoon (x2)', 'evening (x3)'],
      objective: ['$300/morning shift, $400/afternoon, $350/evening', 'Minimize total daily staffing cost'],
      constraints: [
        ['at least 8 nurses in the morning'],
        ['at least 6 in the afternoon'],
        ['at least 4 in the evening'],
        ['at most 25 nurses total (break room limit)'],
        ['capped at 10 nurses maximum'],
      ],
    },
  },

  // ── 10: Chemical Batch — Two-Phase MAX, 2 vars, Advanced ─────────────────
  {
    id: 'wp-chemical-batch',
    title: 'Chemical Batch Production',
    category: 'Production Planning',
    difficulty: 'Advanced',
    numVars: 2,
    scenario:
      'A chemical plant produces two compounds: A (x1) and B (x2), measured in batches per day. ' +
      'Due to regulatory requirements, the total daily production must be EXACTLY 12 batches ' +
      '(x1 + x2 = 12). Each batch of A requires 2 hours processing; each batch of B requires 3 hours. ' +
      'The plant has 30 processing hours available daily. ' +
      'Profit is $500 per batch of A and $800 per batch of B. ' +
      'How many batches of each compound should be produced to maximize profit?',
    variables: [
      { name: 'x1', description: 'batches of Compound A per day' },
      { name: 'x2', description: 'batches of Compound B per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [500, 800],
    constraints: [
      { id: 'c1', coefficients: [1, 1], operator: '=', rhs: 12, label: 'Regulatory total (exact)' },
      { id: 'c2', coefficients: [2, 3], operator: '<=', rhs: 30, label: 'Processing time' },
    ],
    method: 'two-phase',
    formulationHints: {
      variables:
        'Two compounds: x1 = batches of A per day, x2 = batches of B per day.',
      objective:
        'Maximize profit. Coefficients are profit per batch.',
      constraints: [
        'Exact total: the regulatory requirement is that total batches EQUALS 12. ' +
        'This is an equality constraint (=): x1 + x2 = 12.',
        'Processing time: each batch of A takes 2 hrs, each batch of B takes 3 hrs, 30 hrs available: ' +
        '2x1 + 3x2 ≤ 30.',
      ],
      method:
        'You have an equality constraint (=). Equality constraints cannot be handled by standard Simplex ' +
        '(which needs a starting BFS). The Two-Phase method or Big-M can handle this. ' +
        'Two-Phase is cleaner numerically for equality constraints.',
    },
    methodExplanation:
      'The equality constraint requires an artificial variable. Two-Phase: Phase I minimizes the sum ' +
      'of artificials to find a feasible BFS; Phase II optimizes the original objective from there.',
    solvingHints: {
      phase1_initial:
        'Phase I: minimize the artificial variable a1. The Z-row here represents the auxiliary ' +
        'objective (minimize a1), NOT the original profit. We are finding a feasible starting point.',
      select_pivot:
        'Standard Dantzig rule applies to Phase I. Enter the most negative Z-row entry.',
      phase1_complete:
        'Phase I complete! a1 = 0 means we found a feasible BFS satisfying x1 + x2 = 12 exactly. ' +
        'Now the artificial column is removed and the original profit objective is restored for Phase II.',
      phase2_initial:
        'Phase II begins. The Z-row is reconstructed using the original profit coefficients, ' +
        'adjusted for the current basis. Standard Simplex now optimizes 500x1 + 800x2.',
      after_pivot:
        'Phase II pivot. Profit is increasing toward the optimum.',
      optimal:
        'Optimal solution found. Both the regulatory requirement (x1 + x2 = 12) and ' +
        'the processing time constraint are satisfied.',
    },
    highlights: {
      vars: ['A (x1)', 'B (x2)'],
      objective: ['$500 per batch of A and $800 per batch of B', 'maximize profit'],
      constraints: [
        ['EXACTLY 12 batches (x1 + x2 = 12)'],
        ['2 hours processing', '3 hours', '30 processing hours available daily'],
      ],
    },
  },

  // ── 11: Meal Plan — Two-Phase MIN, 2 vars, Advanced ──────────────────────
  {
    id: 'wp-meal-plan',
    title: 'Athlete Meal Plan',
    category: 'Diet / Nutrition',
    difficulty: 'Advanced',
    numVars: 2,
    scenario:
      'A sports nutritionist designs an 8-portion daily meal plan using two types of portions: ' +
      'Protein portions (x1, $3 each) and Carb portions (x2, $2 each). ' +
      'The plan must contain EXACTLY 8 portions total (x1 + x2 = 8). ' +
      'To meet caloric needs: each Protein portion provides 200 cal, each Carb provides 100 cal. ' +
      'The athlete needs at least 1,000 calories, so: 2x1 + x2 ≥ 10 ' +
      '(dividing each term by 100). ' +
      'Minimize the total cost of the meal plan.',
    variables: [
      { name: 'x1', description: 'protein portions per day' },
      { name: 'x2', description: 'carbohydrate portions per day' },
    ],
    objectiveType: 'min',
    objectiveCoefficients: [3, 2],
    constraints: [
      { id: 'c1', coefficients: [1, 1], operator: '=', rhs: 8, label: 'Total portions (exact)' },
      { id: 'c2', coefficients: [2, 1], operator: '>=', rhs: 10, label: 'Caloric minimum' },
    ],
    method: 'two-phase',
    formulationHints: {
      variables:
        'x1 = protein portions, x2 = carbohydrate portions.',
      objective:
        'Minimize cost: $3 per protein portion (x1), $2 per carb portion (x2).',
      constraints: [
        'Total portions EXACTLY 8: x1 + x2 = 8. This is an equality constraint.',
        'Caloric minimum (scaled by 100): 2x1 + x2 ≥ 10.',
      ],
      method:
        'Equality constraint → need an artificial variable → Two-Phase or Big-M. ' +
        'Two-Phase is preferred for exact equality requirements.',
    },
    methodExplanation:
      'The equality constraint x1 + x2 = 8 requires an artificial variable. ' +
      'Phase I minimizes the artificial to zero (finding the feasible point), ' +
      'Phase II then minimizes the actual cost.',
    solvingHints: {
      phase1_initial:
        'Phase I: auxiliary objective is to minimize the artificial variable a1. ' +
        'Once a1 = 0 we know x1 + x2 = 8 is satisfied.',
      select_pivot:
        'Dantzig rule on the Phase I tableau.',
      phase1_complete:
        'Feasible point found (a1 = 0). Phase II restores the MIN cost objective.',
      phase2_initial:
        'Phase II: minimize 3x1 + 2x2 from the current BFS.',
      after_pivot:
        'Cost decreasing toward optimum while maintaining all constraints.',
      optimal:
        'Minimum cost meal plan found. Both the exact portion count and caloric requirement are met.',
    },
    highlights: {
      vars: ['Protein portions (x1, $3 each)', 'Carb portions (x2, $2 each)'],
      objective: ['$3 each', '$2 each', 'Minimize the total cost'],
      constraints: [
        ['EXACTLY 8 portions total (x1 + x2 = 8)'],
        ['200 cal', '100 cal', 'at least 1,000 calories'],
      ],
    },
  },

  // ── 12: Alternative Optimal — Special Case, Simplex MAX, 2 vars ──────────
  {
    id: 'wp-alternative',
    title: 'Alternative Optimal Solutions',
    category: 'Special Cases',
    difficulty: 'Advanced',
    numVars: 2,
    scenario:
      'A clothing company makes t-shirts (x1) and hoodies (x2). ' +
      'Each t-shirt uses 1 yard of fabric and 1 hour of labor. ' +
      'Each hoodie uses 2 yards of fabric and 2 hours of labor. ' +
      'Available: 10 yards of fabric and, due to machine limits, at most 6 t-shirts can be made. ' +
      'Profit is $15 per t-shirt and $30 per hoodie. Maximize profit. ' +
      '\n\n⚠ Special case: notice that the objective coefficients have the same ratio as the ' +
      'first constraint coefficients. This creates a special situation at optimality!',
    variables: [
      { name: 'x1', description: 't-shirts made per day' },
      { name: 'x2', description: 'hoodies made per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [15, 30],
    constraints: [
      { id: 'c1', coefficients: [1, 2], operator: '<=', rhs: 10, label: 'Fabric (yards)' },
      { id: 'c2', coefficients: [1, 0], operator: '<=', rhs: 6, label: 'Machine limit (t-shirts)' },
    ],
    method: 'simplex',
    formulationHints: {
      variables:
        'Two products: x1 = t-shirts, x2 = hoodies made per day.',
      objective:
        'Maximize profit: $15 per t-shirt, $30 per hoodie.',
      constraints: [
        'Fabric: x1 + 2x2 ≤ 10.',
        'Machine limit on t-shirts: x1 ≤ 6. Write as: 1·x1 + 0·x2 ≤ 6.',
      ],
      method:
        'All ≤ constraints → standard Simplex. But look carefully at the objective ' +
        '(15, 30) vs. constraint 1 (1, 2) — notice 15:30 = 1:2, the same ratio! ' +
        'This means the objective line is parallel to that constraint. Interesting...',
    },
    methodExplanation:
      'Standard Simplex applies, but at optimality the solver will flag that a nonbasic decision ' +
      'variable has a zero reduced cost — the signature of alternative optimal solutions.',
    solvingHints: {
      initial:
        'Standard setup. Both products are profitable. Notice: z = 15x1 + 30x2 = 15(x1 + 2x2). ' +
        'The objective is proportional to the first constraint — maximizing z is the same as ' +
        'pushing x1 + 2x2 to its limit of 10.',
      select_pivot:
        'Apply Dantzig rule. The solver will reach an optimal corner.',
      after_pivot:
        'Moving along the boundary toward optimality.',
      optimal:
        'OPTIMAL — but check the Z-row carefully. Is any nonbasic DECISION variable showing ' +
        'a zero reduced cost? If so, we could pivot again and reach a DIFFERENT optimal point ' +
        'with the same z*. Infinitely many optimal solutions exist along that entire edge!',
    },
    specialCaseNote:
      'This problem has ALTERNATIVE OPTIMAL SOLUTIONS. The objective function is parallel to the ' +
      'constraint x1 + 2x2 = 10. Every point on that constraint edge between the two optimal ' +
      'corner points is also optimal — there are infinitely many optimal solutions.',
    highlights: {
      vars: ['t-shirts (x1)', 'hoodies (x2)'],
      objective: ['$15 per t-shirt and $30 per hoodie', 'Maximize profit'],
      constraints: [
        ['1 yard of fabric', '2 yards of fabric', '10 yards of fabric'],
        ['at most 6 t-shirts can be made'],
      ],
    },
  },

  // ── 13: Infeasible — Special Case, Big-M MAX, 2 vars ─────────────────────
  {
    id: 'wp-infeasible',
    title: 'Conflicting Requirements (Infeasible)',
    category: 'Special Cases',
    difficulty: 'Advanced',
    numVars: 2,
    scenario:
      'A factory must produce items to meet two separate contracts. ' +
      'Contract 1 requires at least 10 units of Product A per day (x1 ≥ 10). ' +
      'Contract 2 requires at least 8 units of Product B per day (x2 ≥ 8). ' +
      'However, due to machine capacity, total production cannot exceed 15 units per day ' +
      '(x1 + x2 ≤ 15). Revenue is $5 per unit of A and $7 per unit of B. ' +
      '\n\n⚠ Try to formulate and solve this — see if the solver can find a feasible solution!',
    variables: [
      { name: 'x1', description: 'units of Product A per day' },
      { name: 'x2', description: 'units of Product B per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [5, 7],
    constraints: [
      { id: 'c1', coefficients: [1, 0], operator: '>=', rhs: 10, label: 'Contract A minimum' },
      { id: 'c2', coefficients: [0, 1], operator: '>=', rhs: 8, label: 'Contract B minimum' },
      { id: 'c3', coefficients: [1, 1], operator: '<=', rhs: 15, label: 'Machine capacity' },
    ],
    method: 'big-m',
    formulationHints: {
      variables:
        'x1 = Product A units, x2 = Product B units per day.',
      objective:
        'Maximize revenue: $5 per unit A, $7 per unit B.',
      constraints: [
        'Contract A: x1 ≥ 10.',
        'Contract B: x2 ≥ 8.',
        'Machine capacity: x1 + x2 ≤ 15.',
      ],
      method:
        'Two ≥ constraints → Big-M. But first, look carefully: if x1 ≥ 10 AND x2 ≥ 8, ' +
        'then x1 + x2 ≥ 18. But the capacity says x1 + x2 ≤ 15. ' +
        'Can both contracts be satisfied simultaneously?',
    },
    methodExplanation:
      'Two ≥ constraints require surplus + artificial variables (Big-M). ' +
      'The solver will detect that the constraints are contradictory and report infeasibility.',
    solvingHints: {
      initial:
        'Big-M setup with two artificials. The algorithm will try to drive them to zero, ' +
        'but the contradictory constraints make this impossible.',
      select_pivot:
        'The algorithm proceeds normally — it doesn\'t "know" the problem is infeasible yet.',
      after_pivot:
        'Pivoting continues but notice that at least one artificial cannot be driven to zero.',
      infeasible:
        'INFEASIBLE! At optimality, at least one artificial variable is still positive (> 0). ' +
        'This confirms no feasible solution exists — the three constraints cannot all be satisfied ' +
        'simultaneously. In the real world: the factory cannot fulfill both contracts given machine limits.',
    },
    specialCaseNote:
      'This problem is INFEASIBLE. The two contract minimums (x1 ≥ 10, x2 ≥ 8) require at least ' +
      '18 units total, but machine capacity limits total to 15. No feasible solution exists.',
    highlights: {
      vars: ['Product A', 'Product B'],
      objective: ['$5 per unit of A and $7 per unit of B'],
      constraints: [
        ['at least 10 units of Product A per day (x1 ≥ 10)'],
        ['at least 8 units of Product B per day (x2 ≥ 8)'],
        ['cannot exceed 15 units per day (x1 + x2 ≤ 15)'],
      ],
    },
  },

  // ── 14: Unbounded — Special Case, Simplex MAX, 2 vars ────────────────────
  {
    id: 'wp-unbounded',
    title: 'Unbounded Objective',
    category: 'Special Cases',
    difficulty: 'Advanced',
    numVars: 2,
    scenario:
      'A portfolio manager invests in stocks (x1, millions) and bonds (x2, millions). ' +
      'Stocks are capped at $5M due to risk limits (x1 ≤ 5). ' +
      'The portfolio must hold at least as much in bonds as in stocks (x2 ≥ x1, ' +
      'written as: x1 − x2 ≤ 0). ' +
      'Expected return: 3% on stocks, 2% on bonds. Maximize total return (in millions). ' +
      '\n\n⚠ See what happens when the solver tries to maximize this — something unusual occurs!',
    variables: [
      { name: 'x1', description: 'stock investment (millions $)' },
      { name: 'x2', description: 'bond investment (millions $)' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [3, 2],
    constraints: [
      { id: 'c1', coefficients: [1, 0], operator: '<=', rhs: 5, label: 'Stock limit ($5M)' },
      { id: 'c2', coefficients: [1, -1], operator: '<=', rhs: 0, label: 'Bonds ≥ stocks' },
    ],
    method: 'simplex',
    formulationHints: {
      variables:
        'x1 = stock investment (in $M), x2 = bond investment (in $M).',
      objective:
        'Maximize return: 3% on stocks → 0.03 × x1M, 2% on bonds. We can scale by 100 to use ' +
        'coefficients 3 and 2 directly.',
      constraints: [
        'Stock cap: x1 ≤ 5.',
        'Bonds ≥ stocks means x2 ≥ x1, which rearranges to: x1 − x2 ≤ 0. ' +
        'Write this as: 1·x1 + (−1)·x2 ≤ 0.',
      ],
      method:
        'Both constraints are ≤ — standard Simplex. But notice: is there any constraint ' +
        'that limits how large x2 can get? What happens as bonds grow toward infinity?',
    },
    methodExplanation:
      'Standard Simplex applies. The solver will detect during the algorithm that the entering ' +
      'variable has no positive entries in its column — meaning it can increase without bound. ' +
      'The problem is reported as UNBOUNDED.',
    solvingHints: {
      initial:
        'Standard initial tableau. Both stocks and bonds appear in the objective with positive ' +
        'coefficients. The algorithm will try to increase both.',
      select_pivot:
        'Standard pivot selection. Notice: are all entries in the entering column positive? ' +
        'If not, the ratio test cannot determine a leaving variable...',
      unbounded:
        'UNBOUNDED! The entering variable\'s column has no positive entries in constraint rows — ' +
        'the ratio test fails because that variable can increase without limit. ' +
        'In the real world: this model is incomplete (missing an upper bound on bond investment).',
    },
    specialCaseNote:
      'This problem is UNBOUNDED. The bond investment (x2) has no upper limit, and increasing it ' +
      'always improves the objective. A real model would include a total budget constraint.',
    highlights: {
      vars: ['stocks (x1, millions)', 'bonds (x2, millions)'],
      objective: ['3% on stocks, 2% on bonds', 'Maximize total return'],
      constraints: [
        ['capped at $5M due to risk limits (x1 ≤ 5)'],
        ['at least as much in bonds as in stocks (x2 ≥ x1'],
      ],
    },
  },

  // ── 15: Water Treatment — Big-M MAX, 2 vars, Intermediate ────────────────
  {
    id: 'wp-water-treatment',
    title: 'Water Treatment Plant',
    category: 'Resource Allocation',
    difficulty: 'Intermediate',
    numVars: 2,
    scenario:
      'A water treatment plant uses two chemical processes: Process A (x1, batches/day) ' +
      'and Process B (x2, batches/day). Each batch of Process A removes 3 units of contaminant ' +
      'and uses 2 hours of equipment time. Each batch of Process B removes 5 units of contaminant ' +
      'and uses 4 hours of equipment time. ' +
      'The plant must remove at least 30 units of contaminant per day to meet safety regulations. ' +
      'Equipment is available for at most 24 hours per day. ' +
      'Each batch of Process A costs $4 and each batch of Process B costs $6. ' +
      'Maximize the total contaminant removed while staying within equipment and cost limits.',
    variables: [
      { name: 'x1', description: 'batches of Process A per day' },
      { name: 'x2', description: 'batches of Process B per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [3, 5],
    constraints: [
      { id: 'c1', coefficients: [3, 5], operator: '>=', rhs: 30, label: 'Contaminant removal minimum' },
      { id: 'c2', coefficients: [2, 4], operator: '<=', rhs: 24, label: 'Equipment hours' },
    ],
    method: 'big-m',
    formulationHints: {
      variables:
        'Two processes: x1 = batches of Process A per day, x2 = batches of Process B per day.',
      objective:
        'Maximize contaminant removed. Process A removes 3 units per batch, Process B removes 5. ' +
        'Objective: MAX z = 3x1 + 5x2.',
      constraints: [
        'Safety regulation: must remove AT LEAST 30 units. This is a ≥ constraint: 3x1 + 5x2 ≥ 30.',
        'Equipment limit: at most 24 hours available. This is a ≤ constraint: 2x1 + 4x2 ≤ 24.',
      ],
      method:
        'You have a ≥ constraint. The origin (0, 0) violates it — 0 is not ≥ 30. ' +
        'We cannot start simplex at the origin, so we need an artificial variable. Use Big-M.',
    },
    methodExplanation:
      'The ≥ constraint requires a surplus variable (−e1) and an artificial variable (+a1). ' +
      'The ≤ constraint gets only a slack (+s2). ' +
      'Big-M adds −M×a1 to the MAX objective, forcing the solver to drive a1 to zero.',
    solvingHints: {
      initial:
        'After ERO to clear a1 from Z-row: the Z-row shows large negative entries for x1 and x2 ' +
        '(due to −M terms). The algorithm will first drive a1 out of the basis to reach feasibility, ' +
        'then optimize the real objective.',
      select_pivot:
        'Most negative Z-row entry after M-cleanup determines entering variable. ' +
        'Priority: eliminate the artificial first.',
      after_pivot:
        'Once a1 leaves the basis (= 0), you are in the feasible region. ' +
        'Continue standard simplex pivoting on the real objective.',
      optimal:
        'Optimal! Verify a1 = 0 (feasible). Read x1 and x2 from basis column and RHS.',
    },
    highlights: {
      vars: ['Process A (x1, batches/day)', 'Process B (x2, batches/day)'],
      objective: ['3 units of contaminant', '5 units of contaminant', 'Maximize the total contaminant removed'],
      constraints: [
        ['at least 30 units of contaminant per day'],
        ['at most 24 hours per day'],
      ],
    },
  },

  // ── 16: Security Staffing — Big-M MIN, 2 vars, Intermediate ──────────────
  {
    id: 'wp-security-staffing',
    title: 'Security Staffing',
    category: 'Resource Allocation',
    difficulty: 'Intermediate',
    numVars: 2,
    scenario:
      'A security company assigns guards to two types of shifts: Day shifts (x1) and ' +
      'Night shifts (x2). Each day shift guard costs $120/day. Each night shift guard costs $150/day. ' +
      'Union rules require that at least 4 guards work day shifts. ' +
      'Safety regulations require that the total number of guards on duty at any time is at least 10 ' +
      '(combined day and night shifts). ' +
      'The building has a maximum capacity of 8 guards per shift for safety reasons. ' +
      'How many guards of each type should be scheduled to minimize daily cost?',
    variables: [
      { name: 'x1', description: 'day shift guards scheduled' },
      { name: 'x2', description: 'night shift guards scheduled' },
    ],
    objectiveType: 'min',
    objectiveCoefficients: [120, 150],
    constraints: [
      { id: 'c1', coefficients: [1, 0], operator: '>=', rhs: 4, label: 'Day shift minimum' },
      { id: 'c2', coefficients: [1, 1], operator: '>=', rhs: 10, label: 'Total guards minimum' },
      { id: 'c3', coefficients: [1, 0], operator: '<=', rhs: 8, label: 'Day shift capacity' },
      { id: 'c4', coefficients: [0, 1], operator: '<=', rhs: 8, label: 'Night shift capacity' },
    ],
    method: 'big-m',
    formulationHints: {
      variables:
        'x1 = day shift guards, x2 = night shift guards.',
      objective:
        'Minimize cost: $120 per day guard, $150 per night guard. MIN z = 120x1 + 150x2.',
      constraints: [
        'Union rule: at least 4 day guards. x1 ≥ 4.',
        'Safety: total guards ≥ 10. x1 + x2 ≥ 10.',
        'Capacity: at most 8 day guards. x1 ≤ 8.',
        'Capacity: at most 8 night guards. x2 ≤ 8.',
      ],
      method:
        'Two ≥ constraints → need surplus and artificial variables for each. ' +
        'Two ≤ constraints → need slack variables. Use Big-M.',
    },
    methodExplanation:
      'Constraints 1 and 2 are ≥: each gets −e and +a. Big-M adds +M×a to MIN objective. ' +
      'Constraints 3 and 4 are ≤: each gets +s. ' +
      'Two artificials means two ERO steps to clear Z-row before first pivot.',
    solvingHints: {
      initial:
        'Two artificials in initial basis → do TWO ERO steps to clear Z-row before pivoting. ' +
        'For MIN Big-M: artificials get +M in objective. After cleanup, most positive Z-row entry enters.',
      select_pivot:
        'For MIN: enter the variable with the most POSITIVE Z-row coefficient. ' +
        'The +M terms on artificials make them extremely unattractive — solver drives them out.',
      after_pivot:
        'Each pivot that removes an artificial = one more constraint genuinely satisfied. ' +
        'Continue until both artificials are nonbasic.',
      optimal:
        'MIN optimum reached. Both artificials = 0. Read cost from Z-row RHS.',
    },
    highlights: {
      vars: ['Day shifts (x1)', 'Night shifts (x2)'],
      objective: ['$120/day', '$150/day', 'minimize daily cost'],
      constraints: [
        ['at least 4 guards work day shifts'],
        ['total number of guards on duty at any time is at least 10'],
        ['maximum capacity of 8 guards per shift'],
        ['maximum capacity of 8 guards per shift'],
      ],
    },
  },

  // ── 17: Manufacturing Contract — Big-M MAX, 3 vars, Advanced ─────────────
  {
    id: 'wp-manufacturing-contract',
    title: 'Manufacturing Contract',
    category: 'Production Planning',
    difficulty: 'Advanced',
    numVars: 3,
    scenario:
      'A manufacturer produces three products: Basic (x1), Standard (x2), and Premium (x3). ' +
      'Profit per unit: $5 for Basic, $8 for Standard, $12 for Premium. ' +
      'A contract requires the company to produce at least 10 units of Premium per day. ' +
      'Total machine hours available: 60 hours per day. ' +
      'Each unit requires: Basic = 1 hour, Standard = 2 hours, Premium = 3 hours. ' +
      'Raw material constraint: the company has 80 kg of raw material per day. ' +
      'Each unit requires: Basic = 2 kg, Standard = 3 kg, Premium = 4 kg. ' +
      'Maximize daily profit.',
    variables: [
      { name: 'x1', description: 'Basic units produced per day' },
      { name: 'x2', description: 'Standard units produced per day' },
      { name: 'x3', description: 'Premium units produced per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [5, 8, 12],
    constraints: [
      { id: 'c1', coefficients: [0, 0, 1], operator: '>=', rhs: 10, label: 'Premium contract minimum' },
      { id: 'c2', coefficients: [1, 2, 3], operator: '<=', rhs: 60, label: 'Machine hours' },
      { id: 'c3', coefficients: [2, 3, 4], operator: '<=', rhs: 80, label: 'Raw material (kg)' },
    ],
    method: 'big-m',
    formulationHints: {
      variables:
        'Three products: x1 = Basic, x2 = Standard, x3 = Premium units per day.',
      objective:
        'Maximize profit: $5×x1 + $8×x2 + $12×x3.',
      constraints: [
        'Contract: at least 10 Premium units. x3 ≥ 10. Note: x1 and x2 have coefficient 0.',
        'Machine hours: 1×x1 + 2×x2 + 3×x3 ≤ 60.',
        'Raw material: 2×x1 + 3×x2 + 4×x3 ≤ 80.',
      ],
      method:
        'One ≥ constraint (Premium contract) → needs surplus −e1 and artificial +a1. ' +
        'Two ≤ constraints get slacks. Use Big-M.',
    },
    methodExplanation:
      'One artificial variable a1 for the contract constraint. ' +
      'Big-M adds −M×a1 to MAX objective. One ERO step clears Z-row. ' +
      'Graph view not available for 3-variable problems — tableau only.',
    solvingHints: {
      initial:
        'Three variables, three constraints. Initial basis: a1, s2, s3. ' +
        'One ERO step to eliminate a1 from Z-row. Then identify most negative Z-row entry.',
      select_pivot:
        'With 3 decision variables, scan all three columns for most negative. ' +
        'x3 (Premium, profit $12) may dominate despite the contract constraint.',
      after_pivot:
        'Watch for a1 leaving the basis — once gone, contract constraint is satisfied.',
      optimal:
        'Optimal. Read x1, x2, x3 values from basis column and RHS. ' +
        'Verify x3 ≥ 10 (contract met).',
    },
    highlights: {
      vars: ['Basic (x1)', 'Standard (x2)', 'Premium (x3)'],
      objective: ['$5 for Basic', '$8 for Standard', '$12 for Premium', 'Maximize daily profit'],
      constraints: [
        ['at least 10 units of Premium per day'],
        ['60 hours per day', '1 hour', '2 hours', '3 hours'],
        ['80 kg of raw material', '2 kg', '3 kg', '4 kg'],
      ],
    },
  },

  // ── 18: Catering Menu — Two-Phase MIN, 2 vars, Intermediate ──────────────
  {
    id: 'wp-catering-menu',
    title: 'Catering Menu Planning',
    category: 'Diet / Nutrition',
    difficulty: 'Intermediate',
    numVars: 2,
    scenario:
      'A catering company plans a daily menu using two dishes: Dish A (x1, servings) ' +
      'and Dish B (x2, servings). Dish A costs $8 per serving and Dish B costs $5 per serving. ' +
      'Health regulations require EXACTLY 20 total servings per event. ' +
      'Nutritional guidelines require at least 600 calories total ' +
      '(Dish A provides 40 cal/serving, Dish B provides 25 cal/serving). ' +
      'Minimize the total catering cost.',
    variables: [
      { name: 'x1', description: 'servings of Dish A' },
      { name: 'x2', description: 'servings of Dish B' },
    ],
    objectiveType: 'min',
    objectiveCoefficients: [8, 5],
    constraints: [
      { id: 'c1', coefficients: [1, 1], operator: '=', rhs: 20, label: 'Exact total servings' },
      { id: 'c2', coefficients: [40, 25], operator: '>=', rhs: 600, label: 'Calorie minimum' },
    ],
    method: 'two-phase',
    formulationHints: {
      variables:
        'x1 = servings of Dish A, x2 = servings of Dish B.',
      objective:
        'Minimize cost: $8 per serving of A, $5 per serving of B. MIN z = 8x1 + 5x2.',
      constraints: [
        'Health regulation: EXACTLY 20 total servings. x1 + x2 = 20. This is an equality (=) constraint.',
        'Calorie requirement: at least 600 total calories. 40x1 + 25x2 ≥ 600.',
      ],
      method:
        'Equality constraint → need artificial variable. No slack or surplus for = constraints. ' +
        '≥ constraint → need surplus (−e) and artificial (+a). ' +
        'Two artificials → Two-Phase method is preferred.',
    },
    methodExplanation:
      'Equality constraint gets +a1 only. ≥ constraint gets −e2 + a2. ' +
      'Phase I: minimize w = a1 + a2. If w* = 0, both constraints are feasible. ' +
      'Phase II: minimize original cost 8x1 + 5x2 from the Phase I BFS.',
    solvingHints: {
      phase1_initial:
        'Phase I objective: MIN w = a1 + a2. ' +
        'Two ERO steps needed to clear both artificials from the Phase I Z-row. ' +
        'Then pivot to drive w toward zero.',
      select_pivot:
        'Phase I: enter variable with most positive Z-row entry (MIN problem). ' +
        'Goal is to get both artificials to zero.',
      phase1_complete:
        'w* = 0: both artificials are zero. Both constraints are satisfied. ' +
        'Remove artificial columns, restore MIN cost objective for Phase II.',
      phase2_initial:
        'Phase II Z-row is rebuilt using 8x1 + 5x2. ' +
        'Remember to do ERO to adjust Z-row for current basis before pivoting.',
      after_pivot:
        'Cost decreasing. Check Z-row for remaining positive entries (MIN).',
      optimal:
        'Minimum cost found. Verify x1 + x2 = 20 (equality met) and 40x1 + 25x2 ≥ 600 (calories met).',
    },
    highlights: {
      vars: ['Dish A (x1, servings)', 'Dish B (x2, servings)'],
      objective: ['$8 per serving', '$5 per serving', 'Minimize the total catering cost'],
      constraints: [
        ['EXACTLY 20 total servings'],
        ['at least 600 calories', '40 cal/serving', '25 cal/serving'],
      ],
    },
  },

  // ── 19: Factory Production Quota — Two-Phase MAX, 2 vars, Intermediate ───
  {
    id: 'wp-production-quota',
    title: 'Factory Production Quota',
    category: 'Production Planning',
    difficulty: 'Intermediate',
    numVars: 2,
    scenario:
      'A factory produces two products: Model X (x1) and Model Y (x2). ' +
      'Profit: $10 per Model X and $15 per Model Y. ' +
      'A government contract requires EXACTLY 8 units of Model X per day — no more, no less. ' +
      'Labor constraint: each Model X requires 2 hours and each Model Y requires 3 hours. ' +
      'The factory has 50 labor hours available per day. ' +
      'Maximize total daily profit.',
    variables: [
      { name: 'x1', description: 'Model X units produced per day' },
      { name: 'x2', description: 'Model Y units produced per day' },
    ],
    objectiveType: 'max',
    objectiveCoefficients: [10, 15],
    constraints: [
      { id: 'c1', coefficients: [1, 0], operator: '=', rhs: 8, label: 'Model X contract (exact)' },
      { id: 'c2', coefficients: [2, 3], operator: '<=', rhs: 50, label: 'Labor hours' },
    ],
    method: 'two-phase',
    formulationHints: {
      variables:
        'x1 = Model X units per day, x2 = Model Y units per day.',
      objective:
        'Maximize profit: $10 per Model X, $15 per Model Y. MAX z = 10x1 + 15x2.',
      constraints: [
        'Government contract: EXACTLY 8 units of Model X. x1 = 8. ' +
        'This is an equality constraint — no slack, no surplus, only artificial.',
        'Labor: 2x1 + 3x2 ≤ 50. This is a ≤ constraint — add slack only.',
      ],
      method:
        'Equality constraint → artificial variable needed. Use Two-Phase method. ' +
        'The ≤ constraint is standard — no artificial needed there.',
    },
    methodExplanation:
      'Equality gets +a1 only. ≤ gets +s2. ' +
      'Phase I minimizes w = a1. If w* = 0, x1 = 8 is achievable. ' +
      'Phase II maximizes original profit with x1 pinned at 8.',
    solvingHints: {
      phase1_initial:
        'Phase I: MIN w = a1. One ERO to clear a1 from Phase I Z-row. ' +
        'The equality constraint pins x1 — Phase I will quickly find x1 = 8.',
      select_pivot:
        'Phase I is MIN: enter most positive Z-row entry. Drive a1 out of basis.',
      phase1_complete:
        'w* = 0: x1 = 8 is confirmed feasible. Remove a1 column. ' +
        'Restore MAX objective 10x1 + 15x2 for Phase II.',
      phase2_initial:
        'Phase II Z-row rebuilt for MAX. Now optimize profit with x1 = 8 established.',
      after_pivot:
        'x2 (Model Y) should increase — it has the higher profit per unit.',
      optimal:
        'Maximum profit found. Confirm x1 = 8 (contract met) and 2(8) + 3x2 ≤ 50 (labor met).',
    },
    highlights: {
      vars: ['Model X (x1)', 'Model Y (x2)'],
      objective: ['$10 per Model X', '$15 per Model Y', 'Maximize total daily profit'],
      constraints: [
        ['EXACTLY 8 units of Model X per day'],
        ['2 hours', '3 hours', '50 labor hours available per day'],
      ],
    },
  },

  // ── 20: Research Lab — Two-Phase MIN, 3 vars, Advanced ───────────────────
  {
    id: 'wp-research-lab',
    title: 'Research Lab Resource Allocation',
    category: 'Resource Allocation',
    difficulty: 'Advanced',
    numVars: 3,
    scenario:
      'A research lab allocates time across three projects: Project Alpha (x1, hours), ' +
      'Project Beta (x2, hours), and Project Gamma (x3, hours). ' +
      'Cost per hour: Alpha = $50, Beta = $30, Gamma = $40. ' +
      'A grant requires EXACTLY 20 total hours allocated across all projects per week. ' +
      'Funding agency rules require at least 6 hours on Project Alpha per week. ' +
      'Equipment sharing means Project Beta and Gamma together cannot exceed 15 hours per week. ' +
      'Minimize total weekly cost.',
    variables: [
      { name: 'x1', description: 'hours on Project Alpha per week' },
      { name: 'x2', description: 'hours on Project Beta per week' },
      { name: 'x3', description: 'hours on Project Gamma per week' },
    ],
    objectiveType: 'min',
    objectiveCoefficients: [50, 30, 40],
    constraints: [
      { id: 'c1', coefficients: [1, 1, 1], operator: '=', rhs: 20, label: 'Total hours (exact)' },
      { id: 'c2', coefficients: [1, 0, 0], operator: '>=', rhs: 6, label: 'Alpha minimum' },
      { id: 'c3', coefficients: [0, 1, 1], operator: '<=', rhs: 15, label: 'Beta + Gamma maximum' },
    ],
    method: 'two-phase',
    formulationHints: {
      variables:
        'Three projects: x1 = Alpha hours, x2 = Beta hours, x3 = Gamma hours per week.',
      objective:
        'Minimize cost: $50×x1 + $30×x2 + $40×x3.',
      constraints: [
        'Grant requirement: EXACTLY 20 total hours. x1 + x2 + x3 = 20. Equality → artificial only.',
        'Funding rule: at least 6 hours on Alpha. x1 ≥ 6. ≥ constraint → surplus + artificial.',
        'Equipment: Beta + Gamma ≤ 15. x2 + x3 ≤ 15. ≤ constraint → slack only.',
      ],
      method:
        'Equality constraint AND ≥ constraint → two artificials needed. Two-Phase method. ' +
        'Phase I: minimize sum of both artificials. Phase II: minimize actual cost.',
    },
    methodExplanation:
      'Equality gets +a1. ≥ gets −e2 + a2. ≤ gets +s3. ' +
      'Phase I minimizes w = a1 + a2. Two ERO steps to set up Phase I Z-row. ' +
      'If w* = 0, both the exact total and Alpha minimum are simultaneously achievable.',
    solvingHints: {
      phase1_initial:
        'Phase I Z-row needs TWO ERO steps (one per artificial). ' +
        'Phase I objective is MIN w = a1 + a2 — completely different from the real cost objective.',
      select_pivot:
        'Phase I MIN: enter most positive Z-row coefficient. ' +
        'Algorithm works to satisfy both the equality and the minimum simultaneously.',
      phase1_complete:
        'w* = 0: x1 + x2 + x3 = 20 AND x1 ≥ 6 are both satisfied. ' +
        'Remove a1 and a2 columns. Restore MIN cost objective for Phase II.',
      phase2_initial:
        'Phase II: minimize 50x1 + 30x2 + 40x3 from the feasible BFS. ' +
        'Rebuild Z-row with ERO for current basis before first pivot.',
      after_pivot:
        'Cost decreasing. Beta ($30/hr) is cheapest — expect x2 to increase.',
      optimal:
        'Minimum cost allocation found. Verify: x1+x2+x3=20, x1≥6, x2+x3≤15.',
    },
    highlights: {
      vars: ['Project Alpha (x1, hours)', 'Project Beta (x2, hours)', 'Project Gamma (x3, hours)'],
      objective: ['$50', '$30', '$40', 'Minimize total weekly cost'],
      constraints: [
        ['EXACTLY 20 total hours allocated'],
        ['at least 6 hours on Project Alpha'],
        ['Project Beta and Gamma together cannot exceed 15 hours'],
      ],
    },
  },
];
