/**
 * useGuidedSensitivity.ts
 *
 * State machine for Chapter 8 post-optimality analysis. Parallel to
 * useGuidedSimplex.ts — same pedagogical shape (Attention → Question →
 * Commitment → Feedback → Reveal), different operations.
 *
 * A sensitivity problem runs through five layers:
 *   Layer 1 — arrive:        word problem + "management asks"
 *   Layer 2 — identify_op:   which §8.3.X operation is this?
 *   Layer 3 — solve:         tableau-based matrix math, checked step by step
 *   Layer 4 — reveal:        graphical slider / before-after visualization
 *   Layer 5 — debrief:       plain-English answer
 *
 * Phase 1 of the Chapter 8 rebuild defines the scaffold. The `solve` layer
 * delegates to per-operation sub-machines that are filled in in Phase 2+.
 */

import { useReducer, useCallback } from 'react';
import {
  SensitivityProblem,
  SensitivityOperation,
} from '../data/sensitivityProblems';

// ── Public types ─────────────────────────────────────────────────────────────

export type SensitivityLayer =
  | 'arrive'       // Layer 1 — show word problem + "management asks"
  | 'identify_op'  // Layer 2 — student picks which §8.3.X operation
  | 'solve'        // Layer 3 — operation-specific tableau interaction
  | 'reveal'       // Layer 4 — graphical reveal
  | 'debrief';     // Layer 5 — plain-English answer

/**
 * Sub-phases within the `solve` layer. Each §8.3 operation chooses which
 * of these it exposes; they follow a consistent Attention → Question →
 * Commitment → Feedback → Reveal shape.
 */
export type SolveSubPhase =
  | 'idle'
  // §8.3.1 / §8.3.2 — OF coefficient change
  | 'ofcoeff_row_pick'        // click the row of B⁻¹N corresponding to the basic var (§8.3.1 only)
  | 'ofcoeff_bounds'          // type a Δ bound for each nonbasic column
  | 'ofcoeff_intersect'       // intersect the bounds → final range
  // §8.3.3 — RHS change
  | 'rhs_binv_col'            // click the column of B⁻¹ corresponding to constraint i
  | 'rhs_bounds'              // type a Δ bound for each basic variable
  | 'rhs_intersect'
  | 'rhs_shadow_price'        // compute y[i] = C_B · B⁻¹ column i
  // §8.3.5 — add activity
  | 'addact_transform'        // compute ā_new = B⁻¹ · a_new
  | 'addact_reduced_cost'     // compute c̄_new = C_B · ā − c_new
  | 'addact_decision'         // does it enter?
  // §8.3.6 — add constraint
  | 'addcon_check_feasible'   // plug x* into new constraint — satisfied?
  | 'addcon_dual_simplex'     // walk through dual simplex if infeasible (stretch)
  ;

export interface GuidedSensitivityFeedback {
  kind: 'correct' | 'wrong' | 'hint';
  text: string;
  nearCell?: { row: number; col: number };
}

export interface GuidedSensitivityState {
  problem: SensitivityProblem | null;
  layer: SensitivityLayer;
  /** Student's current guess of which operation this is (from layer 2). */
  pickedOp: SensitivityOperation | null;
  /** Solve layer sub-phase (only meaningful when layer === 'solve'). */
  solveSubPhase: SolveSubPhase;
  /** Running tally of wrong attempts in the current sub-phase. */
  attemptCount: number;
  feedback: GuidedSensitivityFeedback | null;
  /** Whether the student has used the "Show Answer" escape hatch in the current phase. */
  usedShowAnswer: boolean;
  /** Intermediate values computed or committed so far. Keyed by sub-phase. */
  committed: Record<string, unknown>;
}

type Action =
  | { type: 'LOAD_PROBLEM'; problem: SensitivityProblem }
  | { type: 'ARRIVE_NEXT' }            // arrive → identify_op
  | { type: 'PICK_OP'; op: SensitivityOperation }
  | { type: 'PICK_OP_CORRECT' }        // identify_op → solve (with initial sub-phase)
  | { type: 'PICK_OP_WRONG'; hint: string }
  | { type: 'SOLVE_ADVANCE'; nextSubPhase: SolveSubPhase }
  | { type: 'SOLVE_CORRECT'; commit: Record<string, unknown> }
  | { type: 'SOLVE_WRONG'; text: string; nearCell?: { row: number; col: number } }
  | { type: 'SOLVE_HINT'; text: string }
  | { type: 'SHOW_ANSWER_USED' }
  | { type: 'SOLVE_DONE' }              // solve → reveal
  | { type: 'REVEAL_ACK' }              // reveal → debrief
  | { type: 'RESET' };

const INITIAL_STATE: GuidedSensitivityState = {
  problem: null,
  layer: 'arrive',
  pickedOp: null,
  solveSubPhase: 'idle',
  attemptCount: 0,
  feedback: null,
  usedShowAnswer: false,
  committed: {},
};

