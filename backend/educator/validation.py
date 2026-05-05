"""
================================================================================
 validation.py  —  Word-Problem Validator
                   (the file the live app uses, AND the presentation script)
================================================================================

WHAT THIS FILE DOES
-------------------
A teacher writes a word problem (a Python dictionary). Before that problem
can be saved into the bank a student will see, this file's `validate_problem`
function checks it for errors and returns a list of human-readable messages.

    valid problem   ->  []                   (empty list, no errors)
    broken problem  ->  ["title is missing", "difficulty 'expert' is invalid",
                         "constraint #1: operator '!=' is invalid", ...]

It is wired into the running web app at `POST /api/educator/validate` and
runs LIVE every time the admin page's draft form changes.

HOW TO READ THIS FILE (presentation guide)
-------------------------------------------
The function below is split into 8 numbered STEP blocks. Each block has:

    1) A boxed header that names the step
    2) A short paragraph explaining WHY the check exists
    3) The Python code that performs the check

Read top to bottom — the order isn't arbitrary. Earlier steps validate
fields that later steps need (for example, STEP 4 establishes `numVars`,
which STEPS 5 / 6 / 7 use to check list lengths).

WHAT A VALID PROBLEM LOOKS LIKE
-------------------------------
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

RUNNING IT
----------
    Tests:          python -X utf8 -m backend.educator.test_educator
    Live demo:      python -X utf8 -m backend.educator.validation
    (the demo at the bottom of this file prints both a valid run and
     a deliberately-broken run with all the error messages)
================================================================================
"""

# ──────────────────────────────────────────────────────────────────────────────
# IMPORTS AND CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────
#
# `Any` is a type hint meaning "any kind of value" — used because a problem
# dictionary can hold strings, numbers, lists, etc. mixed together.
from typing import Any

# These three sets define the only allowed values for three fields.
# A `set` (curly braces, no key:value) is used instead of a list because:
#   • Membership check (`x in VALID_DIFFICULTIES`) is O(1) on a set.
#   • Sets reject duplicates — keeps the allowed list clean.
#
# Defined at module level (outside the function) so they're built ONCE
# when the module loads, not rebuilt on every function call.
VALID_DIFFICULTIES = {'beginner', 'intermediate', 'advanced'}
VALID_OBJECTIVE_TYPES = {'max', 'min'}
VALID_OPERATORS = {'<=', '>=', '='}


