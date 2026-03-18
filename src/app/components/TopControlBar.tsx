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
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-6">
      {/* Objective */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex gap-1">
          <Button variant={objectiveType === 'max' ? 'default' : 'outline'} size="sm"
            onClick={() => onObjectiveTypeChange('max')} className="h-7 w-14 text-xs">
            <Maximize2 className="w-3 h-3 mr-1" />Max
          </Button>
          <Button variant={objectiveType === 'min' ? 'default' : 'outline'} size="sm"
            onClick={() => onObjectiveTypeChange('min')} className="h-7 w-14 text-xs">
            <Minimize2 className="w-3 h-3 mr-1" />Min
          </Button>
        </div>
        <span className="text-sm font-medium">z =</span>
        {objectiveCoefficients.map((coeff, i) => (
          <span key={i} className="flex items-center gap-1">
            <Input className="w-12 h-7 text-center text-sm" value={coeff}
              onChange={e => handleCoeff(i, e.target.value)} />
            <span className="text-sm text-gray-600">
              {variables[i] ?? `x${i + 1}`}{i < objectiveCoefficients.length - 1 ? ' +' : ''}
            </span>
          </span>
        ))}
      </div>

      <div className="w-px h-8 bg-gray-200 shrink-0" />

      {/* Method + controls */}
      <div className="flex items-center gap-2 shrink-0">
        <Select value={method} onValueChange={onMethodChange}>
          <SelectTrigger className="w-32 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="graphical">Graphical</SelectItem>
            <SelectItem value="simplex">Simplex</SelectItem>
            <SelectItem value="big-m">Big-M</SelectItem>
            <SelectItem value="two-phase">Two-Phase</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={onStepBack} disabled={!canStepBack}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="default" size="sm" className="h-7 px-3 text-xs" onClick={onSolve}>
          <Play className="w-3 h-3 mr-1" />Solve
        </Button>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={onStepForward} disabled={!canStepForward}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={onReset}>
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>

      <div className="w-px h-8 bg-gray-200 shrink-0" />

      {/* Toggles */}
      <div className="flex items-center gap-4 text-xs">
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
