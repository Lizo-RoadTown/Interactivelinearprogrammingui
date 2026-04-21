/**
 * TableauSetupPhase.tsx
 *
 * Guides the student through understanding the initial tableau structure BEFORE
 * they see the full tableau. MC questions about slack / surplus / artificial vars.
 * Correct answers → initial tableau autofills as a reward.
 *
 * Layout: LEFT = sequential MC questions  |  RIGHT = tableau skeleton → reveals on completion
 */

import { useState, useMemo } from 'react';
import { LPProblem, SimplexStep } from '../types';
import { Button } from './ui/button';
import { CheckCircle, XCircle, ChevronRight, Zap } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  problem:      LPProblem;
  method:       string;          // 'simplex' | 'big-m' | 'two-phase'
  initialStep:  SimplexStep;
  onDone:       () => void;
}

interface MCQuestion {
  question:     string;
  options:      string[];
  correctIndex: number;
  explanation:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(problem: LPProblem, method: string): MCQuestion[] {
  const { constraints } = problem;
  const numLeq = constraints.filter(c => c.operator === '<=').length;
  const numGeq = constraints.filter(c => c.operator === '>=').length;
  const n      = constraints.length;

  const qs: MCQuestion[] = [];

  // ── Q1: How many slack variables? (always present for standard simplex) ────
  if (numLeq > 0) {
    const correct = numLeq.toString();
    // Wrong options: avoid duplicating correct; ensure distinct values
    const wrong = Array.from(new Set([
      (numLeq + 1).toString(),
      numLeq > 1 ? (numLeq - 1).toString() : (numLeq + 2).toString(),
      '0',
    ])).filter(v => v !== correct);

    const opts = shuffle([correct, ...wrong.slice(0, 3)]);
    qs.push({
      question:
        `This LP has ${numLeq} "≤" constraint${numLeq !== 1 ? 's' : ''}. ` +
        `How many slack variables do we need to add?`,
      options:      opts,
      correctIndex: opts.indexOf(correct),
      explanation:
        `Each ≤ constraint gets exactly one slack variable to absorb unused capacity. ` +
        `${numLeq} ≤ constraint${numLeq !== 1 ? 's' : ''} → ` +
        `${numLeq} slack variable${numLeq !== 1 ? 's' : ''} (s₁${numLeq > 1 ? '…s' + numLeq : ''}).`,
    });
  }

  // ── Q2: What does a slack variable represent? ─────────────────────────────
  const slackOpts = shuffle([
    'Unused capacity — the gap between the constraint limit and actual usage',
    'A penalty added when a constraint is violated',
    'A replacement for a decision variable when it leaves the basis',
    'The current value of the objective function',
  ]);
  qs.push({
    question:
      'What does a slack variable represent in the initial tableau?',
    options:      slackOpts,
    correctIndex: slackOpts.indexOf('Unused capacity — the gap between the constraint limit and actual usage'),
    explanation:
      'A slack "absorbs" the gap between the RHS and the left-hand side. ' +
      'At the origin (all decision variables = 0) the slack equals the full RHS — no capacity is used.',
  });

  // ── Q3: Initial value of first slack at origin ────────────────────────────
  const firstLeq = constraints.find(c => c.operator === '<=');
  if (firstLeq) {
    const rhs     = firstLeq.rhs;
    const correct = rhs.toString();
    const wrong   = Array.from(new Set([
      '0',
      (rhs + 1).toString(),
      firstLeq.coefficients[0].toString(),
    ])).filter(v => v !== correct);

    const opts = shuffle([correct, ...wrong.slice(0, 3)]);
    const label = firstLeq.label ?? 'C1';
    const terms = firstLeq.coefficients
      .map((v, i) => `${v}x${i + 1}`)
      .join(' + ');
    qs.push({
      question:
        `When all decision variables equal 0 (the origin), what is the initial value of s₁? ` +
        `(Constraint ${label}: ${terms} ≤ ${rhs})`,
      options:      opts,
      correctIndex: opts.indexOf(correct),
      explanation:
        `Substituting x₁ = x₂ = 0 gives 0 ≤ ${rhs}, ` +
        `so s₁ fills the entire gap: s₁ = ${rhs}. ` +
        `The origin is always a basic feasible solution for all-≤ problems because the slacks take the RHS values.`,
    });
  }

  // ── Q4 (Big-M only): How many artificial variables? ──────────────────────
  if (method === 'big-m' && numGeq > 0) {
    const correct = numGeq.toString();
    const wrong   = Array.from(new Set([
      (numGeq + 1).toString(),
      '0',
      n.toString(),
    ])).filter(v => v !== correct);

    const opts = shuffle([correct, ...wrong.slice(0, 3)]);
    qs.push({
      question:
        `This LP has ${numGeq} "≥" constraint${numGeq !== 1 ? 's' : ''}. ` +
        `For each one we add a surplus variable AND an artificial variable. ` +
        `How many artificial variables are added in total?`,
      options:      opts,
      correctIndex: opts.indexOf(correct),
      explanation:
        `Every ≥ constraint needs one artificial to create a valid initial basic feasible solution. ` +
        `${numGeq} ≥ constraint${numGeq !== 1 ? 's' : ''} → ${numGeq} artificial variable${numGeq !== 1 ? 's' : ''} (a₁${numGeq > 1 ? '…a' + numGeq : ''}).`,
    });
  }

  // ── Q5 (Big-M only): Penalty in objective row ────────────────────────────
  if (method === 'big-m' && numGeq > 0) {
    const penaltyOpts = [
      '−M  (a very large negative penalty)',
      '+M  (a very large positive bonus)',
      '0   (no effect on objective)',
      '−1  (same as a regular variable)',
    ];
    qs.push({
      question:
        `In a MAX problem, what coefficient does an artificial variable get in the objective (Z) row?`,
      options:      penaltyOpts,
      correctIndex: 0,
      explanation:
        `We want the solver to drive artificial variables out of the basis. ` +
        `Giving them −M in a MAX objective makes them extremely costly to keep — ` +
        `the solver will prefer any real solution over one with an artificial variable in the basis.`,
    });
  }

  // ── Q6 (Two-Phase only): What does Phase I minimise? ─────────────────────
  if (method === 'two-phase') {
    const phaseOpts = shuffle([
      'The sum of all artificial variables  (w = a₁ + a₂ + …)',
      'The original objective function',
      'The number of basic variables',
      'The sum of all slack variables',
    ]);
    qs.push({
      question:
        'In the Two-Phase method, what does Phase I minimise?',
      options:      phaseOpts,
      correctIndex: phaseOpts.indexOf('The sum of all artificial variables  (w = a₁ + a₂ + …)'),
      explanation:
        'Phase I drives every artificial variable to zero, ` +\n        `finding a feasible starting point. ' +
        'If w* = 0 after Phase I, the artificials are gone and we have a legitimate BFS. ' +
        'Phase II then optimises the original objective from that BFS.',
    });
  }

  return qs;
}

// ── Sub-component: colour band for column type ────────────────────────────────

function colHeaderClass(colType: string | undefined, varName: string): string {
  if (varName === 'RHS') return 'bg-accent/10 text-accent border-accent/30';
  switch (colType) {
    case 'artificial': return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'surplus':    return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'slack':      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    default:           return 'bg-muted/40 text-foreground border-border';
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TableauSetupPhase({ problem, method, initialStep, onDone }: Props) {
  // Generate questions once
  const questions = useMemo(() => buildQuestions(problem, method), []);

  const [qIdx,     setQIdx]     = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; msg: string } | null>(null);
  const [allDone,  setAllDone]  = useState(false);

  const current = questions[qIdx];

  // Tableau data
  const tableau  = initialStep.tableau;
  const allVars  = tableau.allVariables ?? [];
  const colTypes = tableau.colTypes     ?? [];
  const rows     = tableau.rows;
  const basis    = tableau.basisVariables;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleAnswer(optIdx: number) {
    if (selected !== null) return;
    setSelected(optIdx);
    const correct = optIdx === current.correctIndex;
    setFeedback({
      correct,
      msg: correct
        ? `Correct! ${current.explanation}`
        : `Not quite. ${current.explanation}`,
    });
  }

  function handleNext() {
    if (qIdx + 1 >= questions.length) {
      setAllDone(true);
    } else {
      setQIdx(q => q + 1);
      setSelected(null);
      setFeedback(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* LEFT: Questions panel */}
      <div className="w-1/2 border-r border-border flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 px-4 py-2.5 bg-primary/10 border-b border-primary/30 flex items-center justify-between">
          <p className="text-xs font-bold text-primary">Setting Up the Tableau</p>
          {!allDone && (
            <span className="text-xs text-primary">
              Question {qIdx + 1} / {questions.length}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex-shrink-0 flex gap-1 px-4 pt-3 pb-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                i <  qIdx    ? 'bg-emerald-500/100' :
                i === qIdx   ? 'bg-primary/100' :
                               'bg-muted/80'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {!allDone ? (
            /* ── Active question ── */
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {current.question}
              </p>

              {/* Options */}
              <div className="space-y-2">
                {current.options.map((opt, i) => {
                  let cls =
                    'w-full text-left border-2 rounded-lg px-3 py-2.5 text-sm transition-all ';
                  if (selected === null) {
                    cls += 'border-border bg-card hover:border-primary/60 hover:bg-primary/10 cursor-pointer';
                  } else if (i === current.correctIndex) {
                    cls += 'border-green-400 bg-emerald-500/10 text-emerald-200 font-medium';
                  } else if (i === selected) {
                    cls += 'border-red-400 bg-destructive/10 text-red-800';
                  } else {
                    cls += 'border-border bg-card opacity-40 cursor-default';
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={selected !== null}
                      className={cls}
                    >
                      <span className="font-bold text-muted-foreground mr-2">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {opt}
                      {selected !== null && i === current.correctIndex && (
                        <CheckCircle className="inline w-4 h-4 ml-2 text-emerald-400" />
                      )}
                      {selected !== null && i === selected && i !== current.correctIndex && (
                        <XCircle className="inline w-4 h-4 ml-2 text-red-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback */}
              {feedback && (
                <div className={`rounded-lg p-3 text-xs leading-relaxed ${
                  feedback.correct
                    ? 'bg-emerald-500/10 border border-green-300 text-emerald-200'
                    : 'bg-amber-500/10 border border-amber-300 text-amber-200'
                }`}>
                  {feedback.correct
                    ? <CheckCircle className="inline w-3.5 h-3.5 mr-1 text-emerald-400" />
                    : <XCircle className="inline w-3.5 h-3.5 mr-1 text-amber-400" />}
                  {feedback.msg}
                </div>
              )}

              {/* Advance button */}
              {selected !== null && (
                <Button
                  onClick={handleNext}
                  className="w-full bg-primary hover:bg-primary text-white"
                >
                  {qIdx + 1 >= questions.length ? (
                    <>
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      Reveal the Initial Tableau!
                    </>
                  ) : (
                    <>
                      Next Question
                      <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            /* ── All done ── */
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-green-300 rounded-xl p-4 space-y-1">
                <p className="font-bold text-emerald-200 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Tableau structure unlocked!
                </p>
                <p className="text-sm text-emerald-300">
                  The initial tableau has been filled in automatically — your reward
                  for identifying the structure correctly.
                  Now let's step through the simplex iterations.
                </p>
              </div>

              <Button
                onClick={onDone}
                className="w-full bg-primary hover:bg-primary text-white"
              >
                Start Solving →
              </Button>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT: Tableau preview */}
      <div className="w-1/2 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 px-4 py-2.5 bg-muted/40 border-b border-border">
          <p className="text-xs font-bold text-muted-foreground">
            {allDone ? 'Initial Tableau' : 'Tableau Structure Preview'}
          </p>
          {!allDone && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Answer all questions to reveal the values.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-xs font-bold text-muted-foreground border border-border bg-muted/40 whitespace-nowrap">
                    Basis
                  </th>
                  {allVars.map((v, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2 text-xs font-bold border ${colHeaderClass(colTypes[i], v)} whitespace-nowrap`}
                    >
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const basisLabel = ri < basis.length ? basis[ri] : 'Z';
                  const isZRow     = ri === rows.length - 1;
                  return (
                    <tr key={ri} className={isZRow ? 'bg-primary/10' : 'bg-card'}>
                      <td className="px-3 py-2 text-xs font-bold border border-border text-center text-foreground">
                        {basisLabel}
                      </td>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`px-3 py-2 text-xs text-center border border-border transition-all duration-500 ${
                            allDone ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          {cell.displayValue ?? cell.value}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend — only shown after reveal */}
          {allDone && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {numLeqFromTableau(colTypes) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                  <span className="font-bold text-emerald-700">Slack (s)</span>
                  <p className="text-emerald-600 mt-0.5">≤ constraints · absorbs unused capacity</p>
                </div>
              )}
              {colTypes.includes('surplus') && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                  <span className="font-bold text-orange-700">Surplus (s)</span>
                  <p className="text-orange-600 mt-0.5">≥ constraints · subtracts excess</p>
                </div>
              )}
              {colTypes.includes('artificial') && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2">
                  <span className="font-bold text-rose-700">Artificial (a)</span>
                  <p className="text-rose-600 mt-0.5">Temporary · −M penalty drives to zero</p>
                </div>
              )}
              <div className="bg-muted/40 border border-border rounded-lg p-2">
                <span className="font-bold text-foreground">Decision (x)</span>
                <p className="text-muted-foreground mt-0.5">Start at 0 in basis · to be optimised</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Count slack columns without importing problem a second time
function numLeqFromTableau(colTypes: string[]): number {
  return colTypes.filter(t => t === 'slack').length;
}
