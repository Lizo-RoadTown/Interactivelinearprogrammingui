import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { ChevronLeft, ChevronRight, Play, RotateCcw, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { ObjectiveType, Method } from '../types';

interface TopControlBarProps {
  objectiveType: ObjectiveType;
  onObjectiveTypeChange: (type: ObjectiveType) => void;
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
  showRowOperations: boolean;
  onShowRowOperationsToggle: () => void;
  showObjectiveLine: boolean;
  onShowObjectiveLineToggle: () => void;
  canStepBack: boolean;
  canStepForward: boolean;
}

export default function TopControlBar({
  objectiveType,
  onObjectiveTypeChange,
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
  showRowOperations,
  onShowRowOperationsToggle,
  showObjectiveLine,
  onShowObjectiveLineToggle,
  canStepBack,
  canStepForward
}: TopControlBarProps) {
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="grid grid-cols-3 gap-6">
        {/* Left section - Objective Function */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">Objective:</Label>
            <div className="flex gap-2">
              <Button
                variant={objectiveType === 'max' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onObjectiveTypeChange('max')}
                className="w-16"
              >
                <Maximize2 className="w-4 h-4 mr-1" />
                Max
              </Button>
              <Button
                variant={objectiveType === 'min' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onObjectiveTypeChange('min')}
                className="w-16"
              >
                <Minimize2 className="w-4 h-4 mr-1" />
                Min
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">z = </span>
            <Input className="w-12 h-8 text-center" defaultValue="3" />
            <span className="text-sm">x₁ +</span>
            <Input className="w-12 h-8 text-center" defaultValue="2" />
            <span className="text-sm">x₂</span>
          </div>
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="w-4 h-4 mr-1" />
            Add Constraint
          </Button>
        </div>

        {/* Center section - Method & Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">Method:</Label>
            <Select value={method} onValueChange={onMethodChange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="graphical">Graphical</SelectItem>
                <SelectItem value="simplex">Simplex</SelectItem>
                <SelectItem value="big-m">Big-M</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={onStepBack} disabled={!canStepBack}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="default" size="sm" onClick={onSolve}>
              <Play className="w-4 h-4 mr-1" />
              Solve
            </Button>
            <Button variant="outline" size="sm" onClick={onStepForward} disabled={!canStepForward}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right section - Toggles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Interactive Mode</Label>
            <Switch checked={isInteractive} onCheckedChange={onInteractiveModeToggle} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Ratio Test</Label>
            <Switch checked={showRatioTest} onCheckedChange={onShowRatioTestToggle} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Row Operations</Label>
            <Switch checked={showRowOperations} onCheckedChange={onShowRowOperationsToggle} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Objective Line</Label>
            <Switch checked={showObjectiveLine} onCheckedChange={onShowObjectiveLineToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}
