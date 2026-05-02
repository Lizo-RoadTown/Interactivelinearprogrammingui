"""
test_educator.py — beginners run this to verify their work.

Run from the InteractiveLPUI root:
    python -m backend.educator.test_educator

You should see which of the three beginner functions pass/fail.
"""

import traceback
from backend.educator.bank import load_bank


# ─────────────────────────────────────────────────────────────────────────────
# BEGINNER A — listing.py
# ─────────────────────────────────────────────────────────────────────────────

def test_listing():
    from backend.educator.listing import list_problems
    bank = load_bank()

    print("  Test 1: no filters returns all problems")
    result = list_problems(bank)
    assert len(result) == len(bank), f"expected {len(bank)} problems, got {len(result)}"

    print("  Test 2: difficulty='beginner' filter")
    result = list_problems(bank, difficulty='beginner')
    assert all(p['difficulty'] == 'beginner' for p in result), "not all beginner"
    assert len(result) >= 1, "expected at least one beginner problem"

    print("  Test 3: category='diet' filter")
    result = list_problems(bank, category='diet')
    assert all(p['category'] == 'diet' for p in result), "not all 'diet' category"

    print("  Test 4: search='protein' matches scenario text")
    result = list_problems(bank, search='protein')
    assert len(result) >= 1, "expected a problem mentioning 'protein'"
    for p in result:
        combined = (p.get('title', '') + ' ' + p.get('scenario', '')).lower()
        assert 'protein' in combined, f"search 'protein' not in {p.get('id')}"

    print("  Test 5: case-insensitive search")
    result_lower = list_problems(bank, search='bakery')
    result_upper = list_problems(bank, search='BAKERY')
    assert len(result_lower) == len(result_upper), \
        "case-insensitive search should return same count"

    print("  Test 6: combining filters (AND logic)")
    result = list_problems(bank, difficulty='beginner', category='production')
    assert all(p['difficulty'] == 'beginner' and p['category'] == 'production'
               for p in result), "combined filter failed"


# ─────────────────────────────────────────────────────────────────────────────
# BEGINNER B — validation.py
# ─────────────────────────────────────────────────────────────────────────────

VALID_PROBLEM = {
    'id': 'test-problem',
    'title': 'Test Problem',
    'category': 'production',
    'difficulty': 'beginner',
    'scenario': 'Some scenario text here.',
    'numVars': 2,
    'objectiveType': 'max',
    'objectiveCoefficients': [3, 2],
    'variables': ['x1', 'x2'],
    'constraints': [
        {'coefficients': [2, 1], 'operator': '<=', 'rhs': 100},
    ],
}


def test_validation():
    from backend.educator.validation import validate_problem

    print("  Test 1: a valid problem returns []")
    errors = validate_problem(VALID_PROBLEM)
    assert errors == [], f"expected [], got {errors}"

    print("  Test 2: missing title returns an error")
    bad = {**VALID_PROBLEM}; del bad['title']
    errors = validate_problem(bad)
    assert len(errors) >= 1, "expected at least one error for missing title"

    print("  Test 3: invalid difficulty returns an error")
    bad = {**VALID_PROBLEM, 'difficulty': 'expert'}
    errors = validate_problem(bad)
    assert any('difficulty' in e.lower() for e in errors), \
        f"expected an error mentioning 'difficulty', got {errors}"

    print("  Test 4: objectiveType 'maximize' (wrong) returns an error")
    bad = {**VALID_PROBLEM, 'objectiveType': 'maximize'}
    errors = validate_problem(bad)
    assert len(errors) >= 1, "expected error for bad objectiveType"

    print("  Test 5: objectiveCoefficients length mismatch")
    bad = {**VALID_PROBLEM, 'objectiveCoefficients': [1, 2, 3]}  # 3 coeffs but numVars=2
    errors = validate_problem(bad)
    assert len(errors) >= 1, "expected error for length mismatch"

    print("  Test 6: constraint with bad operator")
    bad = {**VALID_PROBLEM, 'constraints': [
        {'coefficients': [1, 1], 'operator': '!=', 'rhs': 5}
    ]}
    errors = validate_problem(bad)
    assert len(errors) >= 1, "expected error for bad operator"

    print("  Test 7: empty constraint list")
    bad = {**VALID_PROBLEM, 'constraints': []}
    errors = validate_problem(bad)
    assert len(errors) >= 1, "expected error for empty constraints"


# ─────────────────────────────────────────────────────────────────────────────
# BEGINNER C — export.py
# ─────────────────────────────────────────────────────────────────────────────

