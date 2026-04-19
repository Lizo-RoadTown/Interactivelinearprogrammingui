"""
validation.py — BEGINNER B
==========================

Your job: write ONE function that checks a word problem for common errors
and returns a list of error messages. An empty list means "no errors".

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

After you finish, run:  python -m backend.educator.test_educator
"""

from typing import Any

VALID_DIFFICULTIES = {'beginner', 'intermediate', 'advanced'}
VALID_OBJECTIVE_TYPES = {'max', 'min'}
VALID_OPERATORS = {'<=', '>=', '='}


def validate_problem(problem: dict[str, Any]) -> list[str]:
    """
    Return a list of error messages describing everything wrong with the
    problem. If the problem is valid, return an empty list.

    The messages should be human-readable — a teacher will see them.
    Examples of good error messages:
        "title is missing"
        "difficulty 'expert' is invalid (must be beginner, intermediate, or advanced)"
        "objectiveCoefficients has 3 entries but numVars is 2"

    ─── YOUR JOB ────────────────────────────────────────────────────────
    Replace the `raise NotImplementedError(...)` below with your code.

    Required checks (the tests will verify these):
      1. 'id' exists and is a non-empty string
      2. 'title' exists and is a non-empty string
      3. 'scenario' exists and is a non-empty string
      4. 'difficulty' is one of VALID_DIFFICULTIES
      5. 'objectiveType' is one of VALID_OBJECTIVE_TYPES
      6. 'numVars' is a positive integer (> 0)
      7. 'variables' is a list with length equal to numVars
      8. 'objectiveCoefficients' is a list with length equal to numVars
      9. 'constraints' is a non-empty list
     10. For each constraint:
           - 'coefficients' is a list with length equal to numVars
           - 'operator' is one of VALID_OPERATORS
           - 'rhs' is a number (int or float)

    Hints:
      • Start with `errors = []`
      • For each check, if it fails, do `errors.append("message")`.
      • Check dict keys with `'key' in problem` or `problem.get('key')`.
      • `isinstance(x, str)` checks if x is a string.
      • `isinstance(x, (int, float)) and not isinstance(x, bool)` checks for numbers.
      • `isinstance(x, list)` checks if x is a list.
      • At the end, `return errors`.
    ────────────────────────────────────────────────────────────────────
    """
    # TODO(beginner-B): implement this function
    raise NotImplementedError(
        "validate_problem() is not implemented yet. "
        "Fill it in — see the docstring above for instructions."
    )
