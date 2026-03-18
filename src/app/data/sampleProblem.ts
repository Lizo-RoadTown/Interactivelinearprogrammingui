import { LPProblem, SimplexStep, Point } from '../types';

// Sample LP Problem:
// Maximize z = 3x₁ + 2x₂
// Subject to:
// 2x₁ + x₂ ≤ 18
// 2x₁ + 3x₂ ≤ 42
// 3x₁ + x₂ ≤ 24
// x₁, x₂ ≥ 0

export const sampleProblem: LPProblem = {
  objectiveType: 'max',
  objectiveCoefficients: [3, 2],
  variables: ['x₁', 'x₂'],
  constraints: [
    { id: 'c1', coefficients: [2, 1], operator: '<=', rhs: 18, label: '2x₁ + x₂ ≤ 18' },
    { id: 'c2', coefficients: [2, 3], operator: '<=', rhs: 42, label: '2x₁ + 3x₂ ≤ 42' },
    { id: 'c3', coefficients: [3, 1], operator: '<=', rhs: 24, label: '3x₁ + x₂ ≤ 24' },
  ],
};

const VARS = ['x₁', 'x₂', 's₁', 's₂', 's₃', 'RHS'];

// Step 0: Initial Tableau
export const initialTableau: SimplexStep = {
  iteration: 0,
  stepType: 'initial',
  tableau: {
    rows: [
      [{ value: 2 }, { value: 1 }, { value: 1 }, { value: 0 }, { value: 0 }, { value: 18 }],
      [{ value: 2 }, { value: 3 }, { value: 0 }, { value: 1 }, { value: 0 }, { value: 42 }],
      [{ value: 3 }, { value: 1 }, { value: 0 }, { value: 0 }, { value: 1 }, { value: 24 }],
      [{ value: -3 }, { value: -2 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }],
    ],
    basisVariables: ['s₁', 's₂', 's₃'],
    allVariables: VARS,
  },
  explanation: 'Initial tableau setup. Slack variables s₁, s₂, s₃ added. Basic feasible solution at origin (0, 0) with z = 0.',
  objectiveValue: 0,
};

// Step 1: Select pivot — x₁ enters, s₃ leaves
export const step1: SimplexStep = {
  iteration: 1,
  stepType: 'select_pivot',
  tableau: {
    rows: [
      [{ value: 2, isPivotCol: true }, { value: 1 }, { value: 1 }, { value: 0 }, { value: 0 }, { value: 18 }],
      [{ value: 2, isPivotCol: true }, { value: 3 }, { value: 0 }, { value: 1 }, { value: 0 }, { value: 42 }],
      [{ value: 3, isPivotCol: true, isPivot: true, isPivotRow: true }, { value: 1, isPivotRow: true }, { value: 0, isPivotRow: true }, { value: 0, isPivotRow: true }, { value: 1, isPivotRow: true }, { value: 24, isPivotRow: true }],
      [{ value: -3, isPivotCol: true }, { value: -2 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }],
    ],
    basisVariables: ['s₁', 's₂', 's₃'],
    allVariables: VARS,
    ratios: [9, 21, 8, null],
  },
  explanation: 'x₁ enters (most negative Z-row coeff: −3). Ratio test: 18/2=9, 42/2=21, 24/3=8. Min ratio=8 → s₃ leaves. Pivot element = 3.',
  pivotRow: 2,
  pivotCol: 0,
  enteringVar: 'x₁',
  leavingVar: 's₃',
  objectiveValue: 0,
};

// Step 2: After pivot on (row 2, col 0)
export const step2: SimplexStep = {
  iteration: 2,
  stepType: 'after_pivot',
  tableau: {
    rows: [
      [{ value: 0, isChanged: true }, { value: 1/3, isChanged: true }, { value: 1 }, { value: 0 }, { value: -2/3, isChanged: true }, { value: 2, isChanged: true }],
      [{ value: 0, isChanged: true }, { value: 7/3, isChanged: true }, { value: 0 }, { value: 1 }, { value: -2/3, isChanged: true }, { value: 26, isChanged: true }],
      [{ value: 1 }, { value: 1/3 }, { value: 0 }, { value: 0 }, { value: 1/3 }, { value: 8 }],
      [{ value: 0, isChanged: true }, { value: -1, isChanged: true }, { value: 0 }, { value: 0 }, { value: 1, isChanged: true }, { value: 24, isChanged: true }],
    ],
    basisVariables: ['s₁', 's₂', 'x₁'],
    allVariables: VARS,
  },
  explanation: 'x₁ entered, s₃ left. BFS now at (8, 0) with z = 24.',
  rowOperations: [
    'R₃(new) = R₃(old) / 3',
    'R₁(new) = R₁(old) − 2 × R₃(new)',
    'R₂(new) = R₂(old) − 2 × R₃(new)',
    'Rz(new) = Rz(old) + 3 × R₃(new)',
  ],
  enteringVar: 'x₁',
  leavingVar: 's₃',
  objectiveValue: 24,
};

