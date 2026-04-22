# Task C — Export a problem as a Markdown worksheet

Your job is to fill in **one Python function** that takes a word problem
dict and returns a printable Markdown worksheet string. A teacher can
paste that string into a note-taking app and hand it to students.

You don't need to know linear programming — you're just building up a
string section by section from the dict's fields.

When you finish, the **Beginner C** card on the `/educator` page will
light up green, and you can demo it live by picking a problem and
showing the generated Markdown.

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

`backend/educator/export.py`

Scroll to `export_to_markdown`. The docstring explains what sections
the worksheet should have; this sheet is a faster walk-through.

---

## 3. What your output should look like

Given this problem (shortened):

```python
problem = {
    'title': 'Bakery Production Mix',
    'difficulty': 'beginner',
    'scenario': 'A small bakery makes two products ...',
    'objectiveType': 'max',
    'variables': ['muffins', 'cookies'],
    'constraints': [
        {'coefficients': [2, 1], 'operator': '<=', 'rhs': 100},
        {'coefficients': [1, 2], 'operator': '<=', 'rhs': 80},
    ],
}
```

Your function should return a Markdown string like this:

```markdown
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
```

The exact wording of each line doesn't have to match; what matters is
that each section is present, in this order, with the field values
filled in from the dict.

---

## 4. Structure hints

Build up a list of lines, then join them:

```python
def export_to_markdown(problem):
    lines = []

    # Title + difficulty
    lines.append(f"# {problem.get('title', 'Untitled')}")
    lines.append(f"*Difficulty: {problem.get('difficulty', 'unknown')}*")
    lines.append("")   # blank line for readability

    # Scenario
    lines.append("## Scenario")
    lines.append("")
    lines.append(problem.get('scenario', ''))
    lines.append("")

    # Your Task header
    lines.append("## Your Task")
    lines.append("")

    # 1. Decision Variables
    lines.append("### 1. Decision Variables")
    lines.append("_Define what each variable represents in your own words:_")
    for v in problem.get('variables', []):
        lines.append(f"- {v} = _____")
    lines.append("")

    # 2. Objective Function
    lines.append("### 2. Objective Function")
    lines.append("_Write the objective function:_")
    lines.append(f"- {problem.get('objectiveType', 'max')} z = _____")
    lines.append("")

    # 3. Constraints
    lines.append("### 3. Constraints")
    lines.append("_Write each constraint:_")
    for i, _ in enumerate(problem.get('constraints', []), start=1):
        lines.append(f"- Constraint {i}: _____")
    lines.append("")

    # 4. Your Solution
    lines.append("### 4. Your Solution")
    lines.append("_Solve using the simplex method and show your work below:_")
    lines.append("")

    return "\n".join(lines)
```

Don't just copy-paste that — type it yourself so you understand each
line. The structure is: `lines = []` → `append` section by section →
`return "\n".join(lines)`.

---

## 5. What `.get()` does (quick aside)

`problem.get('title')` is like `problem['title']` but returns `None`
instead of crashing if the key is missing. `problem.get('title', 'X')`
returns `'X'` as a default. Use `.get()` whenever a key might be
missing — it's safer.

---

## 6. Test your code

```bash
python -m backend.educator.test_educator
```

Look for your section:

```
─── BEGINNER C — export.py ───────────────
  Test 1: title appears as H1
  Test 2: difficulty line present
  Test 3: scenario section present
  ...
  ✓  BEGINNER C — export.py — all tests pass
```

When a test fails it'll show you which section / substring it expected
to find and what it actually got. Match the expectation, re-run.

---

## 7. See your work live

1. Start the backend: `uvicorn backend.main:app --reload --port 8000`
2. Start the frontend: `npm run dev`
3. Open <http://localhost:5173/educator>.
4. Scroll to the **Beginner C** card.
5. Pick a problem from the dropdown → click **Export to Markdown**.
6. The Markdown your function returned appears in the preview pane on
   the right.

---

## 8. For the live demo

~60-second flow:

1. "My function converts a problem dict into a printable worksheet. A
   teacher picks a problem and gets Markdown they can hand to students."
2. Pick a problem from the dropdown → click Export → point at the
   output pane.
3. Pick a different problem → Export → show how the same function
   produces a different worksheet because the input is different.
4. (Optional) Open `export.py` and show the `lines.append(...)`
   pattern that generated it.

Ping a teammate if you're stuck.
