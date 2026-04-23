/**
 * Matrix utilities for the Matrix Method gameboard.
 *
 * Everything here is generic — no 2×2 assumptions. The spec requires
 * the gameboard to work for any n (Toy Factory is 2×2, the chalkboard
 * example is 3×3, a future problem could be 4×4). The inverse uses
 * Gauss-Jordan with partial pivoting.
 */

// ── Construction helpers ─────────────────────────────────────────────────

/** Deep-copy a matrix so downstream mutation doesn't leak. */
export function cloneMatrix(M: number[][]): number[][] {
  return M.map(row => [...row]);
}

/** An n×n identity matrix. */
export function identity(n: number): number[][] {
  const I: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row = new Array(n).fill(0);
    row[r] = 1;
    I.push(row);
  }
  return I;
}

/** Extract one column from a matrix. */
export function column(M: number[][], c: number): number[] {
  return M.map(row => row[c]);
}

/** Pull a subset of columns (in the given order) into a new matrix. */
export function selectColumns(A: number[][], colIndices: number[]): number[][] {
  return A.map(row => colIndices.map(c => row[c]));
}

// ── Inverse (Gauss-Jordan, partial pivoting) ─────────────────────────────

/**
 * Invert an n×n matrix using Gauss-Jordan with partial pivoting.
 * Returns null if the matrix is singular.
 *
 * Partial pivoting keeps numerical error small for matrices with mixed
 * magnitudes (like the chalkboard's B = [[1,1,8], [0,1.5,4], [0,0.5,2]]).
 */
export function invert(M: number[][]): number[][] | null {
  const n = M.length;
  if (n === 0 || M.some(row => row.length !== n)) return null;

  // Augment [M | I]
  const aug: number[][] = M.map((row, r) => {
    const idRow = new Array(n).fill(0);
    idRow[r] = 1;
    return [...row, ...idRow];
  });

  for (let col = 0; col < n; col++) {
    // Find the row with max |pivot| at or below `col`
    let bestRow = col;
    let bestAbs = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      const a = Math.abs(aug[r][col]);
      if (a > bestAbs) {
        bestAbs = a;
        bestRow = r;
      }
    }
    if (bestAbs < 1e-12) return null;   // singular

    // Swap rows
    if (bestRow !== col) {
      [aug[col], aug[bestRow]] = [aug[bestRow], aug[col]];
    }

    // Normalize the pivot row
    const pivot = aug[col][col];
    for (let c = 0; c < 2 * n; c++) aug[col][c] /= pivot;

    // Eliminate every other row
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-15) continue;
      for (let c = 0; c < 2 * n; c++) {
        aug[r][c] -= factor * aug[col][c];
      }
    }
  }

  // The right half of aug is now M⁻¹
  return aug.map(row => row.slice(n));
}

// ── Basic matrix / vector products ───────────────────────────────────────

/** M · v (matrix times vector). */
export function matVec(M: number[][], v: number[]): number[] {
  return M.map(row => row.reduce((s, x, i) => s + x * v[i], 0));
}

/** A · B (matrix times matrix). */
export function matMat(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const k = B.length;
  const n = B[0]?.length ?? 0;
  const out: number[][] = [];
  for (let r = 0; r < m; r++) {
    const row = new Array(n).fill(0);
    for (let c = 0; c < n; c++) {
      let s = 0;
      for (let i = 0; i < k; i++) s += A[r][i] * B[i][c];
      row[c] = s;
    }
    out.push(row);
  }
  return out;
}

/** Row-vector times column-vector = dot product. */
export function dot(a: number[], b: number[]): number {
  return a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
}

// ── Formatting ───────────────────────────────────────────────────────────

/**
 * Format a number cleanly — prefers small-denominator fractions so
 * "1.25" renders as "5/4" (matching the chalkboard), and 1.5 as "3/2",
 * 0.5 as "1/2", etc. Falls back to decimal for messy values.
 */
export function fmtFrac(v: number): string {
  if (!Number.isFinite(v)) return '?';
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  for (const d of [2, 3, 4, 5, 6, 8, 10]) {
    const n = v * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) {
      const num = Math.round(n);
      if (num === 0) return '0';
      if (Math.abs(num) === d) return v > 0 ? '1' : '-1';
      // Reduce
      const g = gcd(Math.abs(num), d);
      return `${num / g}/${d / g}`;
    }
  }
  return v.toFixed(3).replace(/\.?0+$/, '');
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Plain decimal format (no fraction attempts). */
export function fmtDec(v: number): string {
  if (!Number.isFinite(v)) return '?';
  if (Math.abs(v) < 1e-9) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}
