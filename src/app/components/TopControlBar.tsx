import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { ChevronLeft, ChevronRight, Play, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { ObjectiveType, Method } from '../types';

interface TopControlBarProps {
  objectiveType: ObjectiveType;
  onObjectiveTypeChange: (type: ObjectiveType) => void;
  objectiveCoefficients: number[];
  onObjectiveCoefficientsChange: (coeffs: number[]) => void;
  variables: string[];
  method: Method;
  onMethodChange: (method: Method) => void;
  onSolve: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onReset: () => void;
  isInteractive: boolean;
  onInteractiveModeToggle: () => void;
  showRatioTest: boolean;
  onShowRatioTestToggle: () => void;
  showObjectiveLine: boolean;
  onShowObjectiveLineToggle: () => void;
  canStepBack: boolean;
  canStepForward: boolean;
}

export default function TopControlBar({
  objectiveType,
  onObjectiveTypeChange,
  objectiveCoefficients,
  onObjectiveCoefficientsChange,
  variables,
  method,
  onMethodChange,
  onSolve,
  onStepForward,
  onStepBack,
  onReset,
  isInteractive,
  onInteractiveModeToggle,
  showRatioTest,
  onShowRatioTestToggle,
  showObjectiveLine,
  onShowObjectiveLineToggle,
  canStepBack,
  canStepForward,
}: TopControlBarProps) {
  const handleCoeff = (i: number, raw: string) => {
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    const next = [...objectiveCoefficients];
    next[i] = val;
    onObjectiveCoefficientsChange(next);
  };

  return (
    <div className="bg-white border-b-2 border-gray-200 px-6 py-4 flex items-center gap-8">
      {/* Objective */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex gap-1.5">
          <Button variant={objectiveType === 'max' ? 'default' : 'outline'}
            onClick={() => onObjectiveTypeChange('max')} className="h-10 w-18 text-sm font-semibold">
            <Maximize2 className="w-4 h-4 mr-1.5" />Max
          </Button>
          <Button variant={objectiveType === 'min' ? 'default' : 'outline'}
            onClick={() => onObjectiveTypeChange('min')} className="h-10 w-18 text-sm font-semibold">
            <Minimize2 className="w-4 h-4 mr-1.5" />Min
          </Button>
        </div>
        <span className="text-base font-bold">z =</span>
        {objectiveCoefficients.map((coeff, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <Input className="w-16 h-10 text-center text-base font-medium" value={coeff}
              onChange={e => handleCoeff(i, e.target.value)} />
            <span className="text-base text-gray-700 font-medium">
              {variables[i] ?? `x${i + 1}`}{i < objectiveCoefficients.length - 1 ? ' +' : ''}
            </span>
          </span>
        ))}
      </div>

      <div className="w-px h-10 bg-gray-300 shrink-0" />

      {/* Method + controls */}
      <div className="flex items-center gap-3 shrink-0">
        <Select value={method} onValueChange={onMethodChange}>
          <SelectTrigger className="w-36 h-10 text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="graphical">Graphical</SelectItem>
            <SelectItem value="simplex">Simplex</SelectItem>
            <SelectItem value="big-m">Big-M</SelectItem>
            <SelectItem value="two-phase">Two-Phase</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-10 w-10 p-0" onClick={onStepBack} disabled={!canStepBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button variant="default" className="h-10 px-5 text-sm font-semibold" onClick={onSolve}>
          <Play className="w-4 h-4 mr-1.5" />Solve
        </Button>
        <Button variant="outline" className="h-10 w-10 p-0" onClick={onStepForward} disabled={!canStepForward}>
          <ChevronRight className="w-5 h-5" />
        </Button>
        <Button variant="outline" className="h-10 w-10 p-0" onClick={onReset}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div className="w-px h-10 bg-gray-300 shrink-0" />

      {/* Toggles */}
      <div className="flex items-center gap-5 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={isInteractive} onCheckedChange={onInteractiveModeToggle} />
          <span>Interactive</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={showRatioTest} onCheckedChange={onShowRatioTestToggle} />
          <span>Ratio Test</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={showObjectiveLine} onCheckedChange={onShowObjectiveLineToggle} />
          <span>Objective Line</span>
        </label>
      </div>
    </div>
  );
}
