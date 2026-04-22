# Live Demo Script — Problem Bank Team Project

This is the running order for the in-class live demo. It assumes all
three beginner functions are implemented and the tests pass. If any
function is still a stub, its card on `/educator` will say "Stub —
waiting for Beginner X" — that's fine for a mid-progress demo, just
mention it out loud.

---

## Before the demo (5 min)

Two terminals open side-by-side:

**Terminal 1 — backend:**
```bash
cd InteractiveLPUI
source .venv/Scripts/activate       # or equivalent for your OS
uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 — frontend:**
```bash
cd InteractiveLPUI
npm run dev
```

Browser tabs open:
1. <http://localhost:5173/educator>   (the portal)
2. <http://localhost:8000/docs>       (auto-generated FastAPI docs — a
   nice "there's also a REST API" beat to drop in if time allows)
3. (Optional) The GitHub repo on the three Python files.

Run the tests once, leave the output on screen as a "scoreboard":
```bash
python -m backend.educator.test_educator
```

---

## Suggested running order (about 5 minutes total)

### Intro (20 seconds, anyone)

> "We built a web-based educator portal for a bank of linear programming
> word problems. The portal is a React page that calls a Python FastAPI
> backend. The three of us each wrote one Python function that powers
> one part of the portal. Let me show you the portal, and then each of
> us will walk through their function."

Open the browser tab at `/educator`. Point at the header:

> "Three cards, three functions, three of us. The counter up here shows
> how many functions are implemented — all three in our case."

---

### Beginner A — Filter / search (45–60 seconds)

Card to point at: **Beginner A — Filter & search the bank**.

Script:

> "My function takes the full bank of problems and filters by
> difficulty, category, or a search term. It lives in
> `backend/educator/listing.py` — about 10 lines."

**Actions:**
1. Clear any filters, click **Apply filters** → show full list.
2. Type "protein" in the search box → **Apply** → show the diet
   problems only.
3. Switch difficulty dropdown to `intermediate` → **Apply** → narrows.
4. (Optional) Open `listing.py` in the repo view and scroll to the
   function. Point at the loop and the `continue` statements.

> "Each filter is an optional `continue`. If the problem doesn't match
> that filter, skip it. Otherwise, keep it."

---

### Beginner B — Validate (45–60 seconds)

Card: **Beginner B — Validate a proposed problem**.

Script:

> "My function checks a proposed problem for errors — missing keys,
> wrong types, invalid values — and returns a human-readable list of
> what's wrong. It lives in `backend/educator/validation.py`."

**Actions:**
1. Click **load valid example** → **Validate** → point at the green
   "No errors — the problem is valid" state.
2. Click **break it on purpose** → **Validate** → the list of errors
   appears. Read two or three out loud: "difficulty 'expert' is invalid
   — must be beginner, intermediate, or advanced. objectiveCoefficients
   has 1 entry but numVars is 2."
3. (Optional) Open `validation.py` and show the sequence of checks.

> "Each error check is independent, so one invalid field doesn't hide
> the others — the teacher sees every problem at once."

---

### Beginner C — Export (45–60 seconds)

Card: **Beginner C — Export a problem as a Markdown worksheet**.

Script:

> "My function takes a problem dict and builds a printable Markdown
> worksheet. A teacher can copy this into a note-taking app and print
> it for students. The file is `backend/educator/export.py`."

**Actions:**
1. Pick any problem from the dropdown → **Export to Markdown** → point
   at the formatted output in the preview pane.
2. Pick a different problem → **Export** → same function, different
   output, because the input changed.
3. (Optional) Open `export.py` and show the `lines = []` +
   `lines.append(...)` + `"\n".join(lines)` pattern.

> "The structure is the same for every worksheet — title, scenario,
> the four numbered sections — but the specifics come from the dict."

---

### Wrap-up (20 seconds, anyone)

> "All three functions together: a teacher can filter the bank, catch
> errors before publishing a problem, and export any problem as a
> worksheet. The React UI and the FastAPI endpoints were scaffolded
> for us; we wrote the three Python functions that actually do the
> work. Questions?"

---

## If something breaks live

- **"Backend unreachable" rose banner at the top of `/educator`:** the
  uvicorn server stopped or never started. Re-run
  `uvicorn backend.main:app --reload --port 8000` in Terminal 1.
- **A card shows "Stub — waiting for Beginner X":** that person hasn't
  finished. Acknowledge it ("My function is mostly there, here's what's
  still left") and move on.
- **`npm run dev` fails:** run `npm install` first.
- **Tests fail after you made a change right before demo:** revert to
  the last commit with `git stash`, re-run the test, then dig into the
  change after class.

## Things to mention if time is short

These are optional "flavor" points; drop them in if you're under time
or want to impress:

- "The backend has an OpenAPI spec at `/docs` that the React app talks
  to — it's a real production-shape REST API, not a fake."
- "The test file compares our implementations to a reference solution
  the instructor wrote. Both exist so we can see when we diverge."
- "Each of our functions is isolated — we can change ours without
  breaking each other's."

## Things NOT to get dragged into

- Explaining the simplex method. This portal doesn't solve the problems
  — it just manages them. That's a separate module.
- Explaining React / Tailwind / Vite. "The UI is React, we wrote the
  Python" is all the audience needs.
- Debating which person wrote "the hardest" function. They're all about
  the same size and difficulty.

Good luck — this'll go fine.
