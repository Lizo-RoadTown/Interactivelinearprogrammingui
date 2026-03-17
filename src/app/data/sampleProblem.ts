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
    {
      id: 'c1',
      coefficients: [2, 1],
      operator: '<=',
      rhs: 18,
      label: '2x₁ + x₂ ≤ 18'
    },
    {
      id: 'c2',
      coefficients: [2, 3],
      operator: '<=',
      rhs: 42,
      label: '2x₁ + 3x₂ ≤ 42'
    },
    {
      id: 'c3',
      coefficients: [3, 1],
      operator: '<=',
      rhs: 24,
      label: '3x₁ + x₂ ≤ 24'
    }
  ]
};

// Initial Tableau (Step 0)
export const initialTableau: SimplexStep = {
  iteration: 0,
  tableau: {
    rows: [
      // Basis | x₁ | x₂ | s₁ | s₂ | s₃ | RHS
      [{ value: 2 }, { value: 1 }, { value: 1 }, { value: 0 }, { value: 0 }, { value: 18 }],
      [{ value: 2 }, { value: 3 }, { value: 0 }, { value: 1 }, { value: 0 }, { value: 42 }],
      [{ value: 3 }, { value: 1 }, { value: 0 }, { value: 0 }, { value: 1 }, { value: 24 }],
      [{ value: -3 }, { value: -2 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }], // Z-row
    ],
    basisVariables: ['s₁', 's₂', 's₃'],
    nonBasisVariables: ['x₁', 'x₂'],
  },
  explanation: 'Initial tableau setup. We have converted the LP problem to standard form by adding slack variables s₁, s₂, s₃. The current basic feasible solution is at the origin (0, 0) with z = 0.',
  objectiveValue: 0
};

// Step 1: Select pivot (x₁ column)
export const step1: SimplexStep = {
  iteration: 1,
  tableau: {
    rows: [
      [{ value: 2, isPivotCol: true }, { value: 1 }, { value: 1 }, { value: 0 }, { value: 0 }, { value: 18 }],
      [{ value: 2, isPivotCol: true }, { value: 3 }, { value: 0 }, { value: 1 }, { value: 0 }, { value: 42 }],
      [{ value: 3, isPivotCol: true, isPivot: true, isPivotRow: true }, { value: 1, isPivotRow: true }, { value: 0, isPivotRow: true }, { value: 0, isPivotRow: true }, { value: 1, isPivotRow: true }, { value: 24, isPivotRow: true }],
      [{ value: -3, isPivotCol: true }, { value: -2 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }],
    ],
    basisVariables: ['s₁', 's₂', 's₃'],
    nonBasisVariables: ['x₁', 'x₂'],
    ratios: [18/2, 42/2, 24/3, null], // 9, 21, 8
  },
  explanation: 'Pivot selection: x₁ enters the basis (most negative coefficient in Z-row: -3). Using the ratio test, we divide RHS by positive entries in x₁ column: 18/2=9, 42/2=21, 24/3=8. The minimum ratio is 8, so s₃ leaves the basis. Pivot element is 3 at row 3, column 1.',
  pivotRow: 2,
  pivotCol: 0,
  objectiveValue: 0
};

// Step 2: After pivot
export const step2: SimplexStep = {
  iteration: 2,
  tableau: {
    rows: [
      [{ value: 0, isChanged: true }, { value: 1/3, isChanged: true }, { value: 1 }, { value: 0 }, { value: -2/3, isChanged: true }, { value: 2, isChanged: true }],
      [{ value: 0, isChanged: true }, { value: 7/3, isChanged: true }, { value: 0 }, { value: 1 }, { value: -2/3, isChanged: true }, { value: 26, isChanged: true }],
      [{ value: 1 }, { value: 1/3 }, { value: 0 }, { value: 0 }, { value: 1/3 }, { value: 8 }],
      [{ value: 0, isChanged: true }, { value: -1, isChanged: true }, { value: 0 }, { value: 0 }, { value: 1, isChanged: true }, { value: 24, isChanged: true }],
    ],
    basisVariables: ['s₁', 's₂', 'x₁'],
    nonBasisVariables: ['x₂', 's₃'],
  },
  explanation: 'After pivoting on element 3: x₁ enters basis, s₃ leaves. New pivot row: divide row 3 by 3. Then eliminate x₁ from other rows. The new basic feasible solution is at point (8, 0) with z = 24. We moved along an edge of the feasible region.',
  rowOperations: [
    'R₃(new) = R₃(old) / 3',
    'R₁(new) = R₁(old) - 2 × R₃(new)',
    'R₂(new) = R₂(old) - 2 × R₃(new)',
    'Z(new) = Z(old) + 3 × R₃(new)'
  ],
  objectiveValue: 24
};

