/**
 * GraphBuildPhase.tsx
 *
 * Guides the student through building the graph BEFORE solving:
 *   1. For each constraint: MC question about where the line is → line appears
 *   2. For each constraint: MC question about which side is feasible → region shades
 *   3. After all constraints: sliding objective line to discover MAX/MIN visually
 *
 * The student does the reasoning; the graph rewards correct answers with animation.
 */

import { useState } from 'react';
import GraphView from './GraphView';
import { Button } from './ui/button';
import { Constraint, Point } from '../types';
import {
  CheckCircle, XCircle, Lightbulb, ChevronRight, ArrowRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  constraints: Constraint[];
  objectiveCoefficients: number[];
  objectiveType: 'max' | 'min';
  feasibleRegionPolygon: Point[];
  cornerPoints: Point[];
  optimalZ: number;
  onDone: () => void;
}

type GBPhase = 'constraint_intercepts' | 'constraint_direction' | 'objective_intro' | 'objective_slider' | 'wrap_up';

interface MCOption {
  label: string;
  value: string;
}

// ── MC generation helpers ─────────────────────────────────────────────────────

function fmt(n: number) {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateInterceptMC(c: Constraint): { options: MCOption[]; correctValue: string } {
  const [a, b] = c.coefficients;
  const r = c.rhs;

  const x1int = a !== 0 ? r / a : null;
  const x2int = b !== 0 ? r / b : null;

  const correctLabel =
    x1int !== null && x2int !== null
      ? `x₁-axis at (${fmt(x1int)}, 0) and x₂-axis at (0, ${fmt(x2int)})`
      : x1int !== null
      ? `Vertical line at x₁ = ${fmt(x1int)}`
      : `Horizontal line at x₂ = ${fmt(x2int!)}`;

  const correctValue = 'correct';

  const wrongs: MCOption[] = [];
  if (x1int !== null && x2int !== null) {
    // Swap intercepts
    wrongs.push({ label: `x₁-axis at (${fmt(x2int)}, 0) and x₂-axis at (0, ${fmt(x1int)})`, value: 'w1' });
    // Use RHS for both
    wrongs.push({ label: `x₁-axis at (${fmt(r)}, 0) and x₂-axis at (0, ${fmt(r)})`, value: 'w2' });
    // Use the coefficients as intercepts
    wrongs.push({ label: `x₁-axis at (${fmt(a)}, 0) and x₂-axis at (0, ${fmt(b)})`, value: 'w3' });
  } else {
    wrongs.push({ label: `x₁-axis at (${fmt(r * 2)}, 0) and x₂-axis at (0, ${fmt(r * 2)})`, value: 'w1' });
    wrongs.push({ label: `x₁-axis at (${fmt(r / 2)}, 0) and x₂-axis at (0, ${fmt(r / 2)})`, value: 'w2' });
    wrongs.push({ label: `x₁-axis at (${fmt(a + b)}, 0) and x₂-axis at (0, ${fmt(r / (a + b))})`, value: 'w3' });
  }

  const options = shuffle([
    { label: correctLabel, value: correctValue },
    ...wrongs.slice(0, 3),
  ]);

  return { options, correctValue };
}

function generateDirectionMC(c: Constraint): {
  options: MCOption[];
  correctValue: string;
  explanation: string;
} {
  // Test if origin (0,0) satisfies the constraint
  const lhsAtOrigin = c.coefficients.reduce((s, coeff) => s + coeff * 0, 0); // = 0
  let originSatisfies = false;
  let correctLabel: string;
  let explanation: string;

  if (c.operator === '<=') {
    originSatisfies = lhsAtOrigin <= c.rhs; // always true when rhs > 0
    if (originSatisfies) {
      correctLabel = 'The region containing the origin (0, 0) — below-left of the line';
      explanation = `Substituting (0, 0): 0 ${c.operator} ${c.rhs} ✓. The origin satisfies the constraint, so the feasible side is the region containing the origin (below-left of the line).`;
    } else {
      correctLabel = 'The region NOT containing the origin — above-right of the line';
      explanation = `Substituting (0, 0): 0 ${c.operator} ${c.rhs} ✗. The origin does NOT satisfy this constraint, so the feasible side is on the other side of the line.`;
    }
  } else if (c.operator === '>=') {
    originSatisfies = lhsAtOrigin >= c.rhs; // false when rhs > 0
    if (originSatisfies) {
      correctLabel = 'The region containing the origin (0, 0)';
      explanation = `Substituting (0, 0): 0 ${c.operator} ${c.rhs} ✓. The feasible region includes the origin.`;
    } else {
      correctLabel = 'The region NOT containing the origin — above-right of the line';
      explanation = `Substituting (0, 0): 0 ${c.operator} ${c.rhs} ✗. For a ≥ constraint, we need values large enough to satisfy the requirement. The feasible side is away from the origin.`;
    }
  } else {
    // equality — just the line itself
    correctLabel = 'Only the boundary line itself (it\'s an equality)';
    explanation = `This is an equality constraint (=), so only points exactly ON the line are feasible. There is no region — just the line.`;
  }

  const correctValue = 'correct';
  const wrongs: MCOption[] = c.operator === '='
    ? [
        { label: 'The region above the line', value: 'w1' },
        { label: 'The region below the line', value: 'w2' },
        { label: 'The entire graph (both sides)', value: 'w3' },
      ]
    : [
        { label: originSatisfies
            ? 'The region NOT containing the origin — above-right of the line'
            : 'The region containing the origin (0, 0)',
          value: 'w1' },
        { label: 'The entire graph — both sides of the line are feasible', value: 'w2' },
        { label: 'Only the boundary line itself', value: 'w3' },
      ];

  const options = shuffle([{ label: correctLabel, value: correctValue }, ...wrongs]);
  return { options, correctValue, explanation };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphBuildPhase({
  constraints,
  objectiveCoefficients,
  objectiveType,
  feasibleRegionPolygon,
  cornerPoints,
  optimalZ,
  onDone,
}: Props) {
  const [phase, setPhase]       = useState<GBPhase>('constraint_intercepts');
  const [cIdx, setCIdx]         = useState(0);           // current constraint index
  const [confirmed, setConfirmed] = useState(0);         // how many constraints fully confirmed
  const [answer, setAnswer]     = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; correct: boolean } | null>(null);
  const [zValue, setZValue]     = useState(0);

  const nc = constraints.length;
  const c  = constraints[cIdx];

  // Compute z slider range from corner points
  const zValues = cornerPoints.map(p => p.z ?? 0);
  const maxCornerZ = zValues.length > 0 ? Math.max(...zValues) : optimalZ;
  const minCornerZ = zValues.length > 0 ? Math.min(...zValues) : 0;
  const sliderMax  = objectiveType === 'max' ? Math.ceil(maxCornerZ * 1.3) : Math.ceil(maxCornerZ * 1.1);
  const sliderMin  = 0;

  // Classify slider position relative to optimal
  const zStatus: 'under' | 'optimal' | 'over' =
    objectiveType === 'max'
      ? Math.abs(zValue - maxCornerZ) < 1e-6 * (maxCornerZ + 1) || Math.abs(zValue - optimalZ) < 0.5
        ? 'optimal'
        : zValue > optimalZ + 0.5 ? 'over' : 'under'
      : Math.abs(zValue - minCornerZ) < 1e-6 * (minCornerZ + 1) || Math.abs(zValue - optimalZ) < 0.5
        ? 'optimal'
        : zValue < optimalZ - 0.5 ? 'over' : 'under';

  // MC options — re-generated per constraint to keep stable during phase
  const [interceptMC] = useState<{ options: MCOption[]; correctValue: string }[]>(() =>
    constraints.map(con => generateInterceptMC(con))
  );
  const [directionMC] = useState<Array<ReturnType<typeof generateDirectionMC>>>(() =>
    constraints.map(con => generateDirectionMC(con))
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleInterceptAnswer(val: string) {
    if (answer !== null) return;
    setAnswer(val);
    if (val === interceptMC[cIdx].correctValue) {
      setFeedback({ msg: 'Correct! The line is now drawn on the graph. →', correct: true });
    } else {
      const [a, b] = c.coefficients;
      const r = c.rhs;
      setFeedback({
        msg: `Not quite. To find where the line crosses the x₁-axis, set x₂ = 0: ` +
          `${a}x₁ = ${r} → x₁ = ${fmt(r / a)}. ` +
          `To find the x₂-axis, set x₁ = 0: ${b}x₂ = ${r} → x₂ = ${fmt(r / b)}.`,
        correct: false,
      });
    }
  }

  function handleDirectionAnswer(val: string) {
    if (answer !== null) return;
    setAnswer(val);
    const dm = directionMC[cIdx];
    if (val === dm.correctValue) {
      setFeedback({ msg: dm.explanation, correct: true });
    } else {
      setFeedback({
        msg: `Not quite. ${dm.explanation}`,
        correct: false,
      });
    }
  }

  function advanceIntercept() {
    // Line is confirmed — move to direction question for same constraint
    setPhase('constraint_direction');
    setAnswer(null);
    setFeedback(null);
  }

  function advanceDirection() {
    const next = cIdx + 1;
    if (next < nc) {
      // Move to next constraint
      setConfirmed(cIdx + 1);
      setCIdx(next);
      setPhase('constraint_intercepts');
      setAnswer(null);
      setFeedback(null);
    } else {
      // All constraints done — reveal feasible region, show objective intro
      setConfirmed(nc);
      setPhase('objective_intro');
      setAnswer(null);
      setFeedback(null);
    }
  }

  function retryIntercept() {
    setAnswer(null);
    setFeedback(null);
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const constraintLabel = (con: Constraint, i: number) => {
    const terms = con.coefficients
      .map((v, j) => `${v}x₁`.replace('x₁', `x${j + 1}`))
      .join(' + ');
    return `C${i + 1}: ${terms} ${con.operator} ${con.rhs}`;
  };

  function MCButtons({
    options,
    selected,
    correctValue,
    onSelect,
  }: {
    options: MCOption[];
    selected: string | null;
    correctValue: string;
    onSelect: (v: string) => void;
  }) {
    return (
      <div className="space-y-2">
        {options.map((opt, i) => {
          let cls = 'w-full text-left text-sm px-4 py-2.5 rounded-lg border-2 transition-colors ';
          if (selected === null) {
            cls += 'bg-card border-border hover:border-primary/60 hover:bg-primary/10 cursor-pointer';
          } else if (opt.value === correctValue) {
            cls += 'bg-emerald-500/10 border-green-500 text-emerald-200 font-medium';
          } else if (opt.value === selected) {
            cls += 'bg-destructive/10 border-red-400 text-red-800';
          } else {
            cls += 'bg-muted/40 border-border text-muted-foreground';
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => onSelect(opt.value)}
            >
              <span className="font-bold mr-2">{String.fromCharCode(65 + i)})</span>
              {opt.label}
              {selected !== null && opt.value === correctValue && (
                <CheckCircle className="inline w-4 h-4 ml-2 text-emerald-400" />
              )}
              {selected !== null && opt.value === selected && opt.value !== correctValue && (
                <XCircle className="inline w-4 h-4 ml-2 text-red-500" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  const showConstraints   = phase !== 'objective_intro' && phase !== 'objective_slider' && phase !== 'wrap_up' ? confirmed : nc;
  const showFeasible      = phase === 'objective_intro' || phase === 'objective_slider' || phase === 'wrap_up';
  const showObjectiveLine = phase === 'objective_slider' || phase === 'wrap_up';

  const constraintColors = ['text-destructive', 'text-emerald-600', 'text-amber-400', 'text-primary'];

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* LEFT: Questions */}
      <div className="w-2/5 flex flex-col border-r border-border overflow-hidden">

        {/* Progress header */}
        <div className="flex-shrink-0 px-4 py-2.5 bg-primary/10 border-b border-primary/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-primary">Graph Building</p>
            <div className="flex gap-1">
              {constraints.map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < confirmed ? 'bg-primary' :
                    i === cIdx && (phase === 'constraint_intercepts' || phase === 'constraint_direction') ? 'bg-indigo-300' :
                    'bg-muted/80'
                  }`}
                />
              ))}
              <div className={`w-2.5 h-2.5 rounded-full ${
                phase === 'objective_slider' || phase === 'wrap_up' ? 'bg-emerald-500/100' : 'bg-muted/80'
              }`} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Confirmed constraints list */}
          {confirmed > 0 && (
            <div className="space-y-1">
              {constraints.slice(0, confirmed).map((con, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className={`font-mono font-medium ${constraintColors[i % constraintColors.length]}`}>
                    {constraintLabel(con, i)}
                  </span>
                  <span className="text-muted-foreground ml-auto">plotted ✓</span>
                </div>
              ))}
            </div>
          )}

          {/* ── CONSTRAINT INTERCEPTS ──────────────────────────────── */}
          {phase === 'constraint_intercepts' && (
            <div className="space-y-3">
              <div className={`rounded-xl p-3 border-2 ${constraintColors[cIdx % constraintColors.length].replace('text', 'border').replace('600', '200')} bg-card`}>
                <p className="text-xs font-bold text-muted-foreground mb-1">Constraint {cIdx + 1} of {nc}</p>
                <p className={`text-sm font-mono font-bold ${constraintColors[cIdx % constraintColors.length]}`}>
                  {constraintLabel(c, cIdx)}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground mb-3">
                  Where does this line cross the axes?
                </p>
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-2.5 mb-3 text-xs text-accent">
                  <Lightbulb className="inline w-3.5 h-3.5 mr-1 text-blue-500" />
                  To find the x₁-intercept, set x₂ = 0 and solve. To find x₂-intercept, set x₁ = 0.
                </div>

                <MCButtons
                  options={interceptMC[cIdx].options}
                  selected={answer}
                  correctValue={interceptMC[cIdx].correctValue}
                  onSelect={handleInterceptAnswer}
                />
              </div>

              {feedback && (
                <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${feedback.correct ? 'bg-emerald-500/10 border border-green-300 text-emerald-200' : 'bg-destructive/10 border border-red-300 text-red-800'}`}>
                  {feedback.correct
                    ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                    : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                  }
                  <span>{feedback.msg}</span>
                </div>
              )}

              {feedback?.correct && (
                <Button onClick={advanceIntercept} className="w-full bg-primary hover:bg-primary text-white">
                  Line plotted — which side is feasible? <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {feedback && !feedback.correct && (
                <Button variant="outline" onClick={retryIntercept} className="w-full">
                  Try again
                </Button>
              )}
            </div>
          )}

          {/* ── CONSTRAINT DIRECTION ──────────────────────────────── */}
          {phase === 'constraint_direction' && (
            <div className="space-y-3">
              <div className={`rounded-xl p-3 border-2 ${constraintColors[cIdx % constraintColors.length].replace('text', 'border').replace('600', '200')} bg-card`}>
                <p className="text-xs font-bold text-muted-foreground mb-1">Constraint {cIdx + 1} — Feasible Region</p>
                <p className={`text-sm font-mono font-bold ${constraintColors[cIdx % constraintColors.length]}`}>
                  {constraintLabel(c, cIdx)}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground mb-3">
                  Which side of this line satisfies the constraint?
                </p>
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-2.5 mb-3 text-xs text-accent">
                  <Lightbulb className="inline w-3.5 h-3.5 mr-1 text-blue-500" />
                  Substitute the origin (0, 0) into the constraint. Does it satisfy it?
                </div>

                <MCButtons
                  options={directionMC[cIdx].options}
                  selected={answer}
                  correctValue={directionMC[cIdx].correctValue}
                  onSelect={handleDirectionAnswer}
                />
              </div>

              {feedback && (
                <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${feedback.correct ? 'bg-emerald-500/10 border border-green-300 text-emerald-200' : 'bg-destructive/10 border border-red-300 text-red-800'}`}>
                  {feedback.correct
                    ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                    : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                  }
                  <span>{feedback.msg}</span>
                </div>
              )}

              {feedback?.correct && (
                <Button onClick={advanceDirection} className="w-full bg-primary hover:bg-primary text-white">
                  {cIdx + 1 < nc ? `Great — add constraint ${cIdx + 2}` : 'All constraints plotted!'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {feedback && !feedback.correct && (
                <Button variant="outline" onClick={retryIntercept} className="w-full">Try again</Button>
              )}
            </div>
          )}

          {/* ── OBJECTIVE INTRO ──────────────────────────────────────── */}
          {phase === 'objective_intro' && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-green-300 rounded-xl p-4">
                <p className="text-sm font-bold text-emerald-200 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Feasible region complete!
                </p>
                <p className="text-xs text-emerald-300 mt-1 leading-relaxed">
                  The shaded area on the graph is every combination of x₁ and x₂ that satisfies
                  ALL constraints simultaneously. Any point inside (or on the boundary) is a valid solution.
                </p>
              </div>

              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-2">
                <p className="text-sm font-bold text-purple-800">Now: the Objective Function</p>
                <p className="text-xs text-primary leading-relaxed">
                  The objective is to <strong>{objectiveType === 'max' ? 'MAXIMIZE' : 'MINIMIZE'}</strong>{' '}
                  z = {objectiveCoefficients.map((c, i) => `${c}x${i + 1}`).join(' + ')}.
                </p>
                <p className="text-xs text-primary leading-relaxed">
                  The objective function is a <strong>family of parallel lines</strong> — each line
                  corresponds to a different value of z. As z changes, the line slides across the graph.
                </p>
                <p className="text-xs text-primary leading-relaxed">
                  {objectiveType === 'max'
                    ? '→ We want to push the line as FAR from the origin as possible while still touching the feasible region.'
                    : '→ We want to bring the line as CLOSE to the origin as possible while still touching the feasible region.'
                  }
                </p>
              </div>

              <Button
                onClick={() => { setPhase('objective_slider'); setZValue(0); }}
                className="w-full bg-primary hover:bg-purple-700 text-white"
              >
                Try the slider →
              </Button>
            </div>
          )}

          {/* ── OBJECTIVE SLIDER ─────────────────────────────────────── */}
          {phase === 'objective_slider' && (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">
                  Slide the objective line to {objectiveType === 'max' ? 'maximize' : 'minimize'} z
                </p>
                <p className="text-xs text-muted-foreground">
                  Move the slider and watch the dashed purple line on the graph.
                </p>

                {/* z value display */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary font-mono">
                    z = {zValue}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {objectiveCoefficients.map((c, i) => `${c}x${i + 1}`).join(' + ')} = {zValue}
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step={1}
                  value={zValue}
                  onChange={e => setZValue(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>z = 0</span>
                  <span>z = {sliderMax}</span>
                </div>

                {/* Status indicator */}
                <div className={`rounded-lg p-2.5 text-xs font-medium text-center ${
                  zStatus === 'optimal' ? 'bg-emerald-500/20 text-emerald-200 border border-green-300' :
                  zStatus === 'over'    ? 'bg-destructive/20 text-red-800 border border-red-300' :
                                         'bg-accent/20 text-accent border border-accent/40'
                }`}>
                  {zStatus === 'optimal'
                    ? `✓ The line is touching the boundary at a corner! This is the ${objectiveType === 'max' ? 'maximum' : 'minimum'} feasible z.`
                    : zStatus === 'over'
                    ? objectiveType === 'max'
                      ? '⚠ The line has left the feasible region — no solution exists at this z value. Slide back!'
                      : '⚠ The line has left the feasible region. Slide it up!'
                    : objectiveType === 'max'
                    ? '→ The line is inside the feasible region. Can you push it further?'
                    : '→ Can you bring the line closer to the origin while still touching the feasible region?'
                  }
                </div>
              </div>

              {zStatus === 'optimal' && (
                <div className="bg-emerald-500/10 border border-green-300 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-bold text-emerald-200">
                    You found it! z* = {optimalZ}
                  </p>
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    The optimal solution is at the <strong>corner</strong> where the objective line
                    last touches the feasible region. This is always a vertex — this is why the
                    Simplex Method moves from corner to corner!
                  </p>
                </div>
              )}

              {/* Always-visible continue button — student is never stuck */}
              <Button
                onClick={() => setPhase('wrap_up')}
                className={`w-full text-white ${
                  zStatus === 'optimal'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-primary hover:bg-primary'
                }`}
              >
                {zStatus === 'optimal'
                  ? <>Excellent — set up the tableau <ArrowRight className="w-4 h-4 ml-1" /></>
                  : <>Continue to Tableau Setup <ArrowRight className="w-4 h-4 ml-1" /></>
                }
              </Button>
            </div>
          )}

          {/* ── WRAP UP ──────────────────────────────────────────────── */}
          {phase === 'wrap_up' && (
            <div className="space-y-3">
              <div className="bg-primary/10 border border-primary/40 rounded-xl p-4 space-y-2">
                <p className="text-sm font-bold text-primary">Graph complete ✓</p>
                <ul className="space-y-1 text-xs text-primary">
                  <li>✓ {nc} constraint line{nc > 1 ? 's' : ''} plotted</li>
                  <li>✓ Feasible region identified (shaded)</li>
                  <li>✓ Optimal corner found graphically: z* ≈ {optimalZ}</li>
                </ul>
                <p className="text-xs text-primary mt-2 leading-relaxed">
                  Now we'll build the <strong>simplex tableau</strong> — the algebraic way to find
                  this same solution systematically, even for problems with more than 2 variables
                  where we can't graph.
                </p>
              </div>

              <p className="text-xs text-center text-muted-foreground">Step 2 of 3 — next up: Tableau Setup</p>

              <Button
                onClick={onDone}
                size="lg"
                className="w-full bg-primary hover:bg-primary text-white font-semibold py-3"
              >
                Build the Simplex Tableau →
              </Button>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT: Graph */}
      <div className="flex-1 bg-card overflow-hidden">
        <GraphView
          constraints={constraints}
          cornerPoints={showFeasible ? cornerPoints : []}
          feasibleRegionPolygon={showFeasible ? feasibleRegionPolygon : []}
          simplexPath={[]}
          objectiveCoefficients={objectiveCoefficients}
          showObjectiveLine={showObjectiveLine}
          zOverride={showObjectiveLine ? zValue : undefined}
          visibleConstraintCount={
            phase === 'constraint_intercepts' && answer === null
              ? showConstraints          // don't preview the current line before answer
              : showConstraints + (phase === 'constraint_intercepts' || phase === 'constraint_direction' ? 1 : 0)
          }
        />
      </div>
    </div>
  );
}
