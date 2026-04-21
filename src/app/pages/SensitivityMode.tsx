/**
 * SensitivityMode.tsx — Chapter 8 sensitivity analysis tool.
 *
 * Functional, exam-prep oriented. Given an LP, run the six post-optimality
 * operations from Chapter 8 and display formula → substituted values →
 * result → conclusion.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LPProblem } from '../types';
import { useSensitivity, SensitivityOperation, SensitivityParams, SensitivityResponse } from '../hooks/useSensitivity';
import { useLPSolver } from '../hooks/useLPSolver';
import { ArrowLeft, Loader2, AlertCircle, BookOpen, Plus, Trash2, CheckCircle } from 'lucide-react';

// ── Default problem = Textbook Example 8.1 ────────────────────────────────────
// Min z = 4x1 + 6x2 − 6x3 − 5x4
//   x1 + x2 + x3          <= 50
//  2x1 + 3x2        + x4  <= 42
//              3x3  - x4  <= 250
const EXAMPLE_8_1: LPProblem = {
  objectiveType: 'min',
  objectiveCoefficients: [4, 6, -6, -5],
  variables: ['x1', 'x2', 'x3', 'x4'],
  variableSigns: ['nonneg', 'nonneg', 'nonneg', 'nonneg'],
  constraints: [
    { id: 'c1', coefficients: [1, 1, 1, 0], operator: '<=', rhs: 50 },
    { id: 'c2', coefficients: [2, 3, 0, 1], operator: '<=', rhs: 42 },
    { id: 'c3', coefficients: [0, 0, 3, -1], operator: '<=', rhs: 250 },
  ],
};

// ── Operation metadata ────────────────────────────────────────────────────────
const OPERATIONS: { key: SensitivityOperation; section: string; label: string; needsSolved: boolean }[] = [
  { key: 'matrix_form',       section: '§8.2',     label: 'View Matrix Form (B, B⁻¹, N, C_B, C_N)', needsSolved: true },
  { key: 'of_coeff_basic',    section: '§8.3.1',   label: 'Change OF coeff of a BASIC variable',    needsSolved: true },
  { key: 'of_coeff_nonbasic', section: '§8.3.2',   label: 'Change OF coeff of a NONBASIC variable', needsSolved: true },
  { key: 'rhs_range',         section: '§8.3.3',   label: 'Change RHS of a constraint',             needsSolved: true },
  { key: 'shadow_prices',     section: '§8.3.3.1', label: 'Shadow prices for all constraints',      needsSolved: true },
  { key: 'add_activity',      section: '§8.3.5',   label: 'Add a new activity (decision variable)', needsSolved: true },
  { key: 'add_constraint',    section: '§8.3.6',   label: 'Add a new constraint',                   needsSolved: true },
];

export default function SensitivityMode() {
  const navigate = useNavigate();
  const [problem, setProblem] = useState<LPProblem>(EXAMPLE_8_1);
  const [activeOp, setActiveOp] = useState<SensitivityOperation>('matrix_form');
  const [params, setParams] = useState<SensitivityParams>({});

  const { solverResponse, steps, currentStep, isLoading: solveLoading, error: solveError, solve } = useLPSolver();
  const { response, isLoading: sensLoading, error: sensError, run, clear } = useSensitivity();

  // Solve when problem changes (lightweight; backend is warm after first solve)
  useEffect(() => { void solve(problem, 'simplex'); }, [problem, solve]);

  const optimalStep = useMemo(() => steps.find(s => s.stepType === 'optimal'), [steps]);
  const optimalTab = optimalStep?.tableau;
  const basisNames = optimalTab?.basisVariables ?? [];
  const allVars = optimalTab?.allVariables ?? [];
  const nonbasicNames = useMemo(() => {
    if (!optimalTab) return [] as string[];
    // all_vars ends with 'RHS'; exclude it and the basis
    const vars = allVars.slice(0, -1);
    const basisSet = new Set(basisNames.map(s => s.toLowerCase()));
    return vars.filter(v => !basisSet.has(v.toLowerCase()));
  }, [optimalTab, allVars, basisNames]);

  const isSolved = !solveLoading && solverResponse?.status === 'optimal';

  // Clear previous result when switching operations
  useEffect(() => { clear(); setParams({}); }, [activeOp, clear]);

  // ── Constraint editing ────────────────────────────────────────────────────────
  const updateObjCoeff = (i: number, raw: string) => {
    const v = parseFloat(raw); if (isNaN(v)) return;
    setProblem(p => ({ ...p, objectiveCoefficients: p.objectiveCoefficients.map((c, j) => j === i ? v : c) }));
  };
  const updateConstraintCoeff = (ci: number, vi: number, raw: string) => {
    const v = parseFloat(raw); if (isNaN(v)) return;
    setProblem(p => ({
      ...p,
      constraints: p.constraints.map((c, i) =>
        i !== ci ? c : { ...c, coefficients: c.coefficients.map((val, j) => j === vi ? v : val) }),
    }));
  };
  const updateConstraintOp = (ci: number, op: '<=' | '>=' | '=') =>
    setProblem(p => ({
      ...p,
      constraints: p.constraints.map((c, i) => i === ci ? { ...c, operator: op } : c),
    }));
  const updateConstraintRhs = (ci: number, raw: string) => {
    const v = parseFloat(raw); if (isNaN(v)) return;
    setProblem(p => ({
      ...p,
      constraints: p.constraints.map((c, i) => i === ci ? { ...c, rhs: v } : c),
    }));
  };
  const addConstraint = () =>
    setProblem(p => ({
      ...p,
      constraints: [...p.constraints, {
        id: `c${Date.now()}`,
        coefficients: p.variables.map(() => 0),
        operator: '<=', rhs: 0,
      }],
    }));
  const removeConstraint = (ci: number) =>
    setProblem(p => ({ ...p, constraints: p.constraints.filter((_, i) => i !== ci) }));

  const handleCompute = () => {
    if (!isSolved) return;
    void run(problem, activeOp, params);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">

      {/* Header */}
      <div className="bg-slate-900/60 backdrop-blur border-b border-slate-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-slate-300 hover:bg-slate-800 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-1" />Home
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100">Chapter 8 — Sensitivity Analysis</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Post-optimality "what-if" analysis (matrix form, ranges, shadow prices)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0">

        {/* ─── LEFT: LP problem editor ─────────────────────────────────────── */}
        <div className="col-span-4 bg-slate-900 rounded-xl border border-slate-800 p-5 overflow-y-auto">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">LP Problem</h2>

          <div className="mb-3">
            <label className="text-[11px] text-slate-500 block mb-1.5 uppercase tracking-wide">Objective</label>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={problem.objectiveType} onValueChange={(t) => setProblem(p => ({ ...p, objectiveType: t as 'max' | 'min' }))}>
                <SelectTrigger className="w-20 h-8 text-sm bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  <SelectItem value="max">MAX</SelectItem>
                  <SelectItem value="min">MIN</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-400">z =</span>
              {problem.objectiveCoefficients.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <Input className="w-14 h-8 text-center text-sm bg-slate-800 border-slate-700 text-slate-100" value={c}
                    onChange={(e) => updateObjCoeff(i, e.target.value)} />
                  <span className="text-sm text-slate-300">{problem.variables[i]}{i < problem.objectiveCoefficients.length - 1 ? ' +' : ''}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="text-[11px] text-slate-500 block mb-1.5 uppercase tracking-wide">Constraints</label>
            <div className="space-y-2">
              {problem.constraints.map((c, ci) => (
                <div key={c.id} className="flex items-center gap-1 flex-wrap">
                  {c.coefficients.map((coeff, vi) => (
                    <span key={vi} className="flex items-center gap-1">
                      <Input className="w-12 h-7 text-center text-sm bg-slate-800 border-slate-700 text-slate-100" value={coeff}
                        onChange={(e) => updateConstraintCoeff(ci, vi, e.target.value)} />
                      <span className="text-xs text-slate-400">{problem.variables[vi]}{vi < c.coefficients.length - 1 ? '+' : ''}</span>
                    </span>
                  ))}
                  <Select value={c.operator} onValueChange={op => updateConstraintOp(ci, op as '<=' | '>=' | '=')}>
                    <SelectTrigger className="w-14 h-7 text-sm bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                      <SelectItem value="<=">≤</SelectItem>
                      <SelectItem value=">=">≥</SelectItem>
                      <SelectItem value="=">=</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="w-14 h-7 text-center text-sm bg-slate-800 border-slate-700 text-slate-100" value={c.rhs}
                    onChange={(e) => updateConstraintRhs(ci, e.target.value)} />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                    onClick={() => removeConstraint(ci)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full h-7 text-xs mt-2 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white" onClick={addConstraint}>
              <Plus className="w-3 h-3 mr-1" />Add Constraint
            </Button>
          </div>

          {/* Solve status */}
          <div className="mt-4 text-xs">
            {solveLoading && (
              <div className="flex items-center gap-2 text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-2">
                <Loader2 className="w-3 h-3 animate-spin" />Solving...
              </div>
            )}
            {solveError && (
              <div className="flex items-center gap-2 text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-3 h-3" />{solveError}
              </div>
            )}
            {isSolved && optimalStep && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center gap-1 text-emerald-300 font-semibold">
                  <CheckCircle className="w-3 h-3" /> Optimal
                </div>
                <div className="text-slate-300">z* = <span className="font-mono text-white">{solverResponse.optimalValue?.toFixed(4)}</span></div>
                <div className="text-slate-400">basis = [<span className="font-mono text-slate-300">{basisNames.join(', ')}</span>]</div>
                {solverResponse.optimalSolution && (
                  <div className="text-slate-400 font-mono">
                    {Object.entries(solverResponse.optimalSolution)
                      .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`).join(', ')}
                  </div>
                )}
              </div>
            )}
            {!solveLoading && !isSolved && !solveError && (
              <div className="text-slate-500">Problem not yet optimal — check your inputs.</div>
            )}
          </div>
        </div>

        {/* ─── MIDDLE: Operation picker + params ─────────────────────────── */}
        <div className="col-span-3 bg-slate-900 rounded-xl border border-slate-800 p-5 overflow-y-auto">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Operation</h2>
          <div className="space-y-1">
            {OPERATIONS.map(op => (
              <button
                key={op.key}
                onClick={() => setActiveOp(op.key)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                  activeOp === op.key
                    ? 'bg-fuchsia-500/10 border-fuchsia-500/40 text-fuchsia-200 font-medium shadow-sm shadow-fuchsia-500/20'
                    : 'bg-slate-800/50 border-slate-700 hover:border-fuchsia-500/30 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <span className={`font-mono text-[10px] mr-2 ${activeOp === op.key ? 'text-fuchsia-400' : 'text-slate-500'}`}>{op.section}</span>
                {op.label}
              </button>
            ))}
          </div>

          {/* Parameter inputs per operation */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Parameters</h3>
            <OperationParams
              operation={activeOp}
              params={params}
              onParamsChange={setParams}
              basisNames={basisNames}
              nonbasicNames={nonbasicNames}
              nConstraints={problem.constraints.length}
              nVariables={problem.variables.length}
            />
          </div>

          <Button className="w-full mt-4 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white border-0 shadow-lg shadow-fuchsia-500/20"
            onClick={handleCompute} disabled={!isSolved || sensLoading}>
            {sensLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Compute
          </Button>
        </div>

        {/* ─── RIGHT: Result ─────────────────────────────────────────────── */}
        <div className="col-span-5 bg-slate-900 rounded-xl border border-slate-800 p-5 overflow-y-auto">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Result</h2>
          {sensError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm text-rose-300">
              <div className="flex items-center gap-1 font-semibold mb-1">
                <AlertCircle className="w-4 h-4" /> Error
              </div>
              {sensError}
            </div>
          )}
          {!sensError && !response && (
            <div className="text-sm text-slate-500 italic">Pick an operation and click Compute.</div>
          )}
          {response && <ResultPanel response={response} />}
        </div>
      </div>
    </div>
  );
}


// ── Sub-component: parameter inputs ──────────────────────────────────────────
function OperationParams({
  operation, params, onParamsChange,
  basisNames, nonbasicNames, nConstraints, nVariables,
}: {
  operation: SensitivityOperation;
  params: SensitivityParams;
  onParamsChange: (p: SensitivityParams) => void;
  basisNames: string[];
  nonbasicNames: string[];
  nConstraints: number;
  nVariables: number;
}) {
  if (operation === 'matrix_form' || operation === 'shadow_prices') {
    return <p className="text-xs text-slate-500 italic">No parameters required.</p>;
  }

  if (operation === 'of_coeff_basic') {
    return (
      <div>
        <label className="text-xs text-slate-400 block mb-1">Basic variable</label>
        <Select value={params.variable ?? ''} onValueChange={(v) => onParamsChange({ ...params, variable: v })}>
          <SelectTrigger className="h-8 text-sm bg-slate-800 border-slate-700 text-slate-200"><SelectValue placeholder="select..." /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
            {basisNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (operation === 'of_coeff_nonbasic') {
    return (
      <div>
        <label className="text-xs text-slate-400 block mb-1">Nonbasic variable</label>
        <Select value={params.variable ?? ''} onValueChange={(v) => onParamsChange({ ...params, variable: v })}>
          <SelectTrigger className="h-8 text-sm bg-slate-800 border-slate-700 text-slate-200"><SelectValue placeholder="select..." /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
            {nonbasicNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (operation === 'rhs_range') {
    return (
      <div>
        <label className="text-xs text-slate-400 block mb-1">Constraint index (1-based)</label>
        <Select
          value={params.constraint_index !== undefined ? String(params.constraint_index + 1) : ''}
          onValueChange={(v) => onParamsChange({ ...params, constraint_index: parseInt(v, 10) - 1 })}
        >
          <SelectTrigger className="h-8 text-sm bg-slate-800 border-slate-700 text-slate-200"><SelectValue placeholder="select..." /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
            {Array.from({ length: nConstraints }, (_, i) => (
              <SelectItem key={i} value={String(i + 1)}>Constraint {i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (operation === 'add_activity') {
    const a = params.a_new ?? Array(nConstraints).fill(0);
    return (
      <div className="space-y-2">
        <div>
          <label className="text-xs text-slate-400 block mb-1">New column a_new (one entry per constraint)</label>
          <div className="flex flex-col gap-1">
            {a.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-16">Row {i + 1}</span>
                <Input
                  className="h-7 text-sm bg-slate-800 border-slate-700 text-slate-100"
                  value={v}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value);
                    const next = [...a]; next[i] = isNaN(num) ? 0 : num;
                    onParamsChange({ ...params, a_new: next });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">OF coefficient c_new</label>
          <Input
            className="h-7 text-sm bg-slate-800 border-slate-700 text-slate-100"
            value={params.c_new ?? 0}
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              onParamsChange({ ...params, c_new: isNaN(num) ? 0 : num });
            }}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Label (optional)</label>
          <Input
            className="h-7 text-sm bg-slate-800 border-slate-700 text-slate-100"
            value={params.var_label ?? ''}
            placeholder="x_new"
            onChange={(e) => onParamsChange({ ...params, var_label: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (operation === 'add_constraint') {
    const coefs = params.coefficients ?? Array(nVariables).fill(0);
    return (
      <div className="space-y-2">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Coefficients (one per decision var)</label>
          <div className="flex flex-col gap-1">
            {coefs.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-14">x{i + 1}</span>
                <Input
                  className="h-7 text-sm bg-slate-800 border-slate-700 text-slate-100"
                  value={v}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value);
                    const next = [...coefs]; next[i] = isNaN(num) ? 0 : num;
                    onParamsChange({ ...params, coefficients: next });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-slate-400 block mb-1">Operator</label>
            <Select
              value={params.operator ?? '<='}
              onValueChange={(v) => onParamsChange({ ...params, operator: v as '<=' | '>=' | '=' })}
            >
              <SelectTrigger className="h-7 text-sm bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                <SelectItem value="<=">≤</SelectItem>
                <SelectItem value=">=">≥</SelectItem>
                <SelectItem value="=">=</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-400 block mb-1">RHS</label>
            <Input
              className="h-7 text-sm bg-slate-800 border-slate-700 text-slate-100"
              value={params.rhs ?? 0}
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                onParamsChange({ ...params, rhs: isNaN(num) ? 0 : num });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}


// ── Sub-component: result display ────────────────────────────────────────────
function ResultPanel({ response }: { response: SensitivityResponse }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="p-3 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg">
        <div className="text-xs font-mono text-fuchsia-400 mb-1">{response.operation}</div>
        <div className="font-mono text-sm text-fuchsia-100">{response.formula}</div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Show your work</h3>
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1 whitespace-pre-wrap">
          {response.steps.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Result</h3>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-xs">
          <ResultValue result={response.result} />
        </div>
      </div>

      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-1">Conclusion</div>
        <div className="text-sm text-emerald-100">{response.conclusion}</div>
      </div>
    </div>
  );
}

function ResultValue({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      {Object.entries(result).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="font-semibold text-slate-400 min-w-[140px]">{k}:</span>
          <span className="font-mono text-slate-200 break-all">{formatValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/\.?0+$/, '');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    if (v.length > 0 && Array.isArray(v[0])) {
      return '\n' + (v as unknown[][]).map(row =>
        '  [' + row.map(formatValue).join(', ') + ']'
      ).join('\n');
    }
    return '[' + v.map(formatValue).join(', ') + ']';
  }
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}
