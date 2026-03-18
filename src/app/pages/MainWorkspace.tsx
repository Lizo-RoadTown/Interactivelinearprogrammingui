import { useState } from 'react';
import { useNavigate } from 'react-router';
import TopControlBar from '../components/TopControlBar';
import GraphView from '../components/GraphView';
import TableauWorkspace from '../components/TableauWorkspace';
import ExplanationConsole from '../components/ExplanationConsole';
import StepTimeline from '../components/StepTimeline';
import { Button } from '../components/ui/button';
import { ObjectiveType, Method, LPProblem, TableauCell, Tableau } from '../types';
import { useLPSolver } from '../hooks/useLPSolver';
import { BookOpen, Zap, AlertCircle, Loader2 } from 'lucide-react';

const DEFAULT_PROBLEM: LPProblem = {
  objectiveType: 'max',
  objectiveCoefficients: [3, 2],
  variables: ['x1', 'x2'],
  constraints: [
    { id: 'c1', coefficients: [2, 1], operator: '<=', rhs: 18, label: '2x1 + x2 <= 18' },
    { id: 'c2', coefficients: [2, 3], operator: '<=', rhs: 42, label: '2x1 + 3x2 <= 42' },
    { id: 'c3', coefficients: [3, 1], operator: '<=', rhs: 24, label: '3x1 + x2 <= 24' },
  ],
};

