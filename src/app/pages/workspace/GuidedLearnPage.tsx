/**
 * GuidedLearnPage — the learning tool the user asked for.
 *
 * Shape: student opens an LP problem. They see the word problem and ONE
 * question at a time. They answer. A gentle tutor response follows
 * ("Good try — try this instead", "Yes, that's it", "Close — take another
 * look at that bit"). When right, the LP canvas below fills in with their
 * answer and the next question appears. Answered steps stay visible above
 * like completed homework problems accumulating on the page.
 *
 * Phase 1 shipped: formulation (variables → objective → each constraint).
 * Phases 2+ (graph build, tableau, pivots, optimal, sensitivity) are
 * future commits that extend the Toy Factory script.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { WORD_PROBLEMS } from '../../data/wordProblems';
import {
  getScript, Question, TextQuestion, NumberQuestion, MCQuestion, FieldsQuestion, DragQuestion,
  ClickTableauQuestion, CommitPayload, QuestionHighlight, PhaseMeta,
} from '../../data/tutorialScripts';
import DiscoveryGraph from './DiscoveryGraph';
import GuidedTableau, { TableauReveal } from './GuidedTableau';
import ConstraintMeter from './ConstraintMeters';
import { LPDraft } from './guidedTypes';
import {
  ArrowLeft, CheckCircle, Lightbulb, Eye, Sparkles, Compass, Flag,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const WARM_PREFIXES_WRONG = [
  'Good try —',
  'Close, but take another look —',
  'Almost —',
  'Nearly there —',
  'On the right track —',
];

const WARM_PREFIXES_CORRECT = [
  'Yes, exactly.',
  'That\'s it.',
  'Got it — nicely done.',
  'Exactly right.',
  'Perfect.',
];

function pickWarm(list: string[], seed: number): string {
  return list[seed % list.length];
}

function normText(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Which extraction event just fired — drives a short pulse on the source
 *  coefficients in the Canvas, paired with the fly-in on tableau cells. */
type ExtractionPulseKind =
  | null
  | 'slack-identity'   // pulse each row's "+ 1 s_i"
  | 'z-row-x'          // pulse the objective coefficients (they became Z-row)
  | 'initial-basic'    // pulse each constraint's RHS
  | 'initial-z';       // pulse the "z =" label (0 at origin)

// ── Grading ──────────────────────────────────────────────────────────────────

interface AnswerState {
  [questionId: string]: {
    correct: boolean;
    wrongAttempts: number;
    studentAnswer: unknown;   // for later display (what did they type?)
    shownAnswer?: boolean;    // did they use "Show me how"?
  };
}

function gradeTextAnswer(q: TextQuestion, value: string): boolean {
  const n = normText(value);
  if (!n) return false;
  return q.acceptedAnswers.some(a => normText(a) === n);
}

function gradeNumberAnswer(q: NumberQuestion, value: string): boolean {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  const tol = q.tolerance ?? 1e-6;
  return Math.abs(n - q.correct) <= tol;
}

function gradeMCAnswer(q: MCQuestion, value: string): boolean {
  return value === q.correctId;
}

function gradeFieldsAnswer(q: FieldsQuestion, values: Record<string, string>): boolean {
  return q.fields.every(f => {
    const n = Number(values[f.id]);
    if (!Number.isFinite(n)) return false;
    const tol = f.tolerance ?? 1e-6;
    return Math.abs(n - f.correct) <= tol;
  });
}

function gradeDragAnswer(q: DragQuestion, value: number | null): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  const tol = q.tolerance ?? 0.5;
  return Math.abs(value - q.target) <= tol;
}

function gradeClickTableauAnswer(q: ClickTableauQuestion, value: number | null): boolean {
  return value != null && value === q.correctIndex;
}

// ── Commit → LP view reducer ────────────────────────────────────────────────
//
// Builds a partial LPProblem-like object from the sequence of commits the
// student has made correctly. This is what the Canvas renders.

function emptyDraft(numVars: number, numConstraints: number): LPDraft {
  return {
    variables: [],
    objectiveType: null,
    objectiveCoefficients: Array(numVars).fill(null),
    constraints: Array.from({ length: numConstraints }, () => ({
      started: false, label: '', coefficients: Array(numVars).fill(null),
      operator: null, rhs: null,
    })),
  };
}

