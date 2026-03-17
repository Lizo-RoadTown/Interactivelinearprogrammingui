export type ObjectiveType = 'max' | 'min';

export type Method = 'graphical' | 'simplex' | 'big-m';

export interface Constraint {
  id: string;
  coefficients: number[];
  operator: '<=' | '>=' | '=';
  rhs: number;
  label?: string;
}

export interface LPProblem {
  objectiveType: ObjectiveType;
  objectiveCoefficients: number[];
  constraints: Constraint[];
  variables: string[];
}

export interface TableauCell {
  value: number;
  isPivot?: boolean;
  isPivotRow?: boolean;
  isPivotCol?: boolean;
  isChanged?: boolean;
}

export interface Tableau {
  rows: TableauCell[][];
  basisVariables: string[];
  nonBasisVariables: string[];
  ratios?: (number | null)[];
}

export interface SimplexStep {
  iteration: number;
  tableau: Tableau;
  explanation: string;
  pivotRow?: number;
  pivotCol?: number;
  rowOperations?: string[];
  objectiveValue: number;
}

export interface Point {
  x: number;
  y: number;
  label?: string;
  z?: number;
  isCurrent?: boolean;
}

export interface AppState {
  problem: LPProblem;
  method: Method;
  steps: SimplexStep[];
  currentStepIndex: number;
  isInteractive: boolean;
  showRatioTest: boolean;
  showRowOperations: boolean;
  showObjectiveLine: boolean;
  selectedCell?: { row: number; col: number };
}
