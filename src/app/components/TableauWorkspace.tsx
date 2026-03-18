import { Tableau, SimplexStep, InteractivePhase } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface TableauWorkspaceProps {
  tableau: Tableau;
  currentStep?: SimplexStep;
  finalStep?: SimplexStep;
  showRatioTest: boolean;
  onCellClick?: (row: number, col: number) => void;
  selectedCell?: { row: number; col: number };
  isInteractive?: boolean;
  interactivePhase?: InteractivePhase;
}

export default function TableauWorkspace({
  tableau,
  currentStep,
  finalStep,
  showRatioTest,
  onCellClick,
  selectedCell,
  isInteractive = false,
  interactivePhase,
}: TableauWorkspaceProps) {
  const headers = tableau.allVariables ?? [];

  // ── Shared helpers ──────────────────────────────────────────────────────────

  const formatNumber = (num: number): string => {
    if (Number.isInteger(num)) return num.toString();
    // Detect simple fractions via rounding
    const rounded = Math.round(num * 6) / 6;
    const denom = [2, 3, 4, 5, 6];
    for (const d of denom) {
      const n = Math.round(num * d);
      if (Math.abs(n / d - num) < 1e-9) return `${n}/${d}`;
    }
    return num.toFixed(3).replace(/\.?0+$/, '');
  };

  const getCellClassName = (row: number, col: number, forTab: 'current' | 'select' = 'current') => {
    const cell = tableau.rows[row][col];
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    let classes = 'px-4 py-3 text-center border border-gray-200 transition-all';

    if (isSelected) {
      classes += ' ring-2 ring-purple-500 bg-purple-50';
    } else if (forTab === 'select') {
      // Handled separately in Select Pivot tab
    } else if (cell.isPivot) {
      classes += ' bg-amber-400 font-bold text-white';
    } else if (cell.isPivotRow) {
      classes += ' bg-amber-100';
    } else if (cell.isPivotCol) {
      classes += ' bg-blue-100';
    } else if (cell.isChanged) {
      classes += ' bg-green-100 font-medium';
    }

    if (isInteractive && !isSelected) {
      classes += ' cursor-pointer hover:bg-purple-50';
    }

    return classes;
  };

  const getCellExplanation = (row: number, col: number) => {
    const cell = tableau.rows[row][col];
    if (cell.isPivot) return 'Pivot element: entering and leaving variable rows/cols intersect here. We divide this row by this value.';
    if (cell.isPivotRow) return 'Pivot row (leaving variable): this row is divided by the pivot element.';
    if (cell.isPivotCol) return 'Pivot column (entering variable): this column gets eliminated from all other rows.';
    if (cell.isChanged) return 'Changed in last pivot: this value was updated by row operations.';
    return 'Click to select as a potential pivot element (Interactive Mode).';
  };

  const TableBody = ({
    rows,
    basis,
    showRatios,
    getCellClass,
    getExpl,
  }: {
    rows: Tableau['rows'];
    basis: string[];
    showRatios: boolean;
    getCellClass: (r: number, c: number) => string;
    getExpl: (r: number, c: number) => string;
  }) => (
    <TooltipProvider>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="px-4 py-2 bg-gray-100 border border-gray-300 font-semibold">Basis</th>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2 bg-gray-100 border border-gray-300 font-semibold">{h}</th>
            ))}
            {showRatios && (
              <th className="px-4 py-2 bg-purple-100 border border-gray-300 font-semibold">Ratio</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, -1).map((row, rIdx) => (
            <tr key={rIdx}>
              <td className="px-4 py-3 bg-gray-50 border border-gray-300 font-medium text-center">
                {basis[rIdx]}
              </td>
              {row.map((cell, cIdx) => (
                <Tooltip key={cIdx}>
                  <TooltipTrigger asChild>
                    <td
                      className={getCellClass(rIdx, cIdx)}
                      onClick={() => isInteractive && onCellClick?.(rIdx, cIdx)}
                    >
                      {formatNumber(cell.value)}
                    </td>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">{getExpl(rIdx, cIdx)}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {showRatios && (
                <td className="px-4 py-3 bg-purple-50 border border-gray-300 text-center">
                  {tableau.ratios && tableau.ratios[rIdx] !== null
                    ? formatNumber(tableau.ratios[rIdx] as number)
                    : '—'}
                </td>
              )}
            </tr>
          ))}
          {/* Z-row */}
          <tr className="bg-blue-50">
            <td className="px-4 py-3 border border-gray-300 font-semibold text-center">Z</td>
            {rows[rows.length - 1].map((cell, cIdx) => (
              <td
                key={cIdx}
                className={`px-4 py-3 border border-gray-300 text-center font-medium ${cell.isChanged ? 'bg-green-100' : ''}`}
              >
                {formatNumber(cell.value)}
              </td>
            ))}
            {showRatios && <td className="px-4 py-3 bg-purple-50 border border-gray-300" />}
          </tr>
        </tbody>
      </table>
    </TooltipProvider>
  );

  // ── Select Pivot: compute candidate columns ─────────────────────────────────

  const zRow = tableau.rows[tableau.rows.length - 1];
  const rhsColIdx = headers.length - 1; // last column = RHS

  // Negative z-row entries (excluding RHS) = entering candidates
  const candidateCols = zRow
    .map((cell, idx) => ({ idx, val: cell.value }))
    .filter(({ idx, val }) => idx < rhsColIdx && val < -1e-9);

  const optimalEnteringCol =
    candidateCols.length > 0
      ? candidateCols.reduce((a, b) => (a.val < b.val ? a : b)).idx
      : -1;

  // Pivot col for ratio test (from currentStep or computed above)
  const pivotColForRatio = currentStep?.pivotCol ?? optimalEnteringCol;

  // Compute ratios for Select Pivot tab
  const computedRatios: (number | null)[] = tableau.rows.slice(0, -1).map((row) => {
    if (pivotColForRatio < 0) return null;
    const colVal = row[pivotColForRatio].value;
    const rhs = row[rhsColIdx].value;
    return colVal > 1e-9 ? rhs / colVal : null;
  });

  const minRatio = computedRatios.reduce<number | null>((m, r) => {
    if (r === null) return m;
    return m === null || r < m ? r : m;
  }, null);

  const pivotRowForSelect =
    minRatio !== null
      ? computedRatios.findIndex((r) => r !== null && Math.abs(r - minRatio) < 1e-9)
      : -1;

  const getSelectCellClass = (rIdx: number, cIdx: number) => {
    const isPivotCell = rIdx === pivotRowForSelect && cIdx === pivotColForRatio;
    const isPivotRow = rIdx === pivotRowForSelect;
    const isOptEntering = cIdx === optimalEnteringCol;
    const isCandidate = candidateCols.some((c) => c.idx === cIdx);

    let cls = 'px-4 py-3 text-center border border-gray-200 transition-all text-sm';

    if (isPivotCell && pivotColForRatio >= 0) {
      cls += ' bg-amber-400 font-bold text-white ring-2 ring-amber-600';
    } else if (isPivotRow && pivotColForRatio >= 0) {
      cls += ' bg-amber-100';
    } else if (isOptEntering) {
      cls += ' bg-blue-200 font-semibold';
    } else if (isCandidate) {
      cls += ' bg-blue-50';
    }

    return cls;
  };

  const getSelectZRowClass = (cIdx: number) => {
    const val = zRow[cIdx].value;
    const isOptEntering = cIdx === optimalEnteringCol;
    const isCandidate = candidateCols.some((c) => c.idx === cIdx);

    let cls = 'px-4 py-3 border border-gray-300 text-center font-medium ';
    if (cIdx === rhsColIdx) return cls + 'bg-blue-50';
    if (isOptEntering) return cls + 'bg-blue-400 text-white font-bold ring-2 ring-blue-600';
    if (isCandidate) return cls + 'bg-blue-200 font-semibold';
    if (val > 1e-9) return cls + 'bg-green-50 text-green-700';
    return cls + 'bg-blue-50';
  };

  // ── After Pivot row operations ──────────────────────────────────────────────

  const rowOps = currentStep?.rowOperations ?? [];

  // ── Final tab ──────────────────────────────────────────────────────────────

  const finalTableau = finalStep?.tableau;
  const optSolution = finalStep
    ? (() => {
        // Extract solution: basis variables get their RHS values, others = 0
        const sol: Record<string, number> = {};
        finalTableau?.basisVariables.forEach((bv, i) => {
          const rhsCell = finalTableau.rows[i][rhsColIdx];
          sol[bv] = rhsCell?.value ?? 0;
        });
        (finalTableau?.allVariables ?? []).slice(0, -1).forEach((v) => {
          if (!(v in sol)) sol[v] = 0;
        });
        return sol;
      })()
    : null;

  return (
    <div className="h-full bg-white p-4 flex flex-col overflow-auto">
      <div className="mb-3">
        <h3 className="font-semibold text-gray-800">Simplex Tableau</h3>
        <p className="text-xs text-gray-500">
          {isInteractive
            ? `Interactive — ${interactivePhase === 'choose_entering' ? 'click a z-row cell to choose entering variable' : interactivePhase === 'choose_leaving' ? 'click a body cell in the highlighted column to choose leaving variable' : 'optimal reached'}`
            : currentStep
            ? `Step ${currentStep.iteration} · ${currentStep.stepType.replace('_', ' ')}`
            : 'Step through iterations'}
        </p>
      </div>

      <Tabs defaultValue="current" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="select-pivot">Select Pivot</TabsTrigger>
          <TabsTrigger value="after-pivot">After Pivot</TabsTrigger>
          <TabsTrigger value="final">Final</TabsTrigger>
        </TabsList>

        {/* ── CURRENT ─────────────────────────────────────────────────────── */}
        <TabsContent value="current" className="mt-4 flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <TableBody
              rows={tableau.rows}
              basis={tableau.basisVariables}
              showRatios={showRatioTest}
              getCellClass={(r, c) => getCellClassName(r, c)}
              getExpl={getCellExplanation}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2"><div className="w-5 h-5 bg-amber-400 border border-gray-300" /><span>Pivot Element</span></div>
            <div className="flex items-center gap-2"><div className="w-5 h-5 bg-amber-100 border border-gray-300" /><span>Pivot Row</span></div>
            <div className="flex items-center gap-2"><div className="w-5 h-5 bg-blue-100 border border-gray-300" /><span>Pivot Column</span></div>
            <div className="flex items-center gap-2"><div className="w-5 h-5 bg-green-100 border border-gray-300" /><span>Changed</span></div>
          </div>
        </TabsContent>

        {/* ── SELECT PIVOT ─────────────────────────────────────────────────── */}
        <TabsContent value="select-pivot" className="mt-4 flex-1 overflow-auto">
          <div className="mb-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-900 space-y-1">
            <p className="font-semibold">How to choose the pivot:</p>
            <p>1. <span className="font-medium">Entering variable</span>: look at the Z-row. Pick the most negative value — highlighted in dark blue. Negative means we can still improve the objective.</p>
            <p>2. <span className="font-medium">Leaving variable</span>: divide RHS by the positive entries in the entering column (ratio test). The row with the <em>smallest positive ratio</em> leaves — highlighted in amber. This keeps the solution feasible.</p>
            <p>3. The cell where they intersect is the <span className="font-semibold">pivot element</span> (amber + ring).</p>
          </div>

          {candidateCols.length === 0 ? (
            <div className="text-center py-6 text-green-700 font-medium">
              All Z-row coefficients are non-negative — this tableau is already optimal!
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <TooltipProvider>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 bg-gray-100 border border-gray-300 font-semibold">Basis</th>
                        {headers.map((h, i) => (
                          <th
                            key={i}
                            className={`px-4 py-2 border border-gray-300 font-semibold ${
                              i === optimalEnteringCol
                                ? 'bg-blue-400 text-white'
                                : candidateCols.some((c) => c.idx === i)
                                ? 'bg-blue-100'
                                : 'bg-gray-100'
                            }`}
                          >
                            {h}
                            {i === optimalEnteringCol && (
                              <span className="block text-xs font-normal">← entering</span>
                            )}
                          </th>
                        ))}
                        <th className="px-4 py-2 bg-purple-100 border border-gray-300 font-semibold">
                          Ratio (RHS ÷ col)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableau.rows.slice(0, -1).map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td
                            className={`px-4 py-3 border border-gray-300 font-medium text-center ${
                              rIdx === pivotRowForSelect ? 'bg-amber-200' : 'bg-gray-50'
                            }`}
                          >
                            {tableau.basisVariables[rIdx]}
                            {rIdx === pivotRowForSelect && (
                              <span className="block text-xs font-normal text-amber-700">← leaving</span>
                            )}
                          </td>
                          {row.map((cell, cIdx) => (
                            <Tooltip key={cIdx}>
                              <TooltipTrigger asChild>
                                <td className={getSelectCellClass(rIdx, cIdx)}>
                                  {formatNumber(cell.value)}
                                </td>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs text-xs">
                                  {rIdx === pivotRowForSelect && cIdx === pivotColForRatio
                                    ? `Pivot element: ${formatNumber(cell.value)}. This row gets divided by this value.`
                                    : cIdx === pivotColForRatio && cell.value > 1e-9
                                    ? `Positive entry in pivot column → ratio = ${formatNumber(row[rhsColIdx].value)} ÷ ${formatNumber(cell.value)} = ${formatNumber(row[rhsColIdx].value / cell.value)}`
                                    : cIdx === pivotColForRatio && cell.value <= 1e-9
                                    ? 'Non-positive entry: cannot be pivot row (would make solution infeasible).'
                                    : `Row ${rIdx + 1}, Col ${cIdx + 1}: ${formatNumber(cell.value)}`}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                          <td className="px-4 py-3 border border-gray-300 text-center bg-purple-50">
                            {computedRatios[rIdx] !== null ? (
                              <span className={rIdx === pivotRowForSelect ? 'font-bold text-amber-700' : ''}>
                                {formatNumber(computedRatios[rIdx] as number)}
                                {rIdx === pivotRowForSelect && ' ← min'}
                              </span>
                            ) : (
                              <span className="text-gray-400">— (≤0, skip)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {/* Z-row */}
                      <tr>
                        <td className="px-4 py-3 border border-gray-300 font-semibold text-center bg-blue-50">Z</td>
                        {zRow.map((cell, cIdx) => (
                          <Tooltip key={cIdx}>
                            <TooltipTrigger asChild>
                              <td className={getSelectZRowClass(cIdx)}>
                                {formatNumber(cell.value)}
                              </td>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">
                                {cIdx === rhsColIdx
                                  ? `Current objective value: ${formatNumber(cell.value)}`
                                  : cell.value < -1e-9
                                  ? `Reduced cost = ${formatNumber(cell.value)} — negative means ${headers[cIdx]} can improve the objective. ${cIdx === optimalEnteringCol ? 'Most negative → optimal choice for entering variable.' : ''}`
                                  : cell.value > 1e-9
                                  ? `Reduced cost = ${formatNumber(cell.value)} — non-negative, ${headers[cIdx]} is not a candidate.`
                                  : `Reduced cost = 0, ${headers[cIdx]} is at optimality in this direction.`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        <td className="px-4 py-3 border border-gray-300 bg-purple-50" />
                      </tr>
                    </tbody>
                  </table>
                </TooltipProvider>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-blue-400 border border-gray-300" /><span>Optimal entering variable (most negative Z-row)</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-blue-100 border border-gray-300" /><span>Other candidates (negative Z-row)</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-amber-400 border border-gray-300" /><span>Pivot element</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-amber-100 border border-gray-300" /><span>Leaving variable row (min ratio)</span></div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── AFTER PIVOT ─────────────────────────────────────────────────── */}
        <TabsContent value="after-pivot" className="mt-4 flex-1 overflow-auto">
          {rowOps.length === 0 && currentStep?.stepType !== 'after_pivot' ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Navigate to an iteration step to see the row operations performed.
            </div>
          ) : (
            <>
              {currentStep?.enteringVar && currentStep?.leavingVar && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <p className="font-semibold mb-1">Pivot Summary</p>
                  <p><span className="font-medium">Entering:</span> {currentStep.enteringVar} (was non-basic, becomes basic)</p>
                  <p><span className="font-medium">Leaving:</span> {currentStep.leavingVar} (was basic, becomes non-basic → 0)</p>
                  <p className="mt-1 text-amber-700">
                    Goal: make the pivot column look like a unit vector — 1 in the pivot row, 0 everywhere else.
                  </p>
                </div>
              )}

              {rowOps.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Row Operations Performed:</p>
                  <ol className="space-y-1">
                    {rowOps.map((op, i) => (
                      <li key={i} className="text-xs font-mono text-gray-800 bg-white px-3 py-1.5 rounded border border-gray-200">
                        {op}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mb-2 text-xs text-gray-500">
                Result tableau — green cells changed from previous step:
              </div>
              <div className="overflow-x-auto">
                <TableBody
                  rows={tableau.rows}
                  basis={tableau.basisVariables}
                  showRatios={false}
                  getCellClass={(r, c) => {
                    const cell = tableau.rows[r][c];
                    let cls = 'px-4 py-3 text-center border border-gray-200 text-sm';
                    if (cell.isPivot) cls += ' bg-amber-400 font-bold text-white';
                    else if (cell.isPivotRow) cls += ' bg-amber-50';
                    else if (cell.isPivotCol) cls += ' bg-blue-50';
                    else if (cell.isChanged) cls += ' bg-green-200 font-semibold';
                    return cls;
                  }}
                  getExpl={(r, c) => {
                    const cell = tableau.rows[r][c];
                    if (cell.isPivot) return 'This was the pivot element (now = 1 after row scaling).';
                    if (cell.isChanged) return 'This value changed due to row elimination.';
                    return 'Unchanged from previous tableau.';
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-green-200 border border-gray-300" /><span>Changed by row operations</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-amber-400 border border-gray-300" /><span>Pivot element (now = 1)</span></div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── FINAL ────────────────────────────────────────────────────────── */}
        <TabsContent value="final" className="mt-4 flex-1 overflow-auto">
          {!finalTableau ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              The optimal solution has not been reached yet. Keep stepping forward.
            </div>
          ) : (
            <>
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-900">
                <p className="font-semibold mb-1">Optimal Solution Reached</p>
                <p>All Z-row coefficients are non-negative — no further improvement is possible.</p>
                {finalStep?.objectiveValue !== undefined && (
                  <p className="mt-1 font-bold text-green-800 text-sm">
                    Objective Value: {formatNumber(finalStep.objectiveValue)}
                  </p>
                )}
              </div>

              {optSolution && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {Object.entries(optSolution).map(([varName, val]) => (
                    <div
                      key={varName}
                      className={`px-3 py-2 rounded border text-sm flex justify-between ${
                        val !== 0
                          ? 'bg-green-100 border-green-300 font-semibold text-green-900'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <span>{varName}</span>
                      <span>{formatNumber(val)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-2 text-xs text-gray-500">Optimal tableau:</div>
              <div className="overflow-x-auto">
                {(() => {
                  const fVars = finalTableau.allVariables ?? finalTableau.basisVariables.map((_, i) => `col${i}`).concat(['RHS']);
                  const fRhs = fVars.length - 1;
                  return (
                <TooltipProvider>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 bg-gray-100 border border-gray-300 font-semibold">Basis</th>
                        {fVars.map((h, i) => (
                          <th key={i} className="px-4 py-2 bg-gray-100 border border-gray-300 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {finalTableau.rows.slice(0, -1).map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="px-4 py-3 bg-green-50 border border-gray-300 font-medium text-center">
                            {finalTableau.basisVariables[rIdx]}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`px-4 py-3 border border-gray-200 text-center ${
                                cIdx === fRhs
                                  ? 'bg-green-100 font-semibold text-green-900'
                                  : Math.abs(cell.value) < 1e-9
                                  ? 'text-gray-400'
                                  : ''
                              }`}
                            >
                              {formatNumber(cell.value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* Z-row */}
                      <tr className="bg-blue-50">
                        <td className="px-4 py-3 border border-gray-300 font-semibold text-center">Z</td>
                        {finalTableau.rows[finalTableau.rows.length - 1].map((cell, cIdx) => (
                          <Tooltip key={cIdx}>
                            <TooltipTrigger asChild>
                              <td
                                className={`px-4 py-3 border border-gray-300 text-center font-medium ${
                                  cIdx === fRhs
                                    ? 'bg-blue-200 font-bold text-blue-900'
                                    : cell.value > 1e-9
                                    ? 'text-green-700'
                                    : Math.abs(cell.value) < 1e-9
                                    ? 'text-gray-400'
                                    : 'text-red-600'
                                }`}
                              >
                                {formatNumber(cell.value)}
                              </td>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">
                                {cIdx === fRhs
                                  ? `Optimal objective value: ${formatNumber(cell.value)}`
                                  : cell.value > 1e-9
                                  ? `Reduced cost ${formatNumber(cell.value)} ≥ 0: this variable stays non-basic.`
                                  : Math.abs(cell.value) < 1e-9
                                  ? 'Reduced cost = 0: this variable is basic (in the optimal basis).'
                                  : `Warning: negative reduced cost ${formatNumber(cell.value)} — may indicate degeneracy.`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </TooltipProvider>
                  );
                })()}
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-green-100 border border-green-300" /><span>Solution value (RHS of basis row)</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-blue-200 border border-blue-300" /><span>Optimal objective value</span></div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
