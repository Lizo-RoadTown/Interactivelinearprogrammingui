import { Slider } from './ui/slider';
import { Label } from './ui/label';

interface StepTimelineProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
}

export default function StepTimeline({
  currentStep,
  totalSteps,
  onStepChange
}: StepTimelineProps) {
  return (
    <div className="px-4 py-3 bg-card border-t border-border">
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium whitespace-nowrap text-muted-foreground">
          Step Timeline:
        </Label>
        <div className="flex-1">
          <Slider
            value={[currentStep]}
            min={0}
            max={totalSteps - 1}
            step={1}
            onValueChange={(value) => onStepChange(value[0])}
            className="w-full"
          />
        </div>
        <div className="text-sm font-medium text-foreground min-w-16 text-right tabular-nums">
          {currentStep + 1} / {totalSteps}
        </div>
      </div>

      {/* Step markers */}
      <div className="flex justify-between mt-2 px-1">
        {Array.from({ length: totalSteps }, (_, i) => (
          <button
            key={i}
            onClick={() => onStepChange(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentStep
                ? 'bg-primary scale-150 shadow-lg shadow-primary/40'
                : i < currentStep
                ? 'bg-primary/60'
                : 'bg-muted-foreground/30'
            }`}
            title={`Go to step ${i}`}
          />
        ))}
      </div>
    </div>
  );
}