def test_export():
    from backend.educator.export import export_to_markdown

    print("  Test 1: output contains problem title")
    md = export_to_markdown(VALID_PROBLEM)
    assert 'Test Problem' in md, "title not in output"

    print("  Test 2: output contains 'Scenario' heading")
    assert 'Scenario' in md, "'Scenario' heading missing"

    print("  Test 3: output contains each variable")
    for v in VALID_PROBLEM['variables']:
        assert v in md, f"variable {v!r} not in output"

    print("  Test 4: output contains blanks for student to fill")
    assert '_____' in md or '______' in md, "expected blank underscore lines"

    print("  Test 5: output mentions each constraint (by index)")
    n = len(VALID_PROBLEM['constraints'])
    for i in range(1, n + 1):
        # Accept "Constraint 1", "1.", etc.
        assert str(i) in md, f"constraint index {i} not mentioned"

    print("  Test 6: output includes difficulty")
    assert VALID_PROBLEM['difficulty'] in md, "difficulty missing"


# ─────────────────────────────────────────────────────────────────────────────
# BEGINNER D — agent_validation.py
# ─────────────────────────────────────────────────────────────────────────────

def test_agent_validation():
    from backend.educator.agent_validation import validate_agent_output

    print("  Test 1: valid problem returns empty list")
    valid = dict(VALID_PROBLEM)
    errors = validate_agent_output(valid)
    assert errors == [], f"valid problem should have no errors, got {errors}"

    print("  Test 2: non-dict input is rejected with one error")
    for bad in [None, 'just a string', ['list', 'instead'], 42]:
        errors = validate_agent_output(bad)
        assert len(errors) == 1, f"non-dict {bad!r} should produce exactly one error"

    print("  Test 3: missing scenario flagged")
    bad = dict(VALID_PROBLEM)
    bad.pop('scenario')
    errors = validate_agent_output(bad)
    assert any('scenario' in e for e in errors), f"missing scenario not flagged: {errors}"

    print("  Test 4: numVars=0 flagged")
    bad = dict(VALID_PROBLEM)
    bad['numVars'] = 0
    errors = validate_agent_output(bad)
    assert any('numVars' in e for e in errors), f"numVars=0 not flagged: {errors}"

    print("  Test 5: variables length mismatch flagged")
    bad = dict(VALID_PROBLEM)
    bad['numVars'] = 3
    # variables stays at length 2
    errors = validate_agent_output(bad)
    assert any('variables' in e for e in errors), \
        f"variables length mismatch not flagged: {errors}"

    print("  Test 6: bad operator flagged")
    bad = dict(VALID_PROBLEM)
    bad['constraints'] = [{'coefficients': [1, 1], 'operator': '≤', 'rhs': 10}]
    errors = validate_agent_output(bad)
    assert any('operator' in e for e in errors), \
        f"unicode operator not flagged: {errors}"

    print("  Test 7: empty constraints list flagged")
    bad = dict(VALID_PROBLEM)
    bad['constraints'] = []
    errors = validate_agent_output(bad)
    assert any('constraints' in e for e in errors), \
        f"empty constraints not flagged: {errors}"


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

def _run(label, test_fn):
    print(f"\n─── {label} ──────────────────────────────────────────")
    try:
        test_fn()
    except NotImplementedError as e:
        print(f"  ⚠  {label} — not implemented yet")
        return None
    except AssertionError as e:
        print(f"  ✗  FAIL: {e}")
        return False
    except Exception:
        print(f"  ✗  ERROR:")
        traceback.print_exc()
        return False
    print(f"  ✓  {label} — all tests pass")
    return True


def main():
    print("=" * 60)
    print(" Educator Portal — beginner function tests")
    print("=" * 60)

    results = {
        'BEGINNER A (listing.py)':         _run('BEGINNER A — listing.py', test_listing),
        'BEGINNER B (validation.py)':      _run('BEGINNER B — validation.py', test_validation),
        'BEGINNER C (export.py)':          _run('BEGINNER C — export.py', test_export),
        'BEGINNER D (agent_validation.py)': _run('BEGINNER D — agent_validation.py', test_agent_validation),
    }

    print("\n" + "=" * 60)
    print(" Summary")
    print("=" * 60)
    for name, outcome in results.items():
        if outcome is True:
            print(f"  ✓ {name}")
        elif outcome is False:
            print(f"  ✗ {name}  (tests failed — fix and re-run)")
        else:
            print(f"  ⚠ {name}  (not implemented yet)")

    done = sum(1 for v in results.values() if v is True)
    print(f"\n{done}/{len(results)} complete.")


if __name__ == '__main__':
    main()
