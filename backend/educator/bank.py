"""
bank.py — load and save the word problem bank (JSON file).

This is instructor code. It handles the file I/O that the beginner
functions depend on. The beginners never touch this; they just receive
a list of problem dicts as input.
"""

import json
import os
from pathlib import Path
from typing import Any

_DEFAULT_PATH = Path(__file__).parent / 'problems.json'


def load_bank(path: str | Path | None = None) -> list[dict[str, Any]]:
    """Read problems.json and return a list of problem dicts."""
    p = Path(path) if path else _DEFAULT_PATH
    if not p.exists():
        return []
    with p.open('r', encoding='utf-8') as f:
        data = json.load(f)
    return list(data.get('problems', []))


def save_bank(problems: list[dict], path: str | Path | None = None) -> None:
    """Write the problem bank to JSON."""
    p = Path(path) if path else _DEFAULT_PATH
    with p.open('w', encoding='utf-8') as f:
        json.dump({'problems': problems}, f, indent=2)


def find_problem(bank: list[dict], problem_id: str) -> dict | None:
    """Return the problem with matching id, or None."""
    for p in bank:
        if p.get('id') == problem_id:
            return p
    return None


def add_problem(bank: list[dict], new_problem: dict) -> tuple[bool, list[str]]:
    """
    Append a new problem to the bank if it's valid (per Beginner B's validator).
    Returns (success, errors). Does NOT save to disk — caller decides.
    """
    from .validation import validate_problem

    errors = validate_problem(new_problem)
    if errors:
        return False, errors
    if find_problem(bank, new_problem.get('id', '')):
        return False, [f"A problem with id {new_problem.get('id')!r} already exists"]
    bank.append(new_problem)
    return True, []
