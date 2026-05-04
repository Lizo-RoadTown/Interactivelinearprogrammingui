"""
validation_walkthrough.py — BEGINNER B (presentation walkthrough)
=================================================================

This is a TEACHING copy of the validate_problem() function.

Every check in here is annotated with a comment explaining WHY we wrote it
that way, what could go wrong, and what test it makes pass. Read it
top-to-bottom — by the end you'll have built a real input validator from
scratch.

The plain solution (no commentary) lives in `reference_solutions.py`
under `validate_problem_ref`. The starter file students edit is
`validation.py`.

To check that this walkthrough actually passes the test suite, you can
temporarily import it from `validation.py`:

    # in validation.py
    from .validation_walkthrough import validate_problem  # noqa

Then run:

    python -m backend.educator.test_educator

──────────────────────────────────────────────────────────────────────────

PRESENTATION FLOW (suggested, ~5 minutes)

  1. Show the BLANK file (validation.py) — point at the docstring rules.
  2. Show the test file — explain "the tests describe the behavior we
     want; our job is to make them pass."
  3. Walk through THIS file step by step. Each numbered comment block
     below maps to one of the rules from the docstring.
  4. Run the tests live to show all 7 pass.
  5. (Optional) Open the /educator page in the browser and click
     "break it on purpose" to see the validator catch errors live.

──────────────────────────────────────────────────────────────────────────
"""

# ─────────────────────────────────────────────────────────────────────────
# IMPORTS AND CONSTANTS
# ─────────────────────────────────────────────────────────────────────────
#
# `Any` lets us say "this dict can hold any kind of value" in the type hint.
# We don't have to use type hints, but they help editors give better
# autocomplete and catch bugs.
from typing import Any

# These three sets are the "allowed values" for three of our fields.
#
# Why use a `set` instead of a `list`?
#   • Membership check (`x in VALID_DIFFICULTIES`) is faster on a set.
#   • Sets can't have duplicates — keeps the allowed list clean.
#
# We define them at MODULE level (outside the function) so we don't
# rebuild them every time the function is called.
VALID_DIFFICULTIES = {'beginner', 'intermediate', 'advanced'}
VALID_OBJECTIVE_TYPES = {'max', 'min'}
VALID_OPERATORS = {'<=', '>=', '='}