// Step 3: Select pivot — x₂ enters, s₁ leaves
export const step3: SimplexStep = {
  iteration: 3,
  stepType: 'select_pivot',
  tableau: {
    rows: [
      [{ value: 0 }, { value: 1/3, isPivotCol: true, isPivot: true, isPivotRow: true }, { value: 1, isPivotRow: true }, { value: 0, isPivotRow: true }, { value: -2/3, isPivotRow: true }, { value: 2, isPivotRow: true }],
      [{ value: 0 }, { value: 7/3, isPivotCol: true }, { value: 0 }, { value: 1 }, { value: -2/3 }, { value: 26 }],
      [{ value: 1 }, { value: 1/3, isPivotCol: true }, { value: 0 }, { value: 0 }, { value: 1/3 }, { value: 8 }],
      [{ value: 0 }, { value: -1, isPivotCol: true }, { value: 0 }, { value: 0 }, { value: 1 }, { value: 24 }],
    ],
    basisVariables: ['s₁', 's₂', 'x₁'],
    allVariables: VARS,
    ratios: [6, 78/7, 24, null],
  },
  explanation: 'x₂ enters (Z-row coeff: −1). Ratio test: 2/(1/3)=6, 26/(7/3)≈11.1, 8/(1/3)=24. Min=6 → s₁ leaves. Pivot element = 1/3.',
  pivotRow: 0,
  pivotCol: 1,
  enteringVar: 'x₂',
  leavingVar: 's₁',
  objectiveValue: 24,
};

// Step 4: Optimal solution
export const step4: SimplexStep = {
  iteration: 4,
  stepType: 'optimal',
  tableau: {
    rows: [
      [{ value: 0 }, { value: 1 }, { value: 3 }, { value: 0 }, { value: -2 }, { value: 6 }],
      [{ value: 0, isChanged: true }, { value: 0, isChanged: true }, { value: -7, isChanged: true }, { value: 1 }, { value: 4, isChanged: true }, { value: 12, isChanged: true }],
      [{ value: 1, isChanged: true }, { value: 0, isChanged: true }, { value: -1, isChanged: true }, { value: 0 }, { value: 1, isChanged: true }, { value: 6, isChanged: true }],
      [{ value: 0, isChanged: true }, { value: 0, isChanged: true }, { value: 3, isChanged: true }, { value: 0 }, { value: -1, isChanged: true }, { value: 30, isChanged: true }],
    ],
    basisVariables: ['x₂', 's₂', 'x₁'],
    allVariables: VARS,
  },
  explanation: 'OPTIMAL: all Z-row coefficients ≥ 0. Solution: x₁=6, x₂=6, z=30.',
  rowOperations: [
    'R₁(new) = R₁(old) × 3',
    'R₂(new) = R₂(old) − (7/3) × R₁(new)',
    'R₃(new) = R₃(old) − (1/3) × R₁(new)',
    'Rz(new) = Rz(old) + R₁(new)',
  ],
  enteringVar: 'x₂',
  leavingVar: 's₁',
  objectiveValue: 30,
};

export const allSteps: SimplexStep[] = [initialTableau, step1, step2, step3, step4];

export const cornerPoints: Point[] = [
  { x: 0, y: 0, label: '(0,0)', z: 0 },
  { x: 8, y: 0, label: '(8,0)', z: 24 },
  { x: 6, y: 6, label: '(6,6)', z: 30, isCurrent: true },
  { x: 3, y: 12, label: '(3,12)', z: 33 },
  { x: 0, y: 14, label: '(0,14)', z: 28 },
];

export const simplexPath: Point[] = [
  { x: 0, y: 0, label: '(0,0)', z: 0 },
  { x: 8, y: 0, label: '(8,0)', z: 24 },
  { x: 6, y: 6, label: '(6,6)', z: 30 },
];
