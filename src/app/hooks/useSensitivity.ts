/**
 * useSensitivity.ts — React hook for Chapter 8 sensitivity analysis.
 *
 * Thin wrapper around POST /api/sensitivity. Holds the last result and
 * loading/error state; the caller builds the UI.
 */

import { useState, useCallback } from 'react';
import { LPProblem } from '../types';

// Dev: proxied through Vite to localhost:8000.  Production: set VITE_API_URL.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
               : '/api';

export interface SensitivityResponse {
  operation: string;
  formula: string;
  steps: string[];
  result: Record<string, unknown>;
  conclusion: string;
}

export type SensitivityOperation =
  | 'matrix_form'
  | 'of_coeff_basic'
  | 'of_coeff_nonbasic'
  | 'rhs_range'
  | 'shadow_prices'
  | 'add_activity'
  | 'add_constraint';

export interface SensitivityParams {
  variable?: string;
  constraint_index?: number;
  a_new?: number[];
  c_new?: number;
  var_label?: string;
  coefficients?: number[];
  operator?: '<=' | '>=' | '=';
  rhs?: number;
}

function problemToApi(problem: LPProblem) {
  return {
    objectiveType: problem.objectiveType,
    objectiveCoefficients: problem.objectiveCoefficients,
    variables: problem.variables,
    variableSigns: problem.variableSigns,
    constraints: problem.constraints.map(c => ({
      id: c.id,
      coefficients: c.coefficients,
      operator: c.operator,
      rhs: c.rhs,
      label: (c as unknown as { label?: string }).label,
    })),
    method: 'simplex',
  };
}

export function useSensitivity() {
  const [response, setResponse] = useState<SensitivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (
    problem: LPProblem,
    operation: SensitivityOperation,
    params?: SensitivityParams,
  ): Promise<SensitivityResponse | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sensitivity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: problemToApi(problem),
          operation,
          params: params ?? {},
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errBody.detail ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SensitivityResponse;
      setResponse(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setResponse(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return { response, isLoading, error, run, clear };
}
