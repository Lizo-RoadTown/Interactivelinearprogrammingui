import { SimplexStep, InteractivePhase } from '../types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, Info, TrendingUp } from 'lucide-react';

interface ExplanationConsoleProps {
  currentStep: SimplexStep;
  showRowOperations: boolean;
  stepHistory?: SimplexStep[];
  cellExplanation?: string;
  isInteractive?: boolean;
  interactivePhase?: InteractivePhase;
  pivotCount?: number;
}

export default function ExplanationConsole({
  currentStep,
  showRowOperations,
  stepHistory = [],
  cellExplanation,
  isInteractive = false,
  interactivePhase,
  pivotCount = 0,
}: ExplanationConsoleProps) {
  const isOptimal = currentStep.explanation.includes('OPTIMAL');
  const isInitial = currentStep.iteration === 0;

  return (
    <div className="h-full bg-card border-t border-border p-4 flex">
      {/* Main explanation area */}
      <div className="flex-1 pr-4 border-r border-border">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Step Explanation</h3>
          <Badge variant={isOptimal ? 'default' : 'secondary'}>
            Iteration {currentStep.iteration}
          </Badge>
        </div>

        <ScrollArea className="h-48">
          <div className="space-y-3">
            {/* Cell interrogation result (shown when a cell has been clicked) */}
            {cellExplanation && (
              <div className="p-3 bg-primary/10 border border-primary/30 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-semibold text-primary">
                    {isInteractive ? 'Interactive' : 'Cell Explanation'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-primary whitespace-pre-line">{cellExplanation}</p>
              </div>
            )}

            {/* Current step explanation */}
            <div className="flex gap-3">
              <div className="mt-1">
                {isOptimal ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : isInitial ? (
                  <Info className="w-5 h-5 text-accent" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm leading-relaxed">{currentStep.explanation}</p>

                {currentStep.pivotRow !== undefined && currentStep.pivotCol !== undefined && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                    <strong>Pivot:</strong> {currentStep.enteringVar ?? `Col ${currentStep.pivotCol + 1}`} enters,{' '}
                    {currentStep.leavingVar ?? `Row ${currentStep.pivotRow + 1}`} leaves
                  </div>
                )}
              </div>
            </div>

            {/* Row operations */}
            {showRowOperations && currentStep.rowOperations && currentStep.rowOperations.length > 0 && (
              <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-accent" />
                  <h4 className="font-medium text-sm">Row Operations</h4>
                </div>
                <div className="space-y-1">
                  {currentStep.rowOperations.map((op, idx) => (
                    <div key={idx} className="text-xs font-mono bg-card p-2 rounded border border-accent/20">
                      {op}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Objective value */}
            <div className="mt-3 p-2 bg-primary/10 border border-primary/30 rounded">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Current Objective Value:</span>
                <span className="text-lg font-bold text-primary">
                  z = {currentStep.objectiveValue}
                </span>
              </div>
            </div>

            {/* Optimal solution details */}
            {isOptimal && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-medium text-sm text-emerald-200">Optimal Solution Found</h4>
                </div>
                <div className="text-xs space-y-1">
                  <p>✓ All coefficients in Z-row are non-negative</p>
                  <p>✓ Current solution is optimal</p>
                  <p>✓ No further improvement possible</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Step history timeline */}
      <div className="w-64 pl-4">
        <h3 className="font-semibold mb-3">Step History</h3>
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {stepHistory.map((step, idx) => {
              const isCurrent = step.iteration === currentStep.iteration;
              
              return (
                <div
                  key={idx}
                  className={`p-2 rounded border transition-all ${
                    isCurrent
                      ? 'bg-primary/20 border-primary/60 border-2'
                      : 'bg-muted/40 border-border hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      Iteration {step.iteration}
                    </span>
                    {step.explanation.includes('OPTIMAL') && (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    z = {step.objectiveValue}
                  </div>
                  {step.pivotRow !== undefined && (
                    <div className="text-xs text-amber-600 mt-1">
                      Pivot: R{step.pivotRow + 1}, C{step.pivotCol! + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Key indicators */}
        <div className="mt-4 space-y-2 text-xs">
          <div className="p-2 bg-accent/10 rounded">
            <div className="font-medium mb-1">Learning Points</div>
            <ul className="space-y-1 text-foreground">
              <li>• Watch how z increases</li>
              <li>• Follow the simplex path</li>
              <li>• Understand ratio test</li>
              <li>• Track basis changes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
