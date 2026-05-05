# Curriculum-to-Solver Walkthrough

A reference for the professor: every algorithm taught in Chapters 3–8 of the
course textbook is implemented from scratch in this repository. This document
maps each chapter's content to the specific file, class, and line where the
code lives, and explains why the implementation was structured the way it was.

## Why this is not a library wrapper

Before mapping the chapters, the question to answer first is: *what solver is
this app using?*

The answer: **none — the solver is custom code in this repository.** Two
implementations exist in two languages:

- **`backend/solver_core.py`** — the main Python solver. ~1,015 lines.
- **`src/app/pages/AirlineModel.tsx`** — a small TypeScript simplex,
  ~60 lines, used only by the standalone airline-demo page so it can run
  without a backend.

Confirm this by reading the import block at the top of `solver_core.py`:

```python
import re
import itertools
import numpy as np
```

That is everything. There is no `import scipy.optimize.linprog`, no PuLP, no
Gurobi, no CPLEX. NumPy is present strictly for matrix math (multiplication,
identity matrices, basic linear algebra) — every step of the simplex
algorithm itself, every pivot rule, every special-case detection, is
hand-written code in this file. The same is true of the TypeScript simplex,
which uses no math library at all (only built-in array operations).

The practical implication for the course: students can step through each
algorithm line-by-line, set breakpoints, modify pivot rules, and observe the
effect — none of which would be possible with a black-box library call.

---

## Chapter-by-chapter map

### Chapter 3 — Graphical Method

Used for 2-variable LPs where the feasible region can be drawn in the plane.

| Concept | File | Lines | Notes |
|---|---|---|---|
| Compute intersection of two lines | `backend/solver_core.py` | 109–115 | `line_intersect(a1, b1, c1, a2, b2, c2)` — solves the 2×2 linear system using the determinant form. |
| Test whether a point satisfies a single constraint | `backend/solver_core.py` | 116–127 | `point_satisfies(...)` — supports `≤`, `≥`, `=` with a numerical tolerance. |
| Whole-region feasibility test for an (x, y) point | `backend/solver_core.py` | 128–136 | `is_feasible(...)` — chains `point_satisfies` over every constraint. |
| Identify which constraints are binding at a vertex | `backend/solver_core.py` | 137–160 | `_count_binding`, `_binding_labels` — used to label the polygon corners. |
| Sutherland-Hodgman polygon clipping | `backend/solver_core.py` | 161–183 | `sh_clip(polygon, a, b, c)` — produces the feasible region as a convex polygon by intersecting half-planes. Implemented from scratch rather than calling a CG library because the classroom value is in seeing the algorithm's clip-step explicitly. |
| Full graphical-method computation | `backend/solver_core.py` | 184–278 | `compute_graphical_data(sense, obj, constraints, var_names)` — returns the feasible polygon, the corner points, the objective values at each corner, and the simplex path. This is the data the React `GraphView` component renders. |
| 2-variable corner-enumeration solver | `src/app/pages/workspace/lpSolve.ts` | 22–70 | `solveLP2D(draft, sense)` — used in the browser to recompute the optimum live as a sensitivity slider moves. Pure 2D, exact, fast. |

**Why custom**: the textbook's Chapter 3 visualization (vertex traversal,
binding-constraint labels, half-plane shading) needs intermediate values that
a library function would hide. `compute_graphical_data` returns those
intermediates explicitly so the UI can light up each step as the student
works through it.

---

### Chapter 4 — Simplex Method (Maximization & Minimization)

The standard simplex algorithm for LPs with all `≤` constraints.

