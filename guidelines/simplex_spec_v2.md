# SPEC: Guided Simplex Interaction System (Authoritative)
# Version 2.0 — Revised for textbook consistency (KHPContent Linear Programming)
# Changes from v1.0 marked with ⚠️ REVISED and ✅ ADDED

---

## 0. Purpose

This system is a **student-driven learning environment**, not a workflow UI.

The system must enforce:

> **Attention → Question → Commitment → Feedback → Reveal**

The student must **commit to a decision before the system reveals structure**.

---

# 1. Global Interaction Contract

## 1.1 Non-Negotiable Rules

* The system **must not reveal the answer before student input**
* The system **must not allow forward navigation during active reasoning**
* Every pivot consists of **two required reasoning episodes**:
  * Entering variable
  * Leaving variable
* The UI must **guide attention**, not indicate answers

---

## 1.2 Navigation Rules

| State                     | Next Enabled  | Timeline Jump | Notes             |
| ------------------------- | ------------- | ------------- | ----------------- |
| Episode 0 (Z-row setup)   | ❌             | ❌             | Big-M/2-phase only|
| Arrive at pivot           | ❌             | ❌             | Must engage       |
| During entering selection | ❌             | ❌             | Locked            |
| During leaving selection  | ❌             | ❌             | Locked            |
| After correct leaving     | ⚠️ Apply only | ❌             | No skipping       |
| After pivot applied       | ✅             | ✅             | Normal navigation |

---

## 1.3 Show Answer Behavior

* Available at all stages
* Does NOT skip reasoning visualization
* Performs:
  1. Highlight correct selection
  2. Show explanation
  3. Trigger reveal phase
* Then enables "Apply"

---

# 2. Episode Model

## ✅ ADDED: Episode 0 — Z-ROW SETUP (Big-M and Two-Phase only)

This episode appears ONLY when the problem contains >= or = constraints
that require artificial variables. It does NOT appear for standard
simplex problems with all <= constraints.

**Why this exists:** The textbook (Chapter 5, Tables 5.5–5.7) explicitly
shows that after adding artificial variables to the initial tableau,
row operations (EROs) must be performed to eliminate each basic
artificial variable's coefficient from the Z-row BEFORE any pivot
selection can begin. This is a required step students must practice.
Skipping it produces an incorrect Z-row and therefore incorrect
pivot decisions.

---

### Episode 0 — ARRIVE

**Visible**
* Full initial tableau
* Z-row shows raw coefficients (artificials not yet cleared)
* Notice banner: "Before selecting a pivot, the Z-row must be adjusted.
  Basic variables must have a coefficient of 0 in the Z-row."

**Hidden**
* No pivot highlights
* No candidate indicators

---

### Episode 0 — ATTENTION PHASE

**Instruction (Required)**
> "You have basic artificial variables in the basis. Their coefficients
> in the Z-row must be eliminated using row operations before you can
> select an entering variable. Identify which basic variable still has
> a nonzero coefficient in the Z-row."

**UI Changes**
* Basis column highlighted
* Z-row highlighted
* Student must identify which basic variable needs clearing

---

### Episode 0 — COMMITMENT (per artificial)

For each basic artificial variable with a nonzero Z-row coefficient:

**Student selects the row to use for elimination**

**If correct row selected:**
> "Correct. Apply the row operation to eliminate this coefficient
> from the Z-row."
* Show the ERO notation (e.g., MR2 + R4)
* Apply the operation
* Update Z-row display
* Proceed to next artificial if any remain

**If incorrect row selected:**
> "This row will not eliminate the coefficient. You need the row
> where this variable is basic."
* Flash red, retry required

---

### Episode 0 — COMPLETE

When all basic artificials have been cleared from the Z-row:

**Feedback:**
> "Z-row is now correctly set up. All basic variable coefficients
> are zero. You may now select the entering variable."

**Transition:** Proceed to Episode A

---

# EPISODE A — ENTERING VARIABLE

---

## A1 — ARRIVE

**Visible**
* Full tableau (neutral styling)
* Graph at current BFS
* Button: **"Choose Entering Variable"**

**Hidden**
* No highlights
* No candidate indicators
* No ratios
* No color hints

---

## A2 — ATTENTION PHASE

**Trigger:** User clicks "Choose Entering Variable"

**UI Changes**
* Z-row:
  * Thick top border
  * Label: **"Z-row (objective)"**
  * Slight background differentiation

**Instruction (Required)**
> "The Z-row shows how each variable affects the objective.
> For MAX: negative values indicate improvement.
> For MIN: positive values indicate improvement.
> Which variable should enter the basis?"

