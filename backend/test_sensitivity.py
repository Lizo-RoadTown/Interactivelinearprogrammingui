"""
test_sensitivity.py — verify sensitivity.py against Chapter 8 Example 8.1.

Run:  python -m backend.test_sensitivity
      (from the InteractiveLPUI root)
"""

import numpy as np
from backend.solver_core import SimplexSolver
from backend import sensitivity as sa


# ── Example 8.1 fixture ──────────────────────────────────────────────────────
# Min z = 4x1 + 6x2 - 6x3 - 5x4
#   x1 + x2 + x3          <= 50
#  2x1 + 3x2        + x4  <= 42
#              3x3  - x4  <= 250
#   all >= 0

SENSE = 'min'
OBJ = {'X1': 4.0, 'X2': 6.0, 'X3': -6.0, 'X4': -5.0}
CONSTRAINTS = [
    ({'X1': 1.0, 'X2': 1.0, 'X3': 1.0, 'X4': 0.0}, '<=', 50.0),
    ({'X1': 2.0, 'X2': 3.0, 'X3': 0.0, 'X4': 1.0}, '<=', 42.0),
    ({'X1': 0.0, 'X2': 0.0, 'X3': 3.0, 'X4': -1.0}, '<=', 250.0),
]
VAR_NAMES = ['X1', 'X2', 'X3', 'X4']


def _approx(a, b, tol=1e-6):
    return abs(a - b) < tol


def _vec_approx(a, b, tol=1e-6):
    a = np.asarray(a); b = np.asarray(b)
    return a.shape == b.shape and np.allclose(a, b, atol=tol)


def test_solve_and_matrix_form():
    solver = SimplexSolver(SENSE, OBJ, CONSTRAINTS, VAR_NAMES)
    assert solver.status == 'optimal', f"expected 'optimal', got {solver.status}"

    mf = sa.extract_matrix_form(solver)

    # Basis from Table 8.6 should be [x3, x4, s3] (column indices 2, 3, 6)
    basis_names = [mf['all_vars'][j].lower() for j in mf['basis']]
    print(f"  basis variables: {basis_names}")
    assert set(basis_names) == {'x3', 'x4', 's3'}, f"basis mismatch: {basis_names}"

    # B⁻¹ should match textbook equation (8.11)
    # B_inv = [[1,0,0],[0,1,0],[-3,1,1]] WHEN basis is ordered [x3, x4, s3]
    # Since basis order may differ, reorder to check.
    x3_pos = basis_names.index('x3')
    x4_pos = basis_names.index('x4')
    s3_pos = basis_names.index('s3')
    order = [x3_pos, x4_pos, s3_pos]
    B_inv_reordered = mf['B_inv'][order][:, order]
    expected_Binv = np.array([[1, 0, 0], [0, 1, 0], [-3, 1, 1]], dtype=float)
    assert _vec_approx(B_inv_reordered, expected_Binv), \
        f"B⁻¹ mismatch:\n{B_inv_reordered}\nexpected:\n{expected_Binv}"
    print(f"  B⁻¹ matches textbook (8.11) ✓")

    # xB (= B⁻¹·b) should be [50, 42, 142] when ordered [x3, x4, s3]
    xB_reordered = mf['xB'][order]
    expected_xB = np.array([50, 42, 142], dtype=float)
    assert _vec_approx(xB_reordered, expected_xB), \
        f"xB mismatch: {xB_reordered}, expected {expected_xB}"
    print(f"  B⁻¹·b = {xB_reordered} matches textbook (8.15) ✓")

    # z* should be -510
    assert _approx(mf['z_star'], -510.0), f"z* = {mf['z_star']}, expected -510"
    print(f"  z* = {mf['z_star']} matches textbook (8.16) ✓")

    return solver


def test_example_8_2_basic_coeff_range(solver):
    """Example 8.2: change c_x3 (basic). Expect Δ ≤ 6, i.e. c_x3_new ≤ 0."""
    result = sa.of_coeff_range_basic(solver, 'x3')
    r = result['result']
    print(f"  Δ ≤ {r['delta_max']} (expected 6)")
    assert _approx(r['delta_max'], 6.0), f"expected Δ_max = 6, got {r['delta_max']}"
    # Lower bound: textbook Example 8.2 gives Δ ≤ 6 with intersection. Three inequalities:
    #   -20+Δ ≤ 0  →  Δ ≤ 20
    #   -27+Δ ≤ 0  →  Δ ≤ 27
    #    -6+Δ ≤ 0  →  Δ ≤ 6
    # No lower bound from these. Δ_min = -∞.
    assert r['delta_min'] is None, f"expected Δ_min = None, got {r['delta_min']}"
    # New coefficient upper bound: -6 + 6 = 0
    assert _approx(r['new_coefficient_range']['max'], 0.0), \
        f"expected c_x3 ≤ 0, got {r['new_coefficient_range']['max']}"
    print(f"  ✓ Example 8.2 passes")


