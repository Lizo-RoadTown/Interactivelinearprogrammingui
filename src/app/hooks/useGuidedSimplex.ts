/**
 * useGuidedSimplex.ts
 * ====================
 * State machine hook for the Guided Simplex Interaction System (spec v2.0).
 *
 * Enforces: Attention → Question → Commitment → Feedback → Reveal
 *
 * Episodes:
 *   0  — Z-row setup (Big-M / Two-Phase only, future)
 *   A  — Entering variable selection
 *   B  — Leaving variable selection
 */

import { useReducer, useCallback, useMemo, useEffect } from 'react';
import { SimplexStep, Tableau, Point } from '../types';
import { normVar } from '../utils/varName';

// ── Public types ─────────────────────────────────────────────────────────────

export type GuidedEpisode = 'idle' | 'episode0' | 'episodeA' | 'episodeB';

export type GuidedPhase =
  | 'idle'
  // Episode 0 — Z-row setup (Big-M / Two-Phase only)
  | 'e0_arrive'
  | 'e0_attention'
  | 'e0_commitment'
  // Episode A
  | 'a1_arrive'
  | 'a2_attention'
  | 'a3_commitment'
  | 'a3b_suboptimal'
  | 'a4_reveal'
  // Episode B
  | 'b1_attention'
  | 'b3_commitment'
  | 'b4_reveal'
  | 'b5_apply';

export interface GuidedFeedback {
  text: string;
  type: 'invalid' | 'suboptimal' | 'correct' | 'hint' | 'reasoning';
  nearCell?: { row: number; col: number };
  dualButtons?: boolean; // A3b: "Use this anyway" / "Choose again"
}

/** Props passed to TableauWorkspace for phase-aware rendering. */
export interface GuidedTableauProps {
  zRowEmphasis: boolean;
  highlightedCol: number | null;
  rhsEmphasis: boolean;
  dimmedRows: number[];
  cellStates: Record<string, 'correct' | 'invalid' | 'suboptimal'>;
  clickableRegion: 'zrow' | 'pivotcol' | 'basisrow' | 'none';
  showRatios: boolean;
  ratios: (number | null)[];
  minRatioRow: number;
}

/** Props passed to GraphView for per-phase updates. */
export interface GuidedGraphProps {
  enteringVarName: string | null;
  highlightedConstraintIdx: number | null;
  destinationVertex: Point | null;
  showDirectionArrow: boolean;
}

// ── Internal state ──────────────────────────────────────────────────────────

interface State {
  episode: GuidedEpisode;
  phase: GuidedPhase;

  // Episode 0 — Z-row setup
  artificialRows: number[];       // row indices of basic artificials needing Z-row clearing
  currentArtificialIdx: number;   // which one we're on

  // Episode A
  enteringCol: number | null;
  enteringAttempts: Array<{ col: number; type: 'invalid' | 'suboptimal' }>;
  suboptimalChoice: boolean;

  // Episode B
  leavingRow: number | null;
  leavingAttempts: Array<{ row: number; type: 'invalid' | 'notmin' }>;
  ratiosRevealed: boolean;

  // Retry escalation
  attemptCount: number;

  // Feedback
  feedback: GuidedFeedback | null;

  // Navigation
  canAdvance: boolean;
  canJumpTimeline: boolean;

  // Tracking
  suboptimalPivots: Array<{
    iteration: number;
    chosenCol: number;
    optimalCol: number;
  }>;
}

