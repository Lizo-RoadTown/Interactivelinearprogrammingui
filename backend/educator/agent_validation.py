"""
agent_validation.py — BEGINNER D
=================================

Your job: write ONE function that checks the LLM's draft output for
common mistakes BEFORE the form gets pre-filled.

Why this matters: when a professor clicks "Draft with agent" in /admin,
the LLM (Claude or GPT) returns a JSON object that's supposed to be a
valid LP word problem. But LLMs sometimes produce garbage:

  • The model forgot a required field ('scenario' is missing).
  • The model returned numVars=2 but only 1 variable name.
  • The model returned numVars=0 (no variables — meaningless problem).
  • The model returned constraint operators like '≤' (Unicode) instead
    of '<=' (ASCII), which breaks the solver.

If we let those reach the React form, the professor sees a
half-broken pre-fill. Worse, if the professor clicks Save quickly
without reading, students get a malformed problem.

Your function is a SECOND line of defense: catch obvious LLM
mistakes early, return clear error messages, and let the endpoint
surface them to the professor.

After you finish, run:  python -m backend.educator.test_educator
"""

from typing import Any

from backend.educator.validation import (
    VALID_DIFFICULTIES,
    VALID_OBJECTIVE_TYPES,
    VALID_OPERATORS,
)


def validate_agent_output(problem: Any) -> list[str]:
    """
    Return a list of error messages describing what's wrong with the
    LLM's output. Empty list means the output is structurally usable.

    The messages should be human-readable — a professor will see them
    in the agent draft panel.

    ─── REQUIRED CHECKS ─────────────────────────────────────────────────

      1. The input must be a dict at all (the LLM might have returned
         a list, a string, or None).
      2. Required string fields must be non-empty:
            'id', 'title', 'scenario'
      3. 'difficulty' must be in VALID_DIFFICULTIES.
      4. 'objectiveType' must be in VALID_OBJECTIVE_TYPES.
      5. 'numVars' must be a positive integer (>= 1).
      6. 'variables' must be a list with length == numVars.
      7. 'objectiveCoefficients' must be a list with length == numVars.
      8. 'constraints' must be a non-empty list.
      9. For each constraint in the list:
           - 'coefficients' is a list with length == numVars
           - 'operator' is in VALID_OPERATORS    ← '<=', '>=', or '='
           - 'rhs' is a number (int or float, not bool)

    ─── HINTS ───────────────────────────────────────────────────────────

      • Start with `errors = []`.
      • Check the dict-ness FIRST: if `not isinstance(problem, dict)`,
        return early with one error — every other check would crash.
      • Use `.get(key)` to read keys without KeyError.
      • `isinstance(x, str) and x.strip()` checks for non-empty string.
      • `isinstance(x, int) and not isinstance(x, bool) and x > 0`
        checks for a positive integer (booleans are sneaky — `True`
        passes `isinstance(int)`).
      • Append clear messages: "scenario is missing or empty",
        "numVars must be a positive integer, got 0".
      • Walk the constraints list with `for i, c in enumerate(...)`
        so error messages can say "constraint #1: ..." etc.

    ─── EXAMPLES ────────────────────────────────────────────────────────

        >>> validate_agent_output(None)
        ['agent did not return an object']

        >>> validate_agent_output({})
        ['id is missing or empty', 'title is missing or empty', ...]

        >>> validate_agent_output({
        ...     'id': 'wp-test', 'title': 'Test', 'scenario': 'A test...',
        ...     'difficulty': 'beginner', 'objectiveType': 'max',
        ...     'numVars': 2, 'variables': ['x1', 'x2'],
        ...     'objectiveCoefficients': [3, 2],
        ...     'constraints': [
        ...         {'coefficients': [1, 1], 'operator': '<=', 'rhs': 10},
        ...     ],
        ... })
        []  # valid
    ────────────────────────────────────────────────────────────────────
    """
    # TODO(beginner-D): implement this function
    raise NotImplementedError(
        "validate_agent_output() is not implemented yet. "
        "Fill it in — see the docstring above for instructions."
    )
