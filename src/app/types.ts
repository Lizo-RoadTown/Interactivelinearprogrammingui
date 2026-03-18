export type ObjectiveType = 'max' | 'min';

export type Method = 'graphical' | 'simplex' | 'big-m';

export type StepType =
  | 'initial'
  | 'select_pivot'
  | 'after_pivot'
  | 'optimal'
  | 'infeasible'
  | 'unbounded';

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

// ── Tableau types (API-driven) ────────────────────────────────────────────────

export interface TableauCell {
  value: number;
  displayValue?: string;
  isPivot?: boolean;
  isPivotRow?: boolean;
  isPivotCol?: boolean;
  isChanged?: boolean;
  colType?: string;  // "decision" | "slack" | "surplus" | "artificial" | "rhs"
}

export interface Tableau {
  rows: TableauCell[][];          // constraint rows + z-row last
  basisVariables: string[];       // one per constraint row
  allVariables?: string[];        // column headers including 'RHS'
  colTypes?: string[];
  ratios?: (number | null)[];
  rawMatrix?: number[][];         // for interactive pivot computation
  rawBasis?: number[];
}

export interface SimplexStep {
  iteration: number;
  stepType: StepType;
  tableau: Tableau;
  explanation: string;
  pivotRow?: number;
  pivotCol?: number;
  enteringVar?: string;
  leavingVar?: string;
  rowOperations?: string[];
  objectiveValue: number;
}

// ── Graph types ───────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
  label?: string;
  z?: number;
  isCurrent?: boolean;
  isOptimal?: boolean;
  isDegenerate?: boolean;
}

// ── Full solver response ──────────────────────────────────────────────────────

export interface SolverResponse {
  steps: SimplexStep[];
  cornerPoints: Point[];
  feasibleRegionPolygon: Point[];
  simplexPath: Point[];
  axisBounds: { maxX: number; maxY: number };
  standardFormText: string;
  status: 'optimal' | 'infeasible' | 'unbounded';
  optimalValue?: number;
  optimalSolution?: Record<string, number>;
  is2Variable: boolean;
}

// ── Interactive mode ──────────────────────────────────────────────────────────

export type InteractivePhase = 'choose_entering' | 'choose_leaving' | 'viewing';

export interface PivotRecord {
  pivotRow: number;
  pivotCol: number;
  enteringVar: string;
  leavingVar: string;
  wasOptimalChoice: boolean;
  warning?: string;
  resultPoint?: Point;
}

export interface InteractiveState {
  phase: InteractivePhase;
  liveMatrix: number[][];
  liveBasis: number[];
  liveVarNames: string[];
  liveColTypes: string[];
  livePivotCol: number | null;
  pivotHistory: PivotRecord[];
  pivotCount: number;
}

// ── App state ─────────────────────────────────────────────────────────────────

export interface AppState {
  problem: LPProblem;
  method: Method;
  solverResponse: SolverResponse | null;
  currentStepIndex: number;
  isInteractive: boolean;
  interactiveState: InteractiveState | null;
  showRatioTest: boolean;
  showRowOperations: boolean;
  showObjectiveLine: boolean;
  selectedCell?: { row: number; col: number };
  cellExplanation: string;
}
