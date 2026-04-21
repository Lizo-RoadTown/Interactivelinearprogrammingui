/**
 * SolutionLens — "plain English what just happened" lens.
 *
 * Shows the optimal solution: x*, z*, basis, and a written summary.
 * Bridges between the abstract tableau and the student's intuition.
 */

import { SolverResponse } from '../../../types';
import { CheckCircle, AlertCircle, Infinity as InfinityIcon } from 'lucide-react';

interface Props {
  response: SolverResponse | null;
  isLoading: boolean;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(4).replace(/\.?0+$/, '');
}

export default function SolutionLens({ response, isLoading }: Props) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Solving…</p>;
  }
  if (!response) {
    return <p className="text-sm text-muted-foreground italic">No LP loaded.</p>;
  }

  const { status, optimalValue, optimalSolution } = response;

  if (status === 'infeasible') {
    return (
      <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-4">
        <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
          <AlertCircle className="w-5 h-5" />
          Infeasible
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          No solution satisfies all the constraints. Either a constraint is too tight or two
          constraints contradict. Check the Graph lens — there may be no feasible region at all.
        </p>
      </div>
    );
  }

  if (status === 'unbounded') {
    return (
      <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4">
        <div className="flex items-center gap-2 text-amber-300 font-semibold mb-2">
          <InfinityIcon className="w-5 h-5" />
          Unbounded
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The objective can grow without bound in this LP. Usually this means a constraint
          needed to limit the problem is missing.
        </p>
      </div>
    );
  }

  // optimal
  return (
    <div className="space-y-4">

      <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-4">
        <div className="flex items-center gap-2 text-emerald-300 font-semibold mb-2">
          <CheckCircle className="w-5 h-5" />
          Optimal solution found
        </div>
        <div className="text-3xl font-bold text-foreground font-mono">
          z* = {optimalValue != null ? fmt(optimalValue) : '—'}
        </div>
      </div>

      {optimalSolution && (
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Decision variables at optimum
          </h3>
          <div className="bg-muted/40 border border-border rounded-lg divide-y divide-border">
            {Object.entries(optimalSolution).map(([name, val]) => (
              <div key={name} className="px-3 py-2 flex items-center justify-between font-mono text-sm">
                <span className="text-primary">{name}</span>
                <span className={Math.abs(val as number) < 1e-9 ? 'text-muted-foreground' : 'text-foreground font-semibold'}>
                  {fmt(val as number)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-2">
            Variables equal to zero are <strong>nonbasic</strong> — not currently in the solution basis.
            Variables with nonzero values are <strong>basic</strong>.
          </p>
        </section>
      )}

      {/* Interpretation hint */}
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs text-accent leading-relaxed">
        <strong>What this means:</strong> With the current constraints, making {' '}
        {optimalSolution
          ? Object.entries(optimalSolution).filter(([, v]) => Math.abs(v as number) > 1e-9).map(([n, v]) => `${fmt(v as number)} of ${n}`).join(', ')
          : 'the above'
        } gives the best possible value of the objective.
      </div>
    </div>
  );
}
