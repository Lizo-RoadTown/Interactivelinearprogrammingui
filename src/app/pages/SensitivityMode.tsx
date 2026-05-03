/**
 * SensitivityMode.tsx — Chapter 8 learning environment.
 *
 * Five-layer pedagogy parallel to PracticeMode:
 *   1. Browse → pick a sensitivity problem (extends an existing Simplex problem)
 *   2. Arrive → read the word problem, see the "management asks" twist
 *   3. Identify operation → which §8.3.X does this change map to?
 *   4. Solve (tableau-driven) → student-driven matrix math, checked step by step
 *      (still a Phase-2 placeholder — wired per-operation in a later slice)
 *   5. Reveal → graphical slider + live recomputed optimum
 *   6. Debrief → plain-English answer with the actual numbers filled in
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import TableauWorkspace from '../components/TableauWorkspace';
import {
  SENSITIVITY_PROBLEMS,
  SensitivityProblem,
  SensitivityOperation,
  SECTION_LABEL,
  OPERATION_LABEL,
  OPERATION_SHORT_WHY,
} from '../data/sensitivityProblems';
import { WORD_PROBLEMS, WordProblem } from '../data/wordProblems';
import { LPProblem } from '../types';
import { useLPSolver } from '../hooks/useLPSolver';
import { useGuidedSensitivity } from '../hooks/useGuidedSensitivity';
import { LPDraft } from './workspace/guidedTypes';
import { solveLP2D, applyPerturbation, LPSolution } from './workspace/lpSolve';
import SensitivityControls from './workspace/SensitivityControls';
import DiscoveryGraph from './workspace/DiscoveryGraph';
import {
  ArrowLeft, BookOpen, Loader2, AlertCircle, CheckCircle,
  XCircle, Lightbulb, Eye,
} from 'lucide-react';

// ── Word-problem → LPDraft converter (used by Reveal/Debrief sliders) ───────

function wordProblemToDraft(p: WordProblem): LPDraft {
  return {
    variables: p.variables.map(v => ({ name: v.name, description: v.description })),
    objectiveType: p.objectiveType,
    objectiveCoefficients: [...p.objectiveCoefficients],
    constraints: p.constraints.map(c => ({
      started: true,
      label: c.label ?? '',
      coefficients: [...c.coefficients],
      operator: c.operator,
      rhs: c.rhs,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell — routes between the six layers
// ─────────────────────────────────────────────────────────────────────────────

export default function SensitivityMode() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<SensitivityProblem | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">

      <header className="bg-card/60 backdrop-blur border-b border-border px-6 py-4 flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selected ? setSelected(null) : navigate('/')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {selected ? 'Back to problem list' : 'Home'}
        </Button>
        <div className="flex items-center gap-3 ml-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Chapter 8 — Sensitivity Analysis</h1>
            <p className="text-[11px] text-muted-foreground">
              Post-optimality "what if" analysis. Pick a scenario and work through it.
            </p>
          </div>
        </div>
      </header>

      {!selected && (
        <ProblemBrowser onSelect={setSelected} />
      )}

      {selected && (
        <SensitivityRunner problem={selected} onExit={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 — Problem browser
// ─────────────────────────────────────────────────────────────────────────────

function ProblemBrowser({ onSelect }: { onSelect: (p: SensitivityProblem) => void }) {
  const byDiff: Record<string, SensitivityProblem[]> = {
    Beginner: [], Intermediate: [], Advanced: [],
  };
  for (const p of SENSITIVITY_PROBLEMS) byDiff[p.difficulty].push(p);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-5">
          <h2 className="text-lg font-bold text-primary mb-2">What is sensitivity analysis?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You&apos;ve solved an LP — maybe the toy factory, maybe the bakery. Now reality
            intrudes: a profit margin changes, a resource gets cheaper, a new product is
            proposed, a new regulation lands. <strong className="text-foreground">Do you have
            to re-solve the whole LP from scratch?</strong> Usually no. Chapter 8 shows you
            how to reuse your optimal tableau — specifically the matrices B, B⁻¹, N, C_B —
            to answer these questions with a few small computations.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            Each problem below picks up where a Practice Mode problem left off, then adds a
            "what if" twist. You work it out on the optimal tableau, step by step.
          </p>
        </div>

        {(['Beginner', 'Intermediate', 'Advanced'] as const).map(tier => (
          byDiff[tier].length === 0 ? null : (
            <div key={tier}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {tier}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {byDiff[tier].map(p => <ProblemTile key={p.id} problem={p} onSelect={onSelect} />)}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function ProblemTile({
  problem, onSelect,
}: {
  problem: SensitivityProblem;
  onSelect: (p: SensitivityProblem) => void;
}) {
  const base = WORD_PROBLEMS.find(w => w.id === problem.baseProblemId);
  return (
    <button
      onClick={() => onSelect(problem)}
      className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20 transition-all group"
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="text-base font-semibold text-foreground">{problem.title}</h4>
        <span className="text-[10px] font-mono text-accent bg-accent/10 border border-accent/30 rounded px-2 py-0.5 whitespace-nowrap">
          {SECTION_LABEL[problem.operation]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Extends: <span className="text-foreground">{base?.title ?? problem.baseProblemId}</span>
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {problem.managementAsks}
      </p>
      <div className="text-xs text-primary mt-3 group-hover:gap-2 flex items-center gap-1 transition-all">
        Start → <span className="opacity-0 group-hover:opacity-100 transition-opacity">go</span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner — dispatches between layers 2-6 for a selected problem
// ─────────────────────────────────────────────────────────────────────────────

function SensitivityRunner({
  problem, onExit,
}: {
  problem: SensitivityProblem;
  onExit: () => void;
}) {
  const guided = useGuidedSensitivity();
  const baseProblem = WORD_PROBLEMS.find(w => w.id === problem.baseProblemId);
  const solver = useLPSolver();

  // Solve the base problem silently so we have the optimal tableau in hand
  useEffect(() => {
    guided.loadProblem(problem);
    if (baseProblem) {
      const lp: LPProblem = {
        objectiveType: baseProblem.objectiveType,
        objectiveCoefficients: baseProblem.objectiveCoefficients,
        variables: baseProblem.variables.map(v => v.name),
        variableSigns: baseProblem.variables.map(() => 'nonneg' as const),
        constraints: baseProblem.constraints,
      };
      void solver.solve(lp, baseProblem.method);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem.id]);

  if (!baseProblem) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-5 max-w-xl">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertCircle className="w-5 h-5" />
            Missing base problem
          </div>
          <p className="text-sm text-muted-foreground">
            This sensitivity scenario references <code className="font-mono">{problem.baseProblemId}</code>, but that problem isn&apos;t in the bank.
          </p>
          <Button onClick={onExit} variant="outline" className="mt-4">Back</Button>
        </div>
      </div>
    );
  }

  const { layer } = guided.state;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {layer === 'arrive'      && <ArriveLayer problem={problem} baseProblem={baseProblem} guided={guided} />}
      {layer === 'identify_op' && <IdentifyOpLayer problem={problem} guided={guided} />}
      {layer === 'solve'       && <SolvePlaceholder problem={problem} solver={solver} guided={guided} />}
      {layer === 'reveal'      && <RevealLayer problem={problem} baseProblem={baseProblem} guided={guided} />}
      {layer === 'debrief'     && <DebriefLayer problem={problem} baseProblem={baseProblem} guided={guided} onExit={onExit} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — Arrive: show the base problem and the "management asks" question
// ─────────────────────────────────────────────────────────────────────────────

function ArriveLayer({
  problem, baseProblem, guided,
}: {
  problem: SensitivityProblem;
  baseProblem: WordProblem;
  guided: ReturnType<typeof useGuidedSensitivity>;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Previously in Practice Mode
          </p>
          <h3 className="text-lg font-semibold text-foreground mb-2">{baseProblem.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {baseProblem.scenario}
          </p>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-300 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-emerald-200">You solved this already.</strong>{' '}
              The optimal tableau and solution are loaded in the background.
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/40 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
            Now — management asks
          </p>
          <p className="text-base text-foreground leading-relaxed">
            {problem.managementAsks}
          </p>
          <p className="text-sm text-muted-foreground italic mt-3">
            Specific change: {problem.change.description}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={guided.arriveNext}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            Let&apos;s analyze →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 — Identify the operation
// ─────────────────────────────────────────────────────────────────────────────

const OPERATION_ORDER: SensitivityOperation[] = [
  'of_coeff_basic',
  'of_coeff_nonbasic',
  'rhs_range',
  'add_activity',
  'add_constraint',
  'tech_coeff_nonbasic',
];

function IdentifyOpLayer({
  problem, guided,
}: {
  problem: SensitivityProblem;
  guided: ReturnType<typeof useGuidedSensitivity>;
}) {
  const { feedback, pickedOp, attemptCount } = guided.state;
  const isCorrectPick = pickedOp === problem.operation && feedback?.kind === 'correct';

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Step 1: What kind of change is this?
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Chapter 8 classifies post-optimality changes into six kinds. The one you pick
            determines which matrix computation you&apos;ll do. Re-read the management request
            and the specific change described, then choose.
          </p>
        </div>

        <div className="space-y-2">
          {OPERATION_ORDER.map(op => {
            const isPicked = pickedOp === op;
            const stateClass = !isPicked
              ? 'bg-card border-border hover:border-primary/40'
              : (isCorrectPick
                  ? 'bg-emerald-500/10 border-emerald-500/60 ring-2 ring-emerald-500/40'
                  : 'bg-destructive/10 border-destructive/50');
            const disabled = isCorrectPick;
            return (
              <button
                key={op}
                disabled={disabled}
                onClick={() => guided.pickOperation(op)}
                className={`w-full text-left border rounded-xl p-4 transition-all disabled:cursor-default ${stateClass}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-accent bg-accent/10 border border-accent/30 rounded px-2 py-0.5 whitespace-nowrap">
                    {SECTION_LABEL[op]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{OPERATION_LABEL[op]}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {OPERATION_SHORT_WHY[op]}
                    </p>
                  </div>
                  {isPicked && isCorrectPick && <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                  {isPicked && !isCorrectPick && <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {feedback?.kind === 'wrong' && (
          <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Walk-me-through after 2+ wrong attempts */}
        {attemptCount >= 2 && !isCorrectPick && (
          <details className="bg-accent/10 border border-accent/30 rounded-lg" open={attemptCount >= 3}>
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-accent flex items-center gap-1.5 select-none">
              <Lightbulb className="w-3.5 h-3.5" />
              Walk me through this step
            </summary>
            <div className="px-3 pb-3 text-xs text-accent leading-relaxed space-y-2">
              <p>
                Ask yourself two questions about the change being proposed:
              </p>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Is something being <strong>added</strong> to the LP (new variable → §8.3.5, new constraint → §8.3.6), or is an <strong>existing</strong> value being changed?</li>
                <li>If existing: is an <strong>OF coefficient</strong> changing (§8.3.1 if basic variable, §8.3.2 if nonbasic), a <strong>constraint RHS</strong> (§8.3.3), or a <strong>constraint coefficient</strong> of a nonbasic variable (§8.3.4)?</li>
              </ol>
              <p className="italic mt-2 text-muted-foreground">{problem.operationHint}</p>
            </div>
          </details>
        )}

        {isCorrectPick && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {feedback?.text}
            </p>
            <Button
              onClick={() => { /* auto-transitioned by PICK_OP_CORRECT; Continue handled by solve layer */ }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white pointer-events-none opacity-70"
            >
              Loading…
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 4 — Solve (Phase 1 placeholder, per-operation content added in Phase 2+)
// ─────────────────────────────────────────────────────────────────────────────

function SolvePlaceholder({
  problem, solver, guided,
}: {
  problem: SensitivityProblem;
  solver: ReturnType<typeof useLPSolver>;
  guided: ReturnType<typeof useGuidedSensitivity>;
}) {
  const { solverResponse, steps, isLoading } = solver;
  const optimalTableau = useMemo(() => {
    return steps.find(s => s.stepType === 'optimal')?.tableau ?? null;
  }, [steps]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        <div className="bg-primary/10 border border-primary/40 rounded-xl p-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            Operation identified: {SECTION_LABEL[problem.operation]}
          </p>
          <p className="text-sm text-foreground">{OPERATION_LABEL[problem.operation]}</p>
        </div>

        {/* Optimal tableau — always visible during solve layer */}
        {isLoading && (
          <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm text-accent">
            <Loader2 className="w-4 h-4 animate-spin" />
            Solving the base problem to get the optimal tableau…
          </div>
        )}
        {optimalTableau && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Optimal Tableau — your starting point
              </p>
            </div>
            <TableauWorkspace
              tableau={optimalTableau}
              showRatioTest={false}
              afterStep={0}
              onAfterStepChange={() => {}}
            />
          </div>
        )}

        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-5">
          <p className="text-sm font-semibold text-amber-200 mb-2">Phase 2 coming next</p>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            The operation-specific step-by-step solving interface for{' '}
            <span className="font-mono">{SECTION_LABEL[problem.operation]}</span> is being
            built in Phase 2. For now this page shows the optimal tableau you&apos;ll work on
            and confirms your operation pick was correct.
          </p>
          <p className="text-xs text-amber-200/80 leading-relaxed mt-2">
            Debug info — solver status: <span className="font-mono">{solverResponse?.status ?? 'loading'}</span>,
            {' '}z* = <span className="font-mono">{solverResponse?.optimalValue?.toFixed(4) ?? '—'}</span>
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => guided.finishSolve()}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            Skip to graphical reveal →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 5 — Reveal: live sliders + recomputed optimum + (when 2-var) graph
//
// The student drags the perturbation slider for the change the problem
// describes, watches the feasible region and optimum shift, and sees Δz
// update against the baseline. The slope of Δz over the slider's range IS
// the shadow price (RHS) or the reduced-cost margin (objective coeff).
// ─────────────────────────────────────────────────────────────────────────────

function RevealLayer({
  problem, baseProblem, guided,
}: {
  problem: SensitivityProblem;
  baseProblem: WordProblem;
  guided: ReturnType<typeof useGuidedSensitivity>;
}) {
  const draft = useMemo(() => wordProblemToDraft(baseProblem), [baseProblem]);
  const baseline: LPSolution | null = useMemo(
    () => solveLP2D(draft, baseProblem.objectiveType === 'min' ? 'min' : 'max'),
    [draft, baseProblem.objectiveType],
  );

  const [rhsDelta, setRhsDelta] = useState<number[]>([]);
  const [objDelta, setObjDelta] = useState<number[]>([]);

  // Pre-set the slider that matches this problem's specific change so the
  // student lands on the "after" state and can drag back/forward to compare.
  useEffect(() => {
    if (problem.change.delta == null) return;
    const t = problem.change.target?.name;
    if (!t) return;
    if (problem.operation === 'rhs_range') {
      // target.name is the 1-based constraint index as a string ("1", "2", ...)
      const idx = parseInt(t, 10) - 1;
      if (idx >= 0) {
        setRhsDelta(arr => {
          const a = [...arr];
          while (a.length <= idx) a.push(0);
          a[idx] = problem.change.delta!;
          return a;
        });
      }
    } else if (problem.operation === 'of_coeff_basic' || problem.operation === 'of_coeff_nonbasic') {
      // target.name is the variable name ("x1", "x2", ...)
      const idx = baseProblem.variables.findIndex(v => v.name === t);
      if (idx >= 0) {
        setObjDelta(arr => {
          const a = [...arr];
          while (a.length <= idx) a.push(0);
          a[idx] = problem.change.delta!;
          return a;
        });
      }
    }
    // For add_activity / add_constraint / tech_coeff_nonbasic, the slider
    // panel doesn't apply directly — the student gets a static "before/after"
    // banner instead (handled below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem.id]);

  const liveDraft = useMemo(
    () => applyPerturbation(draft, rhsDelta, objDelta),
    [draft, rhsDelta, objDelta],
  );
  const liveSolution: LPSolution | null = useMemo(
    () => solveLP2D(liveDraft, baseProblem.objectiveType === 'min' ? 'min' : 'max'),
    [liveDraft, baseProblem.objectiveType],
  );

  const sliderApplies =
    problem.operation === 'of_coeff_basic' ||
    problem.operation === 'of_coeff_nonbasic' ||
    problem.operation === 'rhs_range';

  const continueToDebrief = () => {
    // Commit the current optimum so the debrief layer can reference it.
    guided.solveCorrect({
      revealBaseline: baseline,
      revealCurrent: liveSolution,
    });
    guided.acknowledgeReveal();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="bg-violet-500/10 border border-violet-500/40 rounded-xl p-4">
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-1">
            Reveal — drag the slider, watch the optimum move
          </p>
          <p className="text-sm text-foreground/90">
            {sliderApplies ? (
              <>
                The slider for <code className="font-mono">{problem.change.target?.name}</code> is
                pre-set to the value the problem asks about. Slide it back to <strong>0</strong> to
                see the baseline, then forward to compare. The slope of Δz is the shadow price (RHS) or
                the reduced-cost margin (objective coefficient).
              </>
            ) : (
              <>
                This operation ({SECTION_LABEL[problem.operation]}) doesn&apos;t map to a single slider —
                the change is structural (a new variable or constraint). Continue to the debrief
                for the worked answer.
              </>
            )}
          </p>
        </div>

        {sliderApplies ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Graph: only meaningful for 2-variable LPs */}
            {baseProblem.numVars === 2 && (
              <div className="bg-card/40 border border-border rounded-xl p-3">
                <DiscoveryGraph
                  draft={liveDraft}
                  linesDrawn={new Set(baseProblem.constraints.map((_, i) => i))}
                  sideDrawnFor={new Set(baseProblem.constraints.map((_, i) => i))}
                  feasibleRegionRevealed
                  bfsPoint={liveSolution ? { x: liveSolution.x1, y: liveSolution.x2 } : null}
                  optimumConfirmed={!!liveSolution}
                  optimumTarget={liveSolution?.z}
                />
              </div>
            )}

            <SensitivityControls
              draft={draft}
              rhsDelta={rhsDelta}
              objDelta={objDelta}
              onRhsDelta={(idx, delta) => {
                setRhsDelta(prev => {
                  const arr = [...prev];
                  while (arr.length <= idx) arr.push(0);
                  arr[idx] = delta;
                  return arr;
                });
              }}
              onObjDelta={(idx, delta) => {
                setObjDelta(prev => {
                  const arr = [...prev];
                  while (arr.length <= idx) arr.push(0);
                  arr[idx] = delta;
                  return arr;
                });
              }}
              onReset={() => {
                setRhsDelta([]);
                setObjDelta([]);
              }}
              baseline={baseline}
            />
          </div>
        ) : (
          <div className="bg-card/40 border border-border rounded-xl p-5 space-y-2">
            <p className="text-sm text-foreground">
              <strong>Change requested:</strong> {problem.change.description}
            </p>
            {baseline && (
              <p className="text-xs text-muted-foreground">
                Baseline optimum: (x₁, x₂) = ({baseline.x1.toFixed(2)}, {baseline.x2.toFixed(2)}),
                {' '}z* = {baseline.z.toFixed(2)}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={continueToDebrief} className="bg-primary hover:bg-primary/90 text-white">
            Continue to debrief →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 6 — Debrief: plain-English answer with the actual numbers filled in
// ─────────────────────────────────────────────────────────────────────────────

function DebriefLayer({
  problem, baseProblem, guided, onExit,
}: {
  problem: SensitivityProblem;
  baseProblem: WordProblem;
  guided: ReturnType<typeof useGuidedSensitivity>;
  onExit: () => void;
}) {
  const baseline = guided.state.committed.revealBaseline as LPSolution | null | undefined;
  const current = guided.state.committed.revealCurrent as LPSolution | null | undefined;
  const dz = baseline && current ? current.z - baseline.z : null;
  const direction = baseProblem.objectiveType === 'min' ? 'min' : 'max';
  const improved =
    dz == null ? null
    : direction === 'max' ? dz > 1e-6
    : dz < -1e-6;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold text-emerald-200">Debrief</h3>
          <p className="text-sm text-foreground leading-relaxed">
            {problem.debriefTemplate}
          </p>
        </div>

        {/* Numeric summary pulled from the Reveal layer's last state. */}
        {baseline && current && (
          <div className="bg-card/40 border border-border rounded-xl p-5 space-y-3 font-mono text-sm">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold not-italic">
              Numbers
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-muted/30 border border-border rounded p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Baseline</p>
                <p className="tabular-nums">x₁* = {baseline.x1.toFixed(2)}</p>
                <p className="tabular-nums">x₂* = {baseline.x2.toFixed(2)}</p>
                <p className="tabular-nums text-foreground font-semibold">z* = {baseline.z.toFixed(2)}</p>
              </div>
              <div className="bg-muted/30 border border-border rounded p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">After change</p>
                <p className="tabular-nums">x₁* = {current.x1.toFixed(2)}</p>
                <p className="tabular-nums">x₂* = {current.x2.toFixed(2)}</p>
                <p className="tabular-nums text-foreground font-semibold">z* = {current.z.toFixed(2)}</p>
              </div>
            </div>
            {dz != null && (
              <p className="text-xs not-italic">
                Δz ={' '}
                <span className={improved ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
                  {dz >= 0 ? '+' : ''}{dz.toFixed(2)}
                </span>
                {' '}
                <span className="text-muted-foreground">
                  ({improved ? 'improved' : Math.abs(dz) < 1e-6 ? 'unchanged' : 'worsened'})
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={onExit} variant="outline">
            Try another sensitivity problem
          </Button>
          <Button onClick={guided.reset} className="bg-primary hover:bg-primary/90 text-white">
            Replay this one
          </Button>
        </div>
      </div>
    </div>
  );
}
