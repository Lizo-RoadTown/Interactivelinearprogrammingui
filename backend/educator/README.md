# Educator Portal — Beginner Tasks

Welcome! This folder contains three small Python tasks, one for each of you.
Each task is a single function, about 20–40 lines of code. You do not need
to know anything about linear programming to do this — you're working with
plain dictionaries, lists, and strings.

## Setup

From the `InteractiveLPUI/` root:

```bash
# activate the Python environment (done once per terminal session)
source .venv/Scripts/activate        # Windows Git Bash
# or: .venv\Scripts\activate          # Windows CMD
# or: source .venv/bin/activate       # Mac/Linux
```

## How this works

There is a JSON file `problems.json` containing a list of word problems.
Each problem is a dictionary with fields like `title`, `scenario`,
`difficulty`, `variables`, `constraints`, etc.

Your three functions work on these dictionaries. They do not solve the
problems — they help a teacher manage the bank of problems.

## The three tasks

| File                  | Assigned to   | What it does                                             |
| --------------------- | ------------- | -------------------------------------------------------- |
| `listing.py`          | **BEGINNER A** | Filter problems by difficulty, category, or search text |
| `validation.py`       | **BEGINNER B** | Check a problem dict for errors                         |
| `export.py`           | **BEGINNER C** | Generate a Markdown student worksheet from a problem    |

Open your assigned file. The docstring at the top explains exactly what
to do, with examples and hints.

## Running the tests

Every time you make a change, run the tests to see if your code is correct:

```bash
python -m backend.educator.test_educator
```

Output tells you which tests pass or fail:

```
─── BEGINNER A — listing.py ──────────────────────────────────────────
  Test 1: no filters returns all problems
  Test 2: difficulty='beginner' filter
  ...
  ✓  BEGINNER A — listing.py — all tests pass
```

- `⚠` means "not implemented yet"
- `✗` means "a test failed — fix and re-run"
- `✓` means "all tests pass — nice work"

You are done with your task when you see `✓` for your letter.

## What happens next

Once all three functions are implemented:

1. A teacher can use the web UI at `/educator` (built separately).
2. That UI calls the FastAPI backend at `/api/educator/*`.
3. Those endpoints call YOUR functions to do the actual work.

You can demo your part live:

- **BEGINNER A** can show filtering the problem list in the terminal.
- **BEGINNER B** can show an invalid problem being caught with clear messages.
- **BEGINNER C** can show a nicely-formatted worksheet being printed from a dict.

## If you get stuck

- Re-read your docstring — it has examples and hints.
- Ask a teammate or your instructor.
- Print things out with `print(...)` to see what your variables look like.
- There is a `reference_solutions.py` file in this folder — it's the
  instructor's copy. Try NOT to look at it until you've really struggled.

## Project context

This portal is part of a larger interactive linear programming tool. Your
work enables teachers to manage the problem bank their students use. Small
job, real impact.
