/**
 * SimplexTutorial — drives the unified Workspace with a Simplex pivot
 * learning script.
 *
 * Wraps useGuidedSimplex (the existing state machine) and maps its phase
 * state onto:
 *   - a NarrativeBanner (one-line instruction + optional action)
 *   - tableau highlight props (Z-row emphasis, pivot column glow, etc.)
 *   - graph props (direction arrow, constraint highlight, destination ghost)
 *   - a cell-click handler that routes to the correct gs action
 *
 * The tutorial never opens a side panel — it lives entirely in the banner +
 * tableau + graph, so the student's eyes stay on the workspace surface.
 */

import { useMemo, useCallback } from 'react';
import { useGuidedSimplex } from '../../../hooks/useGuidedSimplex';
import { useLPSolver } from '../../../hooks/useLPSolver';
import { NarrativeBanner } from '../../../hooks/useLPWorkspace';

type SolverBundle = ReturnType<typeof useLPSolver>;

export interface SimplexTutorialResult {
  enabled: boolean;
  banner: NarrativeBanner | null;
  /** Props to pass into TableauWorkspace for highlighting + click wiring. */
  tableauProps: ReturnType<typeof useGuidedSimplex>['tableauProps'] | undefined;
  /** Props to pass into GraphView for the simplex teaching overlay. */
  graphProps: ReturnType<typeof useGuidedSimplex>['graphProps'] | undefined;
  /** Whether the current phase needs student interaction. */
  needsInteraction: boolean;
  /** Handler for a cell click — dispatches to the correct episode action. */
  onCellClick: (rowIdx: number, colIdx: number) => void;
}

export function useSimplexTutorial(
  enabled: boolean,
  solver: SolverBundle,
  objectiveType: 'max' | 'min',
  method: string,
): SimplexTutorialResult {
  const {
    currentStep, steps, currentStepIndex, stepForward, jumpToStep,
  } = solver;

  const gs = useGuidedSimplex({
    currentStep: currentStep ?? null,
    steps,
    currentStepIndex,
    method,
    objectiveType,
    stepForward,
    jumpToStep,
  });

  const onCellClick = useCallback((rowIdx: number, colIdx: number) => {
    if (!gs.needsInteraction) return;
    const { episode, phase } = gs.state;

    if (episode === 'episode0' && (phase === 'e0_attention' || phase === 'e0_commitment')) {
      gs.e0ClickRow(rowIdx);
      return;
    }
    if (episode === 'episodeA' && (phase === 'a2_attention' || phase === 'a3_commitment')) {
      gs.clickZRowCell(colIdx);
      return;
    }
    if (episode === 'episodeB' && (phase === 'b1_attention' || phase === 'b3_commitment')) {
      gs.clickPivotColumnCell(rowIdx);
      return;
    }
  }, [gs]);

  const banner: NarrativeBanner | null = useMemo(() => {
    if (!enabled) return null;
    if (!gs.needsInteraction) {
      const st = currentStep?.stepType;
      if (st === 'optimal') return {
        kind: 'correct',
        text: `Optimal solution reached — z* = ${currentStep?.objectiveValue?.toFixed(3) ?? '?'}. Open the Solution lens for the full breakdown.`,
      };
      if (st === 'after_pivot') return {
        kind: 'info',
        text: 'Pivot applied. Use the step arrows to see row operations, or continue to the next tableau.',
      };
      return null;
    }

    const { episode, phase, feedback, attemptCount } = gs.state;

    // Episode 0 — Z-row setup
    if (episode === 'episode0') {
      if (phase === 'e0_arrive') {
        return {
          kind: 'question',
          text: 'Before the first pivot, basic artificials must be cleared from the Z-row. Ready?',
          action: { label: 'Begin Z-row setup', onClick: gs.e0Begin },
        };
      }
      if (phase === 'e0_attention' || phase === 'e0_commitment') {
        if (feedback?.type === 'invalid') return { kind: 'wrong', text: feedback.text };
        return {
          kind: 'question',
          text: `Clear artificial ${gs.state.currentArtificialIdx + 1}/${gs.state.artificialRows.length} — click the row where this artificial is basic.`,
        };
      }
    }

    // Episode A — entering variable
    if (episode === 'episodeA') {
      if (phase === 'a1_arrive') {
        return {
          kind: 'question',
          text: 'Which variable should enter the basis to improve z?',
          action: { label: 'Choose entering variable', onClick: gs.clickChooseEntering },
        };
      }
      if (phase === 'a2_attention' || phase === 'a3_commitment') {
        if (feedback?.type === 'invalid') return { kind: 'wrong', text: feedback.text };
        const hint = attemptCount >= 2
          ? `Click a Z-row cell. Hint: for ${objectiveType.toUpperCase()}, look for the most ${objectiveType === 'max' ? 'negative' : 'positive'} value.`
          : `Click a Z-row cell to choose the entering variable (${objectiveType === 'max' ? 'most negative improves z fastest' : 'most positive improves z fastest'}).`;
        return { kind: 'question', text: hint };
      }
      if (phase === 'a3b_suboptimal') {
        return { kind: 'hint', text: feedback?.text ?? 'Valid but not Dantzig-optimal. Use this anyway or pick the most-negative value?' };
      }
      if (phase === 'a4_reveal') {
        return {
          kind: 'correct',
          text: 'Entering variable confirmed. The entire column is now highlighted.',
          action: { label: 'Continue to leaving variable', onClick: gs.acknowledge },
        };
      }
    }

    // Episode B — leaving variable
    if (episode === 'episodeB') {
      if (phase === 'b1_attention' || phase === 'b3_commitment') {
        if (feedback?.type === 'invalid') return { kind: 'wrong', text: feedback.text };
        const hint = attemptCount >= 2
          ? 'Click a row in the highlighted column. Hint: divide RHS by the column entry (only where entry is positive) — smallest ratio wins.'
          : 'Ratio test: divide each positive entry in the pivot column into its RHS. Click the row with the smallest ratio.';
        return { kind: 'question', text: hint };
      }
      if (phase === 'b4_reveal') {
        return {
          kind: 'correct',
          text: 'Leaving variable confirmed. Ratios are now visible in the tableau.',
          action: { label: 'Continue to apply pivot', onClick: gs.acknowledge },
        };
      }
      if (phase === 'b5_apply') {
        return {
          kind: 'correct',
          text: 'Pivot selected. Apply row operations now.',
          action: { label: 'Apply pivot →', onClick: gs.applyPivot },
        };
      }
    }

    return null;
  }, [enabled, gs, currentStep, objectiveType]);

  return {
    enabled,
    banner,
    tableauProps: gs.tableauProps,
    graphProps: gs.graphProps,
    needsInteraction: gs.needsInteraction,
    onCellClick,
  };
}