| Concept | File | Lines | Notes |
|---|---|---|---|
| Solver class | `backend/solver_core.py` | 279–516 | `class SimplexSolver` — the workhorse for Chapters 4 and 5 |
| Standardization (slack variables) | `backend/solver_core.py` | inside `__init__` and `_setup` | Adds one slack variable per `≤` constraint; the initial basis is the slacks, and the all-zero origin is the starting BFS. |
| Initial tableau construction | `backend/solver_core.py` | inside `SimplexSolver` | The Z-row is set to negated objective coefficients (so we can use the "most negative entry" rule whether maximizing or minimizing). Minimization is handled by negating the objective at the input boundary, solving as a max, then negating z\* on output. |
| Dantzig's rule for entering variable | `backend/solver_core.py` | inside the iteration loop | Picks the column with the most negative Z-row entry. |
| Minimum-ratio test for leaving variable | `backend/solver_core.py` | inside the iteration loop | Computes `RHS_i / pivot_col_i` for every row with a positive pivot-column entry, picks the smallest. Numerical guard against zero/negative entries via `> 1e-9`. |
| Pivot operation | `backend/solver_core.py` | 973–1015 | `_apply_pivot_to_T(T, basis, pivot_row, pivot_col)` — divides the pivot row by the pivot, then subtracts the appropriate multiple from every other row. The basis array is updated to record the entering variable. |
| Optimality detection | `backend/solver_core.py` | inside the iteration loop | Loop terminates when no Z-row entry is `< -tol`. |
| Reading the optimal solution from the final tableau | `backend/solver_core.py` | 867–880 | `_bfs_from_tab(tab, var_names)` — walks the basis array, picks each variable's value out of the RHS column. |
| Plain-English explanation of any tableau cell | `backend/solver_core.py` | 881–953 | `_cell_explanation(...)` — used by the click-to-explain feature in the React `TableauWorkspace`. Generates one-sentence descriptions ("This is the ratio of the RHS to the pivot column entry…") per cell type. |
| What the next pivot would be | `backend/solver_core.py` | 954–972 | `_optimal_pivot_info(T, m)` — computes the would-be next entering/leaving pair without applying it. The interactive pivot UI uses this to highlight the recommended move. |

**Why custom**: every iteration of the loop produces a record entered into a
`steps` list. This is what makes the "step through the simplex" UI possible —
the React app receives every intermediate tableau, the basis at each step,
the entering and leaving variables, and the ratio computations. A library
solver would return only the final answer.

The minimization handling deserves a note. Rather than maintaining two
versions of the algorithm (one for max, one for min), the code negates the
objective coefficients at input and negates `z*` at output. This is
mathematically equivalent and means there is exactly one simplex algorithm
to read.

---

### Chapter 5 — Big-M Method and Two-Phase Method

When the LP has `≥` or `=` constraints, the all-zero origin is no longer
feasible, and an artificial-variable technique is required.

#### Big-M Method

| Concept | File | Lines | Notes |
|---|---|---|---|
| Big-M constant | `backend/solver_core.py` | top of file | `BIG_M = ...` — a sufficiently large positive constant penalizing artificial variables in the objective. |
| Switching simplex into Big-M mode | `backend/solver_core.py` | inside `SimplexSolver.__init__` | The class accepts `useBigM=True`; standardization adds an artificial variable to every `≥` and `=` constraint, and the objective gets a `−M * artificial` term (for max) or `+M * artificial` term (for min). |
| Big-M-aware cell formatting | `backend/solver_core.py` | 87–108 | `_fmt_cell(v, M=BIG_M)` — recognizes when a tableau entry has the form `(a + bM)` and formats it as `"a + bM"` rather than the giant numerical value. This is purely cosmetic but critical for the student to see what the tableau actually says. |
| Detection that artificials remain in the basis at optimality | `backend/solver_core.py` | inside the termination check | If any artificial is basic at non-zero value when the algorithm terminates, the LP is infeasible. |

**Why M is exposed symbolically**: a numeric M (say 10⁶) makes the tableau
unreadable. The custom formatter `_fmt_cell` keeps M as a symbol throughout
display while the underlying NumPy math uses the numeric value. Students see
the algebraic expressions; the computer sees the numbers.

#### Two-Phase Method

| Concept | File | Lines | Notes |
|---|---|---|---|
| Solver class | `backend/solver_core.py` | 517–866 | `class TwoPhaseSolver` |
| Phase 1 setup | inside `TwoPhaseSolver` | | Builds an auxiliary objective: minimize the sum of artificials. Uses the same `SimplexSolver` machinery internally. |
| Phase 1 termination | inside `TwoPhaseSolver` | | If the phase-1 optimum is `> 0`, the original LP is infeasible. If `= 0` and an artificial is still basic at zero, drives it out via a pivot, leaving a feasible basis for phase 2. |
| Phase 2 transition | inside `TwoPhaseSolver` | | The phase-1 final tableau (minus the artificial columns) becomes the phase-2 starting tableau. The objective row is rebuilt from the original c-vector. |
| Phase 2 solve | inside `TwoPhaseSolver` | | Standard simplex iteration on the rebuilt tableau. |

**Why two solver classes rather than one with a mode flag**: the data flow
between phase 1 and phase 2 (artificial columns deleted, objective row
rebuilt) is structurally different from a single-phase Big-M run. Keeping
them separate makes the phase boundary explicit in the step record the
React UI consumes.