**Constraints**
* NO highlighted cells
* NO candidate marking

---

## A3 — COMMITMENT (User Click)

User clicks a Z-row cell

---

### A3a — Invalid (wrong direction)

For MAX: user clicks a value >= 0
For MIN: user clicks a value <= 0

**Feedback (inline near cell):**
> MAX: "This value is ≥ 0 — increasing this variable would not
> improve z. Choose a negative Z-row value."
>
> MIN: "This value is ≤ 0 — increasing this variable would not
> improve z. Choose a positive Z-row value."

**Behavior**
* Cell flashes red
* No progression

---

### ⚠️ REVISED: A3b — Valid but not optimal (Dantzig rule)

**Context:** The textbook uses the Dantzig rule (most negative for MAX,
most positive for MIN) as the standard method, but any valid negative
(MAX) or positive (MIN) Z-row entry is a legal choice that will still
lead to the optimal solution — just in more iterations. A non-most-
negative choice is SUBOPTIMAL but NOT INCORRECT. The spec must
not block the student from proceeding with a valid choice.

**Feedback (inline near cell):**
> "This would improve z, but it is not the most negative value.
> The Dantzig rule (most negative) gives the fastest improvement.
> You can use this variable anyway, or choose the most negative."

**Behavior**
* Cell turns amber
* ⚠️ TWO buttons appear (not one):
  * **"Use this variable anyway"** — proceeds to A4 with this choice,
    tracking that a suboptimal selection was made
  * **"Choose again"** — clears selection, student picks again
* Student is NOT forced to retry
* If student proceeds with suboptimal choice: flag is logged,
  explanation is shown after pivot is complete comparing
  the path taken vs. the optimal path

---

### A3c — Correct (most negative for MAX / most positive for MIN)

**Feedback:**
> MAX: "Correct. This is the most negative value — it improves z fastest."
> MIN: "Correct. This is the most positive value — it improves z fastest."

**Behavior**
* Cell turns green
* Proceed to A4

---

## A4 — REVEAL (Entering Variable)

**UI Changes**
* Entire pivot column → **blue highlight**
* Selected cell remains green or amber

**Graph Update**
* Directional arrow from current vertex
* Represents increasing entering variable

**Instruction**
> "Now determine which constraint limits how far this variable
> can increase."

---

# EPISODE B — LEAVING VARIABLE

---

## B1 — ATTENTION

**Visible**
* Pivot column highlighted (blue)
* RHS column subtly emphasized

**Rule Display**
> "Divide RHS by the pivot column entry (only where the pivot
> column entry is POSITIVE). The smallest ratio determines the
> leaving variable. Rows with zero or negative pivot column
> entries are skipped."

**Constraints**
* NO ratios shown yet

---

## B2 — VALID FILTERING

Rows with <= 0 pivot column values:
* Dimmed
* Non-clickable or rejected on click with feedback:
  > "This entry is ≤ 0 and is skipped in the ratio test.
  > Negative entries would make the entering variable negative
  > after pivoting, violating non-negativity."

---

## B3 — COMMITMENT

User clicks a row in pivot column

---

### B3a — Invalid row (zero or negative pivot entry)

**Feedback:**
> "This row cannot leave — the pivot column entry is ≤ 0.
> Only positive entries participate in the ratio test."

---

### B3b — Valid but not minimum ratio

**Feedback (CRITICAL):**
Ratios are revealed ONLY now

> "This is a valid candidate. But compare ratios:
> Row 1: [RHS] ÷ [entry] = [ratio]
> Row 2: [RHS] ÷ [entry] = [ratio]
> The smallest ratio determines feasibility — choosing a larger
> ratio would push another variable negative."

**Behavior**
* Cell amber
* Retry required
* (Unlike Episode A, a non-minimum ratio choice here is genuinely
  incorrect — it produces an infeasible solution. Retry is appropriate.)

---

### B3c — Correct row (minimum ratio)

**Feedback:**
> "Correct. This row has the smallest ratio and limits the increase."

**Behavior**
* Row turns green

---

## B4 — REVEAL (Leaving Variable)

**UI Changes**
* Ratio column appears
* Winning ratio emphasized

**Graph Update**
* Leaving constraint line highlighted
* Destination vertex appears (ghost)
* Dotted path from current to next

---

## B5 — APPLY

**UI:** Button: **"Apply Pivot"**

**Rules**
* Must NOT auto-apply
* Requires explicit click

