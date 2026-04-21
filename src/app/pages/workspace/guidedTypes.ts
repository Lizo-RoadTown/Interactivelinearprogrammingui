/**
 * Shared types for the guided-learn flow.
 */

export interface LPDraft {
  variables: { name: string; description: string }[];
  objectiveType: 'max' | 'min' | null;
  objectiveCoefficients: (number | null)[];
  constraints: {
    started: boolean;
    label: string;
    coefficients: (number | null)[];
    operator: '<=' | '>=' | '=' | null;
    rhs: number | null;
  }[];
}