// Step 3: Select next pivot (x₂ column)
export const step3: SimplexStep = {
  iteration: 3,
  tableau: {
    rows: [
      [{ value: 0 }, { value: 1/3, isPivotCol: true, isPivot: true, isPivotRow: true }, { value: 1, isPivotRow: true }, { value: 0, isPivotRow: true }, { value: -2/3, isPivotRow: true }, { value: 2, isPivotRow: true }],
      [{ value: 0 }, { value: 7/3, isPivotCol: true }, { value: 0 }, { value: 1 }, { value: -2/3 }, { value: 26 }],
      [{ value: 1 }, { value: 1/3, isPivotCol: true }, { value: 0 }, { value: 0 }, { value: 1/3 }, { value: 8 }],
      [{ value: 0 }, { value: -1, isPivotCol: true }, { value: 0 }, { value: 0 }, { value: 1 }, { value: 24 }],
    ],
    basisVariables: ['s₁', 's₂', 'x₁'],
    nonBasisVariables: ['x₂', 's₃'],
    ratios: [6, 78/7, 24, null],
  },
  explanation: 'x₂ enters the basis (negative coefficient -1 in Z-row). Ratio test: 2/(1/3)=6, 26/(7/3)≈11.14, 8/(1/3)=24. Minimum ratio is 6, so s₁ leaves. Pivot element is 1/3 at row 1, column 2.',
  pivotRow: 0,
  pivotCol: 1,
  objectiveValue: 24
};

// Step 4: Optimal solution
export const step4: SimplexStep = {
  iteration: 4,
  tableau: {
    rows: [
      [{ value: 0 }, { value: 1 }, { value: 3 }, { value: 0 }, { value: -2 }, { value: 6 }],
      [{ value: 0, isChanged: true }, { value: 0, isChanged: true }, { value: -7, isChanged: true }, { value: 1 }, { value: 4, isChanged: true }, { value: 12, isChanged: true }],
      [{ value: 1, isChanged: true }, { value: 0, isChanged: true }, { value: -1, isChanged: true }, { value: 0 }, { value: 1, isChanged: true }, { value: 6, isChanged: true }],
      [{ value: 0, isChanged: true }, { value: 0, isChanged: true }, { value: 3, isChanged: true }, { value: 0 }, { value: -1, isChanged: true }, { value: 30, isChanged: true }],
    ],
    basisVariables: ['x₂', 's₂', 'x₁'],
    nonBasisVariables: ['s₁', 's₃'],
  },
  explanation: 'OPTIMAL SOLUTION FOUND! All coefficients in the Z-row are non-negative. The optimal solution is x₁ = 6, x₂ = 6 with maximum z = 30. This corresponds to the corner point (6, 6) of the feasible region.',
  rowOperations: [
    'R₁(new) = R₁(old) × 3',
    'R₂(new) = R₂(old) - (7/3) × R₁(new)',
    'R₃(new) = R₃(old) - (1/3) × R₁(new)',
    'Z(new) = Z(old) + R₁(new)'
  ],
  objectiveValue: 30
};

export const allSteps: SimplexStep[] = [initialTableau, step1, step2, step3, step4];

// Corner points for the feasible region
export const cornerPoints: Point[] = [
  { x: 0, y: 0, label: '(0, 0)', z: 0 },
  { x: 8, y: 0, label: '(8, 0)', z: 24 },
  { x: 6, y: 6, label: '(6, 6)', z: 30, isCurrent: true },
  { x: 3, y: 12, label: '(3, 12)', z: 33 },
  { x: 0, y: 14, label: '(0, 14)', z: 28 }
];

// Simplex path - the sequence of corner points visited
export const simplexPath: Point[] = [
  { x: 0, y: 0, label: '(0, 0)', z: 0 },
  { x: 8, y: 0, label: '(8, 0)', z: 24 },
  { x: 6, y: 6, label: '(6, 6)', z: 30 }
];
