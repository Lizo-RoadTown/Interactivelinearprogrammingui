import { useState, useEffect } from 'react';
import { Tableau, SimplexStep, InteractivePhase } from '../types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/button';
import { GuidedTableauProps } from '../hooks/useGuidedSimplex';

interface TableauWorkspaceProps {
  tableau: Tableau;
  previousTableau?: Tableau;
  currentStep?: SimplexStep;
  showRatioTest: boolean;
  onCellClick?: (row: number, col: number) => void;
  selectedCell?: { row: number; col: number };
  isInteractive?: boolean;
  interactivePhase?: InteractivePhase;
  /**
   * When true, suppress all pivot-selection highlighting (optimal entering
   * column, candidate columns, min-ratio annotation).
   */
  hideSelectionHints?: boolean;
  /**
   * Guided simplex interaction state — drives Z-row emphasis, column highlight,
   * dimmed rows, cell coloring, click gating, and ratio display.
   */
  guidedPhase?: GuidedTableauProps;
  // Controlled afterStep (lifted to parent so narrative can use it)
  afterStep?: number;
  onAfterStepChange?: (step: number) => void;
}

export default function TableauWorkspace({
  tableau,
  previousTableau,
  currentStep,
  showRatioTest,
  onCellClick,
  selectedCell,
  isInteractive = false,
  interactivePhase,
  hideSelectionHints = false,
  guidedPhase,
  afterStep: afterStepProp,
  onAfterStepChange,
}: TableauWorkspaceProps) {
  const headers = tableau.allVariables ?? [];
  const totalRows = tableau.rows.length;
  const rhsColIdx = headers.length - 1;
  const zRowIdx = totalRows - 1;

  // Controlled or uncontrolled afterStep
  const [localAfterStep, setLocalAfterStep] = useState(0);
  const afterStep = afterStepProp ?? localAfterStep;
  const setAfterStep = (s: number) => {
    setLocalAfterStep(s);
    onAfterStepChange?.(s);
  };
  useEffect(() => { setAfterStep(0); }, [currentStep?.iteration]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const fmt = (num: number): string => {
    if (Number.isInteger(num)) return num.toString();
    const denom = [2, 3, 4, 5, 6];
    for (const d of denom) {
      const n = Math.round(num * d);
      if (Math.abs(n / d - num) < 1e-9) return `${n}/${d}`;
    }
    return num.toFixed(3).replace(/\.?0+$/, '');
  };

  // ── Pivot selection helpers ───────────────────────────────────────────────────

  const zRow = tableau.rows[totalRows - 1];
  const candidateCols = zRow
    .map((cell, idx) => ({ idx, val: cell.value }))
    .filter(({ idx, val }) => idx < rhsColIdx && val < -1e-9);
  const optEnteringCol = candidateCols.length > 0
    ? candidateCols.reduce((a, b) => a.val < b.val ? a : b).idx : -1;
  const pivotColForRatio = currentStep?.pivotCol ?? optEnteringCol;
  const computedRatios: (number | null)[] = tableau.rows.slice(0, -1).map(row => {
    if (pivotColForRatio < 0) return null;
    const colVal = row[pivotColForRatio].value;
    const rhs = row[rhsColIdx].value;
    return colVal > 1e-9 ? rhs / colVal : null;
  });
  const minRatio = computedRatios.reduce<number | null>((m, r) =>
    r === null ? m : m === null || r < m ? r : m, null);
  const pivotRowForSelect = minRatio !== null
    ? computedRatios.findIndex(r => r !== null && Math.abs(r - minRatio) < 1e-9) : -1;

  const stepType = currentStep?.stepType;
  const pivotRow = currentStep?.pivotRow ?? -1;
  const pivotCol = currentStep?.pivotCol ?? -1;

  // ── Guided phase helpers ──────────────────────────────────────────────────────

  const gp = guidedPhase;

  /** Get cell state from guided phase */
  const getGuidedCellState = (rIdx: number, cIdx: number): string | undefined => {
    if (!gp) return undefined;
    return gp.cellStates[`${rIdx},${cIdx}`];
  };

  /** Check if a cell is clickable in guided mode */
  const isGuidedClickable = (rIdx: number, cIdx: number, isZRow: boolean): boolean => {
    if (!gp) return false;
    if (gp.clickableRegion === 'zrow') {
      return isZRow && cIdx !== rhsColIdx;
    }
    if (gp.clickableRegion === 'pivotcol') {
      return !isZRow && cIdx === gp.highlightedCol && !gp.dimmedRows.includes(rIdx);
    }
    return false;
  };

  /** Check if a row is dimmed in guided mode */
  const isGuidedDimmed = (rIdx: number): boolean => {
    if (!gp) return false;
    return gp.dimmedRows.includes(rIdx);
  };

  // ── Shared table renderer ────────────────────────────────────────────────────

  const renderTable = ({
    rows, basis, getCellClass, getTooltip, showRatios, ratios, ratioMinRow,
  }: {
    rows: Tableau['rows'];
    basis: string[];
    getCellClass: (rIdx: number, cIdx: number, isZRow: boolean) => string;
    getTooltip?: (rIdx: number, cIdx: number) => string;
    showRatios?: boolean;
    ratios?: (number | null)[];
    ratioMinRow?: number;
  }) => (
    <TooltipProvider>
      <table className="w-full border-collapse text-base">
        <thead>
          <tr>
            <th className="px-4 py-3 bg-gray-100 border border-gray-300 font-semibold text-sm">Basis</th>
            {headers.map((h, i) => {
              let thCls = 'px-4 py-3 border border-gray-300 font-semibold text-sm ';
              if (gp?.highlightedCol === i) thCls += 'bg-blue-200 text-blue-900 ';
              else if (gp?.rhsEmphasis && i === rhsColIdx) thCls += 'bg-purple-100 ';
              else if (i === pivotColForRatio && showRatios && !gp) thCls += 'bg-blue-100 ';
              else thCls += 'bg-gray-100 ';
              return <th key={i} className={thCls}>{h}</th>;
            })}
            {showRatios && <th className="px-4 py-3 bg-purple-100 border border-gray-300 font-semibold text-sm">Ratio</th>}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, -1).map((row, rIdx) => {
            const dimmed = isGuidedDimmed(rIdx);
            return (
              <tr key={rIdx} className={dimmed ? 'opacity-30' : ''}>
                <td className="px-4 py-3 bg-gray-50 border border-gray-300 font-medium text-center text-sm">
                  {basis[rIdx]}
                </td>
                {row.map((cell, cIdx) => (
                  <Tooltip key={cIdx}>
                    <TooltipTrigger asChild>
                      <td
                        data-row={rIdx}
                        data-col={cIdx}
                        className={getCellClass(rIdx, cIdx, false)}
                        onClick={() => onCellClick?.(rIdx, cIdx)}
                      >
                        {fmt(cell.value)}
                      </td>
                    </TooltipTrigger>
                    {getTooltip && (
                      <TooltipContent><p className="max-w-xs text-xs">{getTooltip(rIdx, cIdx)}</p></TooltipContent>
                    )}
                  </Tooltip>
                ))}
                {showRatios && (
                  <td className="px-4 py-3 bg-purple-50 border border-gray-300 text-center text-sm">
                    {ratios?.[rIdx] != null ? (
                      <span className={ratioMinRow === rIdx ? 'font-bold text-green-700' : ''}>
                        {fmt(ratios[rIdx] as number)}{ratioMinRow === rIdx ? ' ← min' : ''}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                )}
              </tr>
            );
          })}
          {/* Z-row */}
          <tr className={gp?.zRowEmphasis
            ? 'border-t-4 border-indigo-400 bg-indigo-50'
            : 'bg-blue-50'
          }>
            <td className={`px-4 py-3 border border-gray-300 font-semibold text-center text-sm ${
              gp?.zRowEmphasis ? 'bg-indigo-100 text-indigo-800' : ''
            }`}>
              {gp?.zRowEmphasis ? (
                <span>Z<span className="block text-xs font-normal text-indigo-600 leading-tight">objective</span></span>
              ) : 'Z'}
            </td>
            {rows[rows.length - 1].map((cell, cIdx) => (
              <td
                key={cIdx}
                data-row={zRowIdx}
                data-col={cIdx}
                className={getCellClass(rows.length - 1, cIdx, true)}
                onClick={() => onCellClick?.(rows.length - 1, cIdx)}
              >
                {fmt(cell.value)}
              </td>
            ))}
            {showRatios && <td className="px-4 py-3 bg-purple-50 border border-gray-300" />}
          </tr>
        </tbody>
      </table>
    </TooltipProvider>
  );

  // ── GUIDED TABLE (used when guidedPhase is active) ────────────────────────────

  const renderGuidedTable = () => {
    const guidedRatios = gp!.showRatios ? gp!.ratios : undefined;
    return renderTable({
      rows: tableau.rows,
      basis: tableau.basisVariables,
      showRatios: gp!.showRatios,
      ratios: guidedRatios,
      ratioMinRow: gp!.minRatioRow,
      getCellClass: (rIdx, cIdx, isZRow) => {
        const cellState = getGuidedCellState(rIdx, cIdx);
        const clickable = isGuidedClickable(rIdx, cIdx, isZRow);
        const inHighlightedCol = gp!.highlightedCol !== null && cIdx === gp!.highlightedCol;
        const isRhs = cIdx === rhsColIdx;
        const cellVal = tableau.rows[rIdx][cIdx].value;

        let cls = 'px-4 py-3 text-center border transition-all text-sm ';

        // Cell state overrides (correct/invalid/suboptimal from attempts)
        if (cellState === 'correct') {
          cls += 'bg-green-200 ring-2 ring-green-500 font-bold text-green-900 border-green-400 ';
          return cls;
        }
        if (cellState === 'invalid') {
          cls += 'bg-red-100 text-red-400 border-red-200 ';
          return cls;
        }
        if (cellState === 'suboptimal') {
          cls += 'bg-amber-200 ring-2 ring-amber-400 font-bold text-amber-900 border-amber-300 ';
          return cls;
        }

        // Column highlight (blue) for entering column
        if (inHighlightedCol && !isZRow && !isRhs) {
          cls += 'bg-blue-100 border-blue-200 ';
          if (clickable) cls += 'cursor-pointer hover:bg-blue-200 hover:ring-2 hover:ring-blue-400 ';
          return cls;
        }

        // RHS emphasis
        if (gp!.rhsEmphasis && isRhs && !isZRow) {
          cls += 'bg-purple-50 font-medium border-gray-200 ';
          return cls;
        }

        // Z-row cells
        if (isZRow) {
          if (isRhs) {
            cls += 'font-semibold border-gray-300 ';
            cls += gp!.zRowEmphasis ? 'bg-indigo-100 text-indigo-800 ' : 'bg-blue-50 ';
          } else if (gp!.zRowEmphasis) {
            // In attention phase: neutral coloring, no hints about negative/positive
            cls += 'bg-indigo-50 border-indigo-200 ';
            if (clickable) cls += 'cursor-pointer hover:bg-indigo-100 hover:ring-2 hover:ring-indigo-400 font-medium ';
          } else {
            cls += 'bg-blue-50 border-gray-200 ';
          }
          return cls;
        }

        // Normal constraint cells
        cls += 'border-gray-200 ';
        return cls;
      },
    });
  };

  // ── STANDARD TABLE (initial / select_pivot) ──────────────────────────────────

  const renderStandardTable = () => {
    const isInitial = !stepType || stepType === 'initial';
    const showHints = !isInitial && !hideSelectionHints;
    return renderTable({
      rows: tableau.rows,
      basis: tableau.basisVariables,
      showRatios: showRatioTest && showHints,
      ratios: computedRatios,
      ratioMinRow: !hideSelectionHints ? pivotRowForSelect : -1,
      getCellClass: (rIdx, cIdx, isZRow) => {
        const cell = tableau.rows[rIdx][cIdx];
        const isPivotCell = rIdx === pivotRow && cIdx === pivotCol;
        const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx;
        let cls = 'px-4 py-3 text-center border transition-all text-sm ';
        if (isSelected) cls += 'ring-2 ring-purple-500 bg-purple-50 border-gray-200';
        else if (isPivotCell && showHints) cls += 'bg-amber-400 font-bold text-white border-amber-500';
        else if (showHints && rIdx === pivotRow) cls += 'bg-amber-100 border-gray-200';
        else if (showHints && cIdx === pivotCol && !isZRow) cls += 'bg-blue-100 border-gray-200';
        else if (isZRow && showHints) {
          if (cIdx === rhsColIdx) cls += 'bg-blue-100 font-semibold border-gray-300';
          else if (cIdx === optEnteringCol) cls += 'bg-blue-400 text-white font-bold border-blue-500';
          else if (candidateCols.some(c => c.idx === cIdx)) cls += 'bg-blue-200 font-semibold border-gray-200';
          else if (cell.value > 1e-9) cls += 'bg-green-50 text-green-700 border-gray-200';
          else cls += 'bg-blue-50 border-gray-200';
        } else if (isZRow) {
          if (cIdx === rhsColIdx) cls += 'bg-blue-50 font-semibold border-gray-300';
          else cls += 'bg-blue-50 border-gray-200';
        } else cls += 'border-gray-200';
        if (isInteractive && !isSelected) cls += ' cursor-pointer hover:bg-purple-50';
        return cls;
      },
    });
  };

  // ── AFTER PIVOT stepper table ─────────────────────────────────────────────────

  const renderAfterPivotTable = () => {
    const hasPrev = !!previousTableau;
    const activeRow = afterStep > 0 && afterStep <= totalRows ? afterStep - 1 : -1;
    const isAtStart = afterStep === 0;
    const isAtEnd = afterStep === totalRows + 1;

    const getRowValues = (rIdx: number) => {
      if (!hasPrev || isAtEnd || afterStep > rIdx) return tableau.rows[rIdx];
      return previousTableau!.rows[rIdx] ?? tableau.rows[rIdx];
    };

    return (
      <>
        {/* Compact navigator */}
        <div className="flex items-center gap-1.5 mb-2">
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setAfterStep(0)} disabled={isAtStart}>
            <SkipBack className="w-3 h-3 mr-1" />Before
          </Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setAfterStep(Math.max(0, afterStep - 1))} disabled={isAtStart}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <span className="flex-1 text-center text-sm text-gray-500">
            {isAtStart ? 'Before pivot' : isAtEnd ? 'After pivot' : `Row op ${afterStep}/${totalRows}`}
          </span>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setAfterStep(Math.min(totalRows + 1, afterStep + 1))} disabled={isAtEnd}>
            <ChevronRight className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setAfterStep(totalRows + 1)} disabled={isAtEnd}>
            After<SkipForward className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {/* Progress dots */}
        <div className="flex items-center gap-1 mb-3">
          {Array.from({ length: totalRows + 2 }).map((_, i) => (
            <button key={i} onClick={() => setAfterStep(i)}
              className={`rounded-full transition-all ${i === afterStep ? 'w-3 h-3 bg-blue-500' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'}`} />
          ))}
        </div>

        {/* Table with partial transformation */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr>
                <th className="px-4 py-3 bg-gray-100 border border-gray-300 font-semibold text-sm">Basis</th>
                {headers.map((h, i) => (
                  <th key={i} className={`px-4 py-3 border border-gray-300 font-semibold text-sm ${i === pivotCol && pivotCol >= 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableau.rows.map((_, rIdx) => {
                const isZRow = rIdx === totalRows - 1;
                const basisLabel = isZRow ? 'Z' : tableau.basisVariables[rIdx];
                const isActive = rIdx === activeRow;
                const isDone = !isAtStart && afterStep > rIdx;
                const isBefore = isAtStart || (!isAtEnd && afterStep <= rIdx && !isActive);
                const displayRow = getRowValues(rIdx);
                return (
                  <tr key={rIdx} className={isActive ? 'ring-2 ring-inset ring-blue-400' : isZRow ? 'bg-blue-50' : ''}>
                    <td className={`px-4 py-3 border border-gray-300 font-medium text-center text-sm ${
                      isActive ? 'font-bold bg-blue-50' : isDone ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {basisLabel}
                      {isActive && <span className="block text-blue-600 font-normal text-xs">← now</span>}
                      {isDone && !isAtEnd && <span className="block text-green-600 font-normal text-xs">✓</span>}
                    </td>
                    {displayRow.map((cell, cIdx) => {
                      const afterVal = tableau.rows[rIdx][cIdx].value;
                      const beforeVal = previousTableau?.rows[rIdx]?.[cIdx]?.value ?? afterVal;
                      const isPivotCell = rIdx === pivotRow && cIdx === pivotCol;
                      const changed = Math.abs(afterVal - beforeVal) > 1e-9;
                      let cls = 'px-4 py-3 text-center border text-sm ';
                      if (isPivotCell && !isBefore) cls += 'bg-amber-400 font-bold text-white border-amber-500';
                      else if (isActive) cls += changed ? 'bg-green-100 font-semibold text-green-900 border-green-300' : 'border-gray-200 text-gray-400';
                      else if (isDone) cls += changed ? 'bg-green-50 text-green-800 border-gray-200' : 'text-gray-400 border-gray-200';
                      else cls += 'text-gray-400 border-gray-200 italic';
                      return (
                        <td key={cIdx} className={cls}>
                          {isActive && changed && hasPrev
                            ? <><span className="line-through text-gray-400 mr-1">{fmt(beforeVal)}</span><span className="text-green-700 font-bold">{fmt(afterVal)}</span></>
                            : fmt(cell.value)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-400" /> active</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-50 border border-green-300" /> done</span>
          <span className="italic">italic</span><span>= before</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-amber-400" /> pivot</span>
        </div>
      </>
    );
  };

  // ── OPTIMAL table ─────────────────────────────────────────────────────────────

  const renderOptimalTable = () => renderTable({
    rows: tableau.rows,
    basis: tableau.basisVariables,
    getCellClass: (rIdx, cIdx, isZRow) => {
      const val = tableau.rows[rIdx][cIdx].value;
      let cls = 'px-4 py-3 text-center border text-sm ';
      if (isZRow && cIdx === rhsColIdx) cls += 'bg-blue-200 font-bold text-blue-900 border-blue-300';
      else if (!isZRow && cIdx === rhsColIdx) cls += 'bg-green-100 font-semibold text-green-900 border-gray-200';
      else if (isZRow) cls += val > 1e-9 ? 'text-green-700 border-gray-200 bg-blue-50' : Math.abs(val) < 1e-9 ? 'text-gray-400 border-gray-200 bg-blue-50' : 'text-red-600 border-gray-200 bg-blue-50';
      else cls += Math.abs(val) < 1e-9 ? 'text-gray-300 border-gray-200' : 'border-gray-200';
      return cls;
    },
  });

  // ── INTERACTIVE table ─────────────────────────────────────────────────────────

  const renderInteractiveTable = () => {
    const phase = interactivePhase;
    return renderTable({
      rows: tableau.rows,
      basis: tableau.basisVariables,
      showRatios: phase === 'choose_leaving' && showRatioTest,
      ratios: computedRatios,
      getCellClass: (rIdx, cIdx, isZRow) => {
        const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx;
        let cls = 'px-4 py-3 text-center border text-sm cursor-pointer ';
        if (isSelected) cls += 'ring-2 ring-purple-500 bg-purple-50 border-gray-200';
        else if (phase === 'choose_entering' && isZRow && cIdx < rhsColIdx && tableau.rows[rIdx][cIdx].value < -1e-9)
          cls += cIdx === optEnteringCol ? 'bg-blue-400 text-white font-bold border-blue-500 hover:bg-blue-500' : 'bg-blue-100 font-semibold border-gray-200 hover:bg-blue-200';
        else if (phase === 'choose_leaving' && !isZRow && cIdx === pivotColForRatio)
          cls += 'bg-amber-100 border-amber-300 hover:bg-amber-200';
        else cls += 'border-gray-200 hover:bg-purple-50';
        return cls;
      },
    });
  };

  // ── Step label ────────────────────────────────────────────────────────────────

  const stepLabel =
    isInteractive ? `Interactive — ${interactivePhase === 'choose_entering' ? 'choose entering variable' : interactivePhase === 'choose_leaving' ? 'choose leaving variable' : 'optimal'}`
    : guidedPhase ? 'Guided Practice'
    : stepType === 'initial' ? 'Initial Tableau'
    : stepType === 'select_pivot' ? `Iteration ${currentStep?.iteration} · Pivot Selection`
    : stepType === 'after_pivot' ? `Iteration ${currentStep?.iteration} · After Pivot`
    : stepType === 'optimal' ? 'Optimal Solution'
    : stepType === 'infeasible' ? 'Infeasible' : stepType === 'unbounded' ? 'Unbounded' : 'Tableau';

  const tableContent =
    guidedPhase ? renderGuidedTable()
    : isInteractive ? renderInteractiveTable()
    : stepType === 'after_pivot' ? renderAfterPivotTable()
    : stepType === 'optimal' ? renderOptimalTable()
    : renderStandardTable();

  return (
    <div className="h-full bg-white p-4 overflow-auto">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{stepLabel}</p>
      {tableContent}
    </div>
  );
}
