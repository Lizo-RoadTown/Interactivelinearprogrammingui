"""
validation.py — BEGINNER B
==========================

Checks a word-problem dict for common errors and returns a list of
human-readable error messages. An empty list means "no errors".

A valid problem has this structure:

    {
      'id':                    'prod-mix-basic',       # required, non-empty string
      'title':                 'Bakery Production Mix', # required, non-empty string
      'category':              'production',            # required string
      'difficulty':            'beginner',              # must be one of:
                                                        # 'beginner', 'intermediate', 'advanced'
      'scenario':              'A small bakery ...',    # required, non-empty string
      'numVars':               2,                       # positive integer
      'objectiveType':         'max',                   # must be 'max' or 'min'
      'objectiveCoefficients': [3, 2],                  # list of numbers, length = numVars
      'variables':             ['muffins', 'cookies'],  # list of strings, length = numVars
      'constraints':           [ ... ],                 # non-empty list (see below)
    }

Each constraint dict looks like:

    {
      'coefficients': [2, 1],        # list of numbers, length = numVars
      'operator':     '<=',          # must be '<=', '>=', or '='
      'rhs':          100,           # number
    }

Tests:  python -m backend.educator.test_educator
Reset to the student starter:
    cp backend/educator/validation_blank.py backend/educator/validation.py
Annotated walkthrough for teaching: validation_walkthrough.py
"""

from typing import Any

VALID_DIFFICULTIES = {'beginner', 'intermediate', 'advanced'}
VALID_OBJECTIVE_TYPES = {'max', 'min'}
VALID_OPERATORS = {'<=', '>=', '='}


def validate_problem(problem: dict[str, Any]) -> list[str]:
    """
    Return a list of error messages describing every issue with the problem.
    An empty list means the problem is valid.
    """
    errors: list[str] = []

    def require_nonempty_string(key: str) -> None:
        val = problem.get(key)
        if not isinstance(val, str) or not val.strip():
            errors.append(f"{key} is missing or not a non-empty string")

    require_nonempty_string('id')
    require_nonempty_string('title')
    require_nonempty_string('scenario')

    diff = problem.get('difficulty')
    if diff not in VALID_DIFFICULTIES:
        errors.append(
            f"difficulty {diff!r} is invalid "
            f"(must be {', '.join(sorted(VALID_DIFFICULTIES))})"
        )

    obj_type = problem.get('objectiveType')
    if obj_type not in VALID_OBJECTIVE_TYPES:
        errors.append(
            f"objectiveType {obj_type!r} is invalid (must be 'max' or 'min')"
        )

    num_vars = problem.get('numVars')
    if (not isinstance(num_vars, int)
            or isinstance(num_vars, bool)
            or num_vars <= 0):
        errors.append(f"numVars must be a positive integer, got {num_vars!r}")
        num_vars = None

    variables = problem.get('variables')
    if not isinstance(variables, list):
        errors.append("variables must be a list")
    elif num_vars is not None and len(variables) != num_vars:
        errors.append(
            f"variables has {len(variables)} entries but numVars is {num_vars}"
        )

    obj_coeffs = problem.get('objectiveCoefficients')
    if not isinstance(obj_coeffs, list):
        errors.append("objectiveCoefficients must be a list")
    elif num_vars is not None and len(obj_coeffs) != num_vars:
        errors.append(
            f"objectiveCoefficients has {len(obj_coeffs)} entries "
            f"but numVars is {num_vars}"
        )

    cons = problem.get('constraints')
    if not isinstance(cons, list):
        errors.append("constraints must be a list")
    elif not cons:
        errors.append("constraints is empty (need at least one)")
    else:
        for i, c in enumerate(cons, start=1):
            if not isinstance(c, dict):
                errors.append(f"constraint #{i} is not a dict")
                continue

            coefs = c.get('coefficients')
            if not isinstance(coefs, list):
                errors.append(f"constraint #{i}: coefficients must be a list")
            elif num_vars is not None and len(coefs) != num_vars:
                errors.append(
                    f"constraint #{i}: coefficients has {len(coefs)} entries "
                    f"but numVars is {num_vars}"
                )

            op = c.get('operator')
            if op not in VALID_OPERATORS:
                errors.append(
                    f"constraint #{i}: operator {op!r} is invalid "
                    f"(must be <=, >=, or =)"
                )

            rhs = c.get('rhs')
            if not isinstance(rhs, (int, float)) or isinstance(rhs, bool):
                errors.append(
                    f"constraint #{i}: rhs must be a number, got {rhs!r}"
                )

    return errors
