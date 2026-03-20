import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import TopControlBar from '../components/TopControlBar';
import GraphView from '../components/GraphView';
import TableauWorkspace from '../components/TableauWorkspace';
import StepTimeline from '../components/StepTimeline';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Method, LPProblem, TableauCell, Tableau, VariableSign } from '../types';
import { useLPSolver } from '../hooks/useLPSolver';
import { BookOpen, Zap, AlertCircle, Loader2, Plus, Trash2, Info } from 'lucide-react';

const DEFAULT_PROBLEM: LPProblem = {
  objectiveType: 'max',
  objectiveCoefficients: [3, 2],
  variables: ['x1', 'x2'],
  variableSigns: ['nonneg', 'nonneg'],
  constraints: [
    { id: 'c1', coefficients: [2, 1], operator: '<=', rhs: 18 },
    { id: 'c2', coefficients: [2, 3], operator: '<=', rhs: 42 },
    { id: 'c3', coefficients: [3, 1], operator: '<=', rhs: 24 },
  ],
};

function fmt(num: number): string {
  if (Number.isInteger(num)) return num.toString();
  const denom = [2, 3, 4, 5, 6];
  for (const d of denom) {
    const n = Math.round(num * d);
    if (Math.abs(n / d - num) < 1e-9) return `${n}/${d}`;
  }
  return num.toFixed(3).replace(/\.?0+$/, '');
}

function formatCell(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  const BIG_M = 1_000_000;
  const mCoeff = Math.round((v / BIG_M) * 1e8) / 1e8;
  if (Math.abs(Math.round(mCoeff)) >= 1 && Math.abs(v - Math.round(mCoeff) * BIG_M) < 0.5) {
    const k = Math.round(mCoeff);
    if (k === 1) return 'M'; if (k === -1) return '-M'; return `${k}M`;
  }
  if (Number.isInteger(Math.round(v * 1e4) / 1e4)) return String(Math.round(v));
  return v.toFixed(4).replace(/\.?0+$/, '');
}