# ─────────────────────────────────────────────────────────────────────────
# THE FUNCTION
# ─────────────────────────────────────────────────────────────────────────
def validate_problem(problem: dict[str, Any]) -> list[str]:
    """
    Check a word-problem dict for common errors.

    Returns a list of human-readable error messages. An empty list means
    the problem is valid.
    """

    # ─────────────────────────────────────────────────────────────────────
    # STEP 0 — Set up an empty list to collect errors as we find them
    # ─────────────────────────────────────────────────────────────────────
    #
    # We do NOT raise an exception on the first error. We KEEP GOING and
    # gather every problem we find, then return them all at once. That
    # way the teacher sees a full report instead of one error at a time.
    errors: list[str] = []

    # ─────────────────────────────────────────────────────────────────────
    # STEP 1 — A small helper for "must be a non-empty string"
    # ─────────────────────────────────────────────────────────────────────
    #
    # Three of our fields ('id', 'title', 'scenario') have the SAME rule:
    # they must exist, be a string, and not be empty/whitespace.
    #
    # Rather than copy-paste that check three times, we write it once as
    # a nested helper function. This is called "Don't Repeat Yourself"
    # (DRY). If we want to change the wording of the error message, we
    # only have to change it in one place.
    #
    # The helper uses `errors` from the enclosing function — Python lets
    # inner functions read variables from their parent scope.
    def require_nonempty_string(key: str) -> None:
        val = problem.get(key)
        # `problem.get(key)` returns `None` if the key is missing, instead
        # of raising KeyError. That makes the next check easier:
        # `None` fails `isinstance(val, str)`, so missing keys are
        # automatically caught.
        if not isinstance(val, str) or not val.strip():
            # `.strip()` removes whitespace; an empty/whitespace string
            # is not really a string in the meaningful sense.
            errors.append(f"{key} is missing or not a non-empty string")

    # Now we use the helper for the three string fields.
    # (Tests 2 and 3 check that these errors get raised when expected.)
    require_nonempty_string('id')
    require_nonempty_string('title')
    require_nonempty_string('scenario')

    # ─────────────────────────────────────────────────────────────────────
    # STEP 2 — `difficulty` must be one of the allowed levels
    # ─────────────────────────────────────────────────────────────────────
    #
    # This check makes Test 3 pass.
    # `!r` in the f-string calls `repr()`, so a string shows up with quotes
    # around it ('expert' instead of expert). That makes the message clearer.
    diff = problem.get('difficulty')
    if diff not in VALID_DIFFICULTIES:
        errors.append(
            f"difficulty {diff!r} is invalid "
            f"(must be {', '.join(sorted(VALID_DIFFICULTIES))})"
        )

    # ─────────────────────────────────────────────────────────────────────
    # STEP 3 — `objectiveType` must be 'max' or 'min'
    # ─────────────────────────────────────────────────────────────────────
    #
    # Same pattern as STEP 2. This makes Test 4 pass — students often
    # write 'maximize' instead of 'max', so this check is important.
    obj_type = problem.get('objectiveType')
    if obj_type not in VALID_OBJECTIVE_TYPES:
        errors.append(
            f"objectiveType {obj_type!r} is invalid (must be 'max' or 'min')"
        )

    # ─────────────────────────────────────────────────────────────────────
    # STEP 4 — `numVars` must be a POSITIVE INTEGER
    # ─────────────────────────────────────────────────────────────────────
    #
    # This one has a Python gotcha. In Python, `True` and `False` are
    # technically integers (True == 1, False == 0). So `isinstance(True, int)`
    # is True! If someone passes `numVars=True` we want to reject that,
    # so we explicitly exclude bool.
    #
    # We also need numVars later to check list lengths, so if it's
    # invalid we set our local copy to None — the later checks will
    # skip the length comparison if num_vars is None, instead of
    # crashing.
    num_vars = problem.get('numVars')
    if (not isinstance(num_vars, int)
            or isinstance(num_vars, bool)
            or num_vars <= 0):
        errors.append(f"numVars must be a positive integer, got {num_vars!r}")
        num_vars = None  # mark as unusable for later length checks

    # ─────────────────────────────────────────────────────────────────────
    # STEP 5 — `variables` must be a list of length numVars
    # ─────────────────────────────────────────────────────────────────────
    #
    # Two-part check:
    #   (a) Is it even a list at all?
    #   (b) If so, is its length right?
    #
    # We use `elif` so that if (a) fails we don't ALSO complain about
    # length — the user already knows it's not a list.
    variables = problem.get('variables')
    if not isinstance(variables, list):
        errors.append("variables must be a list")
    elif num_vars is not None and len(variables) != num_vars:
        # Skip this check if num_vars itself was bad — otherwise we'd
        # produce a confusing second error caused by the first.
        errors.append(
            f"variables has {len(variables)} entries but numVars is {num_vars}"
        )

    # ─────────────────────────────────────────────────────────────────────
    # STEP 6 — `objectiveCoefficients` must be a list of length numVars
    # ─────────────────────────────────────────────────────────────────────
    #
    # Exactly the same shape as STEP 5, but for a different field.
    # This makes Test 5 pass.
    obj_coeffs = problem.get('objectiveCoefficients')
    if not isinstance(obj_coeffs, list):
        errors.append("objectiveCoefficients must be a list")
    elif num_vars is not None and len(obj_coeffs) != num_vars:
        errors.append(
            f"objectiveCoefficients has {len(obj_coeffs)} entries "
            f"but numVars is {num_vars}"
        )

    # ─────────────────────────────────────────────────────────────────────
    # STEP 7 — `constraints` must be a non-empty list of dicts
    # ─────────────────────────────────────────────────────────────────────
    #
    # This is the most complex check because each constraint is itself
    # a dict that needs validation. We structure it as:
    #   1. Is constraints a list?           → Test "list" error
    #   2. Is the list empty?               → Test 7
    #   3. For each item, validate the dict → Test 6
    #
    # We use `enumerate(..., start=1)` so we get human-friendly
    # 1-based indexing in error messages ("constraint #1" instead
    # of "constraint #0").
    cons = problem.get('constraints')
    if not isinstance(cons, list):
        errors.append("constraints must be a list")
    elif not cons:
        errors.append("constraints is empty (need at least one)")
    else:
        for i, c in enumerate(cons, start=1):
            # Each constraint should be a dict. If it's not, skip the
            # rest of the per-constraint checks for this entry — they
            # would all fail in the same way and clutter the report.
            if not isinstance(c, dict):
                errors.append(f"constraint #{i} is not a dict")
                continue

            # Sub-check A: coefficients is a list of length numVars
            coefs = c.get('coefficients')
            if not isinstance(coefs, list):
                errors.append(f"constraint #{i}: coefficients must be a list")
            elif num_vars is not None and len(coefs) != num_vars:
                errors.append(
                    f"constraint #{i}: coefficients has {len(coefs)} entries "
                    f"but numVars is {num_vars}"
                )

            # Sub-check B: operator is one of <=, >=, =
            op = c.get('operator')
            if op not in VALID_OPERATORS:
                errors.append(
                    f"constraint #{i}: operator {op!r} is invalid "
                    f"(must be <=, >=, or =)"
                )

            # Sub-check C: rhs is a number (NOT a bool — same gotcha
            # as numVars in STEP 4).
            rhs = c.get('rhs')
            if not isinstance(rhs, (int, float)) or isinstance(rhs, bool):
                errors.append(
                    f"constraint #{i}: rhs must be a number, got {rhs!r}"
                )

    # ─────────────────────────────────────────────────────────────────────
    # STEP 8 — Return everything we found
    # ─────────────────────────────────────────────────────────────────────
    #
    # If errors is still [], the problem is valid. The caller knows that
    # an empty list means "all good." Notice that we never raised an
    # exception — the whole job of the function is to GATHER errors,
    # not interrupt on the first one.
    return errors


# ─────────────────────────────────────────────────────────────────────────
# DEMO — run this file directly to see the validator in action
# ─────────────────────────────────────────────────────────────────────────
#
# `if __name__ == '__main__'` is a common Python idiom: this block runs
# only when the file is executed directly (`python validation_walkthrough.py`),
# NOT when the file is imported by another module.
#
# It's a great place to put a quick demo so beginners can SEE the
# function working without having to write their own test code.
if __name__ == '__main__':
    # Example 1: a fully valid problem.
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
    print("Valid problem ->", validate_problem(good))
    # Expected: []

    # Example 2: deliberately broken — every kind of error.
    bad = {
        # 'id' is missing
        'title': 'Broken',
        'difficulty': 'expert',          # not a real level
        'scenario': '',                  # empty string
        'numVars': 2,
        'objectiveType': 'maximize',     # should be 'max'
        'objectiveCoefficients': [3],    # wrong length
        'variables': ['a', 'b'],
        'constraints': [
            {'coefficients': [2, 1], 'operator': '<<', 'rhs': 100},
            'not a dict',                # wrong type
        ],
    }
    print("\nBroken problem ->")
    for err in validate_problem(bad):
        print(f"  * {err}")
