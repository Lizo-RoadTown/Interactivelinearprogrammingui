/**
 * LensDrawer — right-side panel that hosts whichever secondary lens is active.
 *
 * Consistent chrome (title + close button), fixed width, scrollable body.
 * The specific lens body is rendered as children.
 */

import { X } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Width. Defaults to ~360px. */
  width?: string;
}

export default function LensDrawer({
  title,
  subtitle,
  onClose,
  children,
  width = 'w-[360px]',
}: Props) {
  return (
    <aside
      className={`${width} shrink-0 border-l border-border bg-card/40 flex flex-col`}
      aria-label={`${title} lens`}
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
            Lens
          </p>
          <h2 className="text-sm font-semibold text-foreground leading-tight truncate">{title}</h2>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground leading-tight truncate">{subtitle}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Close lens"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </aside>
  );
}
