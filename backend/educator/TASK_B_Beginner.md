# Task B — Validate a proposed problem

Your job is to fill in **one Python function** that checks a word problem
dict for common errors and returns a list of human-readable error
messages. An empty list means "no errors."

You don't need to know linear programming — you're checking that a
dictionary has the right keys, types, and values.

When you finish, the **Beginner B** card on the `/educator` page will
light up green, and you can demo it live by clicking "break it on
purpose" and watching your validator catch the errors.

---

## 1. Get set up (once)

From the `InteractiveLPUI/` folder, activate the Python environment:

```bash
# Windows Git Bash
source .venv/Scripts/activate
# Windows CMD
.venv\Scripts\activate
# Mac / Linux
source .venv/bin/activate
```

---

## 2. Open your file

`backend/educator/validation.py`

Scroll to `validate_problem`. The top of the file lists the rules a
valid problem must satisfy; the docstring on the function is the
cheat-sheet version; this file is the even-more-cheat-sheet version.

---

## 3. What "valid" looks like

A valid problem dict has these keys:

| Key | What it is |
| --- | --- |
| `id` | non-empty string |
| `title` | non-empty string |
| `scenario` | non-empty string |
| `category` | string (any value) |
| `difficulty` | one of `'beginner'`, `'intermediate'`, `'advanced'` |
| `objectiveType` | one of `'max'`, `'min'` |
| `numVars` | positive integer |
| `variables` | list of strings, length == `numVars` |
| `objectiveCoefficients` | list of numbers, length == `numVars` |
| `constraints` | non-empty list of constraint dicts |

Each constraint dict has:

| Key | What it is |
| --- | --- |
| `coefficients` | list of numbers, length == `numVars` |
| `operator` | one of `'<='`, `'>='`, `'='` |
| `rhs` | a number (int or float) |

Your function returns a **list of strings**, one per problem found.
Empty list = all good.

---

## 4. Worked examples

### Valid input → no errors

```python
good = {
    'id': 'bakery', 'title': 'Bakery Mix', 'category': 'production',
    'difficulty': 'beginner', 'scenario': 'muffins and cookies',
    'numVars': 2, 'objectiveType': 'max',
    'objectiveCoefficients': [3, 2],
    'variables': ['muffins', 'cookies'],
    'constraints': [
        {'coefficients': [2, 1], 'operator': '<=', 'rhs': 100},
        {'coefficients': [1, 2], 'operator': '<=', 'rhs': 80},
    ],
}
validate_problem(good)  →  []
```

### Bad input → error messages

```python
bad = {
    'title': 'Broken',
    'difficulty': 'expert',            # invalid
    'scenario': 'demo',
    'numVars': 2,
    'objectiveType': 'maximize',       # must be 'max'
    'objectiveCoefficients': [3],      # wrong length
    'variables': ['a', 'b'],
    'constraints': [
        {'coefficients': [2, 1], 'operator': '<<', 'rhs': 100},  # invalid op
    ],
}
validate_problem(bad)
# → [
#   "id is missing or not a non-empty string",
#   "difficulty 'expert' is invalid (must be advanced, beginner, intermediate)",
#   "objectiveType 'maximize' is invalid (must be 'max' or 'min')",
#   "objectiveCoefficients has 1 entries but numVars is 2",
#   "constraint #1: operator '<<' is invalid (must be <=, >=, or =)",
# ]
```

Your messages don't have to match the exact wording — just be
human-readable and specific ("difficulty is invalid" is fine; "error"
alone is not).

---

## 5. Structure hints

```python
def validate_problem(problem):
    errors = []

    # Example check:
    if not isinstance(problem.get('id'), str) or not problem.get('id').strip():
        errors.append("id is missing or not a non-empty string")

    # ... repeat for every rule in the table above ...

    return errors
```

Useful type checks:
- `isinstance(x, str)` → is it a string?
- `isinstance(x, int) and not isinstance(x, bool)` → is it a *real* int?
  (`True` / `False` are technically ints in Python, so you usually
  exclude them.)
- `isinstance(x, (int, float)) and not isinstance(x, bool)` → is it a
  number?
- `isinstance(x, list)` → is it a list?

There are pre-defined sets at the top of the file:
`VALID_DIFFICULTIES`, `VALID_OBJECTIVE_TYPES`, `VALID_OPERATORS`. Use them:

```python
if problem.get('difficulty') not in VALID_DIFFICULTIES:
    errors.append(f"difficulty {problem.get('difficulty')!r} is invalid ...")
```

Don't forget to loop through the constraints and check each one:

```python
for i, c in enumerate(problem.get('constraints', []), start=1):
    if c.get('operator') not in VALID_OPERATORS:
        errors.append(f"constraint #{i}: operator {c.get('operator')!r} is invalid ...")
    # ... etc
```

---

## 6. Test your code

```bash
python -m backend.educator.test_educator
```

Look for:

```
─── BEGINNER B — validation.py ───────────────
  Test 1: valid problem returns empty list
  Test 2: missing id caught
  Test 3: invalid difficulty caught
  ...
  ✓  BEGINNER B — validation.py — all tests pass
```

When a test fails, the output says exactly which input it fed in and
what it expected to see in your error list. Add the check that's
missing, run again.

---

## 7. See your work live

1. Start the backend: `uvicorn backend.main:app --reload --port 8000`
2. Start the frontend: `npm run dev`
3. Open <http://localhost:5173/educator>.
4. Scroll to the **Beginner B** card.
5. Click **Validate** on the pre-loaded valid example → should show
   "No errors — the problem is valid."
6. Click **break it on purpose** → textarea fills with a deliberately
   broken problem → click **Validate** → your error messages appear.

---

## 8. For the live demo

~60-second flow:

1. "My function checks a proposed word problem for errors and tells the
   teacher what's wrong in plain English."
2. Click **Validate** with the valid example → point at the green "no
   errors" state.
3. Click **break it on purpose** → **Validate** → point at the list of
   errors. "My function caught each one separately so the teacher knows
   exactly what to fix."
4. (Optional) Open `validation.py` and show the ~30 lines of checks.

Ping a teammate if you're stuck.