---

### Chapter 6 — Special Cases

| Concept | File | Lines | Notes |
|---|---|---|---|
| Alternative optima (multiple optimal solutions) | `backend/solver_core.py` | inside `SimplexSolver` termination | At optimality, scans non-basic variables for any with reduced cost = 0. If one exists, the response status is set to a special "alternative" marker and the UI displays the second optimum corner. |
| Degeneracy detection | `backend/solver_core.py` | inside the ratio test | When the minimum ratio is tied between rows, the implementation falls back to **Bland's rule** (lowest variable index breaks the tie) to guarantee termination. The presence of degeneracy is recorded in the step. |
| Unbounded LP | `backend/solver_core.py` | inside the entering-variable loop | If the chosen entering variable has no positive entries in its column, the LP is unbounded — the algorithm returns the unbounded direction. |
| Infeasibility | `backend/solver_core.py` | end of Big-M / Two-Phase | A non-zero artificial in the optimal basis (Big-M) or a non-zero phase-1 optimum (Two-Phase) flags the LP as infeasible. The status propagates back through the API to the UI banner. |

**Why Bland's rule**: the textbook teaches Dantzig's rule for the entering
variable but doesn't always cover anti-cycling. Bland's rule (lowest-index
tie-break) is the simplest provably-terminating fallback, and it preserves
Dantzig's "most negative" choice for the primary selection — the tie-break
only kicks in when Dantzig's rule is ambiguous. The TypeScript simplex in
the airline demo uses Bland's rule for both entering and leaving variables.

---

### Chapter 7 — Duality (placeholder)

Chapter 7 (duality / dual prices / weak duality) is referenced indirectly
through the shadow-price computation in `sensitivity.py` (see Chapter 8.3.3.1
below) but does not yet have a dedicated learning page in the app. The dual
LP can be derived from the primal's optimal tableau, and the shadow prices
that emerge from sensitivity analysis are exactly the optimal dual variables
— but this connection is currently shown only at the moment it appears in a
sensitivity report, not as its own walkthrough.

This is a known gap in the curriculum coverage and is the reason the planned
walkthrough cannot run continuously from Chapter 6 into Chapter 8 without a
Chapter 7 stop in between.

---

### Chapter 8.2 — Simplex Matrix Format

The matrix algebra setup that Chapter 8.3's sensitivity work depends on.

| Concept | File | Lines | Notes |
|---|---|---|---|
| Matrix-form extraction from a solved tableau | `backend/sensitivity.py` | 38–117 | `extract_matrix_form(solver)` — given a `SimplexSolver` that has solved an LP, returns a dict containing B, B⁻¹, B⁻¹·N, C_B, C_N, B⁻¹·b, the basis indices, and the optimal Z. This is the data needed to evaluate any of the six §8.3 changes. |
| Matrix Method gameboard (frontend) | `src/app/pages/workspace/matrixMethod/` (multiple files) | | A separate UI that builds the optimal table from B⁻¹, C_B, C_N step by step. The gameboard is meant to be the visual companion to §8.2 — the algebra is hand-derived in the browser to teach the structure. |

**Why a separate sensitivity.py**: §8.2 introduces matrix notation
(C_B, C_N, B, B⁻¹, ā_j, b̄, etc.) explicitly because §8.3 uses every one of
those quantities. Putting them all in `extract_matrix_form` and returning
them as a labeled dict means each §8.3 function (below) reads like the
textbook formulas:

```python
mf = extract_matrix_form(solver)
new_z_row = mf['C_B'] @ mf['B_inv'] @ mf['N'] - mf['C_N']
new_rhs   = mf['B_inv'] @ b
```

---

### Chapter 8.3 — Sensitivity Analysis

Six "what-if" operations on a solved LP. Each gets its own function in
`sensitivity.py`, named after the section number.