const INITIAL_STATE: State = {
  episode: 'idle',
  phase: 'idle',
  artificialRows: [],
  currentArtificialIdx: 0,
  enteringCol: null,
  enteringAttempts: [],
  suboptimalChoice: false,
  leavingRow: null,
  leavingAttempts: [],
  ratiosRevealed: false,
  attemptCount: 0,
  feedback: null,
  canAdvance: true,
  canJumpTimeline: true,
  suboptimalPivots: [],
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'START_EPISODE_0'; artificialRows: number[] }
  | { type: 'E0_BEGIN' }
  | { type: 'E0_CLICK_ROW'; row: number; correctRow: number; rowName: string; correctRowName: string }
  | { type: 'E0_ADVANCE' }  // auto after correct, or when all cleared → advance step
  | { type: 'START_EPISODE_A' }
  | { type: 'CLICK_CHOOSE_ENTERING' }
  | {
      type: 'CLICK_ZROW_CELL';
      col: number;
      zVal: number;
      colName: string;
      correctCol: number;
      correctColName: string;
      correctZVal: number;
      objectiveType: 'max' | 'min';
    }
  | { type: 'ACCEPT_SUBOPTIMAL'; col: number; iteration: number; optimalCol: number }
  | { type: 'RETRY_ENTERING' }
  | { type: 'ADVANCE_TO_B' }
  | {
      type: 'CLICK_PIVOT_COL_CELL';
      row: number;
      entry: number;
      rowName: string;
      ratio: number | null;
      correctRow: number;
      correctRowName: string;
      correctRatio: number | null;
      allRatios: Array<{ rowName: string; ratio: number | null; rhs: number; entry: number }>;
    }
  | { type: 'ADVANCE_TO_APPLY' }
  | { type: 'APPLY_PIVOT' }
  | { type: 'SHOW_ANSWER_ENTERING'; col: number; colName: string; zVal: number }
  | {
      type: 'SHOW_ANSWER_LEAVING';
      row: number;
      rowName: string;
      ratio: number | null;
      allRatios: Array<{ rowName: string; ratio: number | null; rhs: number; entry: number }>;
    }
  | { type: 'RESET' };

// ── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_EPISODE_0':
      return {
        ...INITIAL_STATE,
        episode: 'episode0',
        phase: 'e0_arrive',
        artificialRows: action.artificialRows,
        currentArtificialIdx: 0,
        canAdvance: false,
        canJumpTimeline: false,
        suboptimalPivots: state.suboptimalPivots,
      };

    case 'E0_BEGIN':
      return { ...state, phase: 'e0_attention' };

    case 'E0_CLICK_ROW': {
      const { row, correctRow, rowName, correctRowName } = action;
      if (row === correctRow) {
        return {
          ...state,
          phase: 'e0_commitment', // will auto-advance
          feedback: {
            text: `Correct. Row ${row + 1} (${rowName}) is where this artificial is basic. The row operation will clear its coefficient from the Z-row.`,
            type: 'correct',
            nearCell: { row, col: 0 },
          },
        };
      }
      const newCount = state.attemptCount + 1;
      return {
        ...state,
        attemptCount: newCount,
        feedback: {
          text: `This row will not eliminate the coefficient. You need row ${correctRow + 1} (${correctRowName}) — that's where this artificial variable is basic.`,
          type: 'invalid',
          nearCell: { row, col: 0 },
        },
      };
    }

    case 'E0_ADVANCE': {
      const nextIdx = state.currentArtificialIdx + 1;
      if (nextIdx >= state.artificialRows.length) {
        // All cleared — advance to next step (the post-elimination initial)
        return {
          ...state,
          episode: 'idle',
          phase: 'idle',
          canAdvance: true,
          canJumpTimeline: true,
          feedback: null,
        };
      }
      // More artificials to clear
      return {
        ...state,
        phase: 'e0_attention',
        currentArtificialIdx: nextIdx,
        attemptCount: 0,
        feedback: null,
      };
    }

    case 'START_EPISODE_A':
      return {
        ...INITIAL_STATE,
        episode: 'episodeA',
        phase: 'a1_arrive',
        canAdvance: false,
        canJumpTimeline: false,
        suboptimalPivots: state.suboptimalPivots,
      };

    case 'CLICK_CHOOSE_ENTERING':
      return {
        ...state,
        phase: 'a2_attention',
        feedback: null,
      };

    case 'CLICK_ZROW_CELL': {
      const { col, zVal, colName, correctCol, correctColName, correctZVal, objectiveType } = action;
      const isMax = objectiveType === 'max';

      // Invalid: wrong direction
      const isInvalid = isMax ? zVal >= -1e-9 : zVal <= 1e-9;
      if (isInvalid) {
        const newCount = state.attemptCount + 1;
        let text = isMax
          ? `This value is ≥ 0 — increasing ${colName} would not improve z. Choose a negative Z-row value.`
          : `This value is ≤ 0 — increasing ${colName} would not improve z. Choose a positive Z-row value.`;
        if (newCount >= 3) text += '\n\nHint: Compare all the values in the Z-row carefully.';
        return {
          ...state,
          phase: 'a3_commitment',
          attemptCount: newCount,
          enteringAttempts: [...state.enteringAttempts, { col, type: 'invalid' }],
          feedback: {
            text,
            type: newCount >= 4 ? 'reasoning' : 'invalid',
            nearCell: { row: -1, col }, // -1 = Z-row (resolved by consumer)
          },
        };
      }

      // Correct: most negative (MAX) or most positive (MIN)
      if (col === correctCol) {
        return {
          ...state,
          phase: 'a4_reveal',
          enteringCol: col,
          suboptimalChoice: false,
          attemptCount: 0,
          feedback: {
            text: isMax
              ? `Correct. ${colName} (Z = ${fmtN(zVal)}) is the most negative value — it improves z fastest.`
              : `Correct. ${colName} (Z = ${fmtN(zVal)}) is the most positive value — it improves z fastest.`,
            type: 'correct',
            nearCell: { row: -1, col },
          },
        };
      }

      // Valid but not Dantzig-optimal
      const newCount = state.attemptCount + 1;
      return {
        ...state,
        phase: 'a3b_suboptimal',
        enteringCol: col, // tentative
        attemptCount: newCount,
        enteringAttempts: [...state.enteringAttempts, { col, type: 'suboptimal' }],
        feedback: {
          text: `${colName} (Z = ${fmtN(zVal)}) would improve z, but it is not the most ${isMax ? 'negative' : 'positive'} value. ` +
            `The Dantzig rule says choose ${correctColName} (Z = ${fmtN(correctZVal)}) for the fastest improvement. ` +
            `You can use ${colName} anyway, or choose again.`,
          type: 'suboptimal',
          nearCell: { row: -1, col },
          dualButtons: true,
        },
      };
    }

    case 'ACCEPT_SUBOPTIMAL':
      return {
        ...state,
        phase: 'a4_reveal',
        enteringCol: action.col,
        suboptimalChoice: true,
        attemptCount: 0,
        feedback: {
          text: 'Proceeding with your choice. The Dantzig rule would have been faster, but this is still valid.',
          type: 'suboptimal',
        },
        suboptimalPivots: [
          ...state.suboptimalPivots,
          { iteration: action.iteration, chosenCol: action.col, optimalCol: action.optimalCol },
        ],
      };

    case 'RETRY_ENTERING':
      return {
        ...state,
        phase: 'a3_commitment',
        enteringCol: null,
        feedback: null,
      };

    case 'ADVANCE_TO_B':
      return {
        ...state,
        episode: 'episodeB',
        phase: 'b1_attention',
        leavingRow: null,
        leavingAttempts: [],
        ratiosRevealed: false,
        attemptCount: 0,
        feedback: null,
      };

    case 'CLICK_PIVOT_COL_CELL': {
      const { row, entry, rowName, ratio, correctRow, correctRowName, correctRatio, allRatios } = action;

      // Invalid: non-positive entry
      if (entry <= 1e-9) {
        const newCount = state.attemptCount + 1;
        let text = `This row cannot leave — the pivot column entry is ${entry <= -1e-9 ? 'negative' : 'zero'}. ` +
          `Only positive entries participate in the ratio test.`;
        if (entry <= -1e-9)
          text += ` Negative entries would make the entering variable negative after pivoting, violating non-negativity.`;
        if (newCount >= 3) text += '\n\nHint: Look for rows where the pivot column entry is positive, then divide RHS by that entry.';
        return {
          ...state,
          phase: 'b3_commitment',
          attemptCount: newCount,
          leavingAttempts: [...state.leavingAttempts, { row, type: 'invalid' }],
          feedback: {
            text,
            type: newCount >= 4 ? 'reasoning' : 'invalid',
            nearCell: { row, col: state.enteringCol ?? 0 },
          },
        };
      }

      // Correct: minimum ratio
      if (row === correctRow) {
        const ratioStr = allRatios
          .filter(r => r.ratio !== null && r.entry > 1e-9)
          .map(r => `${r.rowName}: ${fmtN(r.rhs)} ÷ ${fmtN(r.entry)} = ${fmtN(r.ratio!)}`)
          .join('\n');
        return {
          ...state,
          phase: 'b4_reveal',
          leavingRow: row,
          ratiosRevealed: true,
          attemptCount: 0,
          feedback: {
            text: `Correct! ${rowName} has the smallest ratio (${ratio !== null ? fmtN(ratio) : '?'}) and limits the increase.\n\n${ratioStr}`,
            type: 'correct',
            nearCell: { row, col: state.enteringCol ?? 0 },
          },
        };
      }

      // Valid but not minimum ratio — RATIOS REVEALED NOW (spec: critical)
      const newCount = state.attemptCount + 1;
      const ratioStr = allRatios
        .filter(r => r.ratio !== null && r.entry > 1e-9)
        .map(r => `${r.rowName}: ${fmtN(r.rhs)} ÷ ${fmtN(r.entry)} = ${fmtN(r.ratio!)}`)
        .join('\n');
      let text = `This is a valid candidate, but not the minimum ratio. Compare:\n\n${ratioStr}\n\n` +
        `${correctRowName} has the smallest ratio (${correctRatio !== null ? fmtN(correctRatio) : '?'}). ` +
        `Choosing a larger ratio would push another variable negative.`;
      if (newCount >= 3) text += '\n\nHint: Look for the smallest positive ratio.';
      return {
        ...state,
        phase: 'b3_commitment',
        attemptCount: newCount,
        ratiosRevealed: true,
        leavingAttempts: [...state.leavingAttempts, { row, type: 'notmin' }],
        feedback: {
          text,
          type: newCount >= 4 ? 'reasoning' : 'invalid',
          nearCell: { row, col: state.enteringCol ?? 0 },
        },
      };
    }

    case 'ADVANCE_TO_APPLY':
      return {
        ...state,
        phase: 'b5_apply',
        feedback: state.suboptimalChoice
          ? {
              text: 'You chose a valid but suboptimal entering variable. The Dantzig rule would have selected a different variable for faster convergence. Your choice still leads to the optimal solution but may require additional iterations.',
              type: 'hint',
            }
          : state.feedback,
      };

    case 'APPLY_PIVOT':
      return {
        ...state,
        canAdvance: true,
        canJumpTimeline: true,
        episode: 'idle',
        phase: 'idle',
        feedback: null,
      };

    case 'SHOW_ANSWER_ENTERING':
      return {
        ...state,
        phase: 'a4_reveal',
        enteringCol: action.col,
        suboptimalChoice: false,
        feedback: {
          text: `The answer is ${action.colName} (Z = ${fmtN(action.zVal)}). This is the most negative Z-row entry.`,
          type: 'correct',
          nearCell: { row: -1, col: action.col },
        },
      };

    case 'SHOW_ANSWER_LEAVING': {
      const ratioStr = action.allRatios
        .filter(r => r.ratio !== null && r.entry > 1e-9)
        .map(r => `${r.rowName}: ${fmtN(r.rhs)} ÷ ${fmtN(r.entry)} = ${fmtN(r.ratio!)}`)
        .join('\n');
      return {
        ...state,
        phase: 'b4_reveal',
        leavingRow: action.row,
        ratiosRevealed: true,
        feedback: {
          text: `The answer is ${action.rowName} (ratio = ${action.ratio !== null ? fmtN(action.ratio) : '?'}).\n\n${ratioStr}`,
          type: 'correct',
          nearCell: { row: action.row, col: state.enteringCol ?? 0 },
        },
      };
    }

    case 'RESET':
      return INITIAL_STATE;

    default:
      return state;
  }
}