def test_example_8_5_nonbasic_coeff_range(solver):
    """Example 8.5: change c_x1 (nonbasic). Expect Δ ≥ -20."""
    result = sa.of_coeff_range_nonbasic(solver, 'x1')
    r = result['result']
    print(f"  Δ ≥ {r['delta_min']} (expected -20)")
    assert _approx(r['delta_min'], -20.0), f"expected Δ_min = -20, got {r['delta_min']}"
    assert r['delta_max'] is None, f"expected Δ_max = None (MIN + nonbasic)"
    # current_reduced_cost should be -20 per textbook
    assert _approx(r['current_reduced_cost'], -20.0), \
        f"expected c̄_x1 = -20, got {r['current_reduced_cost']}"
    print(f"  ✓ Example 8.5 passes")


def test_example_8_7_rhs_range(solver):
    """Example 8.7: change b_1. Expect -50 ≤ Δ ≤ 47.33 (≈ 142/3)."""
    # Find constraint 1 — first constraint is x1+x2+x3 ≤ 50
    result = sa.rhs_range(solver, constraint_idx=0)
    r = result['result']
    print(f"  Δ range: [{r['delta_min']}, {r['delta_max']}] (expected [-50, ~47.33])")
    assert _approx(r['delta_min'], -50.0), f"expected Δ_min = -50, got {r['delta_min']}"
    assert _approx(r['delta_max'], 142.0 / 3.0), \
        f"expected Δ_max = 142/3 ≈ 47.33, got {r['delta_max']}"
    print(f"  ✓ Example 8.7 passes")


def test_example_8_9_shadow_prices(solver):
    """Example 8.9: shadow prices are -6, -5, 0 for constraints 1,2,3."""
    result = sa.shadow_prices(solver)
    prices = result['result']['prices']
    for p in prices:
        print(f"  constraint {p['constraint']}: shadow price = {p['shadow_price']}")
    sp = {p['constraint']: p['shadow_price'] for p in prices}
    assert _approx(sp[1], -6.0), f"expected shadow price 1 = -6, got {sp[1]}"
    assert _approx(sp[2], -5.0), f"expected shadow price 2 = -5, got {sp[2]}"
    assert _approx(sp[3], 0.0), f"expected shadow price 3 = 0, got {sp[3]}"
    print(f"  ✓ Example 8.9 passes")


def test_example_8_12_add_activity(solver):
    """Example 8.12: add x5 with a=[3,2,-1], c=15. Expect c̄_x5 = -43, still optimal."""
    result = sa.add_activity(solver, a_new=[3, 2, -1], c_new=15, var_label='x5')
    r = result['result']
    print(f"  c̄_x5 = {r['reduced_cost']} (expected -43)")
    assert _approx(r['reduced_cost'], -43.0), \
        f"expected c̄_x5 = -43, got {r['reduced_cost']}"
    assert r['still_optimal'] is True, "expected still optimal (MIN + c̄ ≤ 0)"
    # Transformed column should be [3, 2, -8]
    assert _vec_approx(r['transformed_column'], [3, 2, -8]), \
        f"expected ā_x5 = [3, 2, -8], got {r['transformed_column']}"
    print(f"  ✓ Example 8.12 passes")


def test_example_8_14_add_constraint_satisfied(solver):
    """Example 8.14: add x1+x2+x3 ≥ 50. At x*=(0,0,50,42), LHS = 50 ≥ 50 ✓."""
    result = sa.add_constraint(solver, coefficients=[1, 1, 1, 0],
                               operator='>=', rhs=50)
    r = result['result']
    print(f"  LHS = {r['lhs_value']} (expected 50), satisfied = {r['satisfied']}")
    assert _approx(r['lhs_value'], 50.0), f"expected LHS = 50, got {r['lhs_value']}"
    assert r['satisfied'] is True, "expected satisfied"
    print(f"  ✓ Example 8.14 passes")


def test_example_8_15_add_constraint_violated(solver):
    """Example 8.15: add x1+x2+x3 ≤ 30. At x*=(0,0,50,42), LHS = 50 > 30 ✗."""
    result = sa.add_constraint(solver, coefficients=[1, 1, 1, 0],
                               operator='<=', rhs=30)
    r = result['result']
    print(f"  LHS = {r['lhs_value']} (expected 50), satisfied = {r['satisfied']}")
    assert _approx(r['lhs_value'], 50.0)
    assert r['satisfied'] is False, "expected violated"
    print(f"  ✓ Example 8.15 passes")


def main():
    print("Testing sensitivity.py against Chapter 8 Example 8.1 ...\n")

    print("1. Solve and extract matrix form")
    solver = test_solve_and_matrix_form()

    print("\n2. Example 8.2 — change c_x3 (basic)")
    test_example_8_2_basic_coeff_range(solver)

    print("\n3. Example 8.5 — change c_x1 (nonbasic)")
    test_example_8_5_nonbasic_coeff_range(solver)

    print("\n4. Example 8.7 — change b_1 (RHS)")
    test_example_8_7_rhs_range(solver)

    print("\n5. Example 8.9 — shadow prices")
    test_example_8_9_shadow_prices(solver)

    print("\n6. Example 8.12 — add activity x5")
    test_example_8_12_add_activity(solver)

    print("\n7. Example 8.14 — add satisfied constraint")
    test_example_8_14_add_constraint_satisfied(solver)

    print("\n8. Example 8.15 — add violated constraint")
    test_example_8_15_add_constraint_violated(solver)

    print("\n✓ All Chapter 8 Example 8.1 checks passed.\n")


if __name__ == '__main__':
    main()