# ══════════════════════════════════════════════════════════════════════════════
#  THE FUNCTION
# ══════════════════════════════════════════════════════════════════════════════
def validate_problem(problem: dict[str, Any]) -> list[str]:
    """
    Check a word-problem dict for common errors.
    Returns a list of human-readable error messages.
    Empty list  =>  problem is valid.
    """

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 0 — Set up an empty list to collect errors as we find them
    # ──────────────────────────────────────────────────────────────────────
    #
    # Important design choice: we do NOT raise an exception on the first
    # error. We KEEP GOING and gather every problem we find. That way the
    # teacher sees a full report instead of having to fix one issue, save,
    # discover the next issue, fix, save, and so on.
    errors: list[str] = []

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 1 — A reusable helper: "this field must be a non-empty string"
    # ──────────────────────────────────────────────────────────────────────
    #
    # Three of our fields ('id', 'title', 'scenario') have the SAME rule:
    # the value must exist, be a string, and not be empty/whitespace.
    #
    # Rather than copy-paste that check three times, we write it once as
    # a small inner function. (Programmers call this "DRY" — Don't Repeat
    # Yourself. If we ever change the wording of the error message, we
    # only have to change it in one place.)
    #
    # The helper reads `errors` from the surrounding function — Python
    # lets inner functions read variables from their parent scope.
    def require_nonempty_string(key: str) -> None:
        val = problem.get(key)          # .get() returns None if key missing,
                                        # rather than raising KeyError
        if not isinstance(val, str) or not val.strip():
            errors.append(f"{key} is missing or not a non-empty string")

    require_nonempty_string('id')
    require_nonempty_string('title')
    require_nonempty_string('scenario')

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 2 — `difficulty` must be one of the allowed levels
    # ──────────────────────────────────────────────────────────────────────
    #
    # We compare against the VALID_DIFFICULTIES set we defined above.
    # `!r` in the f-string calls Python's repr(), which puts quotes around
    # strings — so the message reads "difficulty 'expert' is invalid"
    # instead of "difficulty expert is invalid". Clearer for humans.
    diff = problem.get('difficulty')
    if diff not in VALID_DIFFICULTIES:
        errors.append(
            f"difficulty {diff!r} is invalid "
            f"(must be {', '.join(sorted(VALID_DIFFICULTIES))})"
        )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 3 — `objectiveType` must be 'max' or 'min'
    # ──────────────────────────────────────────────────────────────────────
    #
    # Same shape as STEP 2. This catches a really common mistake: people
    # write 'maximize' or 'minimize' (the human words) instead of the
    # short form the solver expects.
    obj_type = problem.get('objectiveType')
    if obj_type not in VALID_OBJECTIVE_TYPES:
        errors.append(
            f"objectiveType {obj_type!r} is invalid (must be 'max' or 'min')"
        )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 4 — `numVars` must be a POSITIVE INTEGER
    # ──────────────────────────────────────────────────────────────────────
    #
    # Watch out for a Python gotcha here: in Python, `True` and `False` are
    # technically integers (True == 1, False == 0). So `isinstance(True, int)`
    # returns True! If someone accidentally passes `numVars=True`, we want
    # to reject that — so we explicitly check `not isinstance(num_vars, bool)`.
    #
    # We also need numVars later (STEPS 5, 6, 7 all check list lengths
    # against it). If it's invalid, we set our LOCAL copy to None and the
    # later steps will skip the length comparison instead of crashing.
    num_vars = problem.get('numVars')
    if (not isinstance(num_vars, int)
            or isinstance(num_vars, bool)
            or num_vars <= 0):
        errors.append(f"numVars must be a positive integer, got {num_vars!r}")
        num_vars = None       # mark as unusable for later length checks

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 5 — `variables` must be a list of length numVars
    # ──────────────────────────────────────────────────────────────────────
    #
    # Two-part check:
    #   (a) Is it even a list?
    #   (b) If so, is its length right?
    #
    # We use `elif` so that if (a) fails we don't ALSO complain about
    # length — the user already knows it's not a list, they don't need
    # a redundant second message.
    variables = problem.get('variables')
    if not isinstance(variables, list):
        errors.append("variables must be a list")
    elif num_vars is not None and len(variables) != num_vars:
        errors.append(
            f"variables has {len(variables)} entries but numVars is {num_vars}"
        )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 6 — `objectiveCoefficients` must be a list of length numVars
    # ──────────────────────────────────────────────────────────────────────
    #
    # Identical pattern to STEP 5, on a different field. The coefficients
    # are the numbers in the objective function (the 3 and 2 in `max 3x + 2y`).
    # There has to be one coefficient per variable, hence length == numVars.
    obj_coeffs = problem.get('objectiveCoefficients')
    if not isinstance(obj_coeffs, list):
        errors.append("objectiveCoefficients must be a list")
    elif num_vars is not None and len(obj_coeffs) != num_vars:
        errors.append(
            f"objectiveCoefficients has {len(obj_coeffs)} entries "
            f"but numVars is {num_vars}"
        )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 7 — `constraints` must be a non-empty list of dicts
    # ──────────────────────────────────────────────────────────────────────
    #
    # This is the most complex check because each constraint is itself a
    # dictionary that needs validation. We structure it as:
    #
    #   1. Is constraints a list at all?
    #   2. Is the list empty? (an LP needs at least one constraint)
    #   3. For each item in the list, validate the constraint dict:
    #        - coefficients is a list of length numVars
    #        - operator is one of <=, >=, =
    #        - rhs is a number
    #
    # `enumerate(..., start=1)` gives us human-friendly 1-based numbering
    # in error messages ("constraint #1" reads better than "constraint #0").
    cons = problem.get('constraints')
    if not isinstance(cons, list):
        errors.append("constraints must be a list")
    elif not cons:
        errors.append("constraints is empty (need at least one)")
    else:
        for i, c in enumerate(cons, start=1):
            # Each constraint should be a dict. If it isn't, skip the rest
            # of the per-constraint checks for this entry — they would all
            # fail in the same way and clutter the report.
            if not isinstance(c, dict):
                errors.append(f"constraint #{i} is not a dict")
                continue

            # 7a. coefficients is a list of length numVars
            coefs = c.get('coefficients')
            if not isinstance(coefs, list):
                errors.append(f"constraint #{i}: coefficients must be a list")
            elif num_vars is not None and len(coefs) != num_vars:
                errors.append(
                    f"constraint #{i}: coefficients has {len(coefs)} entries "
                    f"but numVars is {num_vars}"
                )

            # 7b. operator is one of <=, >=, =
            op = c.get('operator')
            if op not in VALID_OPERATORS:
                errors.append(
                    f"constraint #{i}: operator {op!r} is invalid "
                    f"(must be <=, >=, or =)"
                )

            # 7c. rhs is a number (NOT a bool — same gotcha as numVars in STEP 4)
            rhs = c.get('rhs')
            if not isinstance(rhs, (int, float)) or isinstance(rhs, bool):
                errors.append(
                    f"constraint #{i}: rhs must be a number, got {rhs!r}"
                )

    # ──────────────────────────────────────────────────────────────────────
    #  STEP 8 — Return everything we found
    # ──────────────────────────────────────────────────────────────────────
    #
    # If `errors` is still [], the problem is valid. The caller knows
    # that an empty list means "all good." Notice that we never raised
    # an exception — the whole job of this function is to GATHER errors,
    # not to interrupt on the first one.
    return errors


# ══════════════════════════════════════════════════════════════════════════════
#  LIVE DEMO  —  run this file directly to see the validator in action
# ══════════════════════════════════════════════════════════════════════════════
#
# `if __name__ == '__main__'` is a standard Python idiom: this block runs
# only when the file is executed directly (`python validation.py`),
# NOT when the file is imported by another module like the web server.
#
# It's a good place to put a quick demo so the class can SEE the function
# working without having to write their own test code.
if __name__ == '__main__':
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
    print("   ", validate_problem(good))
    print("    (empty list = no errors found, problem is valid)")

    # ── Demo 2: a deliberately-broken problem (every kind of error) ──────
    bad = {
        # 'id' is missing entirely
        'title': 'Broken',
        'difficulty': 'expert',          # not a real difficulty level
        'scenario': '',                  # empty string (not allowed)
        'numVars': 2,
        'objectiveType': 'maximize',     # should be 'max', not 'maximize'
        'objectiveCoefficients': [3],    # wrong length: 1 entry, but numVars=2
        'variables': ['a', 'b'],
        'constraints': [
            {'coefficients': [2, 1], 'operator': '<<', 'rhs': 100},  # bad operator
            'this is not a dict',                                     # wrong type
        ],
    }
    print("\n[2] Broken problem -> validate_problem() returns:")
    for err in validate_problem(bad):
        print(f"    * {err}")
    print("    (each error is a separate, specific message — the teacher")
    print("     can see exactly what's wrong without guessing)")

    print("\n" + "=" * 70)
