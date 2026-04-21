/**
 * WorkspacePage — the unified LP learning environment.
 *
 * Phase A (this file): shell. One LP loaded, tableau + graph co-located,
 * narrative banner at top, inline feedback layer (empty for now), a simple
 * problem picker to switch between word problems.
 *
 * Phase B will add lens toggles (matrix form, sensitivity, etc).
 * Phase C will attach tutorial scripts (Simplex Practice).
 * Phase D will add slider-first sensitivity exploration.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/button';
import TableauWorkspace from '../../components/TableauWorkspace';
import GraphView from '../../components/GraphView';
import NarrativeBanner from './NarrativeBanner';
import LensRail, { LENSES } from './LensRail';
import LensDrawer from './LensDrawer';
import FormulationLens from './lenses/FormulationLens';
import SolutionLens from './lenses/SolutionLens';
import SensitivityLens from './lenses/SensitivityLens';
import { useLPWorkspace, LensId } from '../../hooks/useLPWorkspace';
import { WORD_PROBLEMS, WordProblem } from '../../data/wordProblems';
import { LPProblem } from '../../types';
import {
  ArrowLeft, Loader2, AlertCircle, BookOpen,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

// Default seed problem — Toy Factory (simplex MAX, 2-var, beginner)
const DEFAULT_PROBLEM_ID = 'wp-toy-factory';

function wordProblemToLP(w: WordProblem): LPProblem {
  return {
    objectiveType: w.objectiveType,
    objectiveCoefficients: w.objectiveCoefficients,
    variables: w.variables.map(v => v.name),
    variableSigns: w.variables.map(() => 'nonneg' as const),
    constraints: w.constraints,
  };
}

export default function WorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Accept ?problem=wp-xxx in the URL so tutorials can deep-link later
  const seedProblemId = searchParams.get('problem') ?? DEFAULT_PROBLEM_ID;
  const seedProblem = useMemo(
    () => WORD_PROBLEMS.find(w => w.id === seedProblemId) ?? WORD_PROBLEMS[0],
    [seedProblemId],
  );

  const ws = useLPWorkspace();

  // Load the seed problem on mount
  useEffect(() => {
    if (seedProblem) ws.loadProblem(wordProblemToLP(seedProblem), seedProblem.method);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedProblem.id]);

  // Current problem's word title for the banner
  const currentTitle = seedProblem?.title ?? 'Custom LP';

  const { solverResponse, steps, currentStep, currentStepIndex, isLoading, error,
    canStepBack, canStepForward, stepForward, stepBack, currentSimplexPath, currentPoint,
  } = ws.solver;

  const tableau = currentStep?.tableau ?? null;
  const prevTableau = steps[currentStepIndex - 1]?.tableau;

  // Problem-switcher state (Phase A convenience; Phase F will replace with templates)
  const [pickerOpen, setPickerOpen] = useState(false);

  // Only one secondary lens open at a time. The LensRail toggle cycles
  // selected → deselected. Primary lenses (tableau, graph) are always
  // visible in the center; the rail covers secondary lenses.
  const [activeLens, setActiveLens] = useState<LensId | null>(null);
  const handleToggleLens = (id: LensId) => {
    // Primary lenses don't open a drawer — they're always rendered in the center
    if (id === 'tableau' || id === 'graph') return;
    setActiveLens(curr => (curr === id ? null : id));
  };
  const activeLensDef = LENSES.find(l => l.id === activeLens);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-card/60 backdrop-blur border-b border-border px-4 py-2 flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">LP Workspace</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">One environment, many lenses</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(p => !p)}
              className="text-xs"
            >
              {currentTitle}
              <ChevronLeft className={`w-3.5 h-3.5 ml-1.5 transition-transform ${pickerOpen ? 'rotate-90' : '-rotate-90'}`} />
            </Button>
            {pickerOpen && (
              <div className="absolute top-full right-0 mt-1 w-72 max-h-96 overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-50 py-1">
                {WORD_PROBLEMS.map(w => (
                  <button
                    key={w.id}
                    onClick={() => {
                      navigate(`/workspace?problem=${w.id}`);
                      setPickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/60 ${
                      w.id === seedProblemId ? 'bg-primary/10 text-primary' : 'text-foreground'
                    }`}
                  >
                    <div className="font-medium">{w.title}</div>
                    <div className="text-muted-foreground text-[10px] mt-0.5">
                      {w.category} · {w.difficulty} · {w.method}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Narrative banner (thin instruction layer) ───────────────────────── */}
      <NarrativeBanner
        banner={ws.banner}
        fallback={
          isLoading ? 'Solving…' :
          error ? `Error: ${error}` :
          solverResponse?.status === 'optimal' ? `${currentTitle} — z* = ${solverResponse.optimalValue?.toFixed(4)}` :
          currentTitle
        }
      />

      {/* ── Main canvas: rail | tableau + graph | optional drawer ───────────── */}
      <div className="flex-1 flex overflow-hidden">

        <LensRail
          lenses={ws.lenses}
          onToggle={handleToggleLens}
          active={activeLens}
        />

        {/* Tableau lens (left, dominant) */}
        <section className="flex-1 min-w-0 flex flex-col border-r border-border">
          <div className="px-3 py-1.5 border-b border-border bg-card/40 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tableau</span>
            {steps.length > 0 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={stepBack} disabled={!canStepBack}
                  className="h-6 w-6 p-0">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {currentStepIndex + 1} / {steps.length}
                </span>
                <Button variant="ghost" size="sm" onClick={stepForward} disabled={!canStepForward}
                  className="h-6 w-6 p-0">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading && (
              <div className="p-6 flex items-center gap-2 text-accent">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Solving…</span>
              </div>
            )}
            {error && (
              <div className="p-6 flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            {tableau && (
              <TableauWorkspace
                tableau={tableau}
                previousTableau={prevTableau}
                currentStep={currentStep ?? undefined}
                showRatioTest={currentStep?.stepType === 'select_pivot'}
                afterStep={0}
                onAfterStepChange={() => {}}
              />
            )}
          </div>
        </section>

        {/* Graph lens (right, companion) — narrower when a drawer is open */}
        <aside className={`
          ${activeLens ? 'w-[32%] min-w-[300px] max-w-[480px]' : 'w-[42%] min-w-[380px] max-w-[620px]'}
          flex flex-col bg-card/30 transition-all
        `}>
          <div className="px-3 py-1.5 border-b border-border bg-card/40 shrink-0">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Graph</span>
          </div>
          <div className="flex-1 overflow-hidden">
            {ws.problem && ws.problem.variables.length === 2 ? (
              <GraphView
                constraints={ws.problem.constraints}
                cornerPoints={solverResponse?.cornerPoints ?? []}
                feasibleRegionPolygon={solverResponse?.feasibleRegionPolygon ?? []}
                simplexPath={currentSimplexPath}
                objectiveCoefficients={ws.problem.objectiveCoefficients}
                showObjectiveLine={true}
                currentPoint={currentPoint ?? undefined}
              />
            ) : (
              <div className="h-full flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                {ws.problem
                  ? <span>Graph view requires 2 variables.<br />This LP has {ws.problem.variables.length}.</span>
                  : <span>Load an LP to see its graph.</span>}
              </div>
            )}
          </div>
        </aside>

        {/* Secondary lens drawer (Formulation / Solution / Sensitivity / etc.) */}
        {activeLens && activeLensDef && (
          <LensDrawer
            title={activeLensDef.label}
            subtitle={activeLensDef.description}
            onClose={() => setActiveLens(null)}
          >
            {activeLens === 'formulation' && <FormulationLens problem={ws.problem} />}
            {activeLens === 'solution'    && <SolutionLens response={solverResponse} isLoading={isLoading} />}
            {activeLens === 'sensitivity' && (
              <SensitivityLens
                problem={ws.problem}
                response={solverResponse}
                isLoading={isLoading}
                method={ws.method}
              />
            )}
            {activeLens !== 'formulation' && activeLens !== 'solution' && activeLens !== 'sensitivity' && (
              <div className="text-sm text-muted-foreground italic">
                The <strong className="text-foreground">{activeLensDef.label}</strong> lens is coming in Phase {activeLensDef.phase ?? '?'}.
              </div>
            )}
          </LensDrawer>
        )}
      </div>
    </div>
  );
}