| § | Function | Lines | What it computes |
|---|---|---|---|
| 8.3.1 | `of_coeff_range_basic(solver, var_name)` | 180–281 | Allowable Δ on the OF coefficient of a basic variable so the current basis remains optimal. Reports the Δ-range and what would happen outside it. |
| 8.3.2 | `of_coeff_range_nonbasic(solver, var_name)` | 282–348 | Same idea but for a nonbasic variable — only the variable's own reduced cost changes, so the formula reduces to a single inequality. |
| 8.3.3 | `rhs_range(solver, constraint_idx)` | 349–430 | Allowable Δ on a constraint RHS so the current basis remains feasible (i.e. B⁻¹·b stays nonnegative). |
| 8.3.3.1 | `shadow_prices(solver)` | 431–477 | Computes the dual prices: y_i = (C_B · B⁻¹)_i for each constraint. These are the rates of change of z* with respect to the RHS of constraint i. |
| 8.3.4 | (combined into `add_activity` for the nonbasic case) | | Changing a technological coefficient of a nonbasic variable — handled via the activity-add path. |
| 8.3.5 | `add_activity(solver, a_new, c_new, name)` | 617–681 | Evaluates whether adding a new decision variable (with its constraint column `a_new` and objective coefficient `c_new`) would enter the basis. Computes the reduced cost C_B·B⁻¹·a_new − c_new. |
| 8.3.6 | `add_constraint(solver, coefficients, operator, rhs)` | 682–798 | Tests whether the current optimal solution satisfies a new constraint. If yes: optimum is unchanged. If no: dual simplex is needed; the function appends the constraint row, transforms it into canonical form via EROs, and returns the modified tableau ready for dual-simplex iteration. |
| (helper) | `sensitivity_summary(solver)` | 478–601 | Produces a complete §8.4-style report combining all of the above. |

**Why each operation is a separate function**: the textbook treats each as
a distinct procedure, and each has different "what does it mean to violate
the range?" semantics:

- §8.3.1 / §8.3.2 violations require continuing the simplex from the
  current basis.
- §8.3.3 violations cause infeasibility and require the dual simplex.
- §8.3.5 / §8.3.6 are decision questions ("does it enter?", "does it
  cut off the optimum?") rather than range questions.

Splitting them lets each function's docstring restate the relevant
textbook formula, and lets the React UI present each as a distinct
"operation" to identify (matching the §8.3.X labels in the
[sensitivityProblems.ts](../src/app/data/sensitivityProblems.ts) file).

---

## How to verify each module yourself

For any solver behavior in the app, you can trace it back to its source in
about three clicks:

1. **In the running app**: open browser DevTools → Network tab.
2. **Trigger the action** (click Solve, drag a slider, click a tableau
   cell).
3. **Look at the request** — the URL identifies the endpoint:
   - `/api/solve` → `SimplexSolver` or `TwoPhaseSolver` in
     [solver_core.py](../backend/solver_core.py)
   - `/api/pivot` → `_apply_pivot_to_T` in solver_core.py
   - `/api/explain-cell` → `_cell_explanation` in solver_core.py
   - `/api/sensitivity` → functions in
     [sensitivity.py](../backend/sensitivity.py)
   - `/api/admin/agent/draft` → BYO-agent proxy in
     [main.py](../backend/main.py) (the only endpoint that calls an
     external service)

For the airline demo specifically, the Network tab shows zero requests when
sliders move — that confirms the `simplex()` function in
[AirlineModel.tsx](../src/app/pages/AirlineModel.tsx) is running entirely
in the browser.

---

## Why the app is structured the way it is

A few architectural decisions worth being able to defend:

1. **Step records, not just final answers.** Every solver method returns a
   list of intermediate steps (each with the tableau, basis, and what
   pivot was performed). The UI scrubs through these. A library function
   that returns only `(x*, z*)` could not power the step-through
   teaching mode.

2. **Symbolic Big-M.** `_fmt_cell` keeps `M` as a symbol in display while
   numeric M drives the math. Students see expressions like `4 + 2M`
   rather than `2,000,004`.

3. **Bland's rule as the tie-breaker.** Dantzig's rule chooses entering
   variables; Bland's rule resolves ties to guarantee termination.
   Cycling is rare but possible on degenerate LPs, and a course tool
   shouldn't ever lock up on a teaching example.

4. **One simplex implementation, max-only internally.** Minimization
   negates the objective at input, solves as max, negates `z*` at
   output. There is exactly one pivot loop in the codebase.

5. **`extract_matrix_form` as the bridge from §8.2 to §8.3.** All six
   sensitivity functions read from the same matrix-form dict. The
   textbook quantities (`C_B`, `B⁻¹`, `N`, `b̄`, etc.) appear by name in
   the code.

6. **Two-language, one algorithm in the airline demo.** The TypeScript
   simplex was added so the airline-final-presentation page could run
   without a backend. It uses the same algorithm logic (Dantzig + Bland)
   but in JavaScript array form, ~60 lines.