function reducer(state: GuidedSensitivityState, action: Action): GuidedSensitivityState {
  switch (action.type) {
    case 'LOAD_PROBLEM':
      return { ...INITIAL_STATE, problem: action.problem };
    case 'ARRIVE_NEXT':
      return { ...state, layer: 'identify_op', feedback: null };
    case 'PICK_OP':
      return { ...state, pickedOp: action.op };
    case 'PICK_OP_CORRECT':
      return {
        ...state,
        layer: 'solve',
        feedback: { kind: 'correct', text: 'Correct — that is the operation this change maps to.' },
        attemptCount: 0,
        solveSubPhase: initialSubPhaseFor(state.problem?.operation ?? null),
      };
    case 'PICK_OP_WRONG':
      return {
        ...state,
        feedback: { kind: 'wrong', text: action.hint },
        attemptCount: state.attemptCount + 1,
      };
    case 'SOLVE_ADVANCE':
      return {
        ...state,
        solveSubPhase: action.nextSubPhase,
        feedback: null,
        attemptCount: 0,
        usedShowAnswer: false,
      };
    case 'SOLVE_CORRECT':
      return {
        ...state,
        feedback: { kind: 'correct', text: 'Correct.' },
        committed: { ...state.committed, ...action.commit },
      };
    case 'SOLVE_WRONG':
      return {
        ...state,
        feedback: { kind: 'wrong', text: action.text, nearCell: action.nearCell },
        attemptCount: state.attemptCount + 1,
      };
    case 'SOLVE_HINT':
      return { ...state, feedback: { kind: 'hint', text: action.text } };
    case 'SHOW_ANSWER_USED':
      return { ...state, usedShowAnswer: true };
    case 'SOLVE_DONE':
      return { ...state, layer: 'reveal', feedback: null };
    case 'REVEAL_ACK':
      return { ...state, layer: 'debrief' };
    case 'RESET':
      return INITIAL_STATE;
  }
}

/** First solve sub-phase for each operation. */
function initialSubPhaseFor(op: SensitivityOperation | null): SolveSubPhase {
  switch (op) {
    case 'of_coeff_basic':       return 'ofcoeff_row_pick';
    case 'of_coeff_nonbasic':    return 'ofcoeff_bounds';
    case 'rhs_range':            return 'rhs_binv_col';
    case 'add_activity':         return 'addact_transform';
    case 'add_constraint':       return 'addcon_check_feasible';
    case 'tech_coeff_nonbasic':  return 'addact_reduced_cost';
    default:                     return 'idle';
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGuidedSensitivity() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const loadProblem = useCallback((problem: SensitivityProblem) => {
    dispatch({ type: 'LOAD_PROBLEM', problem });
  }, []);

  const arriveNext = useCallback(() => {
    dispatch({ type: 'ARRIVE_NEXT' });
  }, []);

  /** Student picks an operation in layer 2; we compare to the problem's true operation. */
  const pickOperation = useCallback((op: SensitivityOperation) => {
    if (!state.problem) return;
    dispatch({ type: 'PICK_OP', op });
    if (op === state.problem.operation) {
      // Delay slightly so the "Correct!" confirmation is visible before advance.
      // Per spec: no auto-advance that rushes — but a short visual beat is OK.
      dispatch({ type: 'PICK_OP_CORRECT' });
    } else {
      dispatch({ type: 'PICK_OP_WRONG', hint: state.problem.operationHint });
    }
  }, [state.problem]);

  const advanceSolveSubPhase = useCallback((nextSubPhase: SolveSubPhase) => {
    dispatch({ type: 'SOLVE_ADVANCE', nextSubPhase });
  }, []);

  const solveCorrect = useCallback((commit: Record<string, unknown> = {}) => {
    dispatch({ type: 'SOLVE_CORRECT', commit });
  }, []);

  const solveWrong = useCallback((text: string, nearCell?: { row: number; col: number }) => {
    dispatch({ type: 'SOLVE_WRONG', text, nearCell });
  }, []);

  const solveHint = useCallback((text: string) => {
    dispatch({ type: 'SOLVE_HINT', text });
  }, []);

  const markShowAnswerUsed = useCallback(() => {
    dispatch({ type: 'SHOW_ANSWER_USED' });
  }, []);

  const finishSolve = useCallback(() => {
    dispatch({ type: 'SOLVE_DONE' });
  }, []);

  const acknowledgeReveal = useCallback(() => {
    dispatch({ type: 'REVEAL_ACK' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    loadProblem,
    arriveNext,
    pickOperation,
    advanceSolveSubPhase,
    solveCorrect,
    solveWrong,
    solveHint,
    markShowAnswerUsed,
    finishSolve,
    acknowledgeReveal,
    reset,
  };
}
