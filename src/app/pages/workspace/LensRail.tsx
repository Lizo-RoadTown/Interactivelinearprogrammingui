/**
 * LensRail — left-side icon strip for toggling secondary lenses.
 *
 * One icon per openable lens. Active lens gets a subtle highlight. Tapping
 * an active lens closes the drawer; tapping an inactive lens switches the
 * drawer to it. Only one secondary lens open at a time (by design — keeps
 * attention focused).
 */

import { LensId } from '../../hooks/useLPWorkspace';
import {
  FileText, Target, Grid3x3, TrendingUp,
  Sliders, GitCompare, Clock,
} from 'lucide-react';

interface LensDef {
  id: LensId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Short helper shown on hover. */
  description: string;
  /** Phase in which this lens becomes functional. Lenses from later phases are disabled. */
  phase: 'B' | 'D' | 'E';
}

// Order matters — this is the visual stack in the rail
const LENSES: LensDef[] = [
  { id: 'formulation', label: 'Formulation', icon: FileText,    description: 'Edit objective & constraints',                              phase: 'B' },
  { id: 'solution',    label: 'Solution',    icon: Target,      description: 'x*, z*, basis — plain-English answer',                     phase: 'B' },
  { id: 'sensitivity', label: 'Sensitivity', icon: Sliders,     description: 'Drag sliders for each coefficient / RHS; watch LP react', phase: 'B' },
  { id: 'matrix',      label: 'Matrix form', icon: Grid3x3,     description: 'B, B⁻¹, N, C_B, C_N at the current iteration',             phase: 'B' },
  { id: 'shadow',      label: 'Shadow',      icon: TrendingUp,  description: 'Dual prices — marginal value of each constraint',          phase: 'B' },
  { id: 'dual',        label: 'Dual LP',     icon: GitCompare,  description: 'View the dual problem and its solution',                   phase: 'E' },
  { id: 'history',     label: 'History',     icon: Clock,       description: 'Every change you made to this workspace',                  phase: 'E' },
];

interface Props {
  lenses: Record<LensId, boolean>;
  onToggle: (id: LensId) => void;
  /** Only one secondary lens visible at a time. Caller passes the current active id. */
  active: LensId | null;
}

export default function LensRail({ lenses, onToggle, active }: Props) {
  return (
    <nav
      className="w-14 border-r border-border bg-card/60 flex flex-col items-center py-3 gap-1 shrink-0"
      aria-label="Lens toggles"
    >
      {LENSES.map(def => {
        const Icon = def.icon;
        const isActive = active === def.id;
        const isDisabled = def.phase !== 'B' && !lenses[def.id];
        return (
          <button
            key={def.id}
            onClick={() => !isDisabled && onToggle(def.id)}
            disabled={isDisabled}
            aria-label={`${def.label}${isDisabled ? ' (coming soon)' : ''}`}
            title={isDisabled ? `${def.label} — coming in Phase ${def.phase}` : `${def.label} — ${def.description}`}
            className={`
              group w-10 h-10 rounded-lg flex items-center justify-center transition-all
              ${isActive
                ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
                : isDisabled
                  ? 'text-muted-foreground/40 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }
            `}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </nav>
  );
}

export { LENSES };
