"""
listing.py — BEGINNER A
=======================

Your job: write ONE function that filters and searches the word problem
bank. This is the only function you need to implement in this file.

The bank is a list of problem dicts, where each problem looks like:

    {
      'id':            'prod-mix-basic',
      'title':         'Bakery Production Mix',
      'category':      'production',
      'difficulty':    'beginner',                # 'beginner'|'intermediate'|'advanced'
      'scenario':      'A small bakery ...',
      'numVars':       2,
      'objectiveType': 'max',                     # 'max' or 'min'
      'variables':     ['muffins', 'cookies'],
      ...
    }

Your function should filter this list based on the user's request.

After you finish, run:  python -m backend.educator.test_educator
"""

from typing import Any


def list_problems(bank: list[dict[str, Any]],
                  difficulty: str | None = None,
                  category: str | None = None,
                  search: str | None = None) -> list[dict[str, Any]]:
    """
    Filter and search the problem bank.

    Arguments:
        bank:       the full list of problems (list of dicts)
        difficulty: if given, only return problems matching this difficulty.
                    Example values: 'beginner', 'intermediate', 'advanced'.
                    If None, don't filter by difficulty.
        category:   if given, only return problems matching this category.
                    Example values: 'production', 'diet', 'transportation'.
                    If None, don't filter by category.
        search:     if given, only return problems where `search` appears
                    (case-insensitive) in the title OR the scenario.
                    If None, don't search.

    Returns:
        A new list of problems that match ALL the filters.

    Examples:

        >>> list_problems(bank)  # no filters → return everything
        [all problems]

        >>> list_problems(bank, difficulty='beginner')
        [problems where difficulty == 'beginner']

        >>> list_problems(bank, category='diet', search='protein')
        [problems where category == 'diet' AND 'protein' appears in title/scenario]

    ─── YOUR JOB ────────────────────────────────────────────────────────
    Replace the line `raise NotImplementedError(...)` below with your code.

    Hints:
      • Start with `result = []`
      • Loop through each problem: `for p in bank:`
      • For each problem, check all the filters. If any filter fails, `continue`.
      • Otherwise, `result.append(p)`.
      • At the end, `return result`.
      • Use `.lower()` to make case-insensitive string comparisons.
      • `search in some_string` checks if `search` is a substring.
    ────────────────────────────────────────────────────────────────────
    """
    # TODO(beginner-A): implement this function
    raise NotImplementedError(
        "list_problems() is not implemented yet. "
        "Fill it in — see the docstring above for instructions."
    )
