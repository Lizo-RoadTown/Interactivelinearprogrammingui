"""
================================================================================
 validation.py  —  Word-Problem Validator
================================================================================

Checks a teacher's word-problem dictionary for errors and returns a list of
human-readable messages.  An empty list means the problem is valid.

    valid problem   ->  []
    broken problem  ->  ["title is missing", "difficulty 'expert' is invalid", ...]

Wired into the running app at:  POST /api/educator/validate

A valid problem dictionary looks like:

    {
      'id':                    'bakery-mix',          # non-empty string
      'title':                 'Bakery Production',   # non-empty string
      'category':              'production',
      'difficulty':            'beginner',            # beginner|intermediate|advanced
      'scenario':              'A small bakery ...',  # non-empty string
      'numVars':               2,                     # positive integer
      'objectiveType':         'max',                 # 'max' or 'min'
      'objectiveCoefficients': [3, 2],                # list of numbers, len == numVars
      'variables':             ['muffins', 'cookies'],# list, len == numVars
      'constraints': [
          {'coefficients': [2, 1], 'operator': '<=', 'rhs': 100},
          ...
      ],
    }

To run:
    Tests:      python -X utf8 -m backend.educator.test_educator
    Live demo:  python -X utf8 -m backend.educator.validation
================================================================================
"""

# ──────────────────────────────────────────────────────────────────────────────
# IMPORTS AND CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────

from typing import Any                              # Any = "any kind of value"

VALID_DIFFICULTIES = {'beginner', 'intermediate', 'advanced'}    # allowed values
VALID_OBJECTIVE_TYPES = {'max', 'min'}                            # allowed values
VALID_OPERATORS = {'<=', '>=', '='}                               # allowed values


# ══════════════════════════════════════════════════════════════════════════════
#  THE FUNCTION
# ══════════════════════════════════════════════════════════════════════════════
def validate_problem(problem: dict[str, Any]) -> list[str]:
    """
    Check a word-problem dict for common errors.
    Returns a list of human-readable error messages.
    Empty list => problem is valid.
    """

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 0 — set up an empty list to collect errors
    # ──────────────────────────────────────────────────────────────────────

    errors: list[str] = []                          # start with no errors found yet

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 1 — helper for "must be a non-empty string"
    # ──────────────────────────────────────────────────────────────────────

    def require_nonempty_string(key: str) -> None:
        val = problem.get(key)                      # read the value (None if key is missing)
        if not isinstance(val, str) or not val.strip():   # not a string, OR string is blank
            errors.append(f"{key} is missing or not a non-empty string")  # record the error

    require_nonempty_string('id')                   # apply rule to 'id' field
    require_nonempty_string('title')                # apply rule to 'title' field
    require_nonempty_string('scenario')             # apply rule to 'scenario' field

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 2 — `difficulty` must be one of the allowed levels
    # ──────────────────────────────────────────────────────────────────────

    diff = problem.get('difficulty')                # read the value (None if missing)
    if diff not in VALID_DIFFICULTIES:              # is the value in the allowed set?
        errors.append(                              # if not, record an error
            f"difficulty {diff!r} is invalid "      # !r adds quotes around the value
            f"(must be {', '.join(sorted(VALID_DIFFICULTIES))})"   # list allowed options
        )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 3 — `objectiveType` must be 'max' or 'min'
    # ──────────────────────────────────────────────────────────────────────

    obj_type = problem.get('objectiveType')         # read the value
    if obj_type not in VALID_OBJECTIVE_TYPES:       # only 'max' or 'min' allowed
        errors.append(                              # record the error
            f"objectiveType {obj_type!r} is invalid (must be 'max' or 'min')"
        )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 4 — `numVars` must be a positive integer
    # ──────────────────────────────────────────────────────────────────────
    #  Note: bool is a subclass of int in Python, so we exclude it explicitly
    #  (otherwise numVars=True would sneak through as 1).

    num_vars = problem.get('numVars')               # read the value
    if (not isinstance(num_vars, int)               # must be an int...
            or isinstance(num_vars, bool)           # ...but NOT a bool
            or num_vars <= 0):                      # ...and must be positive
        errors.append(f"numVars must be a positive integer, got {num_vars!r}")
        num_vars = None                             # mark unusable so STEP 5/6/7 skip length checks

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 5 — `variables` must be a list of length numVars
    # ──────────────────────────────────────────────────────────────────────

    variables = problem.get('variables')            # read the value
    if not isinstance(variables, list):             # check 1: is it a list?
        errors.append("variables must be a list")
    elif num_vars is not None and len(variables) != num_vars:   # check 2: right length?
        errors.append(                              # only check length if numVars was valid
            f"variables has {len(variables)} entries but numVars is {num_vars}"
        )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 6 — `objectiveCoefficients` must be a list of length numVars
    # ──────────────────────────────────────────────────────────────────────

    obj_coeffs = problem.get('objectiveCoefficients')   # read the value
    if not isinstance(obj_coeffs, list):                # check 1: is it a list?
        errors.append("objectiveCoefficients must be a list")
    elif num_vars is not None and len(obj_coeffs) != num_vars:  # check 2: right length?
        errors.append(
            f"objectiveCoefficients has {len(obj_coeffs)} entries "
            f"but numVars is {num_vars}"
        )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 7 — `constraints` must be a non-empty list of dicts
    # ──────────────────────────────────────────────────────────────────────

    cons = problem.get('constraints')               # read the value
    if not isinstance(cons, list):                  # check 1: is it a list?
        errors.append("constraints must be a list")
    elif not cons:                                  # check 2: is the list empty?
        errors.append("constraints is empty (need at least one)")
    else:
        for i, c in enumerate(cons, start=1):       # loop, numbering from 1 (human-friendly)
            if not isinstance(c, dict):             # each item must be a dict
                errors.append(f"constraint #{i} is not a dict")
                continue                            # skip the rest of this iteration

            # 7a — coefficients is a list of length numVars
            coefs = c.get('coefficients')           # read the value
            if not isinstance(coefs, list):         # check 1: is it a list?
                errors.append(f"constraint #{i}: coefficients must be a list")
            elif num_vars is not None and len(coefs) != num_vars:   # check 2: right length?
                errors.append(
                    f"constraint #{i}: coefficients has {len(coefs)} entries "
                    f"but numVars is {num_vars}"
                )

            # 7b — operator is one of <=, >=, =
            op = c.get('operator')                  # read the value
            if op not in VALID_OPERATORS:           # is it in the allowed set?
                errors.append(
                    f"constraint #{i}: operator {op!r} is invalid "
                    f"(must be <=, >=, or =)"
                )

            # 7c — rhs is a number (and not a bool — same gotcha as STEP 4)
            rhs = c.get('rhs')                      # read the value
            if not isinstance(rhs, (int, float)) or isinstance(rhs, bool):
                errors.append(
                    f"constraint #{i}: rhs must be a number, got {rhs!r}"
                )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 8 — return everything we found
    # ──────────────────────────────────────────────────────────────────────

    return errors                                   # [] means valid; any other list means errors