export default function MainWorkspace() {
  const navigate = useNavigate();
  const [problem, setProblem] = useState<LPProblem>(DEFAULT_PROBLEM);
  const [method, setMethod] = useState<Method>('simplex');
  const [isInteractive, setIsInteractive] = useState(false);
  const [showRatioTest, setShowRatioTest] = useState(true);
  const [showObjectiveLine, setShowObjectiveLine] = useState(true);
  const [afterStep, setAfterStep] = useState(0);

  const {
    solverResponse, steps, currentStep, currentStepIndex,
    canStepBack, canStepForward, isLoading, error,
    interactiveState, cellExplanation, currentSimplexPath, currentPoint,
    solve, stepForward, stepBack, jumpToStep, reset,
    enterInteractiveMode, exitInteractiveMode, handleInteractiveClick, explainCell,
  } = useLPSolver();

  // Reset afterStep when the step changes
  useEffect(() => { setAfterStep(0); }, [currentStepIndex]);

  const handleSolve = () => solve(problem, method);

  const handleInteractiveModeToggle = () => {
    if (!isInteractive) {
      if (!solverResponse) {
        solve(problem, method).then(() => { setIsInteractive(true); enterInteractiveMode(); });
      } else { setIsInteractive(true); enterInteractiveMode(); }
    } else { setIsInteractive(false); exitInteractiveMode(); }
  };

  const handleCellClick = (row: number, col: number) => {
    if (!currentStep) return;
    if (isInteractive && interactiveState) handleInteractiveClick(row, col, problem.objectiveType);
    else explainCell(row, col, currentStep, problem.objectiveType);
  };

  // Constraint helpers
  const updateCoeff = (ci: number, vi: number, raw: string) => {
    const val = parseFloat(raw); if (isNaN(val)) return;
    setProblem(p => ({ ...p, constraints: p.constraints.map((c, i) => i !== ci ? c : { ...c, coefficients: c.coefficients.map((v, j) => j === vi ? val : v) }) }));
  };
  const updateOp = (ci: number, op: '<=' | '>=' | '=') =>
    setProblem(p => ({ ...p, constraints: p.constraints.map((c, i) => i === ci ? { ...c, operator: op } : c) }));
  const updateRhs = (ci: number, raw: string) => {
    const val = parseFloat(raw); if (isNaN(val)) return;
    setProblem(p => ({ ...p, constraints: p.constraints.map((c, i) => i === ci ? { ...c, rhs: val } : c) }));
  };
  const addConstraint = () =>
    setProblem(p => ({ ...p, constraints: [...p.constraints, { id: `c${Date.now()}`, coefficients: p.variables.map(() => 0), operator: '<=', rhs: 0 }] }));
  const removeConstraint = (ci: number) =>
    setProblem(p => ({ ...p, constraints: p.constraints.filter((_, i) => i !== ci) }));
  const updateVariableSign = (vi: number, sign: VariableSign) =>
    setProblem(p => {
      const signs = [...(p.variableSigns ?? p.variables.map(() => 'nonneg' as VariableSign))];
      signs[vi] = sign;
      return { ...p, variableSigns: signs };
    });

  // Build display tableau
  const displayTableau = (() => {
    if (isInteractive && interactiveState && solverResponse) {
      const { liveMatrix, liveBasis, liveVarNames, liveColTypes, livePivotCol, phase } = interactiveState;
      const m = liveBasis.length; const nCols = liveMatrix[0]?.length ?? 0;
      const rows: TableauCell[][] = liveMatrix.map((row: number[], r: number) =>
        row.map((val: number, c: number): TableauCell => ({
          value: val, displayValue: formatCell(val),
          isPivotCol: phase === 'choose_leaving' && livePivotCol === c && r < m,
          isPivot: false, isPivotRow: false, isChanged: false,
          colType: c < liveColTypes.length ? liveColTypes[c] : 'rhs',
        }))
      );
      if (phase === 'choose_entering') {
        const zRow = rows[m];
        for (let c = 0; c < nCols - 1; c++) if (liveMatrix[m][c] < -1e-8) zRow[c] = { ...zRow[c], isPivotCol: true };
      }
      return {
        rows,
        basisVariables: liveBasis.map(bIdx => bIdx >= 0 && bIdx < liveVarNames.length ? liveVarNames[bIdx] : '?'),
        allVariables: [...liveVarNames, 'RHS'], colTypes: [...liveColTypes, 'rhs'],
        ratios: phase === 'choose_leaving' && livePivotCol !== null
          ? liveBasis.map((_, i) => { const e = liveMatrix[i][livePivotCol]; return e > 1e-8 ? liveMatrix[i][nCols - 1] / e : null; }).concat([null]) : undefined,
        rawMatrix: liveMatrix, rawBasis: liveBasis,
      } as Tableau;
    }
    return currentStep?.tableau ?? null;
  })();

  // ── Narrative for left panel ──────────────────────────────────────────────────

  const prevTableau = steps[currentStepIndex - 1]?.tableau;
  const stepType = currentStep?.stepType;
  const enteringVar = currentStep?.enteringVar;
  const leavingVar = currentStep?.leavingVar;
  const pivotRow = currentStep?.pivotRow ?? -1;
  const pivotCol = currentStep?.pivotCol ?? -1;
  const totalRows = displayTableau?.rows.length ?? 0;

  const narrative = (() => {
    if (!currentStep) return null;

    if (stepType === 'initial') return (
      <div className="space-y-2 text-xs text-gray-700">
        <p className="font-semibold text-gray-800">Standard Form Setup</p>
        <p>Slack variables have been added to convert each ≤ constraint into an equality. All original variables start at 0 (non-basic); slack variables form the initial basis.</p>
        <p className="text-gray-500">Use <span className="font-mono">→</span> to step through the simplex iterations.</p>
      </div>
    );

    if (stepType === 'select_pivot') {
      const tableau = displayTableau;
      const headers = tableau?.allVariables ?? [];
      const rhsIdx = headers.length - 1;
      const zVal = tableau ? tableau.rows[totalRows - 1][pivotCol]?.value : undefined;
      const pivotVal = tableau ? tableau.rows[pivotRow]?.[pivotCol]?.value : undefined;
      const rhs = tableau ? tableau.rows[pivotRow]?.[rhsIdx]?.value : undefined;
      const ratio = pivotVal && rhs !== undefined ? rhs / pivotVal : undefined;
      return (
        <div className="space-y-3 text-xs">
          <p className="font-semibold text-gray-800">Pivot Selection</p>
          {enteringVar && zVal !== undefined && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="font-medium text-blue-800 mb-1">Entering variable: {enteringVar}</p>
              <p className="text-blue-700">Z-row value = {fmt(zVal)} (most negative). Each unit of {enteringVar} added improves the objective by {fmt(Math.abs(zVal))}.</p>
            </div>
          )}
          {leavingVar && ratio !== undefined && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded">
              <p className="font-medium text-amber-800 mb-1">Leaving variable: {leavingVar}</p>
              <p className="text-amber-700">Min ratio = {rhs !== undefined ? fmt(rhs) : '?'} ÷ {pivotVal !== undefined ? fmt(pivotVal) : '?'} = {fmt(ratio)}. The smallest positive ratio determines which basic variable hits zero first — this keeps the solution feasible.</p>
            </div>
          )}
          {pivotRow >= 0 && pivotCol >= 0 && pivotVal !== undefined && (
            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
              <p className="font-medium text-gray-700">Pivot element</p>
              <p className="text-gray-600">Row {pivotRow + 1}, column {headers[pivotCol]} = {fmt(pivotVal)}. This cell will become 1 after row scaling.</p>
            </div>
          )}
        </div>
      );
    }

    if (stepType === 'after_pivot') {
      const activeRow = afterStep > 0 && afterStep <= totalRows ? afterStep - 1 : -1;
      const rowOps = currentStep.rowOperations ?? [];

      if (activeRow < 0) {
        const isAtEnd = afterStep === totalRows + 1;
        return (
          <div className="space-y-2 text-xs text-gray-700">
            <p className="font-semibold text-gray-800">{isAtEnd ? 'Pivot complete' : 'Before pivot'}</p>
            {isAtEnd
              ? <><p><span className="font-medium">{enteringVar}</span> entered the basis, <span className="font-medium">{leavingVar}</span> left.</p><p className="text-gray-500">Use ← to step back through each row operation.</p></>
              : <><p>About to apply pivot: <span className="font-medium">{enteringVar}</span> enters, <span className="font-medium">{leavingVar}</span> leaves.</p><p className="text-gray-500">Use → to step through each row operation one at a time.</p></>
            }
            {rowOps.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-gray-600 mb-1">All row operations:</p>
                <ol className="space-y-1">
                  {rowOps.map((op, i) => <li key={i} className="font-mono bg-gray-50 border border-gray-200 px-2 py-1 rounded">{op}</li>)}
                </ol>
              </div>
            )}
          </div>
        );
      }

      // Active row explanation
      const isZRow = activeRow === totalRows - 1;
      const op = rowOps[activeRow] ?? '';
      const beforeColVal = prevTableau?.rows[activeRow]?.[pivotCol]?.value ?? 0;
      const isPivotRowHere = activeRow === pivotRow;

      let title = ''; let why = ''; let color = 'bg-blue-50 border-blue-200 text-blue-900';
      if (isPivotRowHere) {
        const pv = prevTableau?.rows[activeRow]?.[pivotCol]?.value ?? 1;
        title = 'Scale the pivot row';
        why = `Divide every entry in this row by the pivot element (${fmt(pv)}) so the ${enteringVar} column becomes 1. All other rows use this scaled row to eliminate ${enteringVar}.`;
        color = 'bg-amber-50 border-amber-200 text-amber-900';
      } else if (isZRow) {
        if (Math.abs(beforeColVal) < 1e-9) {
          title = 'Z-row — no change'; why = `The objective coefficient for ${enteringVar} is already 0 — no update needed.`; color = 'bg-gray-50 border-gray-200 text-gray-600';
        } else {
          title = 'Update the objective (Z-row)';
          why = `The Z-row had ${fmt(beforeColVal)} in the ${enteringVar} column. Subtract ${fmt(beforeColVal)} × (scaled pivot row) to zero it out. This reflects that ${enteringVar} is now basic — its reduced cost becomes 0 and z updates.`;
          color = 'bg-purple-50 border-purple-200 text-purple-900';
        }
      } else if (Math.abs(beforeColVal) < 1e-9) {
        title = `Row ${activeRow + 1} — no change`;
        why = `This row's entry in the ${enteringVar} column is already 0 — nothing to eliminate.`;
        color = 'bg-gray-50 border-gray-200 text-gray-600';
      } else {
        title = `Eliminate ${enteringVar} from Row ${activeRow + 1}`;
        why = `Row ${activeRow + 1} has ${fmt(beforeColVal)} in the ${enteringVar} column. Subtract ${fmt(beforeColVal)} × (scaled pivot row) to zero it out. After the pivot, ${enteringVar} should only appear in the pivot row.`;
      }

      return (
        <div className="space-y-2 text-xs">
          <div className={`p-2 border rounded ${color}`}>
            <p className="font-semibold mb-1">{title}</p>
            {op && <p className="font-mono mb-1">{op}</p>}
            <p className="leading-relaxed">{why}</p>
          </div>
          <p className="text-gray-400">Step {afterStep}/{totalRows} — use ← → in the table to step through rows.</p>
        </div>
      );
    }

    if (stepType === 'optimal') {
      const tableau = displayTableau;
      const headers = tableau?.allVariables ?? [];
      const rhsIdx = headers.length - 1;
      const sol: Record<string, number> = {};
      tableau?.basisVariables.forEach((bv, i) => { sol[bv] = tableau.rows[i][rhsIdx]?.value ?? 0; });
      (headers.slice(0, -1)).forEach(v => { if (!(v in sol)) sol[v] = 0; });
      return (
        <div className="space-y-2 text-xs">
          <p className="font-semibold text-green-800">Optimal Solution Found</p>
          <p className="text-gray-600">All Z-row coefficients are non-negative — no further improvement is possible.</p>
          {currentStep.objectiveValue !== undefined && (
            <div className="p-2 bg-green-50 border border-green-300 rounded">
              <p className="font-bold text-green-800 text-sm">z* = {fmt(currentStep.objectiveValue)}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1 mt-2">
            {Object.entries(sol).map(([v, val]) => (
              <div key={v} className={`px-2 py-1 rounded border text-xs flex justify-between ${val !== 0 ? 'bg-green-100 border-green-300 font-semibold text-green-900' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                <span>{v}</span><span>{fmt(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <p className="text-xs text-gray-500">{currentStep.explanation}</p>;
  })();

  const [showSolver, setShowSolver] = useState(false);

  // If solver has been used, stay in solver view
  useEffect(() => { if (solverResponse) setShowSolver(true); }, [solverResponse]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-purple-700 to-blue-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
        <div className="cursor-pointer" onClick={() => setShowSolver(false)}>
          <h1 className="text-xl font-bold tracking-tight">Linear Programming Simulator</h1>
          <p className="text-xs text-purple-200 mt-0.5">Interactive Simplex Method Learning Tool</p>
        </div>
        {showSolver && (
          <Button
            onClick={() => navigate('/practice')}
            className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-5 py-2 text-sm rounded-lg shadow"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Practice Mode
          </Button>
        )}
      </div>

      {/* ── HERO: Practice Mode front and center ─────────────────────── */}
      {!showSolver && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-50 to-gray-100">
          {/* Practice Mode — the star */}
          <div
            onClick={() => navigate('/practice')}
            className="group cursor-pointer w-full max-w-2xl bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-10 shadow-2xl hover:shadow-3xl hover:scale-[1.02] transition-all duration-200 mb-8"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-white/20 rounded-xl p-3">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">Practice Mode</h2>
                <p className="text-indigo-200 text-lg mt-1">Learn by doing</p>
              </div>
            </div>
            <p className="text-white/90 text-base leading-relaxed mb-6">
              Work through real word problems step by step. Build formulations from scratch,
              identify constraints, choose pivot variables by clicking directly on the tableau,
              and get immediate feedback on your reasoning.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              {['Beginner', 'Intermediate', 'Advanced'].map(level => (
                <span key={level} className="bg-white/20 text-white text-sm px-3 py-1 rounded-full">
                  {level} problems
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-white font-semibold text-lg group-hover:gap-3 transition-all">
              Start Practicing <span className="text-2xl">→</span>
            </div>
          </div>

          {/* Secondary option */}
          <div
            onClick={() => setShowSolver(true)}
            className="cursor-pointer w-full max-w-2xl bg-white rounded-xl p-6 shadow-md hover:shadow-lg hover:scale-[1.01] transition-all border border-gray-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Free-form Solver</h3>
            </div>
            <p className="text-gray-500 text-sm">
              Enter any LP problem and explore the full simplex solution with interactive tableaus and graphs.
            </p>
          </div>
        </div>
      )}

      {/* ── Solver view (hidden until clicked) ────────────────────────── */}
      {showSolver && <>

      {/* ── Control bar ───────────────────────────────────────────────── */}
      <TopControlBar
        objectiveType={problem.objectiveType}
        onObjectiveTypeChange={t => setProblem(p => ({ ...p, objectiveType: t }))}
        objectiveCoefficients={problem.objectiveCoefficients}
        onObjectiveCoefficientsChange={coeffs => setProblem(p => ({ ...p, objectiveCoefficients: coeffs }))}
        variables={problem.variables}
        method={method} onMethodChange={setMethod}
        onSolve={handleSolve} onStepForward={stepForward} onStepBack={stepBack} onReset={reset}
        isInteractive={isInteractive} onInteractiveModeToggle={handleInteractiveModeToggle}
        showRatioTest={showRatioTest} onShowRatioTestToggle={() => setShowRatioTest(v => !v)}
        showObjectiveLine={showObjectiveLine} onShowObjectiveLineToggle={() => setShowObjectiveLine(v => !v)}
        canStepBack={canStepBack} canStepForward={canStepForward}
      />

      {/* Banners */}
      {isLoading && (
        <div className="flex items-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-1.5 text-xs text-blue-700 shrink-0">
          <Loader2 className="w-3 h-3 animate-spin" />Solving...
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-4 py-1.5 text-xs text-red-700 shrink-0">
          <AlertCircle className="w-3 h-3" />{error}
        </div>
      )}

      {/* ── Main: top half (tableau full width) | bottom half (left: info, right: graph) ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── TOP HALF: Tableau spans full width ─────────────────────── */}
        <div className="h-3/5 border-b border-gray-300 bg-white overflow-auto">
          {displayTableau ? (
            <TableauWorkspace
              tableau={displayTableau}
              previousTableau={prevTableau}
              currentStep={currentStep ?? undefined}
              showRatioTest={showRatioTest && !(isInteractive && interactiveState?.phase === 'choose_entering')}
              isInteractive={isInteractive}
              interactivePhase={interactiveState?.phase}
              onCellClick={handleCellClick}
              afterStep={afterStep}
              onAfterStepChange={setAfterStep}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-base font-medium">No problem solved yet</p>
                <p className="text-sm mt-1">Enter constraints below, then click Solve.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── BOTTOM HALF: left = constraints + narrative, right = graph ── */}
        <div className="h-2/5 flex overflow-hidden">

          {/* Bottom-left: constraints + narrative */}
          <div className="w-1/2 flex flex-col border-r border-gray-300 overflow-hidden">

            {/* Constraints */}
            <div className="shrink-0 border-b border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Constraints</p>
              <div className="space-y-2">
                {problem.constraints.map((c, ci) => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    {c.coefficients.map((coeff, vi) => (
                      <span key={vi} className="flex items-center gap-1">
                        <Input className="w-12 h-7 text-center text-sm px-1" value={coeff}
                          onChange={e => updateCoeff(ci, vi, e.target.value)} />
                        <span className="text-sm text-gray-500 font-medium">
                          {problem.variables[vi] ?? `x${vi + 1}`}{vi < c.coefficients.length - 1 ? ' +' : ''}
                        </span>
                      </span>
                    ))}
                    <Select value={c.operator} onValueChange={op => updateOp(ci, op as '<=' | '>=' | '=')}>
                      <SelectTrigger className="w-14 h-7 text-sm px-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<=">≤</SelectItem>
                        <SelectItem value=">=">≥</SelectItem>
                        <SelectItem value="=">=</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input className="w-12 h-7 text-center text-sm px-1" value={c.rhs}
                      onChange={e => updateRhs(ci, e.target.value)} />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-300 hover:text-red-500"
                      onClick={() => removeConstraint(ci)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full h-7 text-xs mt-3" onClick={addConstraint}>
                <Plus className="w-3 h-3 mr-1" />Add Constraint
              </Button>
              {/* Variable sign constraints (Chapter 4: negative / URS variables) */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Variable Sign Constraints</p>
                <div className="flex flex-wrap gap-2">
                  {problem.variables.map((v, vi) => (
                    <div key={vi} className="flex items-center gap-1">
                      <span className="text-xs font-medium text-gray-600">{v}:</span>
                      <Select
                        value={(problem.variableSigns ?? [])[vi] ?? 'nonneg'}
                        onValueChange={s => updateVariableSign(vi, s as VariableSign)}
                      >
                        <SelectTrigger className="w-28 h-6 text-xs px-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nonneg">≥ 0 (standard)</SelectItem>
                          <SelectItem value="nonpos">≤ 0 (negative)</SelectItem>
                          <SelectItem value="urs">unrestricted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Narrative / explanations */}
            <div className="flex-1 min-h-0 bg-white overflow-y-auto p-4">
              {narrative ? (
                <>
                  {narrative}
                  {cellExplanation && (
                    <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-900">
                      <div className="flex items-center gap-1 mb-1">
                        <Info className="w-3 h-3" /><span className="font-semibold">Cell</span>
                      </div>
                      <p className="leading-relaxed">{cellExplanation}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">Solve a problem to see step-by-step explanations here.</p>
              )}
            </div>
          </div>

          {/* Bottom-right: graph fills the quadrant */}
          <div className="w-1/2 bg-white overflow-hidden">
            <GraphView
              constraints={problem.constraints}
              cornerPoints={solverResponse?.cornerPoints ?? []}
              feasibleRegionPolygon={solverResponse?.feasibleRegionPolygon ?? []}
              simplexPath={currentSimplexPath}
              objectiveCoefficients={problem.objectiveCoefficients}
              showObjectiveLine={showObjectiveLine}
              currentPoint={currentPoint ?? undefined}
            />
          </div>
        </div>
      </div>

      {/* Step Timeline */}
      {steps.length > 0 && !isInteractive && (
        <StepTimeline currentStep={currentStepIndex} totalSteps={steps.length} onStepChange={jumpToStep} />
      )}

      </>}
    </div>
  );
}
