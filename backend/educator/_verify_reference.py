"""
_verify_reference.py — instructor-only: verify the test suite passes with
the reference solutions. Run once after editing test_educator.py.

Run:
    python -m backend.educator._verify_reference
"""

from backend.educator import reference_solutions as ref

# Monkey-patch the beginner modules to use reference implementations,
# then run the test suite.
from backend.educator import listing, validation, export
listing.list_problems = ref.list_problems_ref
validation.validate_problem = ref.validate_problem_ref
export.export_to_markdown = ref.export_to_markdown_ref

from backend.educator.test_educator import main
main()
