# Task A — Filter the problem bank

Hi! Your job is to fill in **one Python function** that filters a list of
word problems. You don't need to know anything about linear programming —
you're working with plain dictionaries, lists, and strings.

When you finish, the **Beginner A** card on the `/educator` page of the web
app will light up green, and you can use it to filter problems live during
the team demo.

---

## 1. Get set up (once)

From the `InteractiveLPUI/` folder, in a terminal:

```bash
# Windows Git Bash
source .venv/Scripts/activate
# Windows CMD
.venv\Scripts\activate
# Mac / Linux
source .venv/bin/activate
```

(If the `.venv` folder doesn't exist yet, ask a teammate — one person
creates it once for the whole team.)

---

## 2. Open your file

`backend/educator/listing.py`

Scroll to the function `list_problems`. The docstring explains what it
should do; this sheet is the cheat-sheet version.

---

## 3. What the function does (plain English)

It takes a list of problems and three optional filters. It returns the
problems that match **all** the filters you were given. If a filter is
`None`, skip it.

```python
def list_problems(bank, difficulty=None, category=None, search=None):
    # return a list of problems from `bank` where:
    #   • problem['difficulty'] == difficulty        (if given)
    #   • problem['category']   == category          (if given)
    #   • `search` appears (case-insensitive) in
    #     problem['title'] or problem['scenario']    (if given)
    ...
```

---

## 4. Worked example

Given this tiny bank:

```python
bank = [
    {'id': 'a', 'title': 'Bakery Mix', 'category': 'production',
     'difficulty': 'beginner', 'scenario': 'muffins and cookies...'},
    {'id': 'b', 'title': 'Diet Plan', 'category': 'diet',
     'difficulty': 'beginner', 'scenario': 'protein and carbs...'},
    {'id': 'c', 'title': 'Truck Routes', 'category': 'transportation',
     'difficulty': 'advanced', 'scenario': 'protein shipments...'},
]
```

Calling your function should give:

| Call | What comes back |
| --- | --- |
| `list_problems(bank)` | all 3 |
| `list_problems(bank, difficulty='beginner')` | a, b |
| `list_problems(bank, category='diet')` | b |
| `list_problems(bank, search='Protein')` | b, c (case-insensitive) |
| `list_problems(bank, difficulty='beginner', search='muffin')` | a only |

---

## 5. Hints

- Start with `result = []`.
- Loop: `for p in bank:`
- For each filter, if it's not `None` and doesn't match, `continue`.
- Otherwise, `result.append(p)`.
- At the end, `return result`.
- Lowercase both sides for case-insensitive search:
  `search.lower() in (p.get('title', '') + ' ' + p.get('scenario', '')).lower()`

---

## 6. Test your code

From the `InteractiveLPUI/` folder:

```bash
python -m backend.educator.test_educator
```

Look for your letter in the output:

```
─── BEGINNER A — listing.py ───────────────
  Test 1: no filters returns all problems
  Test 2: difficulty='beginner' filter
  ...
  ✓  BEGINNER A — listing.py — all tests pass
```

- `⚠` means "not implemented yet" — keep going.
- `✗` means a test failed — read the message, it says what was expected.
- `✓` means you're done.

---

## 7. See your work live

1. Start the backend (one terminal):
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
2. Start the frontend (another terminal):
   ```bash
   npm run dev
   ```
3. Open <http://localhost:5173/educator> in a browser.
4. Scroll to the **Beginner A** card. The status badge should now say
   **Implemented ✓**. Try the search box and the difficulty / category
   dropdowns — the results list should update every time you click
   **Apply filters**.

---

## 8. For the live demo

You'll speak for ~60 seconds. Suggested flow:

1. "My function filters the problem bank. I took a list of dicts and
   wrote a loop with three optional checks."
2. Show the card. Type a search term → click Apply → results update.
3. Change the difficulty dropdown → results narrow.
4. (Optional) Open `listing.py` and scroll to the function so the
   audience sees the ~10 lines of code behind the live UI.

If you're stuck or something in this sheet is unclear, ping a teammate.
