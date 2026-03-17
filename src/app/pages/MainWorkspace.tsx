import { useState } from 'react';
import { useNavigate } from 'react-router';
import TopControlBar from '../components/TopControlBar';
import GraphView from '../components/GraphView';
import TableauWorkspace from '../components/TableauWorkspace';
import ExplanationConsole from '../components/ExplanationConsole';
import StepTimeline from '../components/StepTimeline';
import { Button } from '../components/ui/button';
import { ObjectiveType, Method } from '../types';
import { sampleProblem, allSteps, cornerPoints, simplexPath } from '../data/sampleProblem';
import { BookOpen, Zap } from 'lucide-react';

export default function MainWorkspace() {
  const navigate = useNavigate();
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>('max');
  const [method, setMethod] = useState<Method>('simplex');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
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
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Linear Programming Simulator</h1>
          <p className="text-sm text-purple-100">Interactive Simplex Method Learning Tool</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/guided')}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Guided Mode
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/interactive')}
          >
            <Zap className="w-4 h-4 mr-2" />
            Interactive Mode
          </Button>
        </div>
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

      {/* Main Workspace - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Graph */}
        <div className="w-1/3 overflow-auto">
          <GraphView
            constraints={sampleProblem.constraints}
            cornerPoints={cornerPoints}
            simplexPath={simplexPath.slice(0, currentStepIndex + 1)}
            objectiveCoefficients={sampleProblem.objectiveCoefficients}
            showObjectiveLine={showObjectiveLine}
            currentPoint={currentPoint}
          />
        </div>

        {/* Center Panel - Tableau */}
        <div className="flex-1 overflow-auto">
          <TableauWorkspace
            tableau={currentStep.tableau}
            showRatioTest={showRatioTest}
            isInteractive={isInteractive}
          />
        </div>
      </div>

      {/* Bottom Panel - Explanation */}
      <div className="h-72 border-t border-gray-300">
        <ExplanationConsole
          currentStep={currentStep}
          showRowOperations={showRowOperations}
          stepHistory={allSteps}
        />
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
