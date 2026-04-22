import { useState } from 'react';
import { useNavigate } from 'react-router';
import TopControlBar from '../components/TopControlBar';
import GraphView from '../components/GraphView';
import TableauWorkspace from '../components/TableauWorkspace';
import ExplanationConsole from '../components/ExplanationConsole';
import StepTimeline from '../components/StepTimeline';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ObjectiveType, Method } from '../types';
import { sampleProblem, allSteps, cornerPoints, simplexPath } from '../data/sampleProblem';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Sparkles } from 'lucide-react';

export default function InteractiveMode() {
  const navigate = useNavigate();
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>('max');
  const [method, setMethod] = useState<Method>('simplex');
  const [currentStepIndex, setCurrentStepIndex] = useState(1);
  const [isInteractive, setIsInteractive] = useState(true);
  const [showRatioTest, setShowRatioTest] = useState(true);
  const [showRowOperations, setShowRowOperations] = useState(true);
  const [showObjectiveLine, setShowObjectiveLine] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | undefined>();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const currentStep = allSteps[currentStepIndex];
  const currentPoint = simplexPath[Math.min(currentStepIndex, simplexPath.length - 1)];

  // Expected pivot for the current step
  const expectedPivot = { row: 2, col: 0 }; // For step 1

  const handleSolve = () => {
    setCurrentStepIndex(allSteps.length - 1);
  };

  const handleStepForward = () => {
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setSelectedCell(undefined);
      setFeedback(null);
      setShowPreview(false);
    }
  };

  const handleStepBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setSelectedCell(undefined);
      setFeedback(null);
      setShowPreview(false);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    setSelectedCell(undefined);
    setFeedback(null);
    setShowPreview(false);
  };

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
    setShowPreview(false);
    
    // Validate selection
    if (row === expectedPivot.row && col === expectedPivot.col) {
      setFeedback({
        type: 'success',
        message: `Excellent! You've selected the correct pivot element. This is at the intersection of the entering variable (x₁) and the leaving variable (s₃). The ratio test confirms this is the optimal choice with a ratio of 8.`
      });
    } else if (col === expectedPivot.col && row !== expectedPivot.row) {
      setFeedback({
        type: 'warning',
        message: `Good start! You've correctly identified that x₁ should enter the basis (most negative Z-row coefficient). However, this is not the correct row. Try using the ratio test: divide the RHS by the corresponding entry in the x₁ column for each row and select the minimum positive ratio.`
      });
    } else if (col !== expectedPivot.col) {
      setFeedback({
        type: 'error',
        message: `This isn't the optimal entering variable. For maximization, we need to select the column with the most negative coefficient in the Z-row. Look for the largest negative value: x₁ has -3 while x₂ has -2.`
      });
    }
  };

  const handlePreview = () => {
    setShowPreview(!showPreview);
  };

  const handleConfirmPivot = () => {
    if (selectedCell?.row === expectedPivot.row && selectedCell?.col === expectedPivot.col) {
      handleStepForward();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Interactive Practice Mode</h1>
            <p className="text-sm text-purple-100">Make your own pivot choices and learn from mistakes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-4 py-2">
            <Sparkles className="w-4 h-4 mr-2" />
            Practice Problem 1
          </Badge>
        </div>
      </div>

      {/* Control Bar */}
      <TopControlBar
        objectiveType={objectiveType}
        onObjectiveTypeChange={setObjectiveType}
        objectiveCoefficients={sampleProblem.objectiveCoefficients}
        onObjectiveCoefficientsChange={() => {}}
        variables={sampleProblem.variables}
        method={method}
        onMethodChange={setMethod}
        onSolve={handleSolve}
        onStepForward={handleStepForward}
        onStepBack={handleStepBack}
        onReset={handleReset}
        isInteractive={isInteractive}
        onInteractiveModeToggle={() => setIsInteractive(!isInteractive)}
        showRatioTest={showRatioTest}
        onShowRatioTestToggle={() => setShowRatioTest(!showRatioTest)}
        showObjectiveLine={showObjectiveLine}
        onShowObjectiveLineToggle={() => setShowObjectiveLine(!showObjectiveLine)}
        canStepBack={currentStepIndex > 0}
        canStepForward={currentStepIndex < allSteps.length - 1}
      />

      {/* Feedback Alert */}
      {feedback && (
        <div className="px-4 pt-3">
          <Alert
            variant={feedback.type === 'error' ? 'destructive' : 'default'}
            className={
              feedback.type === 'success'
                ? 'bg-green-50 border-green-300 text-green-900'
                : feedback.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : ''
            }
          >
            {feedback.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
            {feedback.type === 'error' && <XCircle className="h-4 w-4" />}
            {feedback.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
            <AlertDescription className="ml-2">{feedback.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Interactive Instructions - Left */}
        <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-auto">
          <div className="space-y-4">
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Your Task
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-medium mb-2">Select the Pivot Element</p>
                <p className="text-gray-700 mb-3">
                  Choose the pivot element in the tableau.
                  The system will provide feedback on your choice.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-purple-600 rounded"></div>
                    <span>Selected cell</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-amber-400 rounded"></div>
                    <span>Correct pivot (after validation)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedCell && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Selection Info</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Row:</span>
                    <span>{selectedCell.row + 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Column:</span>
                    <span>{selectedCell.col + 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Value:</span>
                    <span className="font-mono">
                      {currentStep.tableau.rows[selectedCell.row][selectedCell.col].value}
                    </span>
                  </div>
                  <div className="pt-2 space-y-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={handlePreview}
                    >
                      {showPreview ? 'Hide Preview' : 'Preview Result'}
                    </Button>
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={handleConfirmPivot}
                      disabled={!(selectedCell.row === expectedPivot.row && selectedCell.col === expectedPivot.col)}
                    >
                      Confirm & Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pivot Selection Rules</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <div>
                  <p className="font-medium text-purple-700 mb-1">1. Entering Variable (Column)</p>
                  <p className="text-gray-600">
                    Choose column with most negative coefficient in Z-row (for maximization)
                  </p>
                </div>
                <div>
                  <p className="font-medium text-purple-700 mb-1">2. Leaving Variable (Row)</p>
                  <p className="text-gray-600">
                    Use ratio test: RHS ÷ positive entering column value. Choose minimum ratio.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-purple-700 mb-1">3. Pivot Element</p>
                  <p className="text-gray-600">
                    Located at intersection of entering column and leaving row.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Common Mistakes</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Choosing wrong column</p>
                    <p className="text-gray-600">Not selecting most negative Z-row value</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Skipping ratio test</p>
                    <p className="text-gray-600">Forgetting to divide by entering column</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Using negative ratios</p>
                    <p className="text-gray-600">Only positive ratios are valid</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <p className="text-xs text-gray-700">
                💡 <strong>Pro tip:</strong> Enable "Show Ratio Test" to see calculated ratios for each row.
              </p>
            </div>
          </div>
        </div>

        {/* Graph and Tableau */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Graph */}
            <div className="w-1/2 overflow-auto">
              <GraphView
                constraints={sampleProblem.constraints}
                cornerPoints={cornerPoints}
                simplexPath={simplexPath.slice(0, currentStepIndex + 1)}
                objectiveCoefficients={sampleProblem.objectiveCoefficients}
                showObjectiveLine={showObjectiveLine}
                currentPoint={currentPoint}
              />
            </div>

            {/* Tableau */}
            <div className="flex-1 overflow-auto">
              <TableauWorkspace
                tableau={currentStep.tableau}
                showRatioTest={showRatioTest}
                onCellClick={handleCellClick}
                selectedCell={selectedCell}
                isInteractive={true}
              />
            </div>
          </div>

          {/* Explanation */}
          <div className="h-64 border-t border-gray-300">
            <ExplanationConsole
              currentStep={currentStep}
              showRowOperations={showRowOperations}
              stepHistory={allSteps}
            />
          </div>
        </div>
      </div>

      {/* Step Timeline */}
      <StepTimeline
        currentStep={currentStepIndex}
        totalSteps={allSteps.length}
        onStepChange={setCurrentStepIndex}
      />
    </div>
  );
}
