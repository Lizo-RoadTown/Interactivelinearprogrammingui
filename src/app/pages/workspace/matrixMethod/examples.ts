/**
 * Canonical SolvedLP inputs for the Matrix Method gameboard.
 *
 * The 3×3 example (`chalkboard3x3`) is the chalkboard problem:
 *   max z = 60x₁ + 30x₂ + 20x₃
 *   s.t.  8x₁ + 6x₂ + x₃       + s₁            = 48
 *         4x₁ + 2x₂ + 1.5x₃    + s₂            = 20
 *         2x₁ + 1.5x₂ + 0.5x₃  + s₃            = 8
 *   Given optimal basis: {s₁, x₃, x₁} (in that order).
 * Expected results:
 *   B⁻¹b = [24, 8, 2]ᵀ,  z* = 280
 *   Z-row non-basic entries (x₂, s₂, s₃): 5, 10, 10.
 *
 * The 2×2 example (`toyFactory`) is the walkthrough's Toy Factory at
 * its optimum — a smaller sanity check for the gameboard.
 *   max z = 15x₁ + 20x₂
 *   s.t.  2x₁ + 4x₂ + s₁ = 80
 *         3x₁ + 2x₂ + s₂ = 60
 *   Given optimal basis: {x₁, x₂}.
 *
 * Every number here comes from the problem statement — nothing is
 * precomputed. The gameboard derives B, B⁻¹, B⁻¹b, Z-row, and z* at
 * runtime.
 */

import { SolvedLP } from './types';

export const chalkboard3x3: SolvedLP = {
  id: 'ch8-example-1',
  title: 'Chapter 8 Example — 3-variable MAX',
  sense: 'max',
  variables: [
    { kind: 'decision', index: 1, objCoef: 60 },   // x₁
    { kind: 'decision', index: 2, objCoef: 30 },   // x₂
    { kind: 'decision', index: 3, objCoef: 20 },   // x₃
    { kind: 'slack',    index: 1, objCoef: 0  },   // s₁
    { kind: 'slack',    index: 2, objCoef: 0  },   // s₂
    { kind: 'slack',    index: 3, objCoef: 0  },   // s₃
  ],
  // Columns: x₁, x₂, x₃, s₁, s₂, s₃
  A: [
    [8,   6,   1,   1, 0, 0],
    [4,   2,   1.5, 0, 1, 0],
    [2,   1.5, 0.5, 0, 0, 1],
  ],
  b: [48, 20, 8],
  // Basis in the order the chalkboard presents: s₁, x₃, x₁.
  // Indices into `variables`: s₁=3, x₃=2, x₁=0.
  basicVarIndices: [3, 2, 0],
  scenario:
    'A 3-variable resource-allocation problem. The optimal basis has ' +
    'been given (one slack and two decision variables); reconstruct the ' +
    'optimal tableau via the matrix method.',
};

export const toyFactory: SolvedLP = {
  id: 'toy-factory-optimum',
  title: 'Toy Factory at Optimum (2×2 sanity check)',
  sense: 'max',
  variables: [
    { kind: 'decision', index: 1, objCoef: 15 },   // x₁
    { kind: 'decision', index: 2, objCoef: 20 },   // x₂
    { kind: 'slack',    index: 1, objCoef: 0  },   // s₁
    { kind: 'slack',    index: 2, objCoef: 0  },   // s₂
  ],
  A: [
    [2, 4, 1, 0],
    [3, 2, 0, 1],
  ],
  b: [80, 60],
  // Basis at the optimum (10, 15) = {x₁, x₂}.
  basicVarIndices: [0, 1],
  scenario: 'Toy cars and trucks — the walkthrough problem at its optimum (10, 15).',
};

export const ALL_EXAMPLES: SolvedLP[] = [chalkboard3x3, toyFactory];

export function findExample(id: string): SolvedLP | undefined {
  return ALL_EXAMPLES.find(e => e.id === id);
}
