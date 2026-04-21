"""
sensitivity.py — Chapter 8 sensitivity analysis for a solved LP.

Given a completed SimplexSolver / TwoPhaseSolver in 'optimal' status,
this module exposes the six post-optimality operations from Chapter 8:

  §8.2     extract_matrix_form(solver)          — B, B⁻¹, N, C_B, C_N, b
  §8.3.1   of_coeff_range_basic(solver, var)    — Δ range for OF coeff of a basic variable
  §8.3.2   of_coeff_range_nonbasic(solver, var) — Δ range for OF coeff of a nonbasic variable
  §8.3.3   rhs_range(solver, constraint_idx)    — Δ range for a constraint RHS
  §8.3.3.1 shadow_prices(solver)                — marginal value of each original constraint
  §8.3.4   change_column_nonbasic(solver, ...)  — new a_j for a nonbasic variable
  §8.3.5   add_activity(solver, a_new, c_new)   — propose a new decision variable
  §8.3.6   add_constraint(solver, ...)          — propose a new constraint

Every operation returns a dict with structured "show your work" output:
    {
      'operation':  '§8.3.1',
      'formula':    'C̄_N = C_B · B⁻¹ · N − C_N',
      'steps':      [ ... arithmetic with substituted numbers ... ],
      'result':     { ... computed quantities ... },
      'conclusion': 'plain-English interpretation',
    }

No re-solving is done — everything is a direct algebraic consequence of
the optimal basis. Matches textbook notation (C̄, B⁻¹, Δ) so output is
exam-useful.
"""

from __future__ import annotations

import numpy as np
from typing import Any


# ── Matrix form (§8.2) ───────────────────────────────────────────────────────