function applyCommit(draft: LPDraft, c: CommitPayload, qId: string, fieldsAnswer?: Record<string, string>): LPDraft {
  const d: LPDraft = {
    ...draft,
    variables: [...draft.variables],
    objectiveCoefficients: [...draft.objectiveCoefficients],
    constraints: draft.constraints.map(con => ({ ...con, coefficients: [...con.coefficients] })),
  };

  // Note: for 'fields'-kind questions, the commit is a 'note' placeholder;
  // we infer which constraint/variable to update from the question id.
  if (c.type === 'variable') {
    d.variables[c.index] = { name: c.name, description: c.description };
  } else if (c.type === 'objective') {
    d.objectiveType = c.sense;
  } else if (c.type === 'objective-coefficient') {
    d.objectiveCoefficients[c.variableIndex] = c.value;
  } else if (c.type === 'constraint-started') {
    d.constraints[c.constraintIndex].started = true;
    d.constraints[c.constraintIndex].label = c.label;
  } else if (c.type === 'constraint-coefficient') {
    d.constraints[c.constraintIndex].coefficients[c.variableIndex] = c.value;
  } else if (c.type === 'constraint-operator') {
    d.constraints[c.constraintIndex].operator = c.op;
  } else if (c.type === 'constraint-rhs') {
    d.constraints[c.constraintIndex].rhs = c.value;
  } else if (c.type === 'note' && fieldsAnswer) {
    // Special handling for the fields-based coefficient questions.
    // Infer from question id: 'toy-c1-coefs' → constraint 0 a/b coefficients
    const match = qId.match(/-c(\d+)-coefs$/);
    if (match) {
      const ci = parseInt(match[1], 10) - 1;
      const a = Number(fieldsAnswer['a']);
      const b = Number(fieldsAnswer['b']);
      if (Number.isFinite(a)) d.constraints[ci].coefficients[0] = a;
      if (Number.isFinite(b)) d.constraints[ci].coefficients[1] = b;
    }
  }

  return d;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GuidedLearnPage() {
  const navigate = useNavigate();
  const { problemId } = useParams<{ problemId: string }>();

  const problem = useMemo(
    () => WORD_PROBLEMS.find(p => p.id === problemId),
    [problemId],
  );
  const script = useMemo(
    () => (problemId ? getScript(problemId) : undefined),
    [problemId],
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [fieldsAnswers, setFieldsAnswers] = useState<Record<string, Record<string, string>>>({});
  /** Live slider z value during a DragQuestion, feeds into the graph. */
  const [sliderZ, setSliderZ] = useState<number | null>(null);
  /**
   * Transient signal that fires when a tableau-populating commit just landed.
   * Canvas reads it to pulse the source coefficients at the same moment
   * the matching tableau cells fly in — so the student sees both ends of
   * the extraction. Auto-clears after one animation cycle.
   */
  const [extractionPulse, setExtractionPulse] = useState<ExtractionPulseKind>(null);
  /**
   * Current pivot selection across click-tableau questions. selectedCol
   * is set by the entering-col pick and persists into the next
   * leaving-row pick (so the ratio column can render). Both clear when
   * a pivot is applied.
   */
  const [pivotPick, setPivotPick] = useState<{ col: number | null; row: number | null }>({
    col: null, row: null,
  });

  // Per-render warm phrase seed so feedback text varies a bit between wrongs
  const wrongSeedRef = useRef(0);
  const correctSeedRef = useRef(0);

  if (!problem || !script) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">No guided script for this problem yet</h1>
          <p className="text-sm text-muted-foreground">
            This problem doesn&apos;t have a walkthrough script. Pick a different problem or open it in
            the free workspace.
          </p>
          <Button onClick={() => navigate('/')} variant="outline">Home</Button>
        </div>
      </div>
    );
  }

  const currentQ = script.questions[currentIdx];
  const totalQ = script.questions.length;
  const isDone = currentIdx >= totalQ;

  // Build the partial LP draft + graph-phase state + tableau reveal + pivot history
  const { draft, linesDrawn, sideDrawnFor, feasibleRevealed, tableauReveal, latestPivot } = useMemo(() => {
    let d = emptyDraft(problem.numVars, problem.constraints.length);
    const linesSet = new Set<number>();
    const sidesSet = new Set<number>();
    let feasible = false;
    const tab: TableauReveal = {
      slacksAdded: false,
      slackIdentityRevealed: false,
      zRowXRevealed: false,
      initialBasicValuesRevealed: false,
      initialZRevealed: false,
    };
    let latestPiv: null | {
      pivotNumber: number;
      entering: string;
      leaving: string;
      matrix: number[][];
      basis: string[];
      zValue: number;
      bfs: Record<string, number>;
    } = null;

    for (let i = 0; i < currentIdx; i++) {
      const q = script.questions[i];
      const ans = answers[q.id];
      if (!(ans?.correct || ans?.shownAnswer)) continue;

      const fa = q.kind === 'fields' ? fieldsAnswers[q.id] : undefined;
      d = applyCommit(d, q.commit, q.id, fa);
      if (q.kind === 'fields' && ans?.shownAnswer && !fa) {
        const correct: Record<string, string> = {};
        q.fields.forEach(f => { correct[f.id] = String(f.correct); });
        d = applyCommit(d, q.commit, q.id, correct);
      }

      // Track graph-phase state from commit type
      if (q.commit.type === 'graph-line') linesSet.add(q.commit.constraintIndex);
      if (q.commit.type === 'graph-side') sidesSet.add(q.commit.constraintIndex);
      if (q.commit.type === 'feasible-region-complete') feasible = true;
      // Track tableau reveal state
      if (q.commit.type === 'slacks-added')                tab.slacksAdded = true;
      if (q.commit.type === 'slack-identity-revealed')     tab.slackIdentityRevealed = true;
      if (q.commit.type === 'z-row-x-revealed')            tab.zRowXRevealed = true;
      if (q.commit.type === 'initial-basic-values-revealed') tab.initialBasicValuesRevealed = true;
      if (q.commit.type === 'initial-z-revealed')          tab.initialZRevealed = true;
      // Track pivots — keep only the latest for rendering
      if (q.commit.type === 'pivot-applied') {
        latestPiv = q.commit;
      }
    }

    return {
      draft: d, linesDrawn: linesSet, sideDrawnFor: sidesSet,
      feasibleRevealed: feasible, tableauReveal: tab, latestPivot: latestPiv,
    };
  }, [currentIdx, answers, fieldsAnswers, script, problem]);

  // Whether the graph should be visible at all (any line drawn yet)
  const anyGraphContent = linesDrawn.size > 0 || sideDrawnFor.size > 0 || feasibleRevealed;

  // Current basic feasible solution: latestPivot.bfs after a pivot, or the
  // origin (all-slack) initial BFS before any pivot. Used for the capacity
  // meters and the BFS point on the graph.
  const currentBFS: Record<string, number> = useMemo(() => {
    if (latestPivot) return latestPivot.bfs;
    const b: Record<string, number> = { x1: 0, x2: 0 };
    draft.constraints.forEach((c, i) => {
      b[`s${i + 1}`] = c.rhs ?? 0;
    });
    return b;
  }, [latestPivot, draft.constraints]);

  // The meters and the BFS graph marker make sense once the student has
  // entered the tableau phases (Phase 3 onward) — that's where slack
  // becomes a named concept. Before that they'd be noise.
  const currentQPhase = script.questions[currentIdx]?.phase ?? 1;
  const metersVisible = currentQPhase >= 3 &&
    draft.constraints.length > 0 &&
    draft.constraints.every(c =>
      c.started && c.rhs != null && c.coefficients.every(v => v != null),
    );
  const bfsPoint = metersVisible
    ? { x: currentBFS['x1'] ?? 0, y: currentBFS['x2'] ?? 0 }
    : null;

  // Has the optimum been found (a commit of type 'optimum-found' in the history)?
  const optimumCommit = useMemo(() => {
    for (let i = 0; i < currentIdx; i++) {
      const q = script.questions[i];
      const ans = answers[q.id];
      if (!(ans?.correct || ans?.shownAnswer)) continue;
      if (q.commit.type === 'optimum-found') return q.commit;
    }
    return null;
  }, [currentIdx, answers, script]);

  // Is the CURRENT question a drag/objective one? If so, feed sliderZ to graph.
  const currentQ_pre = script.questions[currentIdx];
  const isCurrentDrag = currentQ_pre?.kind === 'drag';
  const currentDragTarget = isCurrentDrag ? (currentQ_pre as DragQuestion).target : undefined;

  // Active highlight — the current question's `highlight` field, nulled out
  // once the student has answered it correctly so the pulse stops and the
  // visual relaxes before the next question takes over.
  const currentQAnswered = currentQ_pre ? answers[currentQ_pre.id]?.correct === true : false;
  const activeHighlight: QuestionHighlight | null =
    currentQ_pre && !currentQAnswered ? (currentQ_pre.highlight ?? null) : null;

  // Reset slider when arriving at a new drag question
  useEffect(() => {
    if (isCurrentDrag) {
      setSliderZ((currentQ_pre as DragQuestion).min);
    } else {
      setSliderZ(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ_pre?.id]);

  // Refs for the right-column panels so we can scroll the relevant one into
  // view every time the student moves to a new question. Keeping the sync
  // per-question (not per-phase) is important because several things grow
  // the right column mid-phase (meters appearing, tableau appearing after
  // "slacks-added", pivot tableaus replacing the initial one). Each of those
  // layout changes would otherwise drift the right column out of sync with
  // the current question on the left.
  const canvasPanelRef = useRef<HTMLDivElement | null>(null);
  const graphPanelRef = useRef<HTMLDivElement | null>(null);
  const tableauPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentQ_pre) return;
    const phase = currentQ_pre.phase;
    const commitType = currentQ_pre.commit?.type;
    const noteText = commitType === 'note'
      ? (currentQ_pre.commit as { type: 'note'; text: string }).text
      : null;

    // Decide which panel this specific question is acting on. Falls back
    // through what's actually mounted so we never aim at a hidden panel.
    const pickTarget = (): HTMLElement | null => {
      if (phase === 1) return canvasPanelRef.current;
      if (phase === 2) return graphPanelRef.current ?? canvasPanelRef.current;
      if (phase === 3) {
        // The first Phase 3 questions (slack concept, ownership, identity)
        // are about the CONSTRAINT EQUATIONS now being transformed in
        // place in the formulation canvas (where the inline meters live).
        // Tableau-fill questions after that point at the tableau itself.
        const canvasFirst =
          commitType === 'slacks-added' ||
          commitType === 'slack-identity-revealed' ||
          noteText === 'know-to-add-slacks' ||
          noteText === 'slack-ownership-understood';
        if (canvasFirst) {
          return canvasPanelRef.current ?? tableauPanelRef.current ?? graphPanelRef.current;
        }
        return tableauPanelRef.current ?? canvasPanelRef.current ?? graphPanelRef.current;
      }
      // Phases 4–5: pivots, optimal read-off — all tableau-centric.
      if (phase === 4 || phase === 5) {
        return tableauPanelRef.current ?? graphPanelRef.current;
      }
      // Phase 6: sensitivity talks about Z-row shadow prices — tableau again.
      if (phase >= 6) return tableauPanelRef.current ?? graphPanelRef.current;
      return null;
    };

    // Wait one frame so any new panel that just mounted (meters, tableau)
    // has been laid out before we try to scroll to it.
    const handle = requestAnimationFrame(() => {
      pickTarget()?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(handle);
    // Re-run when the question changes AND when panels mount/unmount —
    // meters appearing mid-phase is the common case that needed the extra
    // trigger.
  }, [
    currentQ_pre?.id,
    tableauReveal.slacksAdded,
    anyGraphContent,
    metersVisible,
  ]);

  // Handlers
  const handleAnswer = (q: Question, ok: boolean, studentAnswer: unknown) => {
    setAnswers(prev => {
      const existing = prev[q.id] ?? { correct: false, wrongAttempts: 0, studentAnswer: null };
      return {
        ...prev,
        [q.id]: {
          ...existing,
          correct: existing.correct || ok,
          wrongAttempts: ok ? existing.wrongAttempts : existing.wrongAttempts + 1,
          studentAnswer,
        },
      };
    });
    if (ok) {
      correctSeedRef.current++;
      const kind: ExtractionPulseKind =
        q.commit.type === 'slack-identity-revealed' ? 'slack-identity' :
        q.commit.type === 'z-row-x-revealed' ? 'z-row-x' :
        q.commit.type === 'initial-basic-values-revealed' ? 'initial-basic' :
        q.commit.type === 'initial-z-revealed' ? 'initial-z' : null;
      if (kind) {
        setExtractionPulse(kind);
        setTimeout(() => setExtractionPulse(null), 1100);
      }
      // Clear pivot pick state when a pivot lands so the next cycle starts
      // clean. The click-tableau question itself handles persisting col
      // across the entering→leaving transition.
      if (q.commit.type === 'pivot-applied') {
        setPivotPick({ col: null, row: null });
      }
      setTimeout(() => setCurrentIdx(i => Math.min(i + 1, totalQ)), 900);
    } else {
      wrongSeedRef.current++;
    }
  };

  // Click-tableau handler: called by GuidedTableau when the student
  // clicks a cell eligible for the current click-mode. We update pivot
  // selection state AND call handleAnswer with the clicked index.
  const handleTableauPick = (idx: number) => {
    if (currentQ_pre?.kind !== 'click-tableau') return;
    const q = currentQ_pre;
    if (q.pick === 'entering-col') {
      setPivotPick({ col: idx, row: null });
    } else if (q.pick === 'leaving-row') {
      setPivotPick(p => ({ col: p.col, row: idx }));
    }
    const ok = gradeClickTableauAnswer(q, idx);
    handleAnswer(q, ok, idx);
  };

  const handleShowMe = (q: Question) => {
    // Reveal the answer, apply its commit, advance after a moment
    setAnswers(prev => ({
      ...prev,
      [q.id]: {
        correct: false,
        wrongAttempts: (prev[q.id]?.wrongAttempts ?? 0),
        studentAnswer: null,
        shownAnswer: true,
      },
    }));
    if (q.kind === 'fields') {
      const correct: Record<string, string> = {};
      q.fields.forEach(f => { correct[f.id] = String(f.correct); });
      setFieldsAnswers(prev => ({ ...prev, [q.id]: correct }));
    }
    setTimeout(() => setCurrentIdx(i => Math.min(i + 1, totalQ)), 1100);
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-card/60 backdrop-blur border-b border-border px-4 py-2 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">{script.title}</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">{problem.title} · guided walkthrough</p>
          </div>
        </div>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          Step {Math.min(currentIdx + 1, totalQ)} of {totalQ}
        </div>
      </header>

      {/* ── Main: two columns — question flow (left) + LP canvas (right) ──── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">

        {/* LEFT: word problem + question flow */}
        <section className="overflow-y-auto border-r border-border">
          <div className="p-6 space-y-5 max-w-2xl mx-auto">

            {/* Word problem card — always visible */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">The problem</p>
              <p className="text-sm text-foreground leading-relaxed">{problem.scenario}</p>
            </div>

            {/* Answered questions — grouped by phase, completed phases collapsed */}
            {currentIdx > 0 && (
              <CollapsedHistory
                questions={script.questions}
                currentIdx={currentIdx}
                answers={answers}
                fieldsAnswers={fieldsAnswers}
              />
            )}

            {/* Phase narration — wrap card for the phase we just finished,
                intro card for the phase we're about to start. Both stack
                above the current question, so the student sees what's
                closing out and what's about to begin. */}
            {(() => {
              if (!currentQ) return null;
              const meta = script.phasesMeta;
              if (!meta) return null;
              const prevQ = currentIdx > 0 ? script.questions[currentIdx - 1] : null;
              const firstOfPhase = !prevQ || prevQ.phase !== currentQ.phase;
              const cards: JSX.Element[] = [];
              if (prevQ && prevQ.phase !== currentQ.phase) {
                const prevMeta = meta.find(m => m.phase === prevQ.phase);
                if (prevMeta) {
                  cards.push(<PhaseWrapCard key={`wrap-${prevMeta.phase}`} meta={prevMeta} />);
                }
              }
              if (firstOfPhase) {
                const curMeta = meta.find(m => m.phase === currentQ.phase);
                if (curMeta) {
                  cards.push(<PhaseIntroCard key={`intro-${curMeta.phase}`} meta={curMeta} />);
                }
              }
              return cards.length > 0 ? <div className="space-y-4">{cards}</div> : null;
            })()}

            {/* Current question — scrolled into view when it changes */}
            {!isDone && currentQ && (
              <ScrollIntoViewOnChange keyId={currentQ.id}>
                <QuestionCard
                  q={currentQ}
                  answerState={answers[currentQ.id]}
                  onAnswer={handleAnswer}
                  onShowMe={handleShowMe}
                  fieldsAnswer={fieldsAnswers[currentQ.id] ?? {}}
                  setFieldsAnswer={(v) => setFieldsAnswers(prev => ({ ...prev, [currentQ.id]: v }))}
                  sliderZ={sliderZ}
                  setSliderZ={setSliderZ}
                  wrongPrefix={pickWarm(WARM_PREFIXES_WRONG, wrongSeedRef.current)}
                  correctPrefix={pickWarm(WARM_PREFIXES_CORRECT, correctSeedRef.current)}
                />
              </ScrollIntoViewOnChange>
            )}

            {/* Done state — end-to-end celebration */}
            {isDone && (
              <div className="bg-gradient-to-br from-emerald-500/15 via-primary/10 to-accent/15 border border-emerald-500/50 rounded-2xl p-6 space-y-4 shadow-2xl shadow-emerald-500/20 animate-fill-pop">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-lg">
                  <Sparkles className="w-6 h-6" />
                  You did it — end to end!
                </div>
                <p className="text-sm text-emerald-100 leading-relaxed">
                  You built the LP from a word problem, drew the graph, discovered the optimum
                  by dragging the objective line, set up the initial simplex tableau, walked
                  through two pivots, and read the final answer off the last tableau. Both
                  methods gave you the same result: <strong>10 toy cars, 15 toy trucks,
                  z* = $450/week</strong>.
                </p>
                <div className="bg-card/50 border border-border rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">What you now know:</strong> how to
                  formulate an LP, how to visualize it as a feasible region + objective line,
                  how to standardize it with slacks, and how to run the simplex method by
                  hand. This is a full end-to-end pass.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => navigate('/workspace?problem=wp-toy-factory')}
                    className="bg-accent hover:bg-accent/90 text-white"
                  >
                    Open the free workspace (explore / sensitivity)
                  </Button>
                  <Button
                    onClick={() => navigate('/')}
                    variant="outline"
                  >
                    Back home
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: LP canvas + graph (both fill in as answers accumulate) */}
        <section className="overflow-y-auto bg-card/20">
          <div className="p-6 space-y-6 max-w-2xl mx-auto">
            <div ref={canvasPanelRef} className="scroll-mt-6">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Your LP formulation — grows as you answer
              </p>
              <Canvas
                draft={draft}
                variablesCount={problem.numVars}
                constraintsCount={problem.constraints.length}
                highlight={activeHighlight}
                slacksAdded={tableauReveal.slacksAdded}
                bfs={currentBFS}
                extractionPulse={extractionPulse}
              />
            </div>

            {/* Graph section — appears as soon as the student starts earning graph content */}
            {(anyGraphContent || problem.numVars === 2) && (
              <div ref={graphPanelRef} className="scroll-mt-6">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                  Your graph — fills in as you answer
                </p>
                <div className="bg-card/40 border border-border rounded-xl p-3">
                  {problem.numVars === 2 ? (
                    <DiscoveryGraph
                      draft={draft}
                      linesDrawn={linesDrawn}
                      sideDrawnFor={sideDrawnFor}
                      feasibleRegionRevealed={feasibleRevealed}
                      objectiveZ={latestPivot ? latestPivot.zValue : sliderZ}
                      optimumConfirmed={!!optimumCommit || !!latestPivot}
                      optimumTarget={latestPivot?.zValue ?? optimumCommit?.zValue ?? currentDragTarget}
                      bfsPoint={bfsPoint}
                      slacksMode={tableauReveal.slacksAdded}
                      highlight={activeHighlight}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic p-6 text-center">
                      Graph visualization requires a 2-variable problem.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tableau section — appears once Phase 3 starts (slacksAdded).
                The per-constraint meters are now INLINE under each constraint
                row in the formulation canvas above, anchored to the equation
                they visualize — so there's no standalone meter panel here. */}
            {tableauReveal.slacksAdded && (() => {
              // Has the student reached optimal? That's when the phase of the
              // current question is >= 5 (we're in the reveal/bridge phase) or
              // the script is done.
              const atOptimal = isDone || (currentQ && currentQ.phase >= 5);
              return (
                <div ref={tableauPanelRef} className="scroll-mt-6">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                    {atOptimal
                      ? `Optimal tableau — z* = ${latestPivot?.zValue ?? '?'}`
                      : latestPivot
                        ? `Your tableau — after pivot ${latestPivot.pivotNumber} (z = ${latestPivot.zValue})`
                        : 'Your initial tableau — fills in as you answer'}
                  </p>
                  <div className={`rounded-xl p-3 transition-all ${
                    atOptimal
                      ? 'bg-gradient-to-br from-emerald-500/15 to-card/40 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                      : 'bg-card/40 border border-border'
                  }`}>
                    <GuidedTableau
                      draft={draft}
                      reveal={tableauReveal}
                      override={latestPivot
                        ? { matrix: latestPivot.matrix, basis: latestPivot.basis }
                        : undefined}
                      highlight={activeHighlight}
                      clickMode={currentQ_pre?.kind === 'click-tableau'
                        ? currentQ_pre.pick
                        : null}
                      selectedCol={(() => {
                        // For a leaving-row question the entering col is
                        // embedded in the question itself (question authors
                        // know which column the student just picked).
                        if (currentQ_pre?.kind === 'click-tableau' &&
                            currentQ_pre.pick === 'leaving-row' &&
                            currentQ_pre.enteringCol != null) {
                          return currentQ_pre.enteringCol;
                        }
                        return pivotPick.col;
                      })()}
                      selectedRow={pivotPick.row}
                      onPick={handleTableauPick}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  q, answerState, onAnswer, onShowMe, fieldsAnswer, setFieldsAnswer,
  sliderZ, setSliderZ,
  wrongPrefix, correctPrefix,
}: {
  q: Question;
  answerState: AnswerState[string] | undefined;
  onAnswer: (q: Question, correct: boolean, studentAnswer: unknown) => void;
  onShowMe: (q: Question) => void;
  fieldsAnswer: Record<string, string>;
  setFieldsAnswer: (v: Record<string, string>) => void;
  sliderZ: number | null;
  setSliderZ: (v: number) => void;
  wrongPrefix: string;
  correctPrefix: string;
}) {
  const [textValue, setTextValue] = useState('');
  const [mcPicked, setMcPicked] = useState<string | null>(null);

  const wrongAttempts = answerState?.wrongAttempts ?? 0;
  const justAnswered = answerState?.correct === true;
  const offerShowMe = wrongAttempts >= 2 && !justAnswered && !answerState?.shownAnswer;

  // Clear local state when question id changes
  useEffect(() => {
    setTextValue('');
    setMcPicked(null);
  }, [q.id]);

  return (
    <div className="bg-card border-2 border-primary/40 rounded-xl p-5 shadow-lg shadow-primary/10 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2">Step {q.id.replace('toy-', '')}</p>
        <p className="text-base text-foreground leading-relaxed">{q.prompt}</p>
      </div>

      {/* Input by question kind */}
      {q.kind === 'text' && (
        <TextInput
          value={textValue}
          onChange={setTextValue}
          placeholder={(q as TextQuestion).placeholder}
          onSubmit={() => {
            const ok = gradeTextAnswer(q as TextQuestion, textValue);
            onAnswer(q, ok, textValue);
          }}
          disabled={justAnswered}
        />
      )}

      {q.kind === 'number' && (
        <TextInput
          value={textValue}
          onChange={setTextValue}
          placeholder={(q as NumberQuestion).placeholder}
          numeric
          onSubmit={() => {
            const ok = gradeNumberAnswer(q as NumberQuestion, textValue);
            onAnswer(q, ok, textValue);
          }}
          disabled={justAnswered}
        />
      )}

      {q.kind === 'mc' && (
        <MCInput
          q={q as MCQuestion}
          picked={mcPicked}
          onPick={(id) => {
            setMcPicked(id);
            const ok = gradeMCAnswer(q as MCQuestion, id);
            onAnswer(q, ok, id);
          }}
          disabled={justAnswered}
        />
      )}

      {q.kind === 'fields' && (
        <FieldsInput
          q={q as FieldsQuestion}
          values={fieldsAnswer}
          onChange={setFieldsAnswer}
          onSubmit={() => {
            const ok = gradeFieldsAnswer(q as FieldsQuestion, fieldsAnswer);
            onAnswer(q, ok, { ...fieldsAnswer });
          }}
          disabled={justAnswered}
        />
      )}

      {q.kind === 'drag' && (
        <DragInput
          q={q as DragQuestion}
          value={sliderZ}
          onChange={setSliderZ}
          onSubmit={() => {
            const ok = gradeDragAnswer(q as DragQuestion, sliderZ);
            onAnswer(q, ok, sliderZ);
          }}
          disabled={justAnswered}
        />
      )}

      {q.kind === 'click-tableau' && !justAnswered && (
        <div className="bg-orange-500/10 border-2 border-dashed border-orange-400/60 rounded-lg px-3 py-3 text-sm text-orange-100 flex items-start gap-2 animate-attention-pulse">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-orange-300" />
          <span>
            <strong>Click the tableau on the right.</strong>{' '}
            {(q as ClickTableauQuestion).pick === 'entering-col'
              ? 'Tap the negative number in the z-row that you want to enter the basis.'
              : 'Tap the row (the ratio cell on the right edge) that should leave the basis.'}
          </span>
        </div>
      )}

      {/* Feedback */}
      {justAnswered && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2 text-sm text-emerald-200 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span><strong>{correctPrefix}</strong> Adding it to your LP on the right.</span>
        </div>
      )}

      {!justAnswered && wrongAttempts > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2 text-sm text-amber-200 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{wrongPrefix}</strong>{' '}
            {q.kind === 'mc' && (q as MCQuestion).hintPerOption && mcPicked && (q as MCQuestion).hintPerOption![mcPicked]
              ? (q as MCQuestion).hintPerOption![mcPicked]
              : q.hint}
          </span>
        </div>
      )}

      {/* Show me how — appears after 2 wrong attempts */}
      {offerShowMe && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onShowMe(q)}
          className="text-xs"
        >
          <Eye className="w-3 h-3 mr-1.5" />
          Show me how
        </Button>
      )}
    </div>
  );
}

// ── Input primitives ─────────────────────────────────────────────────────────

function TextInput({
  value, onChange, placeholder, numeric, onSubmit, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  // Auto-focus on appear so the student can start typing immediately
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);
  return (
    <div className="flex gap-2">
      <input
        ref={ref}
        type="text"
        aria-label={placeholder ?? 'answer'}
        inputMode={numeric ? 'decimal' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) onSubmit(); }}
        disabled={disabled}
        className="flex-1 text-base text-foreground bg-muted/40 border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
      />
      <Button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="bg-primary hover:bg-primary/90 text-white"
      >
        Check
      </Button>
    </div>
  );
}

function MCInput({
  q, picked, onPick, disabled,
}: {
  q: MCQuestion;
  picked: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {q.options.map(opt => {
        const isPicked = picked === opt.id;
        const isCorrect = opt.id === q.correctId;
        const cls =
          isPicked && isCorrect ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-100' :
          isPicked && !isCorrect ? 'bg-amber-500/20 border-amber-500/60 text-amber-100' :
          'bg-card border-border text-foreground hover:border-primary/60 hover:bg-primary/5';
        return (
          <button
            type="button"
            key={opt.id}
            onClick={() => !disabled && onPick(opt.id)}
            disabled={disabled}
            className={`w-full text-left text-sm px-4 py-2.5 rounded-lg border-2 transition-colors disabled:cursor-default ${cls}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldsInput({
  q, values, onChange, onSubmit, disabled,
}: {
  q: FieldsQuestion;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  // Refs for each input so Enter can jump focus to the next empty field, or
  // submit if all are filled. Tab works natively via browser.
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  // Auto-focus the first empty field when the question appears
  useEffect(() => {
    if (disabled) return;
    const firstEmpty = q.fields.find(f => !values[f.id]?.trim());
    if (firstEmpty) refs.current[firstEmpty.id]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, disabled]);

  const focusNextEmptyOrSubmit = (fromIdx: number) => {
    // Look after the current one first
    for (let i = fromIdx + 1; i < q.fields.length; i++) {
      if (!values[q.fields[i].id]?.trim()) {
        refs.current[q.fields[i].id]?.focus();
        return;
      }
    }
    // Then wrap to the start
    for (let i = 0; i < fromIdx; i++) {
      if (!values[q.fields[i].id]?.trim()) {
        refs.current[q.fields[i].id]?.focus();
        return;
      }
    }
    // All filled → submit
    if (!disabled) onSubmit();
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {q.fields.map((f, idx) => (
          <div key={f.id}>
            <label htmlFor={`field-${q.id}-${f.id}`} className="text-[10px] text-muted-foreground block mb-0.5">{f.label}</label>
            <input
              id={`field-${q.id}-${f.id}`}
              ref={(el) => { refs.current[f.id] = el; }}
              type="text"
              inputMode="decimal"
              value={values[f.id] ?? ''}
              onChange={(e) => onChange({ ...values, [f.id]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !disabled) {
                  e.preventDefault();
                  focusNextEmptyOrSubmit(idx);
                }
              }}
              placeholder={f.placeholder}
              onFocus={(e) => e.target.select()}
              disabled={disabled}
              className="w-full text-base text-foreground bg-muted/40 border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
          </div>
        ))}
      </div>
      <Button
        onClick={onSubmit}
        disabled={disabled || q.fields.some(f => !values[f.id]?.trim())}
        className="bg-primary hover:bg-primary/90 text-white"
      >
        Check
      </Button>
    </div>
  );
}

function DragInput({
  q, value, onChange, onSubmit, disabled,
}: {
  q: DragQuestion;
  value: number | null;
  onChange: (v: number) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const v = value ?? q.min;
  const step = q.step ?? 1;
  const inTolerance = Math.abs(v - q.target) <= (q.tolerance ?? 0.5);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">z = {q.min}</span>
        <input
          type="range"
          aria-label="Objective value z"
          title="Drag to change z — the objective line moves in the graph as you slide"
          min={q.min}
          max={q.max}
          step={step}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 h-6 accent-orange-500 cursor-pointer"
        />
        <span className="text-xs text-muted-foreground tabular-nums">{q.max}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="bg-muted/40 border border-border rounded-lg px-3 py-1.5 font-mono">
          <span className="text-[10px] text-muted-foreground uppercase">current</span>{' '}
          <span className={`text-xl font-bold tabular-nums ${inTolerance ? 'text-emerald-300' : 'text-orange-300'}`}>
            z = {Math.round(v)}
          </span>
        </div>
        <Button
          onClick={onSubmit}
          disabled={disabled}
          className={inTolerance
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
            : 'bg-primary hover:bg-primary/90 text-white'}
        >
          {inTolerance ? "I think this is the max" : 'Check this value'}
        </Button>
      </div>
    </div>
  );
}

// ── Canvas: the LP as a gameboard ────────────────────────────────────────────
//
// Empty slots are big, obvious, inviting — dashed boxes with a "?" waiting to
// be filled. When an answer lands, the slot flips to a bright solid card with
// the value rendered large. The `fill-pop` animation gives each fill a
// physical sense of arrival: scale from 0.6 to 1.0 with a small bounce.

function Canvas({
  draft, variablesCount, constraintsCount, highlight,
  slacksAdded = false, bfs, extractionPulse = null,
}: {
  draft: LPDraft;
  variablesCount: number;
  constraintsCount: number;
  highlight?: QuestionHighlight | null;
  slacksAdded?: boolean;
  bfs?: Record<string, number>;
  extractionPulse?: ExtractionPulseKind;
}) {
  const pulseOperators = highlight?.target === 'constraint-operators';
  const pulseRhs = highlight?.target === 'constraint-rhs' ||
                   extractionPulse === 'initial-basic';
  const pulseObjCoefs = highlight?.target === 'objective-coefficients' ||
                        extractionPulse === 'z-row-x';
  const pulseSlackTerms = extractionPulse === 'slack-identity';
  const metersReady =
    slacksAdded && draft.constraints.every(c =>
      c.started && c.rhs != null && c.coefficients.every(v => v != null),
    );

  return (
    <div className="space-y-6">

      {/* ── Decision variables ──────────────────────────────────────────── */}
      <Section label="Decision variables">
        <div className="space-y-3">
          {Array.from({ length: variablesCount }, (_, i) => {
            const v = draft.variables[i];
            return (
              <div key={i} className="flex items-center gap-3">
                <VarChip label={`x${i + 1}`} />
                <span className="text-2xl text-muted-foreground">=</span>
                <SlotText value={v?.description} placeholder="click into the first question →" />
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Objective function ─────────────────────────────────────────── */}
      <Section label="Objective function">
        <div className="flex items-center gap-3 flex-wrap">
          <SenseBadge sense={draft.objectiveType} />
          <span className="text-2xl text-muted-foreground">z =</span>
          {Array.from({ length: variablesCount }, (_, i) => {
            const c = draft.objectiveCoefficients[i];
            return (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-2xl text-muted-foreground">+</span>}
                <SlotNumber value={c} pulse={pulseObjCoefs} />
                <VarChip label={`x${i + 1}`} size="sm" />
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Constraints ─────────────────────────────────────────────────── */}
      <Section label={slacksAdded ? 'Subject to (as equations)' : 'Subject to'}>
        <div className="space-y-4">
          {Array.from({ length: constraintsCount }, (_, ci) => {
            const c = draft.constraints[ci];
            const allCoefSet = c?.coefficients.every(v => v != null) ?? false;
            const readyForMeter = slacksAdded && allCoefSet && c?.rhs != null;
            const displayOp: '<=' | '>=' | '=' | null =
              slacksAdded && c?.operator === '<=' ? '=' : (c?.operator ?? null);
            const constraintHighlighted =
              highlight?.target === 'constraint' && highlight.constraintIndex === ci;
            return (
              <div
                key={ci}
                className={`bg-card/40 border border-border rounded-xl p-4 space-y-3${constraintHighlighted ? ' animate-attention-pulse' : ''}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    C{ci + 1}
                  </span>
                  {c?.started && c.label && (
                    <span className="text-xs text-primary font-semibold">{c.label}</span>
                  )}
                  {!c?.started && (
                    <span className="text-xs text-muted-foreground italic">not yet defined</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.from({ length: variablesCount }, (_, vi) => {
                    const coef = c?.coefficients[vi] ?? null;
                    return (
                      <div key={vi} className="flex items-center gap-2">
                        {vi > 0 && <span className="text-2xl text-muted-foreground">+</span>}
                        <SlotNumber value={coef} />
                        <VarChip label={`x${vi + 1}`} size="sm" />
                      </div>
                    );
                  })}
                  {/* Slack term slides in on the left side of the equation
                      when slacks are added. Coefficient 1 for the owning
                      constraint; the s_j for j ≠ ci is implicit (coefficient
                      0) so we don't clutter the line with all zeros. */}
                  {slacksAdded && (
                    <div className="flex items-center gap-2 animate-slide-in-right">
                      <span className="text-2xl text-muted-foreground">+</span>
                      <SlotNumber value={1} pulse={pulseSlackTerms} />
                      <VarChip label={`s${ci + 1}`} size="sm" />
                    </div>
                  )}
                  <OperatorSlot op={displayOp} pulse={pulseOperators} />
                  <SlotNumber value={c?.rhs ?? null} accent pulse={pulseRhs} />
                </div>

                {/* Inline meter — the physical meaning of this row's equation.
                    Two segments (used + unused) that visibly add to the RHS. */}
                {readyForMeter && (
                  <div className="pt-2 border-t border-border/40">
                    <ConstraintMeter
                      constraintIndex={ci}
                      coefficients={c.coefficients.filter((v): v is number => v != null)}
                      rhs={c.rhs as number}
                      bfs={bfs ?? {}}
                      highlight={highlight}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Non-negativity footer */}
      <div className="text-xs text-muted-foreground italic text-center pt-2">
        All variables assumed ≥ 0{slacksAdded ? ' (including slacks sᵢ ≥ 0)' : ''}
      </div>
      {metersReady && (
        <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed text-center">
          Each equation above splits into two pieces: what you&apos;re
          <span className="font-semibold not-italic"> using</span> and what&apos;s
          <span className="font-semibold not-italic"> unused</span> (the slack). They always add to the capacity.
        </p>
      )}
    </div>
  );
}

// ── Canvas primitives ────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-2.5">{label}</p>
      <div className="bg-card/40 border border-border rounded-xl p-4">
        {children}
      </div>
    </div>
  );
}

function VarChip({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm'
    ? 'px-2.5 py-1 text-base font-mono'
    : 'px-3 py-1.5 text-lg font-mono';
  return (
    <span className={`${cls} rounded-lg bg-primary/15 border border-primary/40 text-primary font-semibold tabular-nums`}>
      {label}
    </span>
  );
}

function SlotNumber({ value, accent = false, pulse = false }: { value: number | null; accent?: boolean; pulse?: boolean }) {
  const pulseCls = pulse ? ' animate-attention-pulse' : '';
  if (value === null) {
    return (
      <span className={`inline-flex items-center justify-center w-14 h-14 rounded-xl border-2 border-dashed border-border/80 bg-muted/30 text-muted-foreground/60 text-2xl font-mono${pulseCls}`}>
        ?
      </span>
    );
  }
  const colorCls = accent
    ? 'bg-accent/25 border-accent/60 text-accent-foreground shadow-accent/20'
    : 'bg-emerald-500/25 border-emerald-500/60 text-emerald-100 shadow-emerald-500/20';
  return (
    <span
      key={value}
      className={`inline-flex items-center justify-center w-14 h-14 rounded-xl border-2 ${colorCls} shadow-lg font-mono text-2xl font-bold tabular-nums animate-fill-pop${pulseCls}`}
    >
      {value}
    </span>
  );
}

function SlotText({ value, placeholder }: { value: string | undefined; placeholder: string }) {
  if (!value) {
    return (
      <span className="flex-1 px-4 py-2.5 rounded-xl border-2 border-dashed border-border/80 bg-muted/30 text-sm text-muted-foreground/70 italic">
        {placeholder}
      </span>
    );
  }
  return (
    <span
      key={value}
      className="flex-1 px-4 py-2.5 rounded-xl border-2 border-emerald-500/60 bg-emerald-500/20 text-emerald-100 text-base font-medium shadow-lg shadow-emerald-500/20 animate-fill-pop"
    >
      {value}
    </span>
  );
}

function SenseBadge({ sense }: { sense: 'max' | 'min' | null }) {
  if (sense === null) {
    return (
      <span className="inline-flex items-center justify-center px-4 py-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/30 text-muted-foreground/60 text-xl font-bold uppercase">
        ???
      </span>
    );
  }
  return (
    <span
      key={sense}
      className="inline-flex items-center justify-center px-4 py-2 rounded-xl border-2 border-primary/60 bg-primary/20 text-primary text-xl font-bold uppercase shadow-lg shadow-primary/20 animate-fill-pop"
    >
      {sense}
    </span>
  );
}

function OperatorSlot({ op, pulse = false }: { op: '<=' | '>=' | '=' | null; pulse?: boolean }) {
  const pulseCls = pulse ? ' animate-attention-pulse' : '';
  if (op === null) {
    return (
      <span className={`inline-flex items-center justify-center w-12 h-14 rounded-xl border-2 border-dashed border-border/80 bg-muted/30 text-muted-foreground/60 text-2xl font-mono${pulseCls}`}>
        ?
      </span>
    );
  }
  const sym = op === '<=' ? '≤' : op === '>=' ? '≥' : '=';
  return (
    <span
      key={op}
      className={`inline-flex items-center justify-center w-12 h-14 rounded-xl border-2 border-primary/60 bg-primary/20 text-primary text-3xl font-bold shadow-lg shadow-primary/20 animate-fill-pop${pulseCls}`}
    >
      {sym}
    </span>
  );
}

// ── Phase intro / wrap cards ────────────────────────────────────────────────
// Short narration pieces that frame each phase — they act like chapter
// openings and closings so the student always knows what this step is
// doing, why it matters, and which tool is doing the heavy lifting.

function PhaseIntroCard({ meta }: { meta: PhaseMeta }) {
  return (
    <div className="bg-gradient-to-br from-primary/12 via-card/80 to-card border-2 border-primary/40 rounded-xl p-4 shadow-lg shadow-primary/10 space-y-2 animate-fill-pop">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/60 flex items-center justify-center">
          <Compass className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
            Step {meta.phase} · starting
          </p>
          <p className="text-sm text-foreground font-semibold leading-tight">{meta.title}</p>
        </div>
      </div>
      <div className="text-[11px] text-foreground/90 leading-relaxed space-y-1 pl-9">
        <p><span className="text-muted-foreground font-semibold uppercase text-[9px] tracking-wider mr-1">what:</span>{meta.goal}</p>
        <p><span className="text-muted-foreground font-semibold uppercase text-[9px] tracking-wider mr-1">why:</span>{meta.why}</p>
        <p><span className="text-muted-foreground font-semibold uppercase text-[9px] tracking-wider mr-1">tool:</span>{meta.tool}</p>
      </div>
    </div>
  );
}

function PhaseWrapCard({ meta }: { meta: PhaseMeta }) {
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3 space-y-1 animate-fill-pop">
      <div className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-emerald-400" />
        <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
          Step {meta.phase} · complete — {meta.title}
        </p>
      </div>
      <p className="text-[11px] text-emerald-100/90 leading-relaxed pl-6">
        {meta.wrap}
      </p>
    </div>
  );
}

// ── ScrollIntoViewOnChange ─────────────────────────────────────────────────
// Wraps a child and scrolls it into view whenever `keyId` changes.

function ScrollIntoViewOnChange({ keyId, children }: { keyId: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // block: 'start' (with scroll-mt on the wrapper) keeps the FULL prompt
    // visible — 'center' was cutting off the top of long prompts when the
    // card was taller than the viewport.
    ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [keyId]);
  return <div ref={ref} className="scroll-mt-6">{children}</div>;
}

// ── CollapsedHistory ────────────────────────────────────────────────────────
// Groups answered questions by phase. Each completed phase collapses to a
// single summary card ("Phase 1 — Formulation ✓ complete, X answers"); the
// student can click to expand and review individual questions.

function CollapsedHistory({
  questions, currentIdx, answers, fieldsAnswers,
}: {
  questions: Question[];
  currentIdx: number;
  answers: AnswerState;
  fieldsAnswers: Record<string, Record<string, string>>;
}) {
  // Group the already-answered questions by phase
  const answered = questions.slice(0, currentIdx);
  const byPhase = new Map<number, Question[]>();
  for (const q of answered) {
    if (!byPhase.has(q.phase)) byPhase.set(q.phase, []);
    byPhase.get(q.phase)!.push(q);
  }
  const currentPhase = questions[currentIdx]?.phase ?? -1;
  const phaseNames: Record<number, string> = {
    1: 'Formulation',
    2: 'Graph construction',
    3: 'Tableau setup',
    4: 'Simplex pivots',
    5: 'Optimal solution',
    6: 'Sensitivity analysis',
  };

  const sortedPhases = Array.from(byPhase.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-2">
      {sortedPhases.map(phase => {
        const qs = byPhase.get(phase)!;
        const isFullyPast = phase < currentPhase; // every q in the phase answered AND student has moved on
        return (
          <PhaseGroup
            key={phase}
            phase={phase}
            name={phaseNames[phase] ?? `Phase ${phase}`}
            questions={qs}
            answers={answers}
            fieldsAnswers={fieldsAnswers}
            defaultExpanded={!isFullyPast}
          />
        );
      })}
    </div>
  );
}

function PhaseGroup({
  phase, name, questions, answers, fieldsAnswers, defaultExpanded,
}: {
  phase: number;
  name: string;
  questions: Question[];
  answers: AnswerState;
  fieldsAnswers: Record<string, Record<string, string>>;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => { setExpanded(defaultExpanded); }, [defaultExpanded]);

  return (
    <div className="bg-muted/30 border border-border rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/50 rounded-lg"
      >
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs font-semibold text-foreground">
          Phase {phase} — {name}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {questions.length} answer{questions.length === 1 ? '' : 's'} ·{' '}
          <span className="text-primary">{expanded ? 'hide' : 'review'}</span>
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {questions.map(q => {
            const ans = answers[q.id];
            return (
              <div key={q.id} className="border-l-2 border-emerald-500/30 pl-3 py-1">
                <p className="text-[11px] text-muted-foreground leading-snug">{q.prompt}</p>
                <p className="text-xs text-emerald-300 mt-0.5 font-medium">
                  {ans?.shownAnswer && <span className="italic text-muted-foreground">shown to you</span>}
                  {ans?.correct && !ans.shownAnswer && renderStudentAnswer(q, ans.studentAnswer, fieldsAnswers[q.id])}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Display a student's answer in the compact history ───────────────────────

function renderStudentAnswer(q: Question, ans: unknown, fieldsAnswer?: Record<string, string>): string {
  if (q.kind === 'text')   return `→ "${String(ans ?? '')}"`;
  if (q.kind === 'number') return `→ ${String(ans ?? '')}`;
  if (q.kind === 'mc') {
    const opt = (q as MCQuestion).options.find(o => o.id === ans);
    return `→ ${opt?.label ?? ''}`;
  }
  if (q.kind === 'fields') {
    const f = fieldsAnswer ?? {};
    const entries = (q as FieldsQuestion).fields.map(x => `${x.label}: ${f[x.id] ?? '?'}`).join(', ');
    return `→ ${entries}`;
  }
  if (q.kind === 'drag') {
    return `→ z = ${Math.round(Number(ans ?? 0))}`;
  }
  return '';
}
