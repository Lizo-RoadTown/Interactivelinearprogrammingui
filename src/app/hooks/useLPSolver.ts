/**
 * useLPSolver.ts
 * ==============
 * React hook that owns all solver state and API calls.
 * MainWorkspace imports this and passes slices down to child components.
 */

import { useState, useCallback } from 'react';
import {
  LPProblem, SolverResponse, InteractiveState, InteractivePhase,
  PivotRecord, Point, SimplexStep,
} from '../types';

// Dev: proxied through Vite to localhost:8000
// Production: set VITE_API_URL env var to your Render backend URL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
               : '/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

function buildInteractiveState(step: SimplexStep): InteractiveState {
  return {
    phase: 'choose_entering',
    liveMatrix: step.tableau.rawMatrix ?? [],
    liveBasis: step.tableau.rawBasis ?? [],
    liveVarNames: (step.tableau.allVariables ?? []).slice(0, -1),
    liveColTypes: (step.tableau.colTypes ?? []).slice(0, -1),
    livePivotCol: null,
    pivotHistory: [],
    pivotCount: 0,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLPSolver() {
  const [solverResponse, setSolverResponse] = useState<SolverResponse | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactiveState, setInteractiveState] = useState<InteractiveState | null>(null);
  const [cellExplanation, setCellExplanation] = useState('');

  // ── Solve ────────────────────────────────────────────────────────────────────

  const solve = useCallback(async (problem: LPProblem, method: string) => {
    setIsLoading(true);
    setError(null);
    setSolverResponse(null);
    setCurrentStepIndex(0);
    setInteractiveState(null);
    setCellExplanation('');

    try {
      const response = await postJSON<SolverResponse>('/solve', {
        objectiveType: problem.objectiveType,
        objectiveCoefficients: problem.objectiveCoefficients,
        variables: problem.variables,
        variableSigns: problem.variableSigns ?? problem.variables.map(() => 'nonneg'),
        constraints: problem.constraints,
        method,
      });
      setSolverResponse(response);
      setCurrentStepIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Step navigation ──────────────────────────────────────────────────────────

  const stepForward = useCallback(() => {
    if (!solverResponse) return;
    setCurrentStepIndex(i => Math.min(i + 1, solverResponse.steps.length - 1));
    setCellExplanation('');
  }, [solverResponse]);

  const stepBack = useCallback(() => {
    setCurrentStepIndex(i => Math.max(i - 1, 0));
    setCellExplanation('');
  }, []);

  const jumpToStep = useCallback((index: number) => {
    if (!solverResponse) return;
    setCurrentStepIndex(Math.max(0, Math.min(index, solverResponse.steps.length - 1)));
    setCellExplanation('');
  }, [solverResponse]);

  const jumpToEnd = useCallback(() => {
    if (!solverResponse) return;
    setCurrentStepIndex(solverResponse.steps.length - 1);
  }, [solverResponse]);

  const reset = useCallback(() => {
    setCurrentStepIndex(0);
    setInteractiveState(null);
    setCellExplanation('');
  }, []);

  // ── Interactive mode ─────────────────────────────────────────────────────────

  const enterInteractiveMode = useCallback(() => {
    if (!solverResponse) return;
    const initialStep = solverResponse.steps[0];
    setInteractiveState(buildInteractiveState(initialStep));
    setCellExplanation(
      'Which variable should enter the basis? Find the most negative value in the Z-row.'
    );
  }, [solverResponse]);

  const exitInteractiveMode = useCallback(() => {
    setInteractiveState(null);
    setCellExplanation('');
  }, []);

  const handleInteractiveClick = useCallback(async (
    row: number,
    col: number,
    sense: string,
  ) => {
    if (!interactiveState) return;
    const { phase, liveMatrix, liveBasis, liveVarNames, liveColTypes, livePivotCol } = interactiveState;
    const m = liveBasis.length;
    const nCols = liveMatrix[0].length; // includes RHS

    // ── Phase: choose_entering ────────────────────────────────────────────────
    if (phase === 'choose_entering') {
      if (row !== m) {
        setCellExplanation('Choose the entering variable — look for a negative value in the Z-row (bottom row).');
        return;
      }
      if (col >= nCols - 1) {
        setCellExplanation('The RHS column cannot be an entering variable.');
        return;
      }
      const zVal = liveMatrix[m][col];
      if (zVal >= -1e-8) {
        setCellExplanation(
          `z-row[${liveVarNames[col]}] = ${zVal.toFixed(4)} (non-negative). This column cannot improve the objective. ` +
          `Choose a column with a negative z-row value.`
        );
        return;
      }

      // Determine if this is the Dantzig-optimal choice
      const zRow = liveMatrix[m].slice(0, nCols - 1);
      const mostNegCol = zRow.reduce((best, v, i) => (v < zRow[best] ? i : best), 0);
      const isOptimal = col === mostNegCol;

      setInteractiveState(prev => prev ? {
        ...prev,
        phase: 'choose_leaving',
        livePivotCol: col,
      } : prev);

      const varName = liveVarNames[col];
      const improvement = Math.abs(zVal).toFixed(4);
      if (isOptimal) {
        setCellExplanation(
          `Good choice! ${varName} has the most negative z-row coefficient (${zVal.toFixed(4)}). ` +
          `Each unit of ${varName} added improves z by ${improvement} (Dantzig rule). ` +
          `Now choose the leaving variable — apply the ratio test to the ${varName} column.`
        );
      } else {
        const bestName = liveVarNames[mostNegCol];
        const bestVal = zRow[mostNegCol].toFixed(4);
        setCellExplanation(
          `${varName} is a valid entering variable (z-row = ${zVal.toFixed(4)}), but ${bestName} ` +
          `has a more negative value (${bestVal}) — the Dantzig rule would prefer ${bestName}. ` +
          `Proceeding with ${varName}. Now choose the leaving variable using the ratio test.`
        );
      }
      return;
    }

    // ── Phase: choose_leaving ────────────────────────────────────────────────
    if (phase === 'choose_leaving' && livePivotCol !== null) {
      if (row === m) {
        setCellExplanation('Choose a constraint row (not the Z-row) in the highlighted column.');
        return;
      }

      // Compute ratios for feedback
      const ratios: (number | null)[] = liveBasis.map((_, i) => {
        const elem = liveMatrix[i][livePivotCol];
        return elem > 1e-8 ? liveMatrix[i][nCols - 1] / elem : null;
      });
      const colElem = liveMatrix[row][livePivotCol];

      if (colElem <= 1e-8) {
        const elemStr = colElem.toFixed(4);
        if (colElem < -1e-8) {
          setCellExplanation(
            `Column element = ${elemStr} (negative). Negative entries are skipped in the min-ratio test — ` +
            `they would make the entering variable negative after the pivot (infeasible). ` +
            `Pivoting anyway so you can see the result.`
          );
        } else {
          setCellExplanation(
            `Column element ≈ 0. Cannot pivot on a zero element. Choose a row where the column value is positive.`
          );
          return;
        }
      }

      // Determine if this is the minimum ratio
      const validRatios = ratios.filter(r => r !== null) as number[];
      const minRatio = validRatios.length > 0 ? Math.min(...validRatios) : Infinity;
      const myRatio = ratios[row];
      const isMinRatio = myRatio !== null && Math.abs(myRatio - minRatio) < 1e-6;

      const leavingVar = liveVarNames[liveBasis[row]];
      const enteringVar = liveVarNames[livePivotCol];

      // Call backend to apply pivot
      try {
        const result = await postJSON<{
          step: { tableau: { rawMatrix: number[][]; rawBasis: number[] }; explanation: string; rowOperations: string[]; objectiveValue: number };
          newPoint: Point | null;
          warning: string | null;
          isOptimal: boolean;
        }>('/pivot', {
          matrix: liveMatrix,
          basis: liveBasis,
          varNames: liveVarNames,
          colTypes: liveColTypes,
          pivotRow: row,
          pivotCol: livePivotCol,
          sense,
        });

        const newMatrix = result.step.tableau.rawMatrix;
        const newBasis = result.step.tableau.rawBasis;

        const record: PivotRecord = {
          pivotRow: row,
          pivotCol: livePivotCol,
          enteringVar,
          leavingVar,
          wasOptimalChoice: isMinRatio && !result.warning,
          warning: result.warning ?? undefined,
          resultPoint: result.newPoint ?? undefined,
        };

        const newPhase: InteractivePhase = result.isOptimal ? 'viewing' : 'choose_entering';

        setInteractiveState(prev => prev ? {
          ...prev,
          phase: newPhase,
          liveMatrix: newMatrix,
          liveBasis: newBasis,
          livePivotCol: null,
          pivotHistory: [...prev.pivotHistory, record],
          pivotCount: prev.pivotCount + 1,
        } : prev);

        // Build explanation
        let explanation = '';
        if (result.warning) {
          explanation = `⚠ Warning: ${result.warning}\n\n`;
        } else if (!isMinRatio && myRatio !== null) {
          explanation = `Note: ratio ${myRatio.toFixed(4)} is not the minimum (${minRatio.toFixed(4)}). ` +
            `The simplex method chooses the minimum ratio to stay feasible. Proceeding anyway.\n\n`;
        } else {
          explanation = `Correct! Minimum ratio = ${minRatio.toFixed(4)} → ${leavingVar} leaves.\n\n`;
        }

        if (result.isOptimal) {
          explanation += `OPTIMAL SOLUTION REACHED after ${(interactiveState.pivotCount + 1)} pivot(s). ` +
            `All z-row coefficients are non-negative. z* = ${result.step.objectiveValue}`;
        } else {
          explanation += `${enteringVar} entered, ${leavingVar} left. z = ${result.step.objectiveValue}. ` +
            `Row operations: ${(result.step.rowOperations ?? []).join(' | ')}. ` +
            `Now choose the next entering variable.`;
        }
        setCellExplanation(explanation);
      } catch (e) {
        setCellExplanation(`Pivot failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
  }, [interactiveState]);

  // ── Cell explanation (auto mode click) ──────────────────────────────────────

  const explainCell = useCallback(async (
    row: number,
    col: number,
    step: SimplexStep,
    sense: string,
  ) => {
    try {
      const result = await postJSON<{ explanation: string }>('/explain-cell', {
        matrix: step.tableau.rawMatrix,
        basis: step.tableau.rawBasis,
        varNames: (step.tableau.allVariables ?? []).slice(0, -1),
        colTypes: (step.tableau.colTypes ?? []).slice(0, -1),
        row,
        col,
        sense,
      });
      setCellExplanation(result.explanation);
    } catch {
      setCellExplanation('Could not retrieve explanation.');
    }
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────────

  const steps = solverResponse?.steps ?? [];
  const currentStep = steps[currentStepIndex] ?? null;
  const canStepBack = currentStepIndex > 0;
  const canStepForward = currentStepIndex < steps.length - 1;

  // Simplex path up to current step (for graph animation)
  const currentSimplexPath = (() => {
    if (!solverResponse) return [];
    const fullPath = solverResponse.simplexPath;
    // Count how many AFTER_PIVOT / optimal steps we've seen
    let pivotsSeen = 0;
    for (let i = 0; i <= currentStepIndex; i++) {
      const t = steps[i]?.stepType;
      if (t === 'after_pivot' || t === 'optimal') pivotsSeen++;
    }
    return fullPath.slice(0, pivotsSeen + 1); // +1 for origin
  })();

  // Current BFS point for iso-line
  const currentPoint: Point | null = (() => {
    if (interactiveState?.pivotHistory.length) {
      return interactiveState.pivotHistory.at(-1)?.resultPoint ?? null;
    }
    return currentSimplexPath.at(-1) ?? null;
  })();

  return {
    solverResponse,
    steps,
    currentStep,
    currentStepIndex,
    canStepBack,
    canStepForward,
    isLoading,
    error,
    interactiveState,
    cellExplanation,
    currentSimplexPath,
    currentPoint,
    // actions
    solve,
    stepForward,
    stepBack,
    jumpToStep,
    jumpToEnd,
    reset,
    enterInteractiveMode,
    exitInteractiveMode,
    handleInteractiveClick,
    explainCell,
    setCellExplanation,
  };
}
