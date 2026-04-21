/**
 * FormulationLens — read/edit the LP's formulation.
 *
 * Phase B: read-only view of the current LP. Phase F expands this to a
 * proper editor (right now the MainWorkspace free-form solver at / is
 * the editor; this lens just shows what's loaded).
 */

import { LPProblem } from '../../../types';

interface Props {
  problem: LPProblem | null;
}

function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

function renderExpr(coeffs: number[], varNames: string[]): React.ReactNode {
  const parts: React.ReactNode[] = [];
  coeffs.forEach((c, i) => {
    if (Math.abs(c) < 1e-10) return;
    const sign = c < 0 ? '−' : (parts.length > 0 ? '+' : '');
    const mag = Math.abs(c);
    const coefStr = mag === 1 ? '' : fmt(mag);
    parts.push(
      <span key={i}>
        {parts.length > 0 ? ` ${sign} ` : sign}
        {coefStr}
        <span className="text-primary font-mono">{varNames[i] ?? `x${i + 1}`}</span>
      </span>
    );
  });
  return parts.length === 0 ? '0' : parts;
}

export default function FormulationLens({ problem }: Props) {
  if (!problem) {
    return (
      <p className="text-sm text-muted-foreground italic">No LP loaded.</p>
    );
  }

  const { objectiveType, objectiveCoefficients, variables, constraints, variableSigns } = problem;
  const senseWord = objectiveType === 'max' ? 'MAXIMIZE' : 'MINIMIZE';

  return (
    <div className="space-y-5 text-sm">
      {/* Objective */}
      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Objective function
        </h3>
        <div className="bg-muted/40 border border-border rounded-lg px-3 py-2.5 font-mono">
          <span className="text-primary font-semibold">{senseWord}</span>
          <span className="text-muted-foreground mx-2">z =</span>
          <span className="text-foreground">
            {renderExpr(objectiveCoefficients, variables)}
          </span>
        </div>
      </section>

      {/* Subject to */}
      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Subject to
        </h3>
        <div className="bg-muted/40 border border-border rounded-lg divide-y divide-border font-mono text-sm">
          {constraints.map((c, i) => (
            <div key={c.id} className="px-3 py-2 flex items-baseline gap-2">
              <span className="text-muted-foreground text-xs w-12 shrink-0">
                {c.label || `C${i + 1}`}
              </span>
              <span className="flex-1 text-foreground">
                {renderExpr(c.coefficients, variables)}
                <span className="text-muted-foreground mx-2">
                  {c.operator === '<=' ? '≤' : c.operator === '>=' ? '≥' : '='}
                </span>
                <span className="text-accent">{fmt(c.rhs)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Variable signs */}
      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Variable sign constraints
        </h3>
        <div className="bg-muted/40 border border-border rounded-lg px-3 py-2 font-mono text-sm text-muted-foreground">
          {variables.map((v, i) => {
            const sign = variableSigns?.[i] ?? 'nonneg';
            const op = sign === 'nonneg' ? '≥ 0' : sign === 'nonpos' ? '≤ 0' : 'unrestricted';
            return (
              <span key={v} className="inline-block mr-3">
                <span className="text-primary">{v}</span> {op}
              </span>
            );
          })}
        </div>
      </section>

      {/* Editing note */}
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs text-accent leading-relaxed">
        <strong>Editing:</strong> Phase F will let you edit this LP directly here.
        For now, use the free-form Solver at <code className="text-foreground">/</code> to build or modify an LP,
        then return here to analyze it.
      </div>
    </div>
  );
}
