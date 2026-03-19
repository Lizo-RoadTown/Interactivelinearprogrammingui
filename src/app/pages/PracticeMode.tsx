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
  Beginner:     'bg-green-100 text-green-800 border-green-200',
  Intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Advanced:     'bg-red-100 text-red-800 border-red-200',
};

const CATEGORY_COLOR: Record<WPCategory, string> = {
  'Product Mix':          'bg-blue-600',
  'Resource Allocation':  'bg-emerald-600',
  'Diet / Nutrition':     'bg-orange-500',
  'Production Planning':  'bg-purple-600',
  'Special Cases':        'bg-rose-600',
};

const METHOD_LABEL: Record<string, string> = {
  simplex:    'Standard Simplex',
  'big-m':    'Big-M Method',
  'two-phase':'Two-Phase Method',
};

const STEP_LABEL: Record<StepType, string> = {
  initial:         'Initial Tableau',
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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">What would you like to do?</h2>
        <p className="text-gray-500 text-base max-w-lg">
          Work through a guided word problem step-by-step, or jump straight in with your own LP.
          Either way, the solver will coach you through every decision.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        {/* Practice Problem */}
        <button
          onClick={onPractice}
          className="flex-1 group bg-white border-2 border-indigo-200 hover:border-indigo-500
                     rounded-2xl p-8 text-left shadow-sm hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4
                          group-hover:bg-indigo-600 transition-colors">
            <BookOpen className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Practice Problem</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Get a real-world word problem. Identify the variables, write the objective function,
            set up constraints, choose a method, and solve — with hints at every step.
          </p>
          <div className="mt-4 text-xs font-medium text-indigo-600">
            14 problems · All methods covered →
          </div>
        </button>

        {/* Enter Own */}
        <button
          onClick={onEnterOwn}
          className="flex-1 group bg-white border-2 border-emerald-200 hover:border-emerald-500
                     rounded-2xl p-8 text-left shadow-sm hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4
                          group-hover:bg-emerald-600 transition-colors">
            <PenLine className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Enter My Own</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
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

function ProblemBrowser({ onSelect }: { onSelect: (p: WordProblem) => void }) {
  const [filter, setFilter] = useState<WPDifficulty | 'All'>('All');

  const visible = filter === 'All'
    ? WORD_PROBLEMS
    : WORD_PROBLEMS.filter(p => p.difficulty === filter);

  const random = () => {
    const pool = filter === 'All' ? WORD_PROBLEMS : visible;
    onSelect(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Filter:</span>
        {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map(d => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === d
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {d}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={random}
          className="ml-auto text-xs"
        >
          <Shuffle className="w-3.5 h-3.5 mr-1.5" />
          Surprise me
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {visible.map(problem => (
            <ProblemCard key={problem.id} problem={problem} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProblemCard({
  problem,
  onSelect,
}: {
  problem: WordProblem;
  onSelect: (p: WordProblem) => void;
}) {
  const catColor = CATEGORY_COLOR[problem.category] ?? 'bg-gray-600';
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm
                    hover:shadow-md hover:border-indigo-300 transition-all flex flex-col">
      <div className={`${catColor} text-white px-4 py-2.5 flex items-center justify-between`}>
        <span className="text-xs font-semibold uppercase tracking-wide">{problem.category}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${DIFFICULTY_BADGE[problem.difficulty]}`}>
          {problem.difficulty}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-bold text-gray-900">{problem.title}</h3>
        <p className="text-xs text-gray-500 leading-snug line-clamp-3 flex-1">
          {problem.scenario.replace(/⚠.*$/s, '').slice(0, 120)}…
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-gray-400">{problem.numVars} variables</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{problem.objectiveType.toUpperCase()}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{METHOD_LABEL[problem.method]}</span>
        </div>
        {problem.specialCaseNote && (
          <div className="text-xs text-rose-600 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Special case
          </div>
        )}
        <Button
          size="sm"
          onClick={() => onSelect(problem)}
          className={`w-full mt-2 ${catColor} hover:opacity-90 text-white text-xs`}
        >
          Start this problem →
        </Button>
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
      setTimeout(() => update({ subPhase: 'constraints', currentConstraint: 0, feedbackMsg: '', feedbackKind: 'none' }), 1000);
    }
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
      if (idx + 1 < nc) {
        setTimeout(() => update({ currentConstraint: idx + 1, feedbackMsg: '', feedbackKind: 'none' }), 800);
      } else {
        setTimeout(() => update({ subPhase: 'review', feedbackMsg: '', feedbackKind: 'none' }), 800);
      }
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
    correct: 'bg-green-50 border border-green-300 text-green-800',
    wrong:   'bg-red-50 border border-red-300 text-red-800',
    hint:    'bg-blue-50 border border-blue-300 text-blue-800',
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // Progress steps
  const subSteps: FormulateSubPhase[] = ['vars', 'obj', 'constraints', 'review'];
  const subLabels = ['Variables', 'Objective', 'Constraints', 'Review'];
  const currentIdx = subSteps.indexOf(fs.subPhase);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-0 max-w-lg">
          {subSteps.map((s, i) => (
            <div key={s} className="flex items-center gap-0 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors ${
                i < currentIdx  ? 'bg-indigo-600 border-indigo-600 text-white' :
                i === currentIdx ? 'bg-white border-indigo-600 text-indigo-600' :
                                   'bg-white border-gray-300 text-gray-400'
              }`}>
                {i < currentIdx ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs ml-1.5 hidden sm:block ${i === currentIdx ? 'font-semibold text-indigo-700' : 'text-gray-400'}`}>
                {subLabels[i]}
              </span>
              {i < subSteps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < currentIdx ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Word problem (always visible) */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">The Problem</p>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
              {problem.scenario}
            </p>
          </div>

          {/* Feedback box */}
          {fs.feedbackKind !== 'none' && fs.feedbackMsg && (
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${feedbackBg[fs.feedbackKind]}`}>
              {fs.feedbackKind === 'correct' && <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />}
              {fs.feedbackKind === 'wrong'   && <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />}
              {fs.feedbackKind === 'hint'    && <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />}
              <span>{fs.feedbackMsg}</span>
            </div>
          )}

          {/* ── VARS step ───────────────────────────────────────── */}
          {fs.subPhase === 'vars' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 1: Decision Variables</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This problem has <strong>{n}</strong> decision variable{n > 1 ? 's' : ''}.
                  In LP, we use x1, x2, … for variable names. What does each one represent?
                </p>
              </div>

              <div className="space-y-3">
                {Array.from({ length: n }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-12 flex-shrink-0 text-sm font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5 text-center">
                      x{i + 1}
                    </div>
                    <span className="text-sm text-gray-500">=</span>
                    <input
                      type="text"
                      placeholder={`What does x${i + 1} represent?`}
                      value={fs.varDescriptions[i]}
                      onChange={e => {
                        const d = [...fs.varDescriptions];
                        d[i] = e.target.value;
                        update({ varDescriptions: d });
                      }}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                ))}
              </div>

              {/* Hint */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-blue-500" />
                {problem.formulationHints.variables}
              </div>

              <div className="flex gap-2">
                <Button onClick={submitVars} className="bg-indigo-600 hover:bg-indigo-700 text-white">
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
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 2: Objective Function</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are we maximizing or minimizing? Then enter the coefficient for each variable.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* MAX / MIN toggle */}
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  {(['max', 'min'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => update({ objectiveType: t })}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        fs.objectiveType === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                <span className="text-sm font-medium text-gray-700">z =</span>

                {Array.from({ length: n }, (_, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="0"
                      value={fs.objectiveCoeffs[i]}
                      onChange={e => {
                        const c = [...fs.objectiveCoeffs];
                        c[i] = e.target.value;
                        update({ objectiveCoeffs: c });
                      }}
                      className="w-16 text-sm text-center border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                    />
                    <span className="text-sm font-mono text-gray-700">x{i + 1}</span>
                    {i < n - 1 && <span className="text-gray-400 mx-1">+</span>}
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-blue-500" />
                {problem.formulationHints.objective}
              </div>

              <div className="flex gap-2">
                <Button onClick={submitObj} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Check Objective →
                </Button>
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
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Step 3: Constraints — {idx + 1} of {nc}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Fill in the coefficients, operator, and right-hand side for constraint {idx + 1}.
                  </p>
                </div>

                {/* Already completed constraints */}
                {idx > 0 && (
                  <div className="space-y-1">
                    {Array.from({ length: idx }, (_, j) => {
                      const c = problem.constraints[j];
                      return (
                        <div key={j} className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-1.5 font-mono flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          Constraint {j + 1}: {c.coefficients.map((v, k) => `${v}x${k+1}`).join(' + ')} {c.operator} {c.rhs}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Current constraint input */}
                <div className="flex items-center gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-500 font-medium">C{idx + 1}:</span>
                  {Array.from({ length: n }, (_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="0"
                        value={fs.constraintCoeffs[idx][i]}
                        onChange={e => {
                          const rows = fs.constraintCoeffs.map((row, ri) =>
                            ri === idx
                              ? row.map((v, ci) => ci === i ? e.target.value : v)
                              : row
                          );
                          update({ constraintCoeffs: rows });
                        }}
                        className="w-14 text-sm text-center border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-400"
                      />
                      <span className="text-xs font-mono text-gray-700">x{i + 1}</span>
                      {i < n - 1 && <span className="text-gray-400">+</span>}
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
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 bg-white"
                  >
                    <option value="<=">≤</option>
                    <option value=">=">≥</option>
                    <option value="=">=</option>
                  </select>

                  <input
                    type="number"
                    placeholder="RHS"
                    value={fs.constraintRhs[idx]}
                    onChange={e => {
                      const rhs = [...fs.constraintRhs];
                      rhs[idx] = e.target.value;
                      update({ constraintRhs: rhs });
                    }}
                    className="w-16 text-sm text-center border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-blue-500" />
                  {problem.formulationHints.constraints[idx] ?? 'Re-read the problem for this constraint.'}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => submitConstraint(idx)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {idx + 1 < nc ? `Check & Next →` : `Check & Finish →`}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => showMeConstraint(idx)}>
                    Show Me
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* ── REVIEW step ─────────────────────────────────────── */}
          {fs.subPhase === 'review' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Step 4: Review Your LP</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Great work! Here is the LP you built. Does everything look right?
                </p>
              </div>

              <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-sm space-y-1">
                <div>
                  <span className="text-gray-400">// Objective</span>
                </div>
                <div>
                  <span className="text-yellow-300">{problem.objectiveType.toUpperCase()}</span>
                  {' z = '}
                  {problem.objectiveCoefficients.map((c, i) => (
                    <span key={i}>{i > 0 ? ' + ' : ''}<span className="text-green-300">{c}</span>x{i + 1}</span>
                  ))}
                </div>
                <div className="mt-1">
                  <span className="text-gray-400">// Subject to</span>
                </div>
                {problem.constraints.map((c, i) => (
                  <div key={i}>
                    {'  '}
                    {c.coefficients.map((v, j) => (
                      <span key={j}>{j > 0 ? ' + ' : ''}<span className="text-green-300">{v}</span>x{j + 1}</span>
                    ))}
                    {' '}<span className="text-yellow-300">{c.operator}</span>
                    {' '}<span className="text-green-300">{c.rhs}</span>
                    {c.label && <span className="text-gray-500 ml-2">({c.label})</span>}
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
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
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

  function handleSubmit() {
    const oc = objCoeffs.map(parseFloat);
    if (oc.some(isNaN)) { setError('Please fill in all objective coefficients.'); return; }
    const cs: OwnLPState['constraints'] = constraints.map((c, i) => {
      const coef = c.coefficients.map(parseFloat);
      if (coef.some(isNaN)) { setError(`Fill in all coefficients for constraint ${i + 1}.`); }
      const rhs = parseFloat(c.rhs);
      if (isNaN(rhs)) { setError(`Fill in the right-hand side for constraint ${i + 1}.`); }
      return { coefficients: coef, operator: c.operator, rhs };
    });
    if (error) return;
    setError('');
    onDone({
      numVars,
      objectiveType,
      objectiveCoefficients: oc,
      constraints: cs,
    });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h3 className="text-base font-bold text-gray-900">Enter Your LP</h3>

          {/* Variables / Constraints count */}
          <div className="flex gap-6">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Number of variables
              </label>
              <select
                value={numVars}
                onChange={e => setNumVars(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:outline-none focus:border-indigo-400"
              >
                {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Number of constraints
              </label>
              <select
                value={numConstraints}
                onChange={e => setNumConstraints(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:outline-none focus:border-indigo-400"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Objective */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Objective</label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {(['max', 'min'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setObjectiveType(t)}
                    className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
                      objectiveType === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="text-sm font-medium">z =</span>
              {Array.from({ length: numVars }, (_, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-400">+</span>}
                  <input
                    type="number"
                    placeholder="0"
                    value={objCoeffs[i] ?? ''}
                    onChange={e => {
                      const c = [...objCoeffs];
                      c[i] = e.target.value;
                      setObjCoeffs(c);
                    }}
                    className="w-14 text-sm text-center border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-400"
                  />
                  <span className="text-xs font-mono text-gray-700">x{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Constraints */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Constraints</label>
            <div className="space-y-2">
              {constraints.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-400 w-4">C{idx + 1}</span>
                  {Array.from({ length: numVars }, (_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-400 text-xs">+</span>}
                      <input
                        type="number"
                        placeholder="0"
                        value={c.coefficients[i] ?? ''}
                        onChange={e => {
                          const nc = constraints.map((row, ri) => {
                            if (ri !== idx) return row;
                            const cf = [...row.coefficients];
                            cf[i] = e.target.value;
                            return { ...row, coefficients: cf };
                          });
                          setConstraints(nc);
                        }}
                        className="w-12 text-xs text-center border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-indigo-400"
                      />
                      <span className="text-xs font-mono text-gray-600">x{i + 1}</span>
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
                    className="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none"
                  >
                    <option value="<=">≤</option>
                    <option value=">=">≥</option>
                    <option value="=">=</option>
                  </select>
                  <input
                    type="number"
                    placeholder="RHS"
                    value={c.rhs}
                    onChange={e => {
                      const nc = constraints.map((row, ri) =>
                        ri === idx ? { ...row, rhs: e.target.value } : row
                      );
                      setConstraints(nc);
                    }}
                    className="w-16 text-sm text-center border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
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
          <h3 className="text-xl font-bold text-gray-900">Choose a Method</h3>
          <p className="text-sm text-gray-500 mt-1">
            Based on your constraint types, which solving method should we use?
          </p>
        </div>

        {/* Constraint summary */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Your constraint operators</p>
          <div className="flex gap-2 flex-wrap">
            {constraints.map((c, i) => (
              <span
                key={i}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                  c.operator === '<=' ? 'bg-green-50 text-green-700 border-green-200' :
                  c.operator === '>=' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                        'bg-purple-50 text-purple-700 border-purple-200'
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
            let border = 'border-gray-200 hover:border-indigo-300';
            if (isChosen && feedback) {
              border = feedback.kind === 'correct' ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50';
            }
            return (
              <button
                key={m.id}
                onClick={() => handlePick(m.id)}
                disabled={!!chosen && feedback?.kind === 'correct'}
                className={`w-full text-left border-2 rounded-xl p-4 transition-all ${border} disabled:opacity-60`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                    {m.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{m.label}</span>
                      {isChosen && feedback?.kind === 'correct' && <CheckCircle className="w-4 h-4 text-green-600" />}
                      {isChosen && feedback?.kind === 'wrong'   && <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{m.desc}</p>
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
              ? 'bg-green-50 border border-green-300 text-green-800'
              : 'bg-amber-50 border border-amber-300 text-amber-800'
          }`}>
            {feedback.kind === 'correct'
              ? <CheckCircle className="inline w-4 h-4 mr-1.5 text-green-600" />
              : <AlertTriangle className="inline w-4 h-4 mr-1.5 text-amber-600" />}
            {feedback.msg}
          </div>
        )}

        {/* Hint */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
          <Lightbulb className="inline w-3.5 h-3.5 mr-1 text-blue-500" />
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
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
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

    // Episode A — Entering Variable
    if (episode === 'episodeA') {
      return (
        <div className="space-y-3">
          {/* A1: Arrive — "Choose Entering Variable" button */}
          {phase === 'a1_arrive' && (
            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-700 leading-relaxed">
                  The tableau is ready. Your task: identify which variable should enter the basis to improve the objective.
                </p>
              </div>
              <Button
                onClick={guided.clickChooseEntering}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Choose Entering Variable
              </Button>
            </div>
          )}

          {/* A2/A3: Attention + Commitment — instruction, waiting for click */}
          {(phase === 'a2_attention' || phase === 'a3_commitment') && (
            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-3">
                <p className="text-xs font-bold text-indigo-800 mb-1">
                  Episode A: Choose the Entering Variable
                </p>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  The Z-row shows how each variable affects the objective.
                  {problem.objectiveType === 'max'
                    ? ' For MAX: negative values indicate improvement. Which variable should enter the basis?'
                    : ' For MIN: positive values indicate improvement. Which variable should enter the basis?'}
                </p>
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  Click a cell in the Z-row above.
                </p>
              </div>

              {/* Feedback from wrong attempts */}
              {feedback && renderFeedback(feedback)}

              {/* Show reasoning after 4+ attempts */}
              {attemptCount >= 4 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-800 mb-1">Step-by-step reasoning:</p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    {problem.objectiveType === 'max'
                      ? '1. Scan the Z-row for all values.\n2. Negative values mean increasing that variable improves z.\n3. The MOST negative value gives the fastest improvement.\n4. Click that cell.'
                      : '1. Scan the Z-row for all values.\n2. Positive values mean increasing that variable improves z.\n3. The MOST positive value gives the fastest improvement.\n4. Click that cell.'}
                  </p>
                </div>
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
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                >
                  Use this variable anyway
                </Button>
                <Button onClick={guided.retryEntering} size="sm" variant="outline" className="text-xs">
                  Choose again
                </Button>
              </div>
            </div>
          )}

          {/* A4: Reveal — column highlighted, auto-transitions to B */}
          {phase === 'a4_reveal' && (
            <div className="space-y-3">
              {feedback && renderFeedback(feedback)}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <p className="text-xs text-blue-800">
                  Column highlighted. Moving to leaving variable selection…
                </p>
              </div>
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
              <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-3">
                <p className="text-xs font-bold text-indigo-800 mb-1">
                  Episode B: Choose the Leaving Variable
                </p>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Divide RHS by the pivot column entry (only where the entry is positive).
                  The smallest ratio determines the leaving variable — it&apos;s the first constraint that would be violated.
                </p>
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  Click a row in the highlighted blue column above.
                </p>
              </div>

              {feedback && renderFeedback(feedback)}

              {attemptCount >= 4 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-800 mb-1">Step-by-step reasoning:</p>
                  <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-line">
                    1. Look at each row in the pivot column.{'\n'}
                    2. Skip rows with zero or negative entries.{'\n'}
                    3. For positive entries: compute RHS / entry.{'\n'}
                    4. The row with the smallest ratio leaves the basis.{'\n'}
                    5. Click that row.
                  </p>
                </div>
              )}

              <Button onClick={guided.showAnswer} size="sm" variant="outline" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Show Answer
              </Button>
            </div>
          )}

          {/* B4: Reveal — ratios shown, auto-transitions to Apply */}
          {phase === 'b4_reveal' && (
            <div className="space-y-3">
              {feedback && renderFeedback(feedback)}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <p className="text-xs text-blue-800">
                  Ratios confirmed. Preparing pivot…
                </p>
              </div>
            </div>
          )}

          {/* B5: Apply — explicit button, no auto-advance */}
          {phase === 'b5_apply' && (
            <div className="space-y-3">
              {feedback && renderFeedback(feedback)}
              <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                <p className="text-xs text-green-800 leading-relaxed">
                  Pivot selected. Click below to apply the row operations and advance to the next tableau.
                </p>
              </div>
              <Button
                onClick={guided.applyPivot}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
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
      invalid: 'bg-red-50 border-red-300 text-red-800',
      suboptimal: 'bg-amber-50 border-amber-300 text-amber-800',
      correct: 'bg-green-50 border-green-300 text-green-800',
      hint: 'bg-blue-50 border-blue-300 text-blue-800',
      reasoning: 'bg-blue-50 border-blue-300 text-blue-800',
    };
    const iconMap = {
      invalid: <XCircle className="inline w-3.5 h-3.5 mr-1.5 text-red-500 flex-shrink-0" />,
      suboptimal: <AlertTriangle className="inline w-3.5 h-3.5 mr-1.5 text-amber-600 flex-shrink-0" />,
      correct: <CheckCircle className="inline w-3.5 h-3.5 mr-1.5 text-green-600 flex-shrink-0" />,
      hint: <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-blue-600 flex-shrink-0" />,
      reasoning: <Lightbulb className="inline w-3.5 h-3.5 mr-1.5 text-blue-600 flex-shrink-0" />,
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
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        {isLoading ? 'Solving your LP…' : 'Preparing…'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-700 font-medium">Solver Error</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
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
      <div className="h-3/5 border-b border-gray-300 bg-white overflow-auto">
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
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Loading…
          </div>
        )}
      </div>

      {/* BOTTOM (40%): Guidance + Graph */}
      <div className="h-2/5 flex overflow-hidden">

        {/* Bottom-left: Guidance */}
        <div className="w-1/2 border-r border-gray-300 overflow-hidden flex flex-col">

          {/* Step header */}
          {currentStep && (
            <div className="flex-shrink-0 px-4 py-2 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {STEP_LABEL[currentStep.stepType] ?? currentStep.stepType}
                </Badge>
                <span className="text-xs text-gray-500">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
              <span className="text-xs text-indigo-700 font-medium">
                z = {currentStep.objectiveValue.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* Special case banner */}
            {wordProblem?.specialCaseNote && (currentStep?.stepType === 'optimal' || currentStep?.stepType === 'infeasible' || currentStep?.stepType === 'unbounded' || currentStep?.stepType === 'alternative') && (
              <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-800">{wordProblem.specialCaseNote}</p>
              </div>
            )}

            {/* Alternative / degenerate flags */}
            {currentStep?.hasAlternative && (
              <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-3 flex gap-2">
                <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-indigo-800">Alternative Optimal Solutions</p>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    A nonbasic decision variable has a zero reduced cost. Infinitely many optimal
                    solutions exist along the edge between two optimal corners.
                  </p>
                </div>
              </div>
            )}
            {currentStep?.isDegenerate && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Degenerate BFS</p>
                  <p className="text-xs text-amber-700 mt-0.5">
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
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
                      <p className="text-xs font-bold text-blue-800">What's happening</p>
                    </div>
                    <p className="text-xs text-blue-900 leading-relaxed">{hint}</p>
                  </div>
                )}

                {/* Solver explanation */}
                {currentStep?.explanation && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 mb-1">Solver</p>
                    <p className="text-xs text-gray-700 font-mono leading-relaxed whitespace-pre-wrap">
                      {currentStep.explanation}
                    </p>
                  </div>
                )}

                {/* After-pivot: guidance (student navigated back here) */}
                {stepType === 'after_pivot' && (
                  <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                    <p className="text-xs text-green-800">
                      <CheckCircle className="inline w-3.5 h-3.5 mr-1 text-green-600" />
                      Pivot complete. Use the row operation stepper above to review what happened.
                    </p>
                  </div>
                )}

                {/* Optimal: celebration + summary */}
                {stepType === 'optimal' && (
                  <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                    <p className="text-sm font-bold text-green-800 flex items-center gap-1.5 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      Optimal Solution Found!
                    </p>
                    <p className="text-xs text-green-700 leading-relaxed">
                      All Z-row entries are non-negative. The simplex method has converged.
                      Read the basic variable values from the RHS column of the final tableau above.
                    </p>
                  </div>
                )}

                {/* Infeasible / Unbounded */}
                {(stepType === 'infeasible' || stepType === 'unbounded') && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                    <p className="text-sm font-bold text-red-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      {stepType === 'infeasible' ? 'No Feasible Solution' : 'Unbounded Solution'}
                    </p>
                  </div>
                )}

                {/* Phase I complete: transition message */}
                {stepType === 'phase1_complete' && (
                  <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-3">
                    <p className="text-xs text-indigo-800">
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
        <div className="w-1/2 bg-white overflow-hidden">
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
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
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
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-2">
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
                      ? 'bg-indigo-600 scale-125'
                      : i < currentStepIndex
                      ? 'bg-indigo-300 hover:bg-indigo-400'
                      : 'bg-gray-200'
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
        className="text-white hover:bg-white/20"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {target === 'home' ? 'Home' : target === 'navigate-home' ? 'Exit' : 'Back'}
      </Button>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-600 text-white px-5 py-3.5
                      flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-white/20"
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
              <div className={`text-white rounded-2xl p-6 ${CATEGORY_COLOR[selectedProblem.category] ?? 'bg-gray-700'}`}>
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

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">The Problem</h3>
                <p className="text-base text-gray-800 leading-relaxed whitespace-pre-line">
                  {selectedProblem.scenario}
                </p>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-xs text-indigo-700 leading-relaxed">
                  <strong>Your task:</strong> Read the problem carefully. In the next step, you'll identify
                  the decision variables (what we're deciding), write the objective function (what we're
                  optimizing), and set up each constraint. The system will check your work and give hints
                  if you get stuck.
                </p>
              </div>

              <Button
                onClick={() => setPhase('formulate')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-base"
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
