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
  getScript, Question, TextQuestion, NumberQuestion, MCQuestion, FieldsQuestion,
  CommitPayload,
} from '../../data/tutorialScripts';
import {
  ArrowLeft, CheckCircle, Lightbulb, Eye, Sparkles,
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

// ── Commit → LP view reducer ────────────────────────────────────────────────
//
// Builds a partial LPProblem-like object from the sequence of commits the
// student has made correctly. This is what the Canvas renders.

interface LPDraft {
  variables: { name: string; description: string }[];
  objectiveType: 'max' | 'min' | null;
  objectiveCoefficients: (number | null)[];
  constraints: {
    started: boolean;
    label: string;
    coefficients: (number | null)[];
    operator: '<=' | '>=' | '=' | null;
    rhs: number | null;
  }[];
}

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

  // Build the partial LP draft from all correct commits so far
  const draft = useMemo(() => {
    let d = emptyDraft(problem.numVars, problem.constraints.length);
    for (let i = 0; i < currentIdx; i++) {
      const q = script.questions[i];
      const ans = answers[q.id];
      if (ans?.correct || ans?.shownAnswer) {
        const fa = q.kind === 'fields' ? fieldsAnswers[q.id] : undefined;
        d = applyCommit(d, q.commit, q.id, fa);
        // Also apply the "correct" fields answer for fields questions if shown
        if (q.kind === 'fields' && ans?.shownAnswer && !fa) {
          const correct: Record<string, string> = {};
          q.fields.forEach(f => { correct[f.id] = String(f.correct); });
          d = applyCommit(d, q.commit, q.id, correct);
        }
      }
    }
    return d;
  }, [currentIdx, answers, fieldsAnswers, script, problem]);

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
      // small delay so the correct confirmation registers before advancing
      setTimeout(() => setCurrentIdx(i => Math.min(i + 1, totalQ)), 900);
    } else {
      wrongSeedRef.current++;
    }
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
    <div className="min-h-screen flex flex-col bg-background text-foreground">

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

            {/* Answered questions (compact history) */}
            {currentIdx > 0 && (
              <div className="space-y-2">
                {script.questions.slice(0, currentIdx).map((q, i) => {
                  const ans = answers[q.id];
                  return (
                    <div key={q.id} className="bg-muted/40 border border-border rounded-lg px-3 py-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground">Step {i + 1}</p>
                          <p className="text-xs text-foreground leading-snug">{q.prompt}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ans?.shownAnswer && <span className="italic">shown to you</span>}
                            {ans?.correct && !ans.shownAnswer && renderStudentAnswer(q, ans.studentAnswer, fieldsAnswers[q.id])}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current question */}
            {!isDone && currentQ && (
              <QuestionCard
                q={currentQ}
                answerState={answers[currentQ.id]}
                onAnswer={handleAnswer}
                onShowMe={handleShowMe}
                fieldsAnswer={fieldsAnswers[currentQ.id] ?? {}}
                setFieldsAnswer={(v) => setFieldsAnswers(prev => ({ ...prev, [currentQ.id]: v }))}
                wrongPrefix={pickWarm(WARM_PREFIXES_WRONG, wrongSeedRef.current)}
                correctPrefix={pickWarm(WARM_PREFIXES_CORRECT, correctSeedRef.current)}
              />
            )}

            {/* Done state */}
            {isDone && (
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <CheckCircle className="w-5 h-5" />
                  Formulation complete!
                </div>
                <p className="text-sm text-emerald-200 leading-relaxed">
                  You&apos;ve walked through the entire formulation. Your LP is built on the canvas
                  to the right. The next phases (drawing the graph, setting up the initial
                  tableau, and doing simplex pivots) will be added in the next round.
                </p>
                <Button onClick={() => navigate('/')} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  Back home
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: LP canvas (fills in as answers accumulate) */}
        <section className="overflow-y-auto bg-card/20">
          <div className="p-6 space-y-4 max-w-2xl mx-auto">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Your LP formulation — grows as you answer
            </p>
            <Canvas draft={draft} variablesCount={problem.numVars} constraintsCount={problem.constraints.length} />
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  q, answerState, onAnswer, onShowMe, fieldsAnswer, setFieldsAnswer,
  wrongPrefix, correctPrefix,
}: {
  q: Question;
  answerState: AnswerState[string] | undefined;
  onAnswer: (q: Question, correct: boolean, studentAnswer: unknown) => void;
  onShowMe: (q: Question) => void;
  fieldsAnswer: Record<string, string>;
  setFieldsAnswer: (v: Record<string, string>) => void;
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
  return (
    <div className="flex gap-2">
      <input
        type="text"
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
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {q.fields.map(f => (
          <div key={f.id}>
            <label className="text-[10px] text-muted-foreground block mb-0.5">{f.label}</label>
            <input
              type="text"
              inputMode="decimal"
              value={values[f.id] ?? ''}
              onChange={(e) => onChange({ ...values, [f.id]: e.target.value })}
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

// ── Canvas: the LP building up ───────────────────────────────────────────────

function Canvas({ draft, variablesCount, constraintsCount }: {
  draft: LPDraft;
  variablesCount: number;
  constraintsCount: number;
}) {
  const hasAnyVar = draft.variables.length > 0;
  const hasSense = draft.objectiveType !== null;
  const hasAnyObjCoeff = draft.objectiveCoefficients.some(v => v !== null);
  const anyConstraintStarted = draft.constraints.some(c => c.started);

  return (
    <div className="space-y-4 font-mono text-sm">

      {/* Decision variables */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Decision variables</p>
        <div className="bg-card border border-dashed border-border rounded-lg p-3 min-h-[3.5rem]">
          {!hasAnyVar && (
            <p className="text-xs text-muted-foreground italic">Your variables will appear here.</p>
          )}
          {Array.from({ length: variablesCount }, (_, i) => {
            const v = draft.variables[i];
            return (
              <div key={i} className="flex items-baseline gap-2 text-foreground">
                <span className="text-primary">x{i + 1}</span>
                <span className="text-muted-foreground">=</span>
                <span>{v ? v.description : <span className="text-muted-foreground italic text-xs">…</span>}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Objective */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Objective function</p>
        <div className="bg-card border border-dashed border-border rounded-lg p-3 min-h-[2.5rem]">
          {!hasSense && !hasAnyObjCoeff ? (
            <p className="text-xs text-muted-foreground italic">Your objective function will appear here.</p>
          ) : (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-primary font-semibold uppercase">
                {draft.objectiveType ?? '____'}
              </span>
              <span className="text-muted-foreground">z =</span>
              {Array.from({ length: variablesCount }, (_, i) => {
                const c = draft.objectiveCoefficients[i];
                return (
                  <span key={i} className="flex items-baseline gap-1">
                    {i > 0 && <span className="text-muted-foreground">+</span>}
                    <span className={c !== null ? 'text-foreground' : 'text-muted-foreground italic'}>
                      {c !== null ? c : '__'}
                    </span>
                    <span className="text-primary">x{i + 1}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Constraints */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Constraints</p>
        <div className="bg-card border border-dashed border-border rounded-lg divide-y divide-border">
          {!anyConstraintStarted && (
            <p className="text-xs text-muted-foreground italic p-3">Your constraints will appear here.</p>
          )}
          {Array.from({ length: constraintsCount }, (_, ci) => {
            const c = draft.constraints[ci];
            if (!c.started) {
              return (
                <div key={ci} className="p-3 text-xs text-muted-foreground italic">
                  Constraint {ci + 1}: not yet defined
                </div>
              );
            }
            return (
              <div key={ci} className="p-3 flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground min-w-14">{c.label}</span>
                {Array.from({ length: variablesCount }, (_, vi) => {
                  const coef = c.coefficients[vi];
                  return (
                    <span key={vi} className="flex items-baseline gap-1">
                      {vi > 0 && <span className="text-muted-foreground">+</span>}
                      <span className={coef !== null ? 'text-foreground' : 'text-muted-foreground italic'}>
                        {coef !== null ? coef : '__'}
                      </span>
                      <span className="text-primary">x{vi + 1}</span>
                    </span>
                  );
                })}
                <span className="text-muted-foreground">
                  {c.operator ? (c.operator === '<=' ? '≤' : c.operator === '>=' ? '≥' : '=') : '__'}
                </span>
                <span className={c.rhs !== null ? 'text-accent font-semibold' : 'text-muted-foreground italic'}>
                  {c.rhs !== null ? c.rhs : '__'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Non-negativity (always assumed) */}
      <div className="text-xs text-muted-foreground italic">
        All variables ≥ 0 (standard assumption for this problem type).
      </div>
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
  return '';
}
