"""
reference_solutions.py — instructor copies of the three beginner functions.

Kept OUT of the normal import path (not used by the API) so beginners aren't
tempted to peek. Useful for:
  • Verifying the test suite is correct.
  • Demo fallback if someone needs a working version for presentation prep.

To use the reference solutions instead of the beginner stubs during
development, edit backend/main.py to import from this module.
"""

from typing import Any

VALID_DIFFICULTIES = {'beginner', 'intermediate', 'advanced'}
VALID_OBJECTIVE_TYPES = {'max', 'min'}
VALID_OPERATORS = {'<=', '>=', '='}


def list_problems_ref(bank, difficulty=None, category=None, search=None):
    result = []
    for p in bank:
        if difficulty and p.get('difficulty') != difficulty:
            continue
        if category and p.get('category') != category:
            continue
        if search:
            needle = search.lower()
            haystack = (p.get('title', '') + ' ' + p.get('scenario', '')).lower()
            if needle not in haystack:
                continue
        result.append(p)
    return result


def validate_problem_ref(problem: dict[str, Any]) -> list[str]:
    errors = []

    def require_nonempty_string(key):
        val = problem.get(key)
        if not isinstance(val, str) or not val.strip():
            errors.append(f"{key} is missing or not a non-empty string")
            return False
        return True

    require_nonempty_string('id')
    require_nonempty_string('title')
    require_nonempty_string('scenario')

    diff = problem.get('difficulty')
    if diff not in VALID_DIFFICULTIES:
        errors.append(f"difficulty {diff!r} is invalid "
                      f"(must be {', '.join(sorted(VALID_DIFFICULTIES))})")

    obj_type = problem.get('objectiveType')
    if obj_type not in VALID_OBJECTIVE_TYPES:
        errors.append(f"objectiveType {obj_type!r} is invalid (must be 'max' or 'min')")

    num_vars = problem.get('numVars')
    if not isinstance(num_vars, int) or isinstance(num_vars, bool) or num_vars <= 0:
        errors.append(f"numVars must be a positive integer, got {num_vars!r}")
        num_vars = None

    variables = problem.get('variables')
    if not isinstance(variables, list):
        errors.append("variables must be a list")
    elif num_vars is not None and len(variables) != num_vars:
        errors.append(f"variables has {len(variables)} entries but numVars is {num_vars}")

    obj_coeffs = problem.get('objectiveCoefficients')
    if not isinstance(obj_coeffs, list):
        errors.append("objectiveCoefficients must be a list")
    elif num_vars is not None and len(obj_coeffs) != num_vars:
        errors.append(f"objectiveCoefficients has {len(obj_coeffs)} entries "
                      f"but numVars is {num_vars}")

    cons = problem.get('constraints')
    if not isinstance(cons, list):
        errors.append("constraints must be a list")
    elif not cons:
        errors.append("constraints is empty (need at least one)")
    else:
        for i, c in enumerate(cons):
            if not isinstance(c, dict):
                errors.append(f"constraint #{i+1} is not a dict")
                continue
            coefs = c.get('coefficients')
            if not isinstance(coefs, list):
                errors.append(f"constraint #{i+1}: coefficients must be a list")
            elif num_vars is not None and len(coefs) != num_vars:
                errors.append(f"constraint #{i+1}: coefficients has {len(coefs)} entries "
                              f"but numVars is {num_vars}")
            op = c.get('operator')
            if op not in VALID_OPERATORS:
                errors.append(f"constraint #{i+1}: operator {op!r} is invalid "
                              f"(must be <=, >=, or =)")
            rhs = c.get('rhs')
            if not isinstance(rhs, (int, float)) or isinstance(rhs, bool):
                errors.append(f"constraint #{i+1}: rhs must be a number, got {rhs!r}")

    return errors


def export_to_markdown_ref(problem: dict[str, Any]) -> str:
    lines = []
    lines.append(f"# {problem.get('title', 'Untitled Problem')}")
    lines.append(f"*Difficulty: {problem.get('difficulty', 'unknown')}*")
    lines.append("")
    lines.append("## Scenario")
    lines.append("")
    lines.append(problem.get('scenario', ''))
    lines.append("")
    lines.append("## Your Task")
    lines.append("")
    lines.append("### 1. Decision Variables")
    lines.append("_Define what each variable represents in your own words:_")
    for v in problem.get('variables', []):
        lines.append(f"- {v} = _____")
    lines.append("")
    lines.append("### 2. Objective Function")
    lines.append("_Write the objective function:_")
    lines.append(f"- {problem.get('objectiveType', 'max')} z = _____")
    lines.append("")
    lines.append("### 3. Constraints")
    lines.append("_Write each constraint:_")
    for i, _ in enumerate(problem.get('constraints', []), start=1):
        lines.append(f"- Constraint {i}: _____")
    lines.append("")
    lines.append("### 4. Your Solution")
    lines.append("_Solve using the simplex method and show your work below:_")
    lines.append("")
    return "\n".join(lines)
