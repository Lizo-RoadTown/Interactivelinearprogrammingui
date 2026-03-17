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
import { ObjectiveType, Method } from '../types';
import { sampleProblem, allSteps, cornerPoints, simplexPath, step1 } from '../data/sampleProblem';
import { ArrowLeft, Lightbulb, Target, AlertTriangle } from 'lucide-react';

export default function GuidedMode() {
  const navigate = useNavigate();
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>('max');
  const [method, setMethod] = useState<Method>('simplex');
  const [currentStepIndex, setCurrentStepIndex] = useState(1); // Start at pivot selection step
  const [isInteractive, setIsInteractive] = useState(false);
  const [showRatioTest, setShowRatioTest] = useState(true);
  const [showRowOperations, setShowRowOperations] = useState(true);
  const [showObjectiveLine, setShowObjectiveLine] = useState(true);

  const currentStep = allSteps[currentStepIndex];
  const currentPoint = simplexPath[Math.min(currentStepIndex, simplexPath.length - 1)];

  const handleSolve = () => {
    setCurrentStepIndex(allSteps.length - 1);
  };

  const handleStepForward = () => {
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleStepBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between">
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
            <h1 className="text-2xl font-bold">Guided Learning Mode</h1>
            <p className="text-sm text-blue-100">Step-by-step simplex method tutorial</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          Lesson 1: Pivot Selection
        </Badge>
      </div>

      {/* Control Bar */}
      <TopControlBar
        objectiveType={objectiveType}
        onObjectiveTypeChange={setObjectiveType}
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
        showRowOperations={showRowOperations}
        onShowRowOperationsToggle={() => setShowRowOperations(!showRowOperations)}
        showObjectiveLine={showObjectiveLine}
        onShowObjectiveLineToggle={() => setShowObjectiveLine(!showObjectiveLine)}
        canStepBack={currentStepIndex > 0}
        canStepForward={currentStepIndex < allSteps.length - 1}
      />

      {/* Main Workspace with Guidance Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Guidance Panel - Left */}
        <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-auto">
          <div className="space-y-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Current Task
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-medium mb-2">Select the Entering Variable</p>
                <p className="text-gray-700">
                  Look at the Z-row (bottom row) and find the most negative coefficient.
                  This indicates which variable should enter the basis.
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Hints
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="p-2 bg-white rounded border border-amber-200">
                  <p className="font-medium text-amber-900">Entering Variable Rule:</p>
                  <p className="text-xs text-gray-700 mt-1">
                    Choose the column with the most negative value in the Z-row.
                    In this case, look for -3 or -2.
                  </p>
                </div>
                <div className="p-2 bg-white rounded border border-amber-200">
                  <p className="font-medium text-amber-900">Ratio Test:</p>
                  <p className="text-xs text-gray-700 mt-1">
                    Divide each RHS value by the corresponding positive entry in the entering column.
                    The smallest ratio determines the leaving variable.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Step-by-Step Guide</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Identify entering variable</p>
                    <p className="text-gray-600">Most negative in Z-row</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Perform ratio test</p>
                    <p className="text-gray-600">RHS ÷ entering column</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-400 text-white flex items-center justify-center flex-shrink-0 font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Select pivot element</p>
                    <p className="text-gray-600">Minimum ratio row</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center flex-shrink-0 font-bold">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Perform pivot operation</p>
                    <p className="text-gray-600">Row operations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quiz Question</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="font-medium">What is the entering variable in this iteration?</p>
                <div className="space-y-1">
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    A) x₂ (coefficient: -2)
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs bg-green-100 border-green-400">
                    B) x₁ (coefficient: -3) ✓
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    C) s₁ (coefficient: 0)
                  </Button>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  ✓ Correct! x₁ has the most negative coefficient (-3).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Graph and Tableau - Center and Right */}
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
                isInteractive={false}
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
