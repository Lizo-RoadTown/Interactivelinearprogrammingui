/**
 * PracticeMode.tsx — Unified guided + interactive practice experience.
 *
 * Flow:
 *   Home → (Practice Problem path) Browse → Formulate → Method Select → Solve
 *          (Enter Own path)         Enter LP             Method Select → Solve
 *
 * The Solving screen blends:
 *   - Guided walkthrough (Next/Back through auto-solved steps)
 *   - Interactive pivot practice at select_pivot steps
 *   - Always-visible hints and feedback — student never feels alone
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import GraphView from '../components/GraphView';
import TableauWorkspace from '../components/TableauWorkspace';
import GraphBuildPhase from '../components/GraphBuildPhase';
import HighlightedScenario, { ActiveHighlights } from '../components/HighlightedScenario';
import TableauSetupPhase from '../components/TableauSetupPhase';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useLPSolver } from '../hooks/useLPSolver';
import { useGuidedSimplex } from '../hooks/useGuidedSimplex';
import {
  WORD_PROBLEMS,
  WordProblem,
  WPDifficulty,
  WPCategory,
} from '../data/wordProblems';
import { Constraint, LPProblem, SimplexStep, StepType } from '../types';
import { normVar, sameVar, indexOfVar } from '../utils/varName';
import {
  ArrowLeft, BookOpen, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Lightbulb, AlertTriangle,
  Loader2, Info, Shuffle, PenLine, Eye, Zap, Play,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkflowPhase =
  | 'home'
  | 'browse'
  | 'read_problem'
  | 'formulate'
  | 'enter_own'
  | 'method_select'
  | 'solving';

type FormulateSubPhase = 'vars' | 'obj' | 'constraints' | 'review';

interface OwnLPState {
  numVars: number;
  objectiveType: 'max' | 'min';
  objectiveCoefficients: number[];
  constraints: Array<{
    coefficients: number[];
    operator: '<=' | '>=' | '=';
    rhs: number;
  }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DIFFICULTY_BADGE: Record<WPDifficulty, string> = {
  Beginner:     'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
  Intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Advanced:     'bg-destructive/20 text-destructive border-destructive/30',
};

const CATEGORY_COLOR: Record<WPCategory, string> = {
  'Product Mix':          'bg-accent',
  'Resource Allocation':  'bg-emerald-600',
  'Diet / Nutrition':     'bg-orange-500',
  'Production Planning':  'bg-primary',
  'Special Cases':        'bg-rose-600',
};

const METHOD_LABEL: Record<string, string> = {
  simplex:    'Standard Simplex',
  'big-m':    'Big-M Method',
  'two-phase':'Two-Phase Method',
};

const STEP_LABEL: Record<StepType, string> = {
  initial:         'Initial Tableau',
  z_row_setup:     'Z-Row Setup',
  select_pivot:    'Select Pivot',
  after_pivot:     'After Pivot',
  optimal:         'Optimal Solution',
  infeasible:      'Infeasible',
  unbounded:       'Unbounded',
  phase1_initial:  'Phase I — Initial',
  phase1_complete: 'Phase I Complete',
  phase2_initial:  'Phase II — Initial',
  degenerate:      'Degenerate',
  alternative:     'Alternative Optimal',
};

// Determine which method is required given the constraints the student entered
function detectRequiredMethod(constraints: Array<{ operator: string }>): {
  method: 'simplex' | 'big-m' | 'two-phase';
  reason: string;
} {
  const hasEq  = constraints.some(c => c.operator === '=');
  const hasGeq = constraints.some(c => c.operator === '>=');
  if (hasEq)
    return {
      method: 'two-phase',
      reason: 'You have an equality (=) constraint. Equality constraints require an artificial variable. ' +
              'The Two-Phase method handles this cleanly.',
    };
  if (hasGeq)
    return {
      method: 'big-m',
      reason: 'You have one or more ≥ constraints. The standard Simplex needs all ≤ constraints to start ' +
              'at the origin. Big-M adds a large penalty to handle ≥ constraints in a single phase.',
    };
  return {
    method: 'simplex',
    reason: 'All your constraints are ≤ and variables are ≥ 0. Standard Simplex works perfectly — ' +
            'add slack variables and start at the origin.',
  };
}

// ── Home Screen ───────────────────────────────────────────────────────────────

function HomeScreen({
  onPractice,
  onEnterOwn,
}: {
  onPractice: () => void;
  onEnterOwn: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">What would you like to do?</h2>
        <p className="text-muted-foreground text-base max-w-lg">
          Work through a guided word problem step-by-step, or jump straight in with your own LP.
          Either way, the solver will coach you through every decision.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        {/* Practice Problem */}
        <button
          onClick={onPractice}
          className="flex-1 group bg-card border-2 border-primary/30 hover:border-indigo-500
                     rounded-2xl p-8 text-left shadow-sm hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-4
                          group-hover:bg-primary transition-colors">
            <BookOpen className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Practice Problem</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Get a real-world word problem. Identify the variables, write the objective function,
            set up constraints, choose a method, and solve — with hints at every step.
          </p>
          <div className="mt-4 text-xs font-medium text-primary">
            14 problems · All methods covered →
          </div>
        </button>

        {/* Enter Own */}
        <button
          onClick={onEnterOwn}
          className="flex-1 group bg-card border-2 border-emerald-200 hover:border-emerald-500
                     rounded-2xl p-8 text-left shadow-sm hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4
                          group-hover:bg-emerald-600 transition-colors">
            <PenLine className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Enter My Own</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Already have an LP? Enter your objective and constraints directly.
            The system will help you choose the right method and walk you through solving it.
          </p>
          <div className="mt-4 text-xs font-medium text-emerald-600">
            Skip the word problem → jump straight to solving →
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Problem Browser ────────────────────────────────────────────────────────────

const DIFFICULTY_TIERS: { level: WPDifficulty; desc: string; icon: string; border: string; bg: string; hover: string }[] = [
  {
    level: 'Beginner',
    desc: 'Standard Simplex with all ≤ constraints. 2 variables, clear structure.',
    icon: '1',
    border: 'border-emerald-500/40 hover:border-green-500',
    bg: 'bg-emerald-500/10',
    hover: 'hover:shadow-lg hover:shadow-green-100',
  },
  {
    level: 'Intermediate',
    desc: 'Big-M method, mixed constraints (≤ and ≥), 2–3 variables.',
    icon: '2',
    border: 'border-amber-500/40 hover:border-amber-500',
    bg: 'bg-amber-500/10',
    hover: 'hover:shadow-lg hover:shadow-amber-100',
  },
  {
    level: 'Advanced',
    desc: 'Two-Phase, equality constraints, special cases (infeasible, unbounded, alternative optima).',
    icon: '3',
    border: 'border-destructive/40 hover:border-red-500',
    bg: 'bg-destructive/10',
    hover: 'hover:shadow-lg hover:shadow-red-100',
  },
];

