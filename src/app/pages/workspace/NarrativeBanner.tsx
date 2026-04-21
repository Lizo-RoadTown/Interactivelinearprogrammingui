/**
 * NarrativeBanner — thin top instruction layer.
 *
 * Ambient by design: never covers content, never modal, never more than
 * one line of text + an optional action button. When there's nothing to
 * say it fades to a subtle status strip.
 */

import { NarrativeBanner as BannerData } from '../../hooks/useLPWorkspace';
import { Info, HelpCircle, CheckCircle, XCircle, Lightbulb } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface Props {
  banner: BannerData | null;
  /** Fallback text when no banner is set (e.g. problem title). */
  fallback?: string;
}

const STYLES: Record<BannerData['kind'], string> = {
  info:     'border-border bg-card text-foreground',
  question: 'border-primary/40 bg-primary/10 text-foreground',
  correct:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  wrong:    'border-destructive/40 bg-destructive/10 text-destructive',
  hint:     'border-accent/40 bg-accent/10 text-accent',
};

const ICONS: Record<BannerData['kind'], React.ComponentType<{ className?: string }>> = {
  info:     Info,
  question: HelpCircle,
  correct:  CheckCircle,
  wrong:    XCircle,
  hint:     Lightbulb,
};

export default function NarrativeBanner({ banner, fallback }: Props) {
  if (!banner) {
    return (
      <div className="h-11 px-4 flex items-center text-sm text-muted-foreground border-b border-border bg-card/40 shrink-0">
        {fallback ?? 'Workspace ready.'}
      </div>
    );
  }

  const Icon = ICONS[banner.kind];
  const style = STYLES[banner.kind];

  return (
    <div className={`h-11 px-4 flex items-center gap-3 text-sm border-b shrink-0 ${style}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">{banner.text}</span>
      {banner.action && (
        <Button
          size="sm"
          variant="outline"
          onClick={banner.action.onClick}
          className="h-7 px-3 text-xs"
        >
          {banner.action.label}
        </Button>
      )}
    </div>
  );
}
