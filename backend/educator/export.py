"""
export.py — BEGINNER C
======================

Your job: write ONE function that takes a word problem and returns a
printable student worksheet as a Markdown-formatted string.

A word problem dict looks like:

    {
      'id':                    'prod-mix-basic',
      'title':                 'Bakery Production Mix',
      'category':              'production',
      'difficulty':            'beginner',
      'scenario':              'A small bakery makes two products ...',
      'numVars':               2,
      'objectiveType':         'max',
      'objectiveCoefficients': [3, 2],
      'variables':             ['muffins', 'cookies'],
      'constraints': [
        {'coefficients': [2, 1], 'operator': '<=', 'rhs': 100, 'label': 'flour'},
        {'coefficients': [1, 2], 'operator': '<=', 'rhs': 80,  'label': 'eggs'},
      ],
    }

Your function produces Markdown text a teacher can print for students.

After you finish, run:  python -m backend.educator.test_educator
"""

from typing import Any


def export_to_markdown(problem: dict[str, Any]) -> str:
    """
    Generate a Markdown worksheet for a student. The output should include:

      1. A level-1 heading with the problem title (e.g. "# Bakery Production Mix")
      2. The difficulty, shown like "*Difficulty: beginner*"
      3. A "## Scenario" section with the scenario text
      4. A "## Your Task" section with these blank-space prompts:
           ### 1. Decision Variables
           _Define what each variable represents in your own words:_
           - (one bullet per variable, each saying "variable_name = _____")

           ### 2. Objective Function
           _Write the objective function:_
           - max/min z = ______

           ### 3. Constraints
           _Write each constraint:_
           - (one bullet per constraint, numbered)

           ### 4. Your Solution
           _Solve using the simplex method and show your work below:_

    Example output (abbreviated) for the bakery problem:

        # Bakery Production Mix
        *Difficulty: beginner*

        ## Scenario

        A small bakery makes two products ...

        ## Your Task

        ### 1. Decision Variables
        _Define what each variable represents in your own words:_
        - muffins = _____
        - cookies = _____

        ### 2. Objective Function
        _Write the objective function:_
        - max z = _____

        ### 3. Constraints
        _Write each constraint:_
        - Constraint 1: _____
        - Constraint 2: _____

        ### 4. Your Solution
        _Solve using the simplex method and show your work below:_

    ─── YOUR JOB ────────────────────────────────────────────────────────
    Replace the `raise NotImplementedError(...)` below with your code.

    Hints:
      • Use an f-string: `f"# {problem['title']}\\n"` inserts the title.
      • Build the output line by line: `lines = []`, then `lines.append(...)`.
      • At the end: `return '\\n'.join(lines)`.
      • For the list of variables:
            for v in problem['variables']:
                lines.append(f"- {v} = _____")
      • For constraints, use the index with enumerate:
            for i, c in enumerate(problem['constraints'], start=1):
                lines.append(f"- Constraint {i}: _____")
      • Add blank lines between sections with `lines.append("")`.
    ────────────────────────────────────────────────────────────────────
    """
    # TODO(beginner-C): implement this function
    raise NotImplementedError(
        "export_to_markdown() is not implemented yet. "
        "Fill it in — see the docstring above for instructions."
    )