function fmtN(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  const denom = [2, 3, 4, 5, 6, 8];
  for (const d of denom) {
    const num = Math.round(n * d);
    if (Math.abs(num / d - n) < 1e-9) return `${num}/${d}`;
  }
  return n.toFixed(3).replace(/\.?0+$/, '');
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseGuidedSimplexArgs {
  currentStep: SimplexStep | null;
  steps: SimplexStep[];
  currentStepIndex: number;
  method: string;
  objectiveType: 'max' | 'min';
  stepForward: () => void;
  jumpToStep: (idx: number) => void;
}

export function useGuidedSimplex({
  currentStep,
  steps,
  currentStepIndex,
  method,
  objectiveType,
  stepForward,
  jumpToStep,
}: UseGuidedSimplexArgs) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // ── Determine if current step needs interaction ────────────────────────────
  const stepType = currentStep?.stepType;
  const isZRowSetup = stepType === 'z_row_setup';
  const isPivotStep = stepType === 'select_pivot';
  const isInitialPivotStep =
    (stepType === 'initial' || stepType === 'phase1_initial' || stepType === 'phase2_initial') &&
    currentStepIndex < steps.length - 1;
  const needsInteraction = isZRowSetup || isPivotStep || isInitialPivotStep;

  // Auto-start appropriate episode when arriving at an interactive step
  useEffect(() => {
    if (state.phase !== 'idle') {
      if (!needsInteraction) dispatch({ type: 'RESET' });
      return;
    }
    if (!needsInteraction || !currentStep) return;

    if (isZRowSetup) {
      // Find which basis rows have artificials with nonzero Z-row coefficients
      const tableau = currentStep.tableau;
      const basis = tableau.basisVariables ?? [];
      const colTypes = tableau.colTypes ?? [];
      const allVars = tableau.allVariables ?? [];
      const zRow = tableau.rows[tableau.rows.length - 1];
      const artRows: number[] = [];
      for (let i = 0; i < basis.length; i++) {
        const basisName = basis[i];
        const colIdx = allVars.findIndex(v => normVar(v) === normVar(basisName));
        if (colIdx >= 0 && colTypes[colIdx] === 'artificial') {
          const zVal = zRow[colIdx]?.value ?? 0;
          if (Math.abs(zVal) > 1e-9) artRows.push(i);
        }
      }
      if (artRows.length > 0) {
        dispatch({ type: 'START_EPISODE_0', artificialRows: artRows });
      } else {
        // No artificials to clear — skip this step
        dispatch({ type: 'RESET' });
        if (currentStepIndex < steps.length - 1) jumpToStep(currentStepIndex + 1);
      }
    } else {
      dispatch({ type: 'START_EPISODE_A' });
    }
  }, [currentStepIndex, needsInteraction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-transition: E0 correct → advance to next artificial or complete
  useEffect(() => {
    if (state.phase === 'e0_commitment') {
      const timer = setTimeout(() => {
        dispatch({ type: 'E0_ADVANCE' });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  // Auto-advance: after Episode 0 completes (idle), step forward to the post-elimination tableau
  useEffect(() => {
    if (state.phase === 'idle' && state.canAdvance && isZRowSetup) {
      // Episode 0 just completed — advance past this z_row_setup step
      if (currentStepIndex < steps.length - 1) {
        jumpToStep(currentStepIndex + 1);
      }
    }
  }, [state.phase, state.canAdvance]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-transition: A4 (entering correct) → B1 (leaving attention)
  useEffect(() => {
    if (state.phase === 'a4_reveal') {
      const timer = setTimeout(() => dispatch({ type: 'ADVANCE_TO_B' }), 800);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  // Auto-transition: B4 (leaving correct) → B5 (apply)
  useEffect(() => {
    if (state.phase === 'b4_reveal') {
      const timer = setTimeout(() => dispatch({ type: 'ADVANCE_TO_APPLY' }), 800);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  // ── Compute correct answers from tableau ──────────────────────────────────
  const analysis = useMemo(() => {
    if (!currentStep) return null;
    const tableau = currentStep.tableau;
    const allVars = tableau.allVariables ?? [];
    const rhsColIdx = allVars.length - 1;
    const zRowIdx = tableau.rows.length - 1;
    const zRow = tableau.rows[zRowIdx];
    const basis = tableau.basisVariables ?? [];
    const isMax = objectiveType === 'max';

    // Columns with their Z-row values
    const cols = allVars.slice(0, -1).map((name, idx) => ({
      name,
      idx,
      zVal: zRow[idx]?.value ?? 0,
    }));

    // Candidates: negative for MAX, positive for MIN
    const candidates = cols.filter(c =>
      isMax ? c.zVal < -1e-9 : c.zVal > 1e-9,
    );

    // Dantzig-optimal: most negative for MAX, most positive for MIN
    const dantzigCol = candidates.length > 0
      ? candidates.reduce((a, b) =>
          isMax ? (a.zVal < b.zVal ? a : b) : (a.zVal > b.zVal ? a : b),
        )
      : null;

    // Use backend hint if available, fall back to computed
    const correctEnteringName = normVar(currentStep.enteringVar || dantzigCol?.name || '');
    const correctEnteringCol = cols.findIndex(c => normVar(c.name) === correctEnteringName);

    return {
      allVars,
      rhsColIdx,
      zRowIdx,
      zRow,
      basis,
      cols,
      candidates,
      dantzigCol,
      correctEnteringCol,
      correctEnteringName,
    };
  }, [currentStep, objectiveType]);

  // Compute ratios for a given entering column
  const computeRatios = useCallback(
    (enteringCol: number) => {
      if (!currentStep || !analysis) return { ratios: [], correctRow: -1, correctRowName: '', correctRatio: null as number | null };
      const { basis, rhsColIdx } = analysis;
      const tableau = currentStep.tableau;

      const ratios: (number | null)[] = basis.map((_, r) => {
        const entry = tableau.rows[r]?.[enteringCol]?.value ?? 0;
        const rhs = tableau.rows[r]?.[rhsColIdx]?.value ?? 0;
        return entry > 1e-9 ? rhs / entry : null;
      });

      const validRatios = ratios
        .map((r, i) => ({ r, i }))
        .filter(x => x.r !== null && x.r >= 0);
      const minEntry = validRatios.length > 0
        ? validRatios.reduce((a, b) => (a.r! < b.r! ? a : b))
        : null;

      // Prefer backend hint for correct leaving variable
      const correctLeavingName = normVar(
        currentStep.leavingVar || (minEntry !== null ? basis[minEntry.i] : ''),
      );
      const correctRow = basis.findIndex(v => normVar(v) === correctLeavingName);
      const correctRatio = correctRow >= 0 ? ratios[correctRow] : null;

      return { ratios, correctRow, correctRowName: correctLeavingName, correctRatio };
    },
    [currentStep, analysis],
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  // ── Episode 0 actions ───────────────────────────────────────────────────────

  const e0Begin = useCallback(() => {
    if (state.phase === 'e0_arrive') dispatch({ type: 'E0_BEGIN' });
  }, [state.phase]);

  const e0ClickRow = useCallback((rowIdx: number) => {
    if (state.phase !== 'e0_attention' && state.phase !== 'e0_commitment') return;
    if (!currentStep) return;
    const { artificialRows, currentArtificialIdx } = state;
    const correctRow = artificialRows[currentArtificialIdx];
    const basis = currentStep.tableau.basisVariables ?? [];
    dispatch({
      type: 'E0_CLICK_ROW',
      row: rowIdx,
      correctRow,
      rowName: basis[rowIdx] ?? `row ${rowIdx + 1}`,
      correctRowName: basis[correctRow] ?? `row ${correctRow + 1}`,
    });
  }, [state.phase, state.artificialRows, state.currentArtificialIdx, currentStep]);

  // ── Episode A actions ──────────────────────────────────────────────────────

  const clickChooseEntering = useCallback(() => {
    if (state.phase === 'a1_arrive') {
      dispatch({ type: 'CLICK_CHOOSE_ENTERING' });
    }
  }, [state.phase]);

  const clickZRowCell = useCallback(
    (colIdx: number) => {
      if (!analysis || !currentStep) return;
      if (state.phase !== 'a2_attention' && state.phase !== 'a3_commitment') return;

      const { cols, correctEnteringCol, rhsColIdx, zRowIdx } = analysis;
      if (colIdx >= rhsColIdx) return; // RHS not valid
      const zVal = cols[colIdx]?.zVal ?? 0;
      const colName = cols[colIdx]?.name ?? `col${colIdx}`;
      const correctColName = cols[correctEnteringCol]?.name ?? '';
      const correctZVal = cols[correctEnteringCol]?.zVal ?? 0;

      dispatch({
        type: 'CLICK_ZROW_CELL',
        col: colIdx,
        zVal,
        colName,
        correctCol: correctEnteringCol,
        correctColName,
        correctZVal,
        objectiveType,
      });
    },
    [state.phase, analysis, currentStep, objectiveType],
  );

  const acceptSuboptimalChoice = useCallback(() => {
    if (state.phase !== 'a3b_suboptimal' || state.enteringCol === null || !analysis) return;
    dispatch({
      type: 'ACCEPT_SUBOPTIMAL',
      col: state.enteringCol,
      iteration: currentStep?.iteration ?? 0,
      optimalCol: analysis.correctEnteringCol,
    });
  }, [state.phase, state.enteringCol, analysis, currentStep]);

  const retryEntering = useCallback(() => {
    if (state.phase !== 'a3b_suboptimal') return;
    dispatch({ type: 'RETRY_ENTERING' });
  }, [state.phase]);

  const advanceToB = useCallback(() => {
    if (state.phase !== 'a4_reveal') return;
    dispatch({ type: 'ADVANCE_TO_B' });
  }, [state.phase]);

  const clickPivotColumnCell = useCallback(
    (rowIdx: number) => {
      if (!analysis || !currentStep || state.enteringCol === null) return;
      if (state.phase !== 'b1_attention' && state.phase !== 'b3_commitment') return;

      const { basis, rhsColIdx } = analysis;
      const tableau = currentStep.tableau;
      const entry = tableau.rows[rowIdx]?.[state.enteringCol]?.value ?? 0;
      const rowName = basis[rowIdx] ?? `row${rowIdx}`;
      const rhs = tableau.rows[rowIdx]?.[rhsColIdx]?.value ?? 0;
      const ratio = entry > 1e-9 ? rhs / entry : null;

      const { ratios, correctRow, correctRowName, correctRatio } = computeRatios(state.enteringCol);

      const allRatios = basis.map((name, i) => ({
        rowName: name,
        ratio: ratios[i],
        rhs: tableau.rows[i]?.[rhsColIdx]?.value ?? 0,
        entry: tableau.rows[i]?.[state.enteringCol!]?.value ?? 0,
      }));

      dispatch({
        type: 'CLICK_PIVOT_COL_CELL',
        row: rowIdx,
        entry,
        rowName,
        ratio,
        correctRow,
        correctRowName,
        correctRatio,
        allRatios,
      });
    },
    [state.phase, state.enteringCol, analysis, currentStep, computeRatios],
  );

  const advanceToApply = useCallback(() => {
    if (state.phase !== 'b4_reveal') return;
    dispatch({ type: 'ADVANCE_TO_APPLY' });
  }, [state.phase]);

  const applyPivot = useCallback(() => {
    if (state.phase !== 'b5_apply') return;
    dispatch({ type: 'APPLY_PIVOT' });

    // Skip past non-interactive steps (after_pivot, select_pivot at initial)
    // and land on the next step that needs interaction or is terminal.
    let target = currentStepIndex + 1;
    while (target < steps.length) {
      const st = steps[target].stepType;
      // Stop at: next interactive step, optimal, infeasible, unbounded, phase transitions
      if (st === 'select_pivot' || st === 'initial' ||
          st === 'phase1_initial' || st === 'phase2_initial' ||
          st === 'optimal' || st === 'infeasible' || st === 'unbounded' ||
          st === 'phase1_complete') {
        break;
      }
      target++;
    }
    // Clamp to last step
    target = Math.min(target, steps.length - 1);
    jumpToStep(target);
  }, [state.phase, steps, currentStepIndex, jumpToStep]);

  const showAnswer = useCallback(() => {
    if (!analysis || !currentStep) return;

    if (state.episode === 'episodeA' && state.phase !== 'a4_reveal') {
      const { cols, correctEnteringCol } = analysis;
      dispatch({
        type: 'SHOW_ANSWER_ENTERING',
        col: correctEnteringCol,
        colName: cols[correctEnteringCol]?.name ?? '',
        zVal: cols[correctEnteringCol]?.zVal ?? 0,
      });
    } else if (state.episode === 'episodeB' && state.phase !== 'b4_reveal' && state.phase !== 'b5_apply') {
      if (state.enteringCol === null) return;
      const { basis, rhsColIdx } = analysis;
      const tableau = currentStep.tableau;
      const { ratios, correctRow, correctRatio } = computeRatios(state.enteringCol);
      const correctRowName = basis[correctRow] ?? '';
      const allRatios = basis.map((name, i) => ({
        rowName: name,
        ratio: ratios[i],
        rhs: tableau.rows[i]?.[rhsColIdx]?.value ?? 0,
        entry: tableau.rows[i]?.[state.enteringCol!]?.value ?? 0,
      }));
      dispatch({
        type: 'SHOW_ANSWER_LEAVING',
        row: correctRow,
        rowName: correctRowName,
        ratio: correctRatio,
        allRatios,
      });
    }
  }, [state.episode, state.phase, state.enteringCol, analysis, currentStep, computeRatios]);

  // ── Computed props for TableauWorkspace ────────────────────────────────────

  const tableauProps: GuidedTableauProps = useMemo(() => {
    const base: GuidedTableauProps = {
      zRowEmphasis: false,
      highlightedCol: null,
      rhsEmphasis: false,
      dimmedRows: [],
      cellStates: {},
      clickableRegion: 'none',
      showRatios: false,
      ratios: [],
      minRatioRow: -1,
    };

    if (!analysis || !currentStep || !needsInteraction) return base;

    const { zRowIdx } = analysis;
    const tableau = currentStep.tableau;
    const basis = tableau.basisVariables ?? [];

    const in0 = state.episode === 'episode0';
    const inA = state.episode === 'episodeA';
    const inB = state.episode === 'episodeB';

    // Episode 0: Z-row + basis emphasis, clickable basis rows
    if (in0 && state.phase !== 'e0_arrive') {
      base.zRowEmphasis = true;
      base.clickableRegion = 'basisrow';
    }

    // Z-row emphasis in A2+
    if (inA && state.phase !== 'a1_arrive') base.zRowEmphasis = true;

    // Column highlight in A4, B*
    if ((inA && state.phase === 'a4_reveal') || inB) {
      base.highlightedCol = state.enteringCol;
    }

    // RHS emphasis in B1+
    if (inB) base.rhsEmphasis = true;

    // Clickable region
    if (inA && (state.phase === 'a2_attention' || state.phase === 'a3_commitment')) {
      base.clickableRegion = 'zrow';
    } else if (inB && (state.phase === 'b1_attention' || state.phase === 'b3_commitment')) {
      base.clickableRegion = 'pivotcol';
    }

    // Dimmed rows in Episode B (non-positive pivot col entry)
    if (inB && state.enteringCol !== null) {
      basis.forEach((_, i) => {
        const entry = tableau.rows[i]?.[state.enteringCol!]?.value ?? 0;
        if (entry <= 1e-9) base.dimmedRows.push(i);
      });
    }

    // Cell states from attempts + confirmed
    for (const a of state.enteringAttempts) {
      const key = `${zRowIdx},${a.col}`;
      base.cellStates[key] = a.type === 'suboptimal' ? 'suboptimal' : 'invalid';
    }
    if (state.enteringCol !== null && (state.phase === 'a4_reveal' || inB)) {
      base.cellStates[`${zRowIdx},${state.enteringCol}`] = state.suboptimalChoice ? 'suboptimal' : 'correct';
    }
    for (const a of state.leavingAttempts) {
      const key = `${a.row},${state.enteringCol}`;
      base.cellStates[key] = 'invalid';
    }
    if (state.leavingRow !== null) {
      base.cellStates[`${state.leavingRow},${state.enteringCol}`] = 'correct';
    }

    // Ratios
    if (state.ratiosRevealed && state.enteringCol !== null) {
      const { ratios, correctRow } = computeRatios(state.enteringCol);
      base.showRatios = true;
      base.ratios = ratios;
      base.minRatioRow = correctRow;
    }

    return base;
  }, [state, analysis, currentStep, needsInteraction, computeRatios]);

  // ── Computed props for GraphView ──────────────────────────────────────────

  const graphProps: GuidedGraphProps = useMemo(() => {
    const base: GuidedGraphProps = {
      enteringVarName: null,
      highlightedConstraintIdx: null,
      destinationVertex: null,
      showDirectionArrow: false,
    };

    if (!analysis || !currentStep) return base;

    // A4: show direction arrow
    if (state.phase === 'a4_reveal' && state.enteringCol !== null) {
      base.enteringVarName = analysis.cols[state.enteringCol]?.name ?? null;
      base.showDirectionArrow = true;
    }

    // B4/B5: show constraint highlight and destination
    if ((state.phase === 'b4_reveal' || state.phase === 'b5_apply') && state.leavingRow !== null) {
      // The leaving variable is a basis variable — find which constraint it corresponds to
      // For slack variables, the constraint index usually matches the row index
      base.highlightedConstraintIdx = state.leavingRow;

      // Destination vertex: use the next step's simplex path point if available
      const nextStepData = steps[currentStepIndex + 1];
      if (nextStepData) {
        // Get the point from the raw matrix after pivot
        // For now, leave as null — the graph already shows simplex path
      }

      base.enteringVarName = analysis.cols[state.enteringCol ?? 0]?.name ?? null;
      base.showDirectionArrow = true;
    }

    return base;
  }, [state, analysis, currentStep, steps, currentStepIndex]);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    state,
    needsInteraction,
    tableauProps,
    graphProps,

    // Actions — Episode 0
    e0Begin,
    e0ClickRow,
    // Actions — Episode A
    clickChooseEntering,
    clickZRowCell,
    acceptSuboptimalChoice,
    retryEntering,
    advanceToB,
    clickPivotColumnCell,
    advanceToApply,
    applyPivot,
    showAnswer,
  };
}