export default function MainWorkspace() {
  const navigate = useNavigate();
  const [problem, setProblem] = useState<LPProblem>(DEFAULT_PROBLEM);
  const [method, setMethod] = useState<Method>('simplex');
  const [isInteractive, setIsInteractive] = useState(false);
  const [showRatioTest, setShowRatioTest] = useState(true);
  const [showRowOperations, setShowRowOperations] = useState(true);
  const [showObjectiveLine, setShowObjectiveLine] = useState(true);

  const {
    solverResponse,
    steps,
    currentStep,
    currentStepIndex,
    canStepBack,
    canStepForward,
    isLoading,
    error,
    interactiveState,
    cellExplanation,
    currentSimplexPath,
    currentPoint,
    solve,
    stepForward,
    stepBack,
    jumpToStep,
    jumpToEnd,
    reset,
    enterInteractiveMode,
    exitInteractiveMode,
    handleInteractiveClick,
    explainCell,
  } = useLPSolver();

  const handleSolve = () => {
    solve(problem, method);
  };

  const handleObjectiveTypeChange = (type: ObjectiveType) => {
    setProblem(p => ({ ...p, objectiveType: type }));
  };

  const handleMethodChange = (m: Method) => {
    setMethod(m);
  };

  const handleInteractiveModeToggle = () => {
    if (!isInteractive) {
      if (!solverResponse) {
        solve(problem, method).then(() => {
          setIsInteractive(true);
          enterInteractiveMode();
        });
      } else {
        setIsInteractive(true);
        enterInteractiveMode();
      }
    } else {
      setIsInteractive(false);
      exitInteractiveMode();
    }
  };

  const handleCellClick = (row: number, col: number) => {
    if (!currentStep) return;
    if (isInteractive && interactiveState) {
      handleInteractiveClick(row, col, problem.objectiveType);
    } else {
      explainCell(row, col, currentStep, problem.objectiveType);
    }
  };

  // Build the tableau to display: interactive live state or current step
  const displayTableau = (() => {
    if (isInteractive && interactiveState && solverResponse) {
      // Build a display tableau from the live interactive matrix
      const { liveMatrix, liveBasis, liveVarNames, liveColTypes, livePivotCol, phase } = interactiveState;
      const m = liveBasis.length;
      const nCols = liveMatrix[0]?.length ?? 0;

      const rows: TableauCell[][] = liveMatrix.map((row: number[], r: number) =>
        row.map((val: number, c: number): TableauCell => ({
          value: val,
          displayValue: formatCell(val),
          isPivotCol: phase === 'choose_leaving' && livePivotCol === c && r < m,
          isPivot: false,
          isPivotRow: false,
          isChanged: false,
          colType: c < liveColTypes.length ? liveColTypes[c] : 'rhs',
        }))
      );

      // z-row highlighting: negative cells in choose_entering phase
      if (phase === 'choose_entering') {
        const zRow = rows[m];
        for (let c = 0; c < nCols - 1; c++) {
          if (liveMatrix[m][c] < -1e-8) {
            zRow[c] = { ...zRow[c], isPivotCol: true };
          }
        }
      }

      return {
        rows,
        basisVariables: liveBasis.map(bIdx =>
          bIdx >= 0 && bIdx < liveVarNames.length ? liveVarNames[bIdx] : '?'
        ),
        allVariables: [...liveVarNames, 'RHS'],
        colTypes: [...liveColTypes, 'rhs'],
        ratios: phase === 'choose_leaving' && livePivotCol !== null
          ? liveBasis.map((_, i) => {
              const elem = liveMatrix[i][livePivotCol];
              return elem > 1e-8 ? liveMatrix[i][nCols - 1] / elem : null;
            }).concat([null])
          : undefined,
        rawMatrix: liveMatrix,
        rawBasis: liveBasis,
      };
    }
    return currentStep?.tableau ?? null;
  })();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Linear Programming Simulator</h1>
          <p className="text-sm text-purple-100">Interactive Simplex Method Learning Tool</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/guided')}>
            <BookOpen className="w-4 h-4 mr-2" />
            Guided Mode
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/interactive')}>
            <Zap className="w-4 h-4 mr-2" />
            Interactive Mode
          </Button>
        </div>
      </div>

      {/* Control Bar */}
      <TopControlBar
        objectiveType={problem.objectiveType}
        onObjectiveTypeChange={handleObjectiveTypeChange}
        method={method}
        onMethodChange={handleMethodChange}
        onSolve={handleSolve}
        onStepForward={stepForward}
        onStepBack={stepBack}
        onReset={reset}
        isInteractive={isInteractive}
        onInteractiveModeToggle={handleInteractiveModeToggle}
        showRatioTest={showRatioTest}
        onShowRatioTestToggle={() => setShowRatioTest(v => !v)}
        showRowOperations={showRowOperations}
        onShowRowOperationsToggle={() => setShowRowOperations(v => !v)}
        showObjectiveLine={showObjectiveLine}
        onShowObjectiveLineToggle={() => setShowObjectiveLine(v => !v)}
        canStepBack={canStepBack}
        canStepForward={canStepForward}
      />

      {/* Loading / error banner */}
      {isLoading && (
        <div className="flex items-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          Solving...
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Graph */}
        <div className="w-1/3 overflow-auto">
          <GraphView
            constraints={problem.constraints}
            cornerPoints={solverResponse?.cornerPoints ?? []}
            feasibleRegionPolygon={solverResponse?.feasibleRegionPolygon ?? []}
            simplexPath={currentSimplexPath}
            objectiveCoefficients={problem.objectiveCoefficients}
            showObjectiveLine={showObjectiveLine}
            currentPoint={currentPoint ?? undefined}
            axisBounds={solverResponse?.axisBounds}
          />
        </div>

        {/* Center Panel — Tableau */}
        <div className="flex-1 overflow-auto">
          {displayTableau ? (
            <TableauWorkspace
              tableau={displayTableau}
              currentStep={currentStep ?? undefined}
              showRatioTest={showRatioTest && !(isInteractive && interactiveState?.phase === 'choose_entering')}
              isInteractive={isInteractive}
              interactivePhase={interactiveState?.phase}
              onCellClick={handleCellClick}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg font-medium">No problem solved yet</p>
                <p className="text-sm mt-1">Fill in the objective and constraints above, then click Solve.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel — Explanation */}
      <div className="h-72 border-t border-gray-300">
        {currentStep ? (
          <ExplanationConsole
            currentStep={currentStep}
            showRowOperations={showRowOperations}
            stepHistory={steps}
            cellExplanation={cellExplanation}
            isInteractive={isInteractive}
            interactivePhase={interactiveState?.phase}
            pivotCount={interactiveState?.pivotCount ?? 0}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Solve a problem to see step explanations here.
          </div>
        )}
      </div>

      {/* Step Timeline */}
      {steps.length > 0 && !isInteractive && (
        <StepTimeline
          currentStep={currentStepIndex}
          totalSteps={steps.length}
          onStepChange={jumpToStep}
        />
      )}
    </div>
  );
}

// Simple cell formatter matching the backend's _fmt_cell logic
function formatCell(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  const BIG_M = 1_000_000;
  const mCoeff = Math.round((v / BIG_M) * 1e8) / 1e8;
  if (Math.abs(Math.round(mCoeff)) >= 1 && Math.abs(v - Math.round(mCoeff) * BIG_M) < 0.5) {
    const k = Math.round(mCoeff);
    if (k === 1) return 'M';
    if (k === -1) return '-M';
    return `${k}M`;
  }
  if (Number.isInteger(Math.round(v * 1e4) / 1e4)) return String(Math.round(v));
  return v.toFixed(4).replace(/\.?0+$/, '');
}