def extract_matrix_form(solver) -> dict[str, Any]:
    """
    Pull B, B⁻¹, N, C_B, C_N, b from a solved LP.

    Returns a dict with NumPy arrays plus bookkeeping info:
      B          (m × m)   columns of original constraint matrix for basic vars
      B_inv      (m × m)   inverse of B
      N          (m × k)   columns for nonbasic vars (k = n_total - m)
      CB         (m,)      original OF coefficients of basic vars, in basis order
      CN         (k,)      original OF coefficients of nonbasic vars, in nonbasic order
      b          (m,)      original RHS vector
      basis      list[int] column indices of basic vars (length m)
      nonbasic   list[int] column indices of nonbasic vars (length k)
      all_vars   list[str] variable names (length n_total), lowercase
      col_types  list[str] 'decision'|'slack'|'surplus'|'artificial' per column
      sense      'min' | 'max'
      c          (n_total,) full coefficient vector in the ORIGINAL problem
                            (decision vars have obj coeff; slack/surplus/artificial = 0
                             so that shadow prices and range analysis match textbook)
      xB         (m,)      values of basic vars at optimum (= B⁻¹·b)
      z_star     float     optimal objective value (in user's sign convention)
    """
    if solver.status != 'optimal':
        raise ValueError(f"solver.status must be 'optimal', got {solver.status!r}")
    if not solver.tableaus:
        raise ValueError("solver has no tableaus — did it actually run?")

    optimal = solver.tableaus[-1]
    initial = solver.tableaus[0]

    basis: list[int] = list(optimal['basis'])
    all_vars: list[str] = list(optimal['all_vars'])
    col_types: list[str] = list(optimal['col_types'])
    m = len(basis)
    n_total = len(all_vars)

    # Original constraint matrix and RHS from iteration 0.
    T0 = initial['matrix']
    A_full = T0[:m, :n_total].copy()
    b = T0[:m, -1].copy()

    # Original objective coefficients. solver.obj is keyed by UPPERCASE decision var
    # names (per parse_expr); slack/surplus/artificial vars get c_j = 0 for
    # sensitivity analysis (textbook convention — Big-M is an internal device).
    c = np.zeros(n_total)
    obj = solver.obj
    for j, v in enumerate(all_vars):
        if col_types[j] == 'decision':
            # obj dict keys are uppercase; all_vars entries are lowercase
            c[j] = obj.get(v.upper(), obj.get(v, 0.0))

    B = A_full[:, basis].copy()
    try:
        B_inv = np.linalg.inv(B)
    except np.linalg.LinAlgError as e:
        raise ValueError(f"Basis matrix B is singular: {e}")

    nonbasic = [j for j in range(n_total) if j not in basis]
    N = A_full[:, nonbasic].copy() if nonbasic else np.zeros((m, 0))

    CB = np.array([c[j] for j in basis])
    CN = np.array([c[j] for j in nonbasic]) if nonbasic else np.array([])

    xB = B_inv @ b

    # Optimal z = c·x. Only basic vars are nonzero → z* = CB · xB
    z_star = float(CB @ xB)

    return {
        'B': B, 'B_inv': B_inv, 'N': N, 'CB': CB, 'CN': CN,
        'b': b, 'basis': basis, 'nonbasic': nonbasic,
        'all_vars': all_vars, 'col_types': col_types,
        'sense': solver.sense, 'c': c,
        'm': m, 'n_total': n_total,
        'xB': xB, 'z_star': z_star,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────

def _finite_or_none(v: Any) -> float | None:
    """Coerce numpy scalars to Python floats; map NaN/Inf/None to None."""
    if v is None:
        return None
    try:
        f = float(v)
        if not np.isfinite(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def _fmt(x: float, places: int = 4) -> str:
    """Format a scalar for display: drop trailing zeros, show fractions prettily."""
    if abs(x) < 1e-10:
        return '0'
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return f"{x:.{places}f}".rstrip('0').rstrip('.')


def _fmt_vec(v: np.ndarray, places: int = 4) -> str:
    return "[" + "  ".join(_fmt(x, places) for x in np.asarray(v).ravel()) + "]"


def _fmt_matrix(M: np.ndarray, places: int = 4) -> list[str]:
    """Render a matrix as a list of strings, one per row."""
    M = np.asarray(M)
    if M.ndim == 1:
        M = M.reshape(1, -1)
    col_strs = [[_fmt(x, places) for x in row] for row in M]
    # Pad columns to equal width for alignment
    widths = [max(len(col_strs[r][c]) for r in range(len(col_strs)))
              for c in range(len(col_strs[0]))]
    lines = []
    for r in range(len(col_strs)):
        row = "  ".join(col_strs[r][c].rjust(widths[c]) for c in range(len(widths)))
        lines.append(f"[ {row} ]")
    return lines


def _var_name(mf: dict, col_idx: int) -> str:
    return mf['all_vars'][col_idx]


def _find_col(mf: dict, var_name: str) -> int:
    """Find column index by variable name (case-insensitive)."""
    target = var_name.strip().lower()
    for j, v in enumerate(mf['all_vars']):
        if v.lower() == target:
            return j
    raise ValueError(f"Variable {var_name!r} not found in {mf['all_vars']}")


def _optimality_sign(sense: str) -> str:
    """For MIN, optimal reduced costs must be ≤ 0. For MAX, ≥ 0."""
    return '≤' if sense == 'min' else '≥'


# ── §8.3.1: Change OF coefficient of a BASIC variable ────────────────────────

def of_coeff_range_basic(solver, var_name: str) -> dict[str, Any]:
    """
    Find the range of Δ such that adding Δ to the OF coefficient of a BASIC
    variable keeps the current optimal basis optimal.

    Δ changes C_B, which changes C̄_N = C_B·B⁻¹·N − C_N. For each nonbasic j,
    C̄_N[j] gets an added Δ·(k-th row of B⁻¹·N)[j] where k is the basis
    position of the variable.

    For MIN, require C̄_N[j] ≤ 0 for all j. For MAX, ≥ 0.
    """
    mf = extract_matrix_form(solver)
    sense = mf['sense']
    col = _find_col(mf, var_name)
    if col not in mf['basis']:
        raise ValueError(f"{var_name} is not a basic variable (basis = "
                         f"{[_var_name(mf, j) for j in mf['basis']]})")

    k = mf['basis'].index(col)  # basis position
    B_inv_N = mf['B_inv'] @ mf['N']                # (m × k_nonbasic)
    current_CbarN = mf['CB'] @ B_inv_N - mf['CN']  # (k_nonbasic,)
    row_k = B_inv_N[k, :]                           # coefficient of Δ in each C̄_N[j]

    # For each nonbasic j: current_CbarN[j] + Δ·row_k[j]  {≤ 0 for MIN, ≥ 0 for MAX}
    delta_min, delta_max = -np.inf, np.inf
    binding: list[dict] = []
    for idx, j in enumerate(mf['nonbasic']):
        a = row_k[idx]
        c = current_CbarN[idx]
        # c + a·Δ (≤0 for MIN | ≥0 for MAX)
        if abs(a) < 1e-12:
            continue  # no constraint on Δ from this variable
        if sense == 'min':
            # a·Δ ≤ -c
            bound = -c / a
            if a > 0:
                delta_max = min(delta_max, bound)
            else:
                delta_min = max(delta_min, bound)
        else:  # max
            # a·Δ ≥ -c
            bound = -c / a
            if a > 0:
                delta_min = max(delta_min, bound)
            else:
                delta_max = min(delta_max, bound)
        binding.append({
            'var': _var_name(mf, j),
            'current_reduced_cost': float(c),
            'delta_coefficient': float(a),
            'derived_bound': float(bound),
        })

    steps = []
    steps.append(f"Basic variable: {var_name} at basis position {k}")
    steps.append(f"Current reduced costs C̄_N = {_fmt_vec(current_CbarN)}  (for nonbasic "
                 f"{[_var_name(mf, j) for j in mf['nonbasic']]})")
    steps.append(f"Row {k} of B⁻¹·N = {_fmt_vec(row_k)}  (Δ's coefficient in each C̄_N[j])")
    opt = _optimality_sign(sense)
    for b in binding:
        steps.append(
            f"  {_fmt(b['current_reduced_cost'])} + ({_fmt(b['delta_coefficient'])})·Δ {opt} 0"
            f"   →   Δ {'≤' if b['delta_coefficient'] > 0 else '≥'} {_fmt(b['derived_bound'])}"
            + (f"  (from column {b['var']})" if b['var'] else '')
        )

    # Original coefficient value (textbook c_j^old)
    c_old = float(mf['c'][col])
    range_str = (
        f"{_fmt(delta_min) if np.isfinite(delta_min) else '−∞'}"
        f"  ≤  Δ  ≤  "
        f"{_fmt(delta_max) if np.isfinite(delta_max) else '+∞'}"
    )
    new_c_low = (c_old + delta_min) if np.isfinite(delta_min) else float('-inf')
    new_c_high = (c_old + delta_max) if np.isfinite(delta_max) else float('inf')

    return {
        'operation': '§8.3.1 — OF coefficient of a basic variable',
        'formula': 'C̄_N_new = C_B_new · B⁻¹ · N − C_N  where C_B_new = C_B + Δ·e_k',
        'steps': steps,
        'result': {
            'variable': var_name,
            'current_coefficient': c_old,
            'delta_min': float(delta_min) if np.isfinite(delta_min) else None,
            'delta_max': float(delta_max) if np.isfinite(delta_max) else None,
            'new_coefficient_range': {
                'min': None if not np.isfinite(new_c_low) else new_c_low,
                'max': None if not np.isfinite(new_c_high) else new_c_high,
            },
            'binding_constraints': binding,
        },
        'conclusion': (
            f"Current optimal basis stays optimal as long as the coefficient of "
            f"{var_name} stays in [{_fmt(new_c_low) if np.isfinite(new_c_low) else '−∞'}, "
            f"{_fmt(new_c_high) if np.isfinite(new_c_high) else '+∞'}].  "
            f"Equivalently, Δ in [{range_str}]."
        ),
    }


# ── §8.3.2: Change OF coefficient of a NONBASIC variable ─────────────────────

def of_coeff_range_nonbasic(solver, var_name: str) -> dict[str, Any]:
    """
    Find the range of Δ such that adding Δ to the OF coefficient of a NONBASIC
    variable keeps the current optimal basis optimal.

    Δ only affects the single reduced cost of that variable:
      c̄_j_new = C_B·B⁻¹·a_j − (c_j + Δ) = (current c̄_j) − Δ

    For MIN, require c̄_j_new ≤ 0. For MAX, ≥ 0. OF value does NOT change.
    """
    mf = extract_matrix_form(solver)
    sense = mf['sense']
    col = _find_col(mf, var_name)
    if col in mf['basis']:
        raise ValueError(f"{var_name} is basic — use of_coeff_range_basic() instead")

    a_j = mf['N'][:, mf['nonbasic'].index(col)]
    current_cbar = float(mf['CB'] @ (mf['B_inv'] @ a_j) - mf['c'][col])
    # c̄_j_new = current_cbar − Δ. Require (≤0 for MIN | ≥0 for MAX).
    if sense == 'min':
        # current_cbar - Δ ≤ 0  →  Δ ≥ current_cbar
        delta_min, delta_max = current_cbar, np.inf
    else:
        # current_cbar - Δ ≥ 0  →  Δ ≤ current_cbar
        delta_min, delta_max = -np.inf, current_cbar

    c_old = float(mf['c'][col])
    new_c_low = (c_old + delta_min) if np.isfinite(delta_min) else float('-inf')
    new_c_high = (c_old + delta_max) if np.isfinite(delta_max) else float('inf')

    steps = [
        f"Nonbasic variable: {var_name}",
        f"a_{var_name} (original column) = {_fmt_vec(a_j)}",
        f"c̄_{var_name} = C_B · B⁻¹ · a_{var_name} − c_{var_name} = {_fmt(current_cbar)}",
        f"After Δ change: c̄_{var_name}_new = {_fmt(current_cbar)} − Δ",
        (f"MIN optimality: {_fmt(current_cbar)} − Δ ≤ 0   →   Δ ≥ {_fmt(current_cbar)}"
         if sense == 'min' else
         f"MAX optimality: {_fmt(current_cbar)} − Δ ≥ 0   →   Δ ≤ {_fmt(current_cbar)}"),
    ]

    return {
        'operation': '§8.3.2 — OF coefficient of a nonbasic variable',
        'formula': 'c̄_j_new = C_B · B⁻¹ · a_j − (c_j + Δ) = (current c̄_j) − Δ',
        'steps': steps,
        'result': {
            'variable': var_name,
            'current_coefficient': c_old,
            'current_reduced_cost': current_cbar,
            'delta_min': float(delta_min) if np.isfinite(delta_min) else None,
            'delta_max': float(delta_max) if np.isfinite(delta_max) else None,
            'new_coefficient_range': {
                'min': None if not np.isfinite(new_c_low) else new_c_low,
                'max': None if not np.isfinite(new_c_high) else new_c_high,
            },
            'note': 'The OF value does not change as long as the basis is unchanged.',
        },
        'conclusion': (
            f"Coefficient of {var_name} can range over "
            f"[{_fmt(new_c_low) if np.isfinite(new_c_low) else '−∞'}, "
            f"{_fmt(new_c_high) if np.isfinite(new_c_high) else '+∞'}] without changing "
            f"the optimal basis or OF value."
        ),
    }


# ── §8.3.3: Change RHS of a constraint ───────────────────────────────────────

def rhs_range(solver, constraint_idx: int) -> dict[str, Any]:
    """
    Find the range of Δ such that adding Δ to b[constraint_idx] keeps the
    current basis feasible (b̄ = B⁻¹·b stays ≥ 0).

    The new RHS vector is b̄_new = B⁻¹·(b + Δ·e_i) = B⁻¹·b + Δ·(i-th column of B⁻¹).
    Require each component ≥ 0.
    """
    mf = extract_matrix_form(solver)
    m = mf['m']
    if not (0 <= constraint_idx < m):
        raise ValueError(f"constraint_idx must be in [0, {m}), got {constraint_idx}")

    col_of_Binv = mf['B_inv'][:, constraint_idx]  # coefficient of Δ in each b̄[k]
    current_bbar = mf['xB']                         # m-vector

    delta_min, delta_max = -np.inf, np.inf
    binding: list[dict] = []
    for k in range(m):
        a = col_of_Binv[k]
        c = current_bbar[k]
        # c + a·Δ ≥ 0
        if abs(a) < 1e-12:
            continue
        bound = -c / a
        if a > 0:
            delta_min = max(delta_min, bound)
        else:
            delta_max = min(delta_max, bound)
        binding.append({
            'basic_var': _var_name(mf, mf['basis'][k]),
            'current_value': float(c),
            'delta_coefficient': float(a),
            'derived_bound': float(bound),
        })

    b_old = float(mf['b'][constraint_idx])
    new_b_low = (b_old + delta_min) if np.isfinite(delta_min) else float('-inf')
    new_b_high = (b_old + delta_max) if np.isfinite(delta_max) else float('inf')

    steps = [
        f"Constraint index: {constraint_idx + 1}  (textbook 1-indexed)",
        f"Current RHS: b[{constraint_idx + 1}] = {_fmt(b_old)}",
        f"b̄_new = B⁻¹·b + Δ·(column {constraint_idx + 1} of B⁻¹)",
        f"B⁻¹ column {constraint_idx + 1} = {_fmt_vec(col_of_Binv)}",
        f"Current b̄ = {_fmt_vec(current_bbar)}",
        f"Nonnegativity b̄_new ≥ 0 gives:",
    ]
    for b in binding:
        a = b['delta_coefficient']
        steps.append(
            f"  {_fmt(b['current_value'])} + ({_fmt(a)})·Δ ≥ 0"
            f"   →   Δ {'≥' if a > 0 else '≤'} {_fmt(b['derived_bound'])}"
            f"  (from basic variable {b['basic_var']})"
        )

    return {
        'operation': '§8.3.3 — RHS of a constraint',
        'formula': 'b̄_new = B⁻¹ · (b + Δ·e_i)  ≥  0',
        'steps': steps,
        'result': {
            'constraint_index': constraint_idx + 1,
            'current_rhs': b_old,
            'delta_min': float(delta_min) if np.isfinite(delta_min) else None,
            'delta_max': float(delta_max) if np.isfinite(delta_max) else None,
            'new_rhs_range': {
                'min': None if not np.isfinite(new_b_low) else new_b_low,
                'max': None if not np.isfinite(new_b_high) else new_b_high,
            },
            'binding_variables': binding,
        },
        'conclusion': (
            f"RHS of constraint {constraint_idx + 1} can range over "
            f"[{_fmt(new_b_low) if np.isfinite(new_b_low) else '−∞'}, "
            f"{_fmt(new_b_high) if np.isfinite(new_b_high) else '+∞'}] and the current "
            f"basis stays feasible. Outside this range, dual simplex is needed."
        ),
    }


# ── §8.3.3.1: Shadow prices ──────────────────────────────────────────────────

def shadow_prices(solver) -> dict[str, Any]:
    """
    Compute the shadow price of each original constraint.

    Shadow price of constraint i = change in z per unit increase of b_i
                                 = (CB · B⁻¹)[i]

    This is the i-th component of y = CB·B⁻¹ (the dual solution / simplex multipliers).
    A shadow price of 0 means the constraint has slack — adding resources doesn't help.
    """
    mf = extract_matrix_form(solver)
    y = mf['CB'] @ mf['B_inv']  # (m,) — dual vector
    sense = mf['sense']

    prices = []
    for i in range(mf['m']):
        sp = float(y[i])
        prices.append({
            'constraint': i + 1,
            'shadow_price': sp,
            'interpretation': _shadow_price_interp(sp, sense),
        })

    steps = [
        'Shadow price vector y = C_B · B⁻¹',
        f'C_B = {_fmt_vec(mf["CB"])}',
        'B⁻¹ =',
        *(f'   {line}' for line in _fmt_matrix(mf['B_inv'])),
        f'y = C_B · B⁻¹ = {_fmt_vec(y)}',
    ]

    return {
        'operation': '§8.3.3.1 — shadow prices',
        'formula': 'y = C_B · B⁻¹   (y[i] = change in z per unit added to b[i])',
        'steps': steps,
        'result': {
            'dual_vector': y.tolist(),
            'prices': prices,
        },
        'conclusion': (
            'Nonzero shadow prices identify binding constraints whose resources are '
            'worth expanding (or restricting). Zero shadow price ⇒ slack in that '
            'constraint ⇒ no value in adding more of that resource.'
        ),
    }


def sensitivity_summary(solver) -> dict[str, Any]:
    """
    Aggregated single-call summary for the interactive Sensitivity lens.

    Returns matrix form + all coefficient ranges + all RHS ranges + shadow
    prices in one flat structure, so the frontend can build a full slider
    panel without making N separate API calls.

    Output shape (all arrays serialized as lists):
      {
        'sense': 'max' | 'min',
        'basis_vars':  [...],     # lowercase names in basis order
        'nonbasic_vars': [...],   # lowercase names in nonbasic order
        'decision_vars': [...],   # original decision variable names (lowercase)
        'B_inv': [[...]],
        'xB': [...],
        'z_star': float,
        'shadow_prices': [float, ...],   # length m, in constraint order
        'coefficient_ranges': [          # one entry per decision variable
          {
            'variable': 'x1',
            'current_value': float,
            'is_basic': bool,
            'delta_min': float | None,
            'delta_max': float | None,
            'value_min': float | None,
            'value_max': float | None,
          }, ...
        ],
        'rhs_ranges': [                  # one entry per original constraint
          {
            'constraint_index': int (1-based),
            'current_rhs': float,
            'delta_min': float | None,
            'delta_max': float | None,
            'value_min': float | None,
            'value_max': float | None,
            'shadow_price': float,
          }, ...
        ],
      }
    """
    mf = extract_matrix_form(solver)
    basis = mf['basis']
    all_vars = mf['all_vars']
    col_types = mf['col_types']

    basis_var_names = [all_vars[j] for j in basis]
    nonbasic_var_names = [all_vars[j] for j in mf['nonbasic']]
    decision_var_names = [all_vars[j] for j, t in enumerate(col_types) if t == 'decision']

    # Shadow prices y = C_B · B⁻¹
    y = mf['CB'] @ mf['B_inv']

    # Coefficient ranges for every decision variable (basic or nonbasic)
    coeff_ranges = []
    for v in decision_var_names:
        col = _find_col(mf, v)
        is_basic = col in basis
        try:
            if is_basic:
                res = of_coeff_range_basic(solver, v)['result']
            else:
                res = of_coeff_range_nonbasic(solver, v)['result']
            coeff_ranges.append({
                'variable': v,
                'current_value': float(mf['c'][col]),
                'is_basic': bool(is_basic),
                'delta_min': _finite_or_none(res.get('delta_min')),
                'delta_max': _finite_or_none(res.get('delta_max')),
                'value_min': _finite_or_none(res.get('new_coefficient_range', {}).get('min')),
                'value_max': _finite_or_none(res.get('new_coefficient_range', {}).get('max')),
            })
        except Exception as e:
            coeff_ranges.append({
                'variable': v, 'current_value': float(mf['c'][col]), 'is_basic': bool(is_basic),
                'delta_min': None, 'delta_max': None, 'value_min': None, 'value_max': None,
                'error': str(e),
            })

    # RHS ranges for each original constraint
    rhs_ranges_list = []
    for i in range(mf['m']):
        try:
            res = rhs_range(solver, i)['result']
            rhs_ranges_list.append({
                'constraint_index': i + 1,
                'current_rhs': float(mf['b'][i]),
                'delta_min': _finite_or_none(res.get('delta_min')),
                'delta_max': _finite_or_none(res.get('delta_max')),
                'value_min': _finite_or_none(res.get('new_rhs_range', {}).get('min')),
                'value_max': _finite_or_none(res.get('new_rhs_range', {}).get('max')),
                'shadow_price': float(y[i]),
            })
        except Exception as e:
            rhs_ranges_list.append({
                'constraint_index': i + 1,
                'current_rhs': float(mf['b'][i]),
                'delta_min': None, 'delta_max': None,
                'value_min': None, 'value_max': None,
                'shadow_price': float(y[i]),
                'error': str(e),
            })

    return {
        'sense': mf['sense'],
        'basis_vars': basis_var_names,
        'nonbasic_vars': nonbasic_var_names,
        'decision_vars': decision_var_names,
        'B_inv': mf['B_inv'].tolist(),
        'xB': mf['xB'].tolist(),
        'z_star': mf['z_star'],
        'shadow_prices': y.tolist(),
        'coefficient_ranges': coeff_ranges,
        'rhs_ranges': rhs_ranges_list,
    }


def _shadow_price_interp(sp: float, sense: str) -> str:
    if abs(sp) < 1e-9:
        return 'nonbinding (slack in this constraint — adding resources has no effect)'
    if sense == 'min':
        if sp < 0:
            return f'adding 1 unit reduces z by {_fmt(-sp)} (cost reduction — beneficial)'
        return f'adding 1 unit increases z by {_fmt(sp)} (cost increase)'
    else:  # max
        if sp > 0:
            return f'adding 1 unit increases z by {_fmt(sp)} (revenue gain — beneficial)'
        return f'adding 1 unit decreases z by {_fmt(-sp)}'


# ── §8.3.5: Add a new decision variable (new activity) ───────────────────────

def add_activity(solver, a_new: list[float], c_new: float,
                 var_label: str = 'x_new') -> dict[str, Any]:
    """
    Propose adding a new decision variable x_new with constraint coefficient
    vector a_new and OF coefficient c_new. Check if current basis remains optimal.

    Compute reduced cost:
        c̄_new = C_B · B⁻¹ · a_new − c_new
    For MIN optimality, need c̄_new ≤ 0. For MAX, ≥ 0.
    If violated, the current solution is no longer optimal; the variable would
    enter the basis and simplex would continue.
    """
    mf = extract_matrix_form(solver)
    a = np.asarray(a_new, dtype=float)
    if a.shape != (mf['m'],):
        raise ValueError(f"a_new must have length {mf['m']}, got {a.shape}")

    Binv_a = mf['B_inv'] @ a                  # new column in optimal table
    cbar = float(mf['CB'] @ Binv_a - c_new)   # reduced cost in optimal table

    sense = mf['sense']
    if sense == 'min':
        still_optimal = cbar <= 1e-9
        opt_condition = f"c̄_{var_label} = {_fmt(cbar)} {'≤' if still_optimal else '>'} 0"
    else:
        still_optimal = cbar >= -1e-9
        opt_condition = f"c̄_{var_label} = {_fmt(cbar)} {'≥' if still_optimal else '<'} 0"

    steps = [
        f"Proposed new variable: {var_label}",
        f"Original column a_{var_label} = {_fmt_vec(a)}",
        f"OF coefficient c_{var_label} = {_fmt(c_new)}",
        f"Transformed column (optimal table): ā_{var_label} = B⁻¹·a_{var_label} = {_fmt_vec(Binv_a)}",
        f"Reduced cost c̄_{var_label} = C_B·B⁻¹·a_{var_label} − c_{var_label}"
        f"  = {_fmt(float(mf['CB'] @ Binv_a))} − ({_fmt(c_new)}) = {_fmt(cbar)}",
        f"Optimality check for {sense.upper()}: {opt_condition}",
    ]

    if still_optimal:
        conclusion = (f"{var_label} would not enter the basis. The current optimal "
                      "solution is unchanged, and adding this activity is NOT "
                      "profitable (for MAX) or cost-reducing (for MIN).")
    else:
        conclusion = (f"{var_label} WOULD enter the basis. The current solution is "
                      f"no longer optimal; continue simplex with {var_label} as the "
                      "entering variable using the new column ā above.")

    return {
        'operation': '§8.3.5 — add a new activity (decision variable)',
        'formula': 'c̄_new = C_B · B⁻¹ · a_new − c_new',
        'steps': steps,
        'result': {
            'variable': var_label,
            'a_new': a.tolist(),
            'c_new': float(c_new),
            'transformed_column': Binv_a.tolist(),
            'reduced_cost': cbar,
            'still_optimal': bool(still_optimal),
        },
        'conclusion': conclusion,
    }


# ── §8.3.6: Add a new constraint ─────────────────────────────────────────────

def add_constraint(solver, coefficients: list[float], operator: str,
                   rhs: float) -> dict[str, Any]:
    """
    Propose adding a new constraint: (coefficients·x) {op} rhs
    where op ∈ {'<=', '>=', '='}. 'coefficients' has length = number of
    original decision variables.

    Plug the current optimal x* into the new constraint:
      • if satisfied   → current solution remains optimal, no action.
      • if violated    → current solution is cut off; must re-solve. Standardize
                         by adding a slack variable (flip sign if ≥) and use the
                         dual simplex method. We report what the new row would
                         look like without actually running dual simplex.
    """
    mf = extract_matrix_form(solver)

    # Count original decision variables
    n_dec = sum(1 for t in mf['col_types'] if t == 'decision')
    coeffs = np.asarray(coefficients, dtype=float)
    if coeffs.shape != (n_dec,):
        raise ValueError(f"coefficients must have length {n_dec} (number of decision "
                         f"vars), got {coeffs.shape}")

    # Build current optimal x for decision variables only
    x_current = np.zeros(n_dec)
    dec_cols = [j for j, t in enumerate(mf['col_types']) if t == 'decision']
    for k, bv in enumerate(mf['basis']):
        if bv in dec_cols:
            pos = dec_cols.index(bv)
            x_current[pos] = float(mf['xB'][k])

    lhs_value = float(coeffs @ x_current)

    if operator == '<=':
        satisfied = lhs_value <= rhs + 1e-9
    elif operator == '>=':
        satisfied = lhs_value >= rhs - 1e-9
    elif operator == '=':
        satisfied = abs(lhs_value - rhs) < 1e-9
    else:
        raise ValueError(f"operator must be '<=', '>=', or '=', got {operator!r}")

    steps = [
        f"Proposed new constraint: {_fmt_expr(coeffs, dec_cols, mf)}  {operator}  {_fmt(rhs)}",
        f"Current optimal x = {_fmt_vec(x_current)}",
        f"LHS evaluated at x*: {_fmt(lhs_value)}  {operator}  {_fmt(rhs)}  →  "
        f"{'SATISFIED' if satisfied else 'VIOLATED'}",
    ]

    if satisfied:
        conclusion = ("Current optimal solution already satisfies the new constraint. "
                      "No re-solving needed.")
        return {
            'operation': '§8.3.6 — add a new constraint',
            'formula': 'Substitute x* into new constraint, check feasibility',
            'steps': steps,
            'result': {
                'coefficients': coeffs.tolist(),
                'operator': operator,
                'rhs': float(rhs),
                'x_current': x_current.tolist(),
                'lhs_value': lhs_value,
                'satisfied': True,
            },
            'conclusion': conclusion,
        }

    # Violated path — describe what dual simplex would start with.
    # Standardize: if ≥, multiply through by −1 to turn into ≤, then add slack.
    # If =, would need artificial (not implemented here).
    std_coeffs = coeffs.copy()
    std_rhs = rhs
    std_op = operator
    if operator == '>=':
        std_coeffs = -std_coeffs
        std_rhs = -rhs
        std_op = '<='
        steps.append(f"Standardize ≥: multiply by −1 → "
                     f"{_fmt_expr(std_coeffs, dec_cols, mf)}  ≤  {_fmt(std_rhs)}")

    steps.append(f"Add slack s_new: {_fmt_expr(std_coeffs, dec_cols, mf)} + s_new "
                 f"= {_fmt(std_rhs)}")
    steps.append("Append new row to optimal tableau; restore canonical form for "
                 "basic variables via EROs; then run DUAL SIMPLEX (table is optimal "
                 "in z-row but infeasible in RHS).")

    # Compute new row in terms of OPTIMAL table columns, after canonical restoration.
    # The textbook trick: the new row in the optimal-tableau coordinate system is
    # (a_new_dec, 1_slot_for_new_slack, 0s_for_original_slacks) - sum over basic
    # decision vars of the row it replaces. Here we just echo the standardized form
    # and let dual simplex handle it in the UI layer (functional scope).

    conclusion = ("Current solution violates the new constraint. Adding it cuts the "
                  "current optimum from the feasible region; the problem must be "
                  "re-solved. The dual simplex method is the standard approach — "
                  "add the new row, restore canonical form via EROs, iterate until "
                  "feasible again.")

    return {
        'operation': '§8.3.6 — add a new constraint',
        'formula': 'Substitute x* into new constraint, check feasibility',
        'steps': steps,
        'result': {
            'coefficients': coeffs.tolist(),
            'operator': operator,
            'rhs': float(rhs),
            'x_current': x_current.tolist(),
            'lhs_value': lhs_value,
            'satisfied': False,
            'standardized_coefficients': std_coeffs.tolist(),
            'standardized_operator': std_op,
            'standardized_rhs': float(std_rhs),
        },
        'conclusion': conclusion,
    }


def _fmt_expr(coeffs: np.ndarray, dec_cols: list[int], mf: dict) -> str:
    """Render  3x1 + 2x2 − 1x3  style expression from a coefficient vector."""
    parts = []
    for i, c in enumerate(coeffs):
        name = mf['all_vars'][dec_cols[i]] if i < len(dec_cols) else f'x{i + 1}'
        if abs(c) < 1e-10:
            continue
        sign = '+' if c > 0 else '−'
        mag = _fmt(abs(c))
        coef = '' if mag == '1' else mag
        parts.append(f"{sign} {coef}{name}")
    if not parts:
        return '0'
    # Drop leading '+ '
    joined = ' '.join(parts)
    if joined.startswith('+ '):
        joined = joined[2:]
    return joined