**On Apply**
* Tableau updates via row operations
* Graph animates to new vertex
* Ratio column removed
* If Episode 0 is needed again (e.g., Phase II setup in Two-Phase):
  return to Episode 0 before next Episode A
* Otherwise: next Episode A begins

---

# 3. Retry / Support Model

## Attempts

| Attempts | Behavior                            |
| -------- | ----------------------------------- |
| 1–2      | Minimal feedback                    |
| 3        | Add hint (e.g., "compare values")   |
| 4+       | Offer "Show reasoning"              |

---

## Show Reasoning (NOT same as Show Answer)

* Explains rule step-by-step
* Does NOT auto-select answer
* Student must still click

---

# 4. Visual System Requirements

## Color Semantics

| Meaning                          | Color           |
| -------------------------------- | --------------- |
| Attention target                 | subtle emphasis |
| Candidate (user-selected)        | amber           |
| Suboptimal but valid (Episode A) | amber + note    |
| Correct                          | green           |
| Active column                    | blue            |
| Invalid                          | red flash       |
| Skipped (non-positive ratio row) | dimmed          |

---

## Required Behaviors

* Column highlight must be **strong and continuous**
* Feedback must be **inline (near interaction)**
* No bottom-panel-only explanations

---

# 5. Graph ↔ Tableau Mapping (Required)

| Event                | Graph Behavior               |
| -------------------- | ---------------------------- |
| Entering selected    | Direction arrow from vertex  |
| Leaving selected     | Constraint line highlighted  |
| Pivot applied        | Move to new vertex           |
| Episode 0 active     | Graph shows current BFS only |

---

## Requirement

The graph must:
* Support reasoning (not just confirm)
* Visually correspond to tableau decisions

---

# 6. Timing Rules

* No auto-advance except minor UI transitions (<300ms)
* No auto-apply pivot
* All major transitions require user action

---

# 7. Extensibility Requirement

This model MUST apply to:

* **Initial tableau construction**
* **Z-row setup (Episode 0)** — Big-M and Two-Phase only
* **Slack/surplus/artificial variable decisions**
* **Optimality detection**
* **Infeasible/unbounded detection**
* **Phase I → Phase II transition** — Episode 0 re-runs when
  Phase II begins and original objective is restored, since the
  Z-row must be recomputed for the new objective

Same structure throughout:

> Attention → Question → Commitment → Feedback → Reveal

---

# 8. Two-Phase Specific Behavior

## Phase I → Phase II Transition

When Phase I completes (w* = 0):

1. Show banner: "Phase I complete. All artificials are zero — a
   basic feasible solution exists. Artificial columns will now be
   removed and the original objective restored."
2. Remove artificial columns from display
3. Restore original objective coefficients in Z-row
   (shown as raw, not yet adjusted for current basis)
4. **Re-enter Episode 0** to clear basic variable coefficients
   from the new Z-row before pivot selection resumes
5. Then proceed to Episode A for Phase II

## Phase I Failure (Infeasible)

When Phase I ends with w* > 0 (artificial still basic with RHS > 0):

* Show: "INFEASIBLE. An artificial variable remains in the basis
  with a positive value. No feasible solution exists."
* Disable further pivot interaction
* Enable "Show explanation" only

---

# 9. Implementation Constraint

Do NOT begin coding until:

* This interaction model is confirmed
* Step sequencing matches exactly
* Episode 0 gating is implemented before Episodes A and B
* The A3b dual-button behavior is implemented (not retry-only)

---

# Summary of Changes from v1.0

| Section    | Change                                      | Reason                                         |
| ---------- | ------------------------------------------- | ---------------------------------------------- |
| A3b        | Replaced "retry required" with dual-button  | Non-most-negative is valid per textbook         |
| A3b        | Added suboptimal path logging               | Allows debrief comparison after pivot           |
| Episode 0  | Added entirely (Z-row setup phase)          | Required by textbook before any pivot selection |
| Section 7  | Added Episode 0 and Phase I→II to scope     | Completeness                                   |
| Section 8  | Added Two-Phase specific behavior           | Phase I→II needs its own Episode 0             |
| B2         | Added explicit rejection feedback text      | Clarifies why negative entries are skipped      |
| A2         | Added MIN/MAX conditional instruction text  | Spec was MAX-only; MIN uses opposite sign rule  |

---

# Final Instruction to AI

Implement this **exact interaction contract**.

Do not simplify, reorder, or collapse phases.

If any ambiguity arises, prioritize:

> "Student must think before system reveals."

Episode 0 is non-negotiable for Big-M and Two-Phase problems.
The A3b dual-button is non-negotiable — do not revert to retry-only.