# ══════════════════════════════════════════════════════════════════════════════
#  TO RUN
# ══════════════════════════════════════════════════════════════════════════════
#  Tests:      python -X utf8 -m backend.educator.test_educator
#  Live demo:  python -X utf8 -m backend.educator.validation   <-- runs the block below
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':                          # only runs when called directly
    print("=" * 70)
    print(" validate_problem() — live demo")
    print("=" * 70)

    # ── Demo 1: a fully valid problem ────────────────────────────────────
    good = {
        'id': 'bakery',
        'title': 'Bakery Mix',
        'category': 'production',
        'difficulty': 'beginner',
        'scenario': 'muffins and cookies',
        'numVars': 2,
        'objectiveType': 'max',
        'objectiveCoefficients': [3, 2],
        'variables': ['muffins', 'cookies'],
        'constraints': [
            {'coefficients': [2, 1], 'operator': '<=', 'rhs': 100},
            {'coefficients': [1, 2], 'operator': '<=', 'rhs': 80},
        ],
    }
    print("\n[1] Valid problem -> validate_problem() returns:")
    print("   ", validate_problem(good))           # expected: []

    # ── Demo 2: a deliberately-broken problem ────────────────────────────
    bad = {
        # 'id' missing
        'title': 'Broken',
        'difficulty': 'expert',                    # not a valid difficulty
        'scenario': '',                            # empty string
        'numVars': 2,
        'objectiveType': 'maximize',               # should be 'max'
        'objectiveCoefficients': [3],              # wrong length
        'variables': ['a', 'b'],
        'constraints': [
            {'coefficients': [2, 1], 'operator': '<<', 'rhs': 100},  # bad operator
            'this is not a dict',                                     # wrong type
        ],
    }
    print("\n[2] Broken problem -> validate_problem() returns:")
    for err in validate_problem(bad):              # print each error on its own line
        print(f"    * {err}")

    print("\n" + "=" * 70)