function ProblemBrowser({ onSelect }: { onSelect: (p: WordProblem) => void }) {
  const pickRandom = (level: WPDifficulty) => {
    const pool = WORD_PROBLEMS.filter(p => p.difficulty === level);
    onSelect(pool[Math.floor(Math.random() * pool.length)]);
  };

  const counts: Record<WPDifficulty, number> = {
    Beginner: WORD_PROBLEMS.filter(p => p.difficulty === 'Beginner').length,
    Intermediate: WORD_PROBLEMS.filter(p => p.difficulty === 'Intermediate').length,
    Advanced: WORD_PROBLEMS.filter(p => p.difficulty === 'Advanced').length,
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Choose a Difficulty</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          You'll get a random word problem at the level you choose.
          Formulate the LP, pick the method, and solve it step by step.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-3xl">
        {DIFFICULTY_TIERS.map(tier => (
          <button
            key={tier.level}
            onClick={() => pickRandom(tier.level)}
            className={`flex-1 ${tier.bg} border-2 ${tier.border} ${tier.hover}
                       rounded-2xl p-6 text-left transition-all cursor-pointer`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-lg font-bold
                            ${tier.level === 'Beginner' ? 'bg-emerald-500/30 text-emerald-200' :
                              tier.level === 'Intermediate' ? 'bg-amber-500/30 text-amber-200' :
                              'bg-destructive/30 text-destructive'}`}>
              {tier.icon}
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">{tier.level}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{tier.desc}</p>
            <p className="text-xs text-muted-foreground mt-3">{counts[tier.level]} problems</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Formulation Wizard ────────────────────────────────────────────────────────

interface FormulateState {
  subPhase: FormulateSubPhase;
  // Student answers
  varDescriptions: string[];
  objectiveType: 'max' | 'min' | '';
  objectiveCoeffs: string[];       // string for input binding
  constraintCoeffs: string[][];    // [constraint][var]
  constraintOps: Array<'<=' | '>=' | '='>;
  constraintRhs: string[];
  currentConstraint: number;       // which constraint we're on
  // Feedback
  feedbackMsg: string;
  feedbackKind: 'none' | 'correct' | 'wrong' | 'hint';
  hintVisible: boolean;
}

function makeInitialFormState(n: number, nc: number): FormulateState {
  return {
    subPhase: 'vars',
    varDescriptions: Array(n).fill(''),
    objectiveType: '',
    objectiveCoeffs: Array(n).fill(''),
    constraintCoeffs: Array(nc).fill(null).map(() => Array(n).fill('')),
    constraintOps: Array(nc).fill('<='),
    constraintRhs: Array(nc).fill(''),
    currentConstraint: 0,
    feedbackMsg: '',
    feedbackKind: 'none',
    hintVisible: false,
  };
}

function checkObjective(
  studentType: string,
  studentCoeffs: string[],
  correct: { type: string; coeffs: number[] },
): { ok: boolean; msg: string } {
  if (studentType !== correct.type) {
    return {
      ok: false,
      msg: `Not quite — is this a problem where we want to increase something (MAX) or decrease something (MIN)?`,
    };
  }
  for (let i = 0; i < correct.coeffs.length; i++) {
    const v = parseFloat(studentCoeffs[i]);
    if (isNaN(v) || Math.abs(v - correct.coeffs[i]) > 1e-6) {
      return {
        ok: false,
        msg: `The objective type is correct, but check the coefficient on x${i + 1}. ` +
             `Re-read the problem: what is the profit/cost per unit of x${i + 1}?`,
      };
    }
  }
  return { ok: true, msg: `Correct! Objective: ${correct.type.toUpperCase()} ${correct.coeffs.map((c, i) => `${c}x${i + 1}`).join(' + ')}` };
}

function checkConstraint(
  coeffStrs: string[],
  op: string,
  rhsStr: string,
  correct: Constraint,
  idx: number,
): { ok: boolean; msg: string } {
  const rhs = parseFloat(rhsStr);
  if (isNaN(rhs) || Math.abs(rhs - correct.rhs) > 1e-6) {
    return { ok: false, msg: `Check the right-hand side of constraint ${idx + 1}. What is the total available (or required)?` };
  }
  if (op !== correct.operator) {
    return {
      ok: false,
      msg: `The operator isn't right. Is constraint ${idx + 1} an upper limit (≤), lower limit (≥), or exact requirement (=)?`,
    };
  }
  for (let i = 0; i < correct.coefficients.length; i++) {
    const v = parseFloat(coeffStrs[i]);
    if (isNaN(v) || Math.abs(v - correct.coefficients[i]) > 1e-6) {
      return {
        ok: false,
        msg: `Check the coefficient on x${i + 1} in constraint ${idx + 1}. How much of the resource does one unit of x${i + 1} use?`,
      };
    }
  }
  return { ok: true, msg: `Constraint ${idx + 1} is correct!` };
}

function FormulationWizard({
  problem,
  onDone,
}: {
  problem: WordProblem;
  onDone: () => void;
}) {
  const n  = problem.numVars;
  const nc = problem.constraints.length;
  const [fs, setFs] = useState<FormulateState>(() => makeInitialFormState(n, nc));

  const update = (patch: Partial<FormulateState>) =>
    setFs(prev => ({ ...prev, ...patch }));

  const feedback = (msg: string, kind: FormulateState['feedbackKind']) =>
    update({ feedbackMsg: msg, feedbackKind: kind });

  // Clear stale 'wrong' feedback when the student edits any input. A correct
  // or hint message stays put (they want to read those).
  useEffect(() => {
    if (fs.feedbackKind === 'wrong') {
      setFs(prev => prev.feedbackKind === 'wrong'
        ? { ...prev, feedbackMsg: '', feedbackKind: 'none' }
        : prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fs.objectiveType, fs.objectiveCoeffs, fs.constraintCoeffs,
      fs.constraintOps, fs.constraintRhs, fs.varDescriptions]);

  // ── VARS step ───────────────────────────────────────────────────────────
  function submitVars() {
    if (fs.varDescriptions.some(d => d.trim() === '')) {
      feedback('Please fill in a description for each variable before continuing.', 'wrong');
      return;
    }
    feedback('', 'none');
    update({ subPhase: 'obj' });
  }

  // ── OBJ step ────────────────────────────────────────────────────────────
  // Explicit Continue step after a correct answer — replaces the old setTimeout
  // auto-advance, which moved on before students could read the confirmation.
  function submitObj() {
    const result = checkObjective(
      fs.objectiveType,
      fs.objectiveCoeffs,
      { type: problem.objectiveType, coeffs: problem.objectiveCoefficients },
    );
    if (!result.ok) {
      feedback(result.msg, 'wrong');
    } else {
      feedback(result.msg, 'correct');
      // No auto-advance. Student clicks "Continue →" when ready (rendered below).
    }
  }

  function advanceFromObj() {
    update({ subPhase: 'constraints', currentConstraint: 0, feedbackMsg: '', feedbackKind: 'none' });
  }

  function showMeObj() {
    update({
      objectiveType: problem.objectiveType,
      objectiveCoeffs: problem.objectiveCoefficients.map(String),
      feedbackMsg: `Here's the correct objective: ${problem.objectiveType.toUpperCase()} ${problem.objectiveCoefficients.map((c, i) => `${c}x${i + 1}`).join(' + ')}`,
      feedbackKind: 'hint',
    });
  }

  // ── CONSTRAINTS step ────────────────────────────────────────────────────
  function submitConstraint(idx: number) {
    const result = checkConstraint(
      fs.constraintCoeffs[idx],
      fs.constraintOps[idx],
      fs.constraintRhs[idx],
      problem.constraints[idx],
      idx,
    );
    if (!result.ok) {
      feedback(result.msg, 'wrong');
    } else {
      feedback(result.msg, 'correct');
      // No auto-advance. "Continue →" button (rendered below) advances explicitly.
    }
  }

  function advanceFromConstraint(idx: number) {
    if (idx + 1 < nc) {
      update({ currentConstraint: idx + 1, feedbackMsg: '', feedbackKind: 'none' });
    } else {
      update({ subPhase: 'review', feedbackMsg: '', feedbackKind: 'none' });
    }
  }

  function showMeConstraint(idx: number) {
    const c = problem.constraints[idx];
    const newCoeffs = fs.constraintCoeffs.map((row, i) =>
      i === idx ? c.coefficients.map(String) : row
    );
    const newOps = fs.constraintOps.map((op, i) => i === idx ? c.operator : op);
    const newRhs = fs.constraintRhs.map((r, i) => i === idx ? String(c.rhs) : r);
    update({
      constraintCoeffs: newCoeffs,
      constraintOps: newOps,
      constraintRhs: newRhs,
      feedbackMsg: `Constraint ${idx + 1}: ${c.coefficients.map((v, j) => `${v}x${j + 1}`).join(' + ')} ${c.operator} ${c.rhs}`,
      feedbackKind: 'hint',
    });
  }

  const feedbackBg = {
    none:    '',
    correct: 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-200',
    wrong:   'bg-destructive/10 border border-destructive/40 text-destructive',
    hint:    'bg-accent/10 border border-accent/40 text-accent',
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // Progress steps
  const subSteps: FormulateSubPhase[] = ['vars', 'obj', 'constraints', 'review'];
  const subLabels = ['Variables', 'Objective', 'Constraints', 'Review'];
  const currentIdx = subSteps.indexOf(fs.subPhase);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="flex-shrink-0 px-6 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-0 max-w-lg">
          {subSteps.map((s, i) => (
            <div key={s} className="flex items-center gap-0 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors ${
                i < currentIdx  ? 'bg-primary border-indigo-600 text-white' :
                i === currentIdx ? 'bg-card border-indigo-600 text-primary' :
                                   'bg-card border-border text-muted-foreground'
              }`}>
                {i < currentIdx ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs ml-1.5 hidden sm:block ${i === currentIdx ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                {subLabels[i]}
              </span>
              {i < subSteps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < currentIdx ? 'bg-primary' : 'bg-muted/80'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Word problem (always visible) — with progressive highlights */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-200 uppercase tracking-wide mb-2">The Problem</p>
            <HighlightedScenario
              scenario={problem.scenario}
              highlights={problem.highlights}
              active={{
                vars: fs.subPhase === 'vars' || fs.subPhase === 'review',
                objective: fs.subPhase === 'obj' || fs.subPhase === 'review',
                constraintIdx: fs.subPhase === 'constraints'
                  ? fs.currentConstraint
                  : fs.subPhase === 'review' ? 'all' : undefined,
              }}
            />
          </div>

          {/* Feedback box */}
          {fs.feedbackKind !== 'none' && fs.feedbackMsg && (
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${feedbackBg[fs.feedbackKind]}`}>
              {fs.feedbackKind === 'correct' && <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />}
              {fs.feedbackKind === 'wrong'   && <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />}
              {fs.feedbackKind === 'hint'    && <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />}
              <span>{fs.feedbackMsg}</span>
            </div>
          )}

          {/* ── VARS step ───────────────────────────────────────── */}
          {fs.subPhase === 'vars' && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Step 1: Decision Variables</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This problem has <strong>{n}</strong> decision variable{n > 1 ? 's' : ''}.
                  In LP, we use x1, x2, … for variable names. What does each one represent?
                </p>
              </div>

              <div className="space-y-3">
                {Array.from({ length: n }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-12 flex-shrink-0 text-sm font-mono font-bold text-primary bg-primary/10 border border-primary/30 rounded-lg px-2 py-1.5 text-center">
                      x{i + 1}
                    </div>
                    <span className="text-sm text-muted-foreground">=</span>
                    <input
                      type="text"
                      placeholder={`What does x${i + 1} represent?`}
                      value={fs.varDescriptions[i]}
                      onChange={e => {
                        const d = [...fs.varDescriptions];
                        d[i] = e.target.value;
                        update({ varDescriptions: d });
                      }}
                      className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/60"
                    />
                  </div>
                ))}
              </div>

              {/* Hint */}
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs text-accent">
                <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-accent" />
                {problem.formulationHints.variables}
              </div>

              <div className="flex gap-2">
                <Button onClick={submitVars} className="bg-primary hover:bg-primary text-white">
                  Confirm Variables →
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    update({ varDescriptions: problem.variables.map(v => v.description) });
                    feedback('Variables filled in: ' + problem.variables.map(v => `${v.name} = ${v.description}`).join(', '), 'hint');
                  }}
                >
                  Show Me
                </Button>
              </div>
            </div>
          )}

          {/* ── OBJ step ────────────────────────────────────────── */}
          {fs.subPhase === 'obj' && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Step 2: Objective Function</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are we maximizing or minimizing? Then enter the coefficient for each variable.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* MAX / MIN toggle */}
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(['max', 'min'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => update({ objectiveType: t })}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        fs.objectiveType === t
                          ? 'bg-primary text-white'
                          : 'bg-card text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                <span className="text-sm font-medium text-foreground">z =</span>

                {Array.from({ length: n }, (_, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={fs.objectiveCoeffs[i]}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const c = [...fs.objectiveCoeffs];
                        c[i] = e.target.value;
                        update({ objectiveCoeffs: c });
                      }}
                      className="w-20 text-base text-center border border-border rounded-md px-2 py-2 bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-sm font-mono text-foreground">x{i + 1}</span>
                    {i < n - 1 && <span className="text-muted-foreground mx-1">+</span>}
                  </div>
                ))}
              </div>

              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs text-accent">
                <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-accent" />
                {problem.formulationHints.objective}
              </div>

              <div className="flex gap-2">
                {fs.feedbackKind === 'correct' ? (
                  <Button onClick={advanceFromObj} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    Continue →
                  </Button>
                ) : (
                  <Button onClick={submitObj} className="bg-primary hover:bg-primary text-white">
                    Check Objective
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={showMeObj}>
                  Show Me
                </Button>
              </div>
            </div>
          )}

          {/* ── CONSTRAINTS step ────────────────────────────────── */}
          {fs.subPhase === 'constraints' && (() => {
            const idx = fs.currentConstraint;
            return (
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Step 3: Constraints — {idx + 1} of {nc}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fill in the coefficients, operator, and right-hand side for constraint {idx + 1}.
                  </p>
                </div>

                {/* Already completed constraints */}
                {idx > 0 && (
                  <div className="space-y-1">
                    {Array.from({ length: idx }, (_, j) => {
                      const c = problem.constraints[j];
                      return (
                        <div key={j} className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-1.5 font-mono flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          Constraint {j + 1}: {c.coefficients.map((v, k) => `${v}x${k+1}`).join(' + ')} {c.operator} {c.rhs}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Current constraint input */}
                <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/40 rounded-lg border border-border">
                  <span className="text-sm text-muted-foreground font-medium">C{idx + 1}:</span>
                  {Array.from({ length: n }, (_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={fs.constraintCoeffs[idx][i]}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          const rows = fs.constraintCoeffs.map((row, ri) =>
                            ri === idx
                              ? row.map((v, ci) => ci === i ? e.target.value : v)
                              : row
                          );
                          update({ constraintCoeffs: rows });
                        }}
                        className="w-16 text-base text-center border border-border rounded-md px-2 py-1.5 bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                      <span className="text-sm font-mono text-foreground">x{i + 1}</span>
                      {i < n - 1 && <span className="text-muted-foreground">+</span>}
                    </div>
                  ))}

                  {/* Operator */}
                  <select
                    value={fs.constraintOps[idx]}
                    onChange={e => {
                      const ops = [...fs.constraintOps];
                      ops[idx] = e.target.value as '<=' | '>=' | '=';
                      update({ constraintOps: ops });
                    }}
                    className="text-sm border border-border rounded px-2 py-1 focus:outline-none focus:border-primary/60 bg-card"
                  >
                    <option value="<=">≤</option>
                    <option value=">=">≥</option>
                    <option value="=">=</option>
                  </select>

                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="RHS"
                    value={fs.constraintRhs[idx]}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const rhs = [...fs.constraintRhs];
                      rhs[idx] = e.target.value;
                      update({ constraintRhs: rhs });
                    }}
                    className="w-20 text-base text-center border border-border rounded-md px-2 py-1.5 bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs text-accent">
                  <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-accent" />
                  {problem.formulationHints.constraints[idx] ?? 'Re-read the problem for this constraint.'}
                </div>

                <div className="flex gap-2">
                  {fs.feedbackKind === 'correct' ? (
                    <Button
                      onClick={() => advanceFromConstraint(idx)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      {idx + 1 < nc ? `Continue to Constraint ${idx + 2} →` : `Continue to Review →`}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => submitConstraint(idx)}
                      className="bg-primary hover:bg-primary text-white"
                    >
                      Check Constraint {idx + 1}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => showMeConstraint(idx)}>
                    Show Me
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* ── REVIEW step ─────────────────────────────────────── */}
          {fs.subPhase === 'review' && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Step 4: Review Your LP</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Great work! Here is the LP you built. Does everything look right?
                </p>
              </div>

              <div className="bg-muted text-emerald-400 rounded-xl p-4 font-mono text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">// Objective</span>
                </div>
                <div>
                  <span className="text-yellow-300">{problem.objectiveType.toUpperCase()}</span>
                  {' z = '}
                  {problem.objectiveCoefficients.map((c, i) => (
                    <span key={i}>{i > 0 ? ' + ' : ''}<span className="text-emerald-300">{c}</span>x{i + 1}</span>
                  ))}
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">// Subject to</span>
                </div>
                {problem.constraints.map((c, i) => (
                  <div key={i}>
                    {'  '}
                    {c.coefficients.map((v, j) => (
                      <span key={j}>{j > 0 ? ' + ' : ''}<span className="text-emerald-300">{v}</span>x{j + 1}</span>
                    ))}
                    {' '}<span className="text-yellow-300">{c.operator}</span>
                    {' '}<span className="text-emerald-300">{c.rhs}</span>
                    {c.label && <span className="text-muted-foreground ml-2">({c.label})</span>}
                  </div>
                ))}
                <div>
                  {'  '}
                  {Array.from({ length: n }, (_, i) => `x${i + 1}`).join(', ')}
                  {' ≥ 0'}
                </div>
              </div>

              <Button
                onClick={onDone}
                className="w-full bg-primary hover:bg-primary text-white"
              >
                Looks good — Choose a Method →
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Enter Own LP form ────────────────────────────────────────────────────────

function EnterOwnForm({
  onDone,
}: {
  onDone: (state: OwnLPState) => void;
}) {
  const [numVars, setNumVars] = useState(2);
  const [numConstraints, setNumConstraints] = useState(2);
  const [objectiveType, setObjectiveType] = useState<'max' | 'min'>('max');
  const [objCoeffs, setObjCoeffs] = useState<string[]>(['', '']);
  const [constraints, setConstraints] = useState<Array<{
    coefficients: string[];
    operator: '<=' | '>=' | '=';
    rhs: string;
  }>>([
    { coefficients: ['', ''], operator: '<=', rhs: '' },
    { coefficients: ['', ''], operator: '<=', rhs: '' },
  ]);
  const [error, setError] = useState('');

  // Resize arrays when numVars/numConstraints changes
  useEffect(() => {
    setObjCoeffs(prev => {
      const a = [...prev];
      while (a.length < numVars) a.push('');
      return a.slice(0, numVars);
    });
    setConstraints(prev => {
      const updated = prev.map(c => {
        const coeffs = [...c.coefficients];
        while (coeffs.length < numVars) coeffs.push('');
        return { ...c, coefficients: coeffs.slice(0, numVars) };
      });
      while (updated.length < numConstraints)
        updated.push({ coefficients: Array(numVars).fill(''), operator: '<=', rhs: '' });
      return updated.slice(0, numConstraints);
    });
  }, [numVars, numConstraints]);

  // Clear error whenever the form changes — users shouldn't have to stare at a
  // stale error after they've fixed the problem that caused it.
  useEffect(() => {
    if (error) setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objCoeffs, constraints, numVars, numConstraints, objectiveType]);

  // Accept anything that parseFloat can turn into a finite number, plus treat
  // empty strings as "not filled in" (distinct from 0). We don't call
  // parseFloat('' ) because it returns NaN which is ambiguous with a typo.
  function parseCell(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  function handleSubmit() {
    // Collect ALL errors up front. Previous version set-state inside the map
    // then returned early on stale `error`, which meant the submit would
    // sometimes proceed with invalid data and sometimes get stuck on an old
    // error after the user fixed the input. This version decides in one pass.
    const errors: string[] = [];

    const oc: number[] = [];
    for (let i = 0; i < numVars; i++) {
      const v = parseCell(objCoeffs[i] ?? '');
      if (v === null) errors.push(`Objective coefficient for x${i + 1} is missing.`);
      oc.push(v ?? 0);
    }

    const cs: OwnLPState['constraints'] = [];
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      const coef: number[] = [];
      for (let j = 0; j < numVars; j++) {
        const v = parseCell(c.coefficients[j] ?? '');
        if (v === null) errors.push(`Constraint ${i + 1}: coefficient for x${j + 1} is missing.`);
        coef.push(v ?? 0);
      }
      const rhs = parseCell(c.rhs);
      if (rhs === null) errors.push(`Constraint ${i + 1}: right-hand side is missing.`);
      cs.push({ coefficients: coef, operator: c.operator, rhs: rhs ?? 0 });
    }

    if (errors.length > 0) {
      setError(errors[0]);  // show the first issue; others surface after fix
      return;
    }

    setError('');
    onDone({ numVars, objectiveType, objectiveCoefficients: oc, constraints: cs });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          <h3 className="text-base font-bold text-foreground">Enter Your LP</h3>

          {/* Variables / Constraints count */}
          <div className="flex gap-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Number of variables
              </label>
              <select
                value={numVars}
                onChange={e => setNumVars(Number(e.target.value))}
                className="text-sm border border-border rounded px-3 py-1.5 bg-card focus:outline-none focus:border-primary/60"
              >
                {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Number of constraints
              </label>
              <select
                value={numConstraints}
                onChange={e => setNumConstraints(Number(e.target.value))}
                className="text-sm border border-border rounded px-3 py-1.5 bg-card focus:outline-none focus:border-primary/60"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Objective */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Objective</label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['max', 'min'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setObjectiveType(t)}
                    className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
                      objectiveType === t
                        ? 'bg-primary text-white'
                        : 'bg-card text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="text-sm font-medium">z =</span>
              {Array.from({ length: numVars }, (_, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground">+</span>}
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={objCoeffs[i] ?? ''}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const c = [...objCoeffs];
                      c[i] = e.target.value;
                      setObjCoeffs(c);
                    }}
                    className="w-16 text-base text-center border border-border rounded px-2 py-1.5 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-indigo-200"
                  />
                  <span className="text-sm font-mono text-foreground">x{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Constraints */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Constraints</label>
            <div className="space-y-2">
              {constraints.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap p-3 bg-muted/40 rounded-lg">
                  <span className="text-sm font-mono text-muted-foreground w-6">C{idx + 1}</span>
                  {Array.from({ length: numVars }, (_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground text-sm">+</span>}
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={c.coefficients[i] ?? ''}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          const nc = constraints.map((row, ri) => {
                            if (ri !== idx) return row;
                            const cf = [...row.coefficients];
                            cf[i] = e.target.value;
                            return { ...row, coefficients: cf };
                          });
                          setConstraints(nc);
                        }}
                        className="w-16 text-base text-center border border-border rounded px-2 py-1.5 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-indigo-200"
                      />
                      <span className="text-sm font-mono text-muted-foreground">x{i + 1}</span>
                    </div>
                  ))}
                  <select
                    value={c.operator}
                    onChange={e => {
                      const nc = constraints.map((row, ri) =>
                        ri === idx ? { ...row, operator: e.target.value as '<=' | '>=' | '=' } : row
                      );
                      setConstraints(nc);
                    }}
                    className="text-base border border-border rounded px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="<=">≤</option>
                    <option value=">=">≥</option>
                    <option value="=">=</option>
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="RHS"
                    value={c.rhs}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const nc = constraints.map((row, ri) =>
                        ri === idx ? { ...row, rhs: e.target.value } : row
                      );
                      setConstraints(nc);
                    }}
                    className="w-20 text-base text-center border border-border rounded px-2 py-1.5 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full bg-primary hover:bg-primary text-white"
          >
            Continue to Method Selection →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Method Selector ───────────────────────────────────────────────────────────

function MethodSelector({
  constraints,
  onSelect,
}: {
  constraints: Array<{ operator: string }>;
  onSelect: (method: 'simplex' | 'big-m' | 'two-phase') => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; kind: 'correct' | 'wrong' } | null>(null);
  const correct = detectRequiredMethod(constraints);

  const methods = [
    {
      id: 'simplex',
      label: 'Standard Simplex',
      desc: 'Works when all constraints are ≤ and all variables are ≥ 0. Adds slack variables only.',
      icon: '⚡',
    },
    {
      id: 'big-m',
      label: 'Big-M Method',
      desc: 'Handles ≥ and = constraints in a single phase. Uses a large penalty M for artificial variables.',
      icon: 'M',
    },
    {
      id: 'two-phase',
      label: 'Two-Phase Method',
      desc: 'Phase I finds a feasible BFS by minimizing artificials. Phase II optimizes the original objective. Preferred for = constraints.',
      icon: 'II',
    },
  ];

  function handlePick(id: string) {
    setChosen(id);
    if (id === correct.method) {
      setFeedback({ msg: `Correct! ${correct.reason}`, kind: 'correct' });
    } else {
      const wrongReasons: Record<string, string> = {
        simplex:
          'Standard Simplex requires all ≤ constraints. Check your formulation — you have a ' +
          (constraints.some(c => c.operator === '=') ? '= constraint.' : '≥ constraint.'),
        'big-m':
          'Big-M would work here, but there is a better fit for your constraint types. ' +
          correct.reason,
        'two-phase':
          'Two-Phase would work, but it\'s usually reserved for = constraints. ' + correct.reason,
      };
      setFeedback({
        msg: wrongReasons[id] ?? 'That\'s not the best fit. ' + correct.reason,
        kind: 'wrong',
      });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="text-center">
          <h3 className="text-xl font-bold text-foreground">Choose a Method</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Based on your constraint types, which solving method should we use?
          </p>
        </div>

        {/* Constraint summary */}
        <div className="bg-muted/40 rounded-xl border border-border p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Your constraint operators</p>
          <div className="flex gap-2 flex-wrap">
            {constraints.map((c, i) => (
              <span
                key={i}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                  c.operator === '<=' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                  c.operator === '>=' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                        'bg-primary/10 text-primary border-primary/30'
                }`}
              >
                C{i + 1}: {c.operator}
              </span>
            ))}
          </div>
        </div>

        {/* Method buttons */}
        <div className="space-y-3">
          {methods.map(m => {
            const isChosen  = chosen === m.id;
            const isCorrect = m.id === correct.method;
            let border = 'border-border hover:border-primary/40';
            if (isChosen && feedback) {
              border = feedback.kind === 'correct' ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-destructive/40 bg-destructive/10';
            }
            return (
              <button
                key={m.id}
                onClick={() => handlePick(m.id)}
                disabled={!!chosen && feedback?.kind === 'correct'}
                className={`w-full text-left border-2 rounded-xl p-4 transition-all ${border} disabled:opacity-60`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {m.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{m.label}</span>
                      {isChosen && feedback?.kind === 'correct' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      {isChosen && feedback?.kind === 'wrong'   && <XCircle className="w-4 h-4 text-destructive" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-xl p-4 text-sm ${
            feedback.kind === 'correct'
              ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-200'
              : 'bg-amber-500/10 border border-amber-500/40 text-amber-200'
          }`}>
            {feedback.kind === 'correct'
              ? <CheckCircle className="inline w-4 h-4 mr-1.5 text-emerald-400" />
              : <AlertTriangle className="inline w-4 h-4 mr-1.5 text-amber-400" />}
            {feedback.msg}
          </div>
        )}

        {/* Hint */}
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 text-xs text-accent">
          <Lightbulb className="inline w-3.5 h-3.5 mr-1 text-accent" />
          <strong>Hint:</strong>{' '}
          {constraints.some(c => c.operator === '=')
            ? 'You have an equality (=) constraint. Which method specifically handles equality constraints?'
            : constraints.some(c => c.operator === '>=')
            ? 'You have at least one ≥ constraint. The standard simplex needs all ≤. Which methods add artificial variables to handle this?'
            : 'All your constraints are ≤. Which method works directly with ≤ constraints without needing artificial variables?'
          }
        </div>

        {/* Proceed buttons */}
        <div className="flex gap-3">
          {feedback?.kind === 'correct' && (
            <Button
              onClick={() => onSelect(correct.method)}
              className="flex-1 bg-primary hover:bg-primary text-white"
            >
              <Zap className="w-4 h-4 mr-1.5" />
              Let's Solve It!
            </Button>
          )}
          {(!feedback || feedback.kind === 'wrong') && (
            <Button
              variant="outline"
              onClick={() => {
                setChosen(correct.method);
                setFeedback({ msg: correct.reason, kind: 'correct' });
              }}
              className="text-sm"
            >
              Show Me the Right Method
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? r.toString() : r.toFixed(2);
}

// ── Solving Screen ─────────────────────────────────────────────────────────────

function SolvingScreen({
  problem,
  method,
  wordProblem,
  solver,
}: {
  problem: LPProblem;
  method: string;
  wordProblem?: WordProblem;
  solver: ReturnType<typeof useLPSolver>;
}) {
  const {
    steps, currentStep, currentStepIndex,
    canStepBack, canStepForward, isLoading, error,
    currentSimplexPath, currentPoint, solverResponse,
    stepForward, stepBack, jumpToStep,
  } = solver;

  const prevStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null;

  // Sub-phase state: loading → graph_build (2-var) or tableau_setup → pivoting
  type SolvingSubPhase = 'loading' | 'graph_build' | 'tableau_setup' | 'pivoting';
  const [solvingSubPhase, setSolvingSubPhase] = useState<SolvingSubPhase>('loading');

  // Transition out of loading once solver completes
  useEffect(() => {
    if (!isLoading && !error && solverResponse && solvingSubPhase === 'loading') {
      setSolvingSubPhase(problem.variables.length === 2 ? 'graph_build' : 'tableau_setup');
    }
  }, [isLoading, error, solverResponse, solvingSubPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guided Simplex interaction hook ──────────────────────────────────────────
  const guided = useGuidedSimplex({
    currentStep,
    steps,
    currentStepIndex,
    method,
    objectiveType: problem.objectiveType,
    stepForward,
    jumpToStep,
  });

  const { state: gs, needsInteraction, tableauProps, graphProps } = guided;

  // Hints from word problem or generic
  const stepType = currentStep?.stepType;
  function getHint(): string {
    if (!stepType) return '';
    if (wordProblem?.solvingHints) {
      const h = (wordProblem.solvingHints as Record<string, string | undefined>)[stepType];
      if (h) return h;
    }
    const generic: Partial<Record<StepType, string>> = {
      initial:         'The initial tableau is set up. All decision variables start at 0, slacks (and artificials if any) form the initial basis.',
      select_pivot:    'Choose the entering variable: most negative Z-row coefficient. Then use the ratio test to find the leaving variable.',
      after_pivot:     'A pivot was completed. Check the Z-row for remaining negative entries.',
      optimal:         'All Z-row entries ≥ 0. The optimal solution is found. Read basic variable values from the RHS column.',
      infeasible:      'Infeasible — no solution satisfies all constraints simultaneously.',
      unbounded:       'Unbounded — the objective can improve without limit. A constraint is missing.',
      phase1_initial:  'Phase I: minimizing the sum of artificial variables to find a feasible BFS.',
      phase1_complete: 'Phase I complete (w* = 0). Feasible BFS found. Artificial columns removed for Phase II.',
      phase2_initial:  'Phase II begins. Original objective restored. Standard simplex continues from the feasible BFS.',
    };
    return generic[stepType] ?? '';
  }
  const hint = getHint();

  // ── Tableau click handler (delegates to guided hook) ──────────────────────────
  function handleCellClick(rowIdx: number, colIdx: number) {
    if (!needsInteraction) return;

    const { episode, phase } = gs;

    // Episode 0: basis row cells
    if (episode === 'episode0' && (phase === 'e0_attention' || phase === 'e0_commitment')) {
      guided.e0ClickRow(rowIdx);
      return;
    }

    // Episode A: Z-row cells only
    if (episode === 'episodeA' && (phase === 'a2_attention' || phase === 'a3_commitment')) {
      guided.clickZRowCell(colIdx);
      return;
    }

    // Episode B: pivot column cells only
    if (episode === 'episodeB' && (phase === 'b1_attention' || phase === 'b3_commitment')) {
      guided.clickPivotColumnCell(rowIdx);
      return;
    }
  }

  // ── Guided interaction panel content ────────────────────────────────────────
  function renderGuidedPanel() {
    const { episode, phase, feedback, attemptCount } = gs;

    // Episode 0 — Z-Row Setup
    if (episode === 'episode0') {
      return (
        <div className="space-y-3">
          {phase === 'e0_arrive' && (
            <div className="space-y-3">
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3">
                <p className="text-sm font-bold text-amber-200 mb-1">Z-Row Setup Required</p>
                <p className="text-xs text-amber-300 leading-relaxed">
                  Before selecting a pivot, the Z-row must be adjusted. Basic artificial
                  variables have nonzero coefficients in the Z-row that must be eliminated
                  using row operations.
                </p>
              </div>
              <Button
                onClick={guided.e0Begin}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                Begin Z-Row Setup
              </Button>
            </div>
          )}

          {(phase === 'e0_attention' || phase === 'e0_commitment') && (
            <div className="space-y-3">
              <div className="bg-primary/10 border border-primary/40 rounded-lg p-3">
                <p className="text-xs font-bold text-primary mb-1">
                  Clear Artificial {gs.currentArtificialIdx + 1} of {gs.artificialRows.length}
                </p>
                <p className="text-xs text-primary leading-relaxed">
                  A basic artificial variable still has a nonzero coefficient in the Z-row.
                  Identify the row where this artificial is basic — that row will be used to
                  eliminate the coefficient via a row operation.
                </p>
              </div>

              {feedback && renderFeedback(feedback)}

              {phase === 'e0_commitment' && feedback?.type === 'correct' && (
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  <p className="text-xs text-accent">
                    Applying row operation…
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Episode A — Entering Variable
    if (episode === 'episodeA') {
      return (
        <div className="space-y-3">
          {/* A1: Arrive — "Choose Entering Variable" button */}
          {phase === 'a1_arrive' && (
            <div className="space-y-3">
              <div className="bg-muted/40 border border-border rounded-lg p-3">
                <p className="text-xs text-foreground leading-relaxed">
                  The tableau is ready. Your task: identify which variable should enter the basis to improve the objective.
                </p>
              </div>
              <Button
                onClick={guided.clickChooseEntering}
                className="w-full bg-primary hover:bg-primary text-white"
              >
                Choose Entering Variable
              </Button>
            </div>
          )}

          {/* A2/A3: Attention + Commitment — instruction, waiting for click */}
          {(phase === 'a2_attention' || phase === 'a3_commitment') && (
            <div className="space-y-3">
              <div className="bg-primary/10 border border-primary/40 rounded-lg p-3">
                <p className="text-xs font-bold text-primary mb-1">
                  Episode A: Choose the Entering Variable
                </p>
                <p className="text-xs text-primary leading-relaxed">
                  The Z-row shows how each variable affects the objective.
                  {problem.objectiveType === 'max'
                    ? ' For MAX: negative values indicate improvement. Which variable should enter the basis?'
                    : ' For MIN: positive values indicate improvement. Which variable should enter the basis?'}
                </p>
                <p className="text-xs text-primary mt-2 font-medium">
                  Which variable has the most potential to improve the objective?
                </p>
              </div>

              {/* Feedback from wrong attempts */}
              {feedback && renderFeedback(feedback)}

              {/* After 2+ attempts: offer a "walk me through" button.
                  After 3+ attempts: auto-expand the reasoning.
                  Always: Show Answer escape hatch. */}
              {attemptCount >= 2 && (
                <details className="bg-accent/10 border border-accent/30 rounded-lg" open={attemptCount >= 3}>
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-accent flex items-center gap-1.5 select-none">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Walk me through this step
                  </summary>
                  <p className="px-3 pb-3 text-xs text-accent leading-relaxed whitespace-pre-line">
                    {problem.objectiveType === 'max'
                      ? '1. Scan every value in the Z-row.\n2. A negative number means "increasing this variable would improve z."\n3. The MOST negative value gives the fastest improvement per unit.\n4. That variable should enter the basis.'
                      : '1. Scan every value in the Z-row.\n2. A positive number means "increasing this variable would improve z."\n3. The MOST positive value gives the fastest improvement per unit.\n4. That variable should enter the basis.'}
                  </p>
                </details>
              )}

              <Button onClick={guided.showAnswer} size="sm" variant="outline" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Show Answer
              </Button>
            </div>
          )}

          {/* A3b: Suboptimal — dual buttons */}
          {phase === 'a3b_suboptimal' && (
            <div className="space-y-3">
              {feedback && renderFeedback(feedback)}
              <div className="flex gap-2">
                <Button
                  onClick={guided.acceptSuboptimalChoice}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs"
                >
                  Use this variable anyway
                </Button>
                <Button onClick={guided.retryEntering} size="sm" variant="outline" className="text-xs">
                  Choose again
                </Button>
              </div>
            </div>
          )}

          {/* A4: Reveal — column highlighted. Continue when student is ready. */}
          {phase === 'a4_reveal' && (
            <div className="space-y-3">
              {feedback && renderFeedback(feedback)}
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 space-y-2">
                <p className="text-xs text-accent leading-relaxed">
                  Entering variable confirmed. The whole column is highlighted — notice how it now points in the direction your objective will improve. When you&apos;re ready, continue to choose the leaving variable.
                </p>
              </div>
              <Button
                onClick={guided.acknowledge}
                className="w-full bg-accent hover:bg-accent/90 text-white"
              >
                Continue to Leaving Variable →
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Episode B — Leaving Variable
    if (episode === 'episodeB') {
      return (
        <div className="space-y-3">
          {/* B1/B3: Attention + Commitment */}
          {(phase === 'b1_attention' || phase === 'b3_commitment') && (
            <div className="space-y-3">
              <div className="bg-primary/10 border border-primary/40 rounded-lg p-3">
                <p className="text-xs font-bold text-primary mb-1">
                  Episode B: Choose the Leaving Variable
                </p>
                <p className="text-xs text-primary leading-relaxed">
                  Divide RHS by the pivot column entry (only where the entry is positive).
                  The smallest ratio determines the leaving variable — it&apos;s the first constraint that would be violated.
                </p>
                <p className="text-xs text-primary mt-2 font-medium">
                  Which row has the smallest ratio? That constraint is the binding limit.
                </p>
              </div>

              {feedback && renderFeedback(feedback)}

              {/* After 2+ attempts: offer a "walk me through" button.
                  After 3+ attempts: auto-expand the reasoning. */}
              {attemptCount >= 2 && (
                <details className="bg-accent/10 border border-accent/30 rounded-lg" open={attemptCount >= 3}>
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-accent flex items-center gap-1.5 select-none">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Walk me through this step
                  </summary>
                  <p className="px-3 pb-3 text-xs text-accent leading-relaxed whitespace-pre-line">
                    1. Look at each row in the pivot column (the highlighted blue column).{'\n'}
                    2. Skip rows with zero or negative entries — those constraints don&apos;t limit the entering variable.{'\n'}
                    3. For rows with positive entries: divide RHS by the entry. That&apos;s the ratio.{'\n'}
                    4. The row with the smallest ratio is the first constraint that would be violated.{'\n'}
                    5. That row’s basic variable leaves the basis.
                  </p>
                </details>
              )}

              <Button onClick={guided.showAnswer} size="sm" variant="outline" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Show Answer
              </Button>
            </div>
          )}

          {/* B4: Reveal — ratios shown. Continue when student is ready. */}
          {phase === 'b4_reveal' && (
            <div className="space-y-3">
              {feedback && renderFeedback(feedback)}
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 space-y-2">
                <p className="text-xs text-accent leading-relaxed">
                  Leaving variable confirmed. The ratio column shows the full minimum-ratio test. Notice how the winning ratio ties directly to the basic variable that hits zero first. Ready to apply the pivot?
                </p>
              </div>
              <Button
                onClick={guided.acknowledge}
                className="w-full bg-accent hover:bg-accent/90 text-white"
              >
                Continue to Apply Pivot →
              </Button>
            </div>
          )}

          {/* B5: Apply — explicit button, no auto-advance */}
          {phase === 'b5_apply' && (
            <div className="space-y-3">
              {feedback && renderFeedback(feedback)}
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3">
                <p className="text-xs text-emerald-200 leading-relaxed">
                  Pivot selected. Click below to apply the row operations and advance to the next tableau.
                </p>
              </div>
              <Button
                onClick={guided.applyPivot}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Apply Pivot
              </Button>
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  /** Render a feedback message with appropriate styling. */
  function renderFeedback(fb: NonNullable<typeof gs.feedback>) {
    const bgMap = {
      invalid: 'bg-destructive/10 border-destructive/40 text-destructive',
      suboptimal: 'bg-amber-500/10 border-amber-500/40 text-amber-200',
      correct: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200',
      hint: 'bg-accent/10 border-accent/40 text-accent',
      reasoning: 'bg-accent/10 border-accent/40 text-accent',
    };
    const iconMap = {
      invalid: <XCircle className="inline w-3.5 h-3.5 mr-1.5 text-destructive flex-shrink-0" />,
      suboptimal: <AlertTriangle className="inline w-3.5 h-3.5 mr-1.5 text-amber-400 flex-shrink-0" />,
      correct: <CheckCircle className="inline w-3.5 h-3.5 mr-1.5 text-emerald-400 flex-shrink-0" />,
      hint: <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-accent flex-shrink-0" />,
      reasoning: <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-accent flex-shrink-0" />,
    };
    return (
      <div className={`rounded-lg p-3 text-xs leading-relaxed border whitespace-pre-line ${bgMap[fb.type]}`}>
        {iconMap[fb.type]}
        {fb.text}
      </div>
    );
  }

  // ── Sub-phase: loading ───────────────────────────────────────────────────────
  if (isLoading || solvingSubPhase === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        {isLoading ? 'Solving your LP…' : 'Preparing…'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 max-w-md text-center">
          <p className="text-destructive font-medium">Solver Error</p>
          <p className="text-sm text-destructive mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // ── Sub-phase: graph_build ────────────────────────────────────────────────────
  if (solvingSubPhase === 'graph_build' && solverResponse) {
    const optZ = solverResponse.optimalValue
      ?? Math.max(...solverResponse.cornerPoints.map(p => p.z ?? 0), 0);
    return (
      <GraphBuildPhase
        constraints={problem.constraints}
        objectiveCoefficients={problem.objectiveCoefficients}
        objectiveType={problem.objectiveType}
        feasibleRegionPolygon={solverResponse.feasibleRegionPolygon}
        cornerPoints={solverResponse.cornerPoints}
        optimalZ={optZ}
        onDone={() => setSolvingSubPhase('tableau_setup')}
      />
    );
  }

  // ── Sub-phase: tableau_setup ──────────────────────────────────────────────────
  if (solvingSubPhase === 'tableau_setup' && steps.length > 0) {
    return (
      <TableauSetupPhase
        problem={problem}
        method={method}
        initialStep={steps[0]}
        onDone={() => setSolvingSubPhase('pivoting')}
      />
    );
  }

  // ── Sub-phase: pivoting ───────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* TOP: Tableau (60%) */}
      <div className="h-3/5 border-b border-border bg-card overflow-auto">
        {currentStep ? (
          <TableauWorkspace
            tableau={currentStep.tableau}
            previousTableau={prevStep?.tableau}
            currentStep={currentStep}
            showRatioTest={false}
            isInteractive={false}
            hideSelectionHints={needsInteraction}
            onCellClick={needsInteraction ? handleCellClick : undefined}
            guidedPhase={needsInteraction ? tableauProps : undefined}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        )}
      </div>

      {/* BOTTOM (40%): Guidance + Graph */}
      <div className="h-2/5 flex overflow-hidden">

        {/* Bottom-left: Guidance */}
        <div className="w-1/2 border-r border-border overflow-hidden flex flex-col">

          {/* Step header */}
          {currentStep && (
            <div className="flex-shrink-0 px-4 py-2 bg-primary/10 border-b border-primary/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {STEP_LABEL[currentStep.stepType] ?? currentStep.stepType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
              <span className="text-xs text-primary font-medium">
                z = {currentStep.objectiveValue.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* Special case banner */}
            {wordProblem?.specialCaseNote && (currentStep?.stepType === 'optimal' || currentStep?.stepType === 'infeasible' || currentStep?.stepType === 'unbounded' || currentStep?.stepType === 'alternative') && (
              <div className="bg-destructive/10 border border-rose-300 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-800">{wordProblem.specialCaseNote}</p>
              </div>
            )}

            {/* Alternative / degenerate flags */}
            {currentStep?.hasAlternative && (
              <div className="bg-primary/10 border border-primary/40 rounded-lg p-3 flex gap-2">
                <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-primary">Alternative Optimal Solutions</p>
                  <p className="text-xs text-primary mt-0.5">
                    A nonbasic decision variable has a zero reduced cost. Infinitely many optimal
                    solutions exist along the edge between two optimal corners.
                  </p>
                </div>
              </div>
            )}
            {currentStep?.isDegenerate && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-200">Degenerate BFS</p>
                  <p className="text-xs text-amber-300 mt-0.5">
                    A basic variable equals zero. Bland's Rule is used to prevent cycling.
                  </p>
                </div>
              </div>
            )}

            {/* Guided interaction panel */}
            {needsInteraction && renderGuidedPanel()}

            {/* Non-interactive steps: hint + navigation guidance */}
            {!needsInteraction && (
              <>
                {/* Hint */}
                {hint && (
                  <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lightbulb className="w-3.5 h-3.5 text-accent" />
                      <p className="text-xs font-bold text-accent">What's happening</p>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{hint}</p>
                  </div>
                )}

                {/* Solver explanation */}
                {currentStep?.explanation && (
                  <div className="bg-muted/40 border border-border rounded-lg p-3">
                    <p className="text-xs font-bold text-muted-foreground mb-1">Solver</p>
                    <p className="text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap">
                      {currentStep.explanation}
                    </p>
                  </div>
                )}

                {/* After-pivot: guidance (student navigated back here) */}
                {stepType === 'after_pivot' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3">
                    <p className="text-xs text-emerald-200">
                      <CheckCircle className="inline w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Pivot complete. Use the row operation stepper above to review what happened.
                    </p>
                  </div>
                )}

                {/* Optimal: celebration + summary */}
                {stepType === 'optimal' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-4">
                    <p className="text-sm font-bold text-emerald-200 flex items-center gap-1.5 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      Optimal Solution Found!
                    </p>
                    <p className="text-xs text-emerald-300 leading-relaxed">
                      All Z-row entries are non-negative. The simplex method has converged.
                      Read the basic variable values from the RHS column of the final tableau above.
                    </p>
                  </div>
                )}

                {/* Infeasible / Unbounded */}
                {(stepType === 'infeasible' || stepType === 'unbounded') && (
                  <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-4">
                    <p className="text-sm font-bold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      {stepType === 'infeasible' ? 'No Feasible Solution' : 'Unbounded Solution'}
                    </p>
                  </div>
                )}

                {/* Phase I complete: transition message */}
                {stepType === 'phase1_complete' && (
                  <div className="bg-primary/10 border border-primary/40 rounded-lg p-3">
                    <p className="text-xs text-primary">
                      Phase I is complete. All artificial variables have been driven to zero.
                      The original objective will now be restored for Phase II.
                    </p>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* Bottom-right: Graph */}
        <div className="w-1/2 bg-card overflow-hidden">
          {problem.variables.length === 2 ? (
            <GraphView
              constraints={problem.constraints}
              cornerPoints={solverResponse?.cornerPoints ?? []}
              feasibleRegionPolygon={solverResponse?.feasibleRegionPolygon ?? []}
              simplexPath={currentSimplexPath}
              objectiveCoefficients={problem.objectiveCoefficients}
              showObjectiveLine={true}
              currentPoint={currentPoint ?? undefined}
              guidedGraph={needsInteraction ? graphProps : undefined}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <p className="text-sm font-medium">Graph not available</p>
              <p className="text-xs mt-1">
                The graphical view requires exactly 2 decision variables.
                This problem has {problem.variables.length}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Step timeline */}
      {steps.length > 0 && (
        <div className="flex-shrink-0 bg-card border-t border-border px-4 py-2 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={stepBack}
            disabled={!canStepBack}
            className="text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            {steps.map((s, i) => {
              const canJump = needsInteraction && !gs.canJumpTimeline
                ? i < currentStepIndex
                : true;
              return (
                <button
                  key={i}
                  onClick={() => canJump && jumpToStep(i)}
                  disabled={!canJump}
                  className={`flex-shrink-0 w-2.5 h-2.5 rounded-full transition-colors ${
                    i === currentStepIndex
                      ? 'bg-primary scale-125'
                      : i < currentStepIndex
                      ? 'bg-primary/60 hover:bg-primary/80'
                      : 'bg-muted/80'
                  } disabled:cursor-default`}
                  title={canJump ? `Step ${i + 1}: ${STEP_LABEL[s.stepType] ?? s.stepType}` : 'Complete the pivot to unlock'}
                />
              );
            })}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={stepForward}
            disabled={!canStepForward || (needsInteraction && !gs.canAdvance)}
            className="text-xs"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main PracticeMode Component ───────────────────────────────────────────────

export default function PracticeMode() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<WorkflowPhase>('home');
  const [selectedProblem, setSelectedProblem] = useState<WordProblem | null>(null);
  const [solveLP, setSolveLP] = useState<LPProblem | null>(null);
  const [solveMethod, setSolveMethod] = useState<string>('simplex');

  // Lifted solver — solve() is fired eagerly when the method is confirmed,
  // so the backend response arrives while the student is still on
  // GraphBuildPhase / TableauSetupPhase rather than on a loading spinner.
  const solver = useLPSolver();

  // ── Navigation helpers ──────────────────────────────────────────────────

  function handleSelectProblem(p: WordProblem) {
    setSelectedProblem(p);
    setPhase('read_problem');
  }

  function handleFormulationDone() {
    if (!selectedProblem) return;
    setSolveLP({
      objectiveType: selectedProblem.objectiveType,
      objectiveCoefficients: selectedProblem.objectiveCoefficients,
      variables: selectedProblem.variables.map(v => v.name),
      constraints: selectedProblem.constraints,
    });
    setPhase('method_select');
  }

  function handleOwnLPDone(state: OwnLPState) {
    setSolveLP({
      objectiveType: state.objectiveType,
      objectiveCoefficients: state.objectiveCoefficients,
      variables: Array.from({ length: state.numVars }, (_, i) => `x${i + 1}`),
      constraints: state.constraints.map((c, i) => ({
        id: `c${i + 1}`,
        coefficients: c.coefficients,
        operator: c.operator,
        rhs: c.rhs,
      })),
    });
    setPhase('method_select');
  }

  function handleMethodSelected(method: 'simplex' | 'big-m' | 'two-phase') {
    setSolveMethod(method);
    // Fire the API call NOW — before transitioning to the solving phase.
    // The student will spend time on GraphBuildPhase / TableauSetupPhase, so by
    // the time they reach the pivoting view the response is usually already here.
    if (solveLP) solver.solve(solveLP, method);
    setPhase('solving');
  }

  // ── Header ──────────────────────────────────────────────────────────────

  const headerLabels: Record<WorkflowPhase, string> = {
    home:          'Practice Mode',
    browse:        'Choose a Problem',
    read_problem:  selectedProblem?.title ?? 'Problem',
    formulate:     `Formulate: ${selectedProblem?.title ?? ''}`,
    enter_own:     'Enter Your LP',
    method_select: 'Choose a Method',
    solving:       `Solving: ${selectedProblem?.title ?? 'Your Problem'}`,
  };

  const headerSub: Record<WorkflowPhase, string> = {
    home:          'Work through real problems from start to finish',
    browse:        'Select a word problem to formulate and solve',
    read_problem:  'Read the problem, then build the LP formulation',
    formulate:     'Identify variables, objective, and constraints',
    enter_own:     'Enter your objective function and constraints',
    method_select: 'Choose the right solving method for your LP',
    solving:       'Walk through the solution — try pivots yourself!',
  };

  function BackButton() {
    const backTargets: Partial<Record<WorkflowPhase, WorkflowPhase | 'navigate-home'>> = {
      browse:       'home',
      read_problem: 'browse',
      formulate:    'read_problem',
      enter_own:    'home',
      method_select: selectedProblem ? 'formulate' : 'enter_own',
      solving:      'method_select',
    };
    const target = backTargets[phase];
    if (!target) return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (target === 'navigate-home') navigate('/');
          else setPhase(target);
        }}
        className="text-white hover:bg-card/20"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {target === 'home' ? 'Home' : target === 'navigate-home' ? 'Exit' : 'Back'}
      </Button>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-muted overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-600 text-white px-5 py-3.5
                      flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-card/20"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Home
          </Button>
          {phase !== 'home' && <BackButton />}
          <div>
            <h1 className="text-lg font-bold leading-tight">{headerLabels[phase]}</h1>
            <p className="text-xs text-indigo-200">{headerSub[phase]}</p>
          </div>
        </div>

        {/* Step nav — only shown during solving */}
        {phase === 'solving' && (
          <div className="flex items-center gap-2">
            {selectedProblem && (
              <Badge variant="secondary" className="text-xs hidden sm:flex">
                {selectedProblem.category} · {selectedProblem.difficulty}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {phase === 'home' && (
          <HomeScreen
            onPractice={() => setPhase('browse')}
            onEnterOwn={() => setPhase('enter_own')}
          />
        )}

        {phase === 'browse' && (
          <ProblemBrowser onSelect={handleSelectProblem} />
        )}

        {phase === 'read_problem' && selectedProblem && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <div className={`text-white rounded-2xl p-6 ${CATEGORY_COLOR[selectedProblem.category] ?? 'bg-muted'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                    {selectedProblem.category}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${DIFFICULTY_BADGE[selectedProblem.difficulty]}`}>
                    {selectedProblem.difficulty}
                  </span>
                </div>
                <h2 className="text-2xl font-bold">{selectedProblem.title}</h2>
                <div className="flex gap-3 mt-2 text-xs opacity-80">
                  <span>{selectedProblem.numVars} variables</span>
                  <span>·</span>
                  <span>{selectedProblem.objectiveType.toUpperCase()}</span>
                  <span>·</span>
                  <span>{METHOD_LABEL[selectedProblem.method]}</span>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">The Problem</h3>
                <p className="text-base text-foreground leading-relaxed whitespace-pre-line">
                  {selectedProblem.scenario}
                </p>
              </div>

              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                <p className="text-xs text-primary leading-relaxed">
                  <strong>Your task:</strong> Read the problem carefully. In the next step, you'll identify
                  the decision variables (what we're deciding), write the objective function (what we're
                  optimizing), and set up each constraint. The system will check your work and give hints
                  if you get stuck.
                </p>
              </div>

              <Button
                onClick={() => setPhase('formulate')}
                className="w-full bg-primary hover:bg-primary text-white py-3 text-base"
              >
                I've read it — Let's Formulate →
              </Button>
            </div>
          </div>
        )}

        {phase === 'formulate' && selectedProblem && (
          <FormulationWizard
            problem={selectedProblem}
            onDone={handleFormulationDone}
          />
        )}

        {phase === 'enter_own' && (
          <EnterOwnForm onDone={handleOwnLPDone} />
        )}

        {phase === 'method_select' && solveLP && (
          <MethodSelector
            constraints={solveLP.constraints}
            onSelect={handleMethodSelected}
          />
        )}

        {phase === 'solving' && solveLP && (
          <SolvingScreen
            problem={solveLP}
            method={solveMethod}
            wordProblem={selectedProblem ?? undefined}
            solver={solver}
          />
        )}

      </div>
    </div>
  );
}
