---
name: lp-ui-design
description: |
  Apply the Interactive LP Simulator's design rules to a UI/UX task. Use when
  building or reviewing any student-facing learning surface in this repo —
  new chapter content, a new sensitivity operation, a tableau interaction, a
  word-problem flow. Pulls in the 14 design rules from
  docs/UX_BEST_PRACTICES.md and the authoritative interaction spec at
  guidelines/simplex_spec_v2.md, then evaluates or scaffolds the task
  against them.

  Trigger words that should auto-invoke this skill:
  "design rules", "best practices", "make this guided", "follow the spec",
  "Attention → Question → Commitment", "Episode 0 / A / B",
  "is this consistent with the rest of the app", "make a new chapter",
  "wire up §8.3", "add a new lesson", "scaffold a learning page",
  "make this match Practice", "make this match GuidedLearnPage".
---

# LP UI Design — Apply the rules to a task

You are working in the **Interactive Linear Programming UI** codebase. The
app's student-facing chapters (3–6) work because they enforce a specific
interaction model. The chapters that don't work yet (parts of §8.3, the
Matrix Method gameboard) skip parts of that model and students bounce.

## Always do this first

Before scaffolding code or proposing a design, **read these three files in
order** and treat them as the authoritative reference:

1. [guidelines/simplex_spec_v2.md](../../../guidelines/simplex_spec_v2.md) — the
   non-negotiable interaction contract. The Episode model, the Color
   Semantics, the Retry/Support model, the Show Answer behavior.
2. [docs/UX_BEST_PRACTICES.md](../../../docs/UX_BEST_PRACTICES.md) — the 14
   rules pulled from the working chapters, with code references and the
   "why this matters" reasoning for each.
3. [docs/CURRICULUM_TO_SOLVER.md](../../../docs/CURRICULUM_TO_SOLVER.md) —
   the chapter-to-code map. Use this to find which file/class/line implements
   the textbook concept being asked about.

## The master contract

Every interaction in a student-facing learning page must enforce:

> **Attention → Question → Commitment → Feedback → Reveal**

The student must **commit to a decision before the system reveals
structure**. No auto-advance, no answer-before-input, no forward navigation
during reasoning. This is rule zero — every other rule serves it.

## How to apply the skill

When the user asks for a UI/UX change in this app, walk through this
checklist explicitly and report on each step:

### Step 1 — Identify which textbook event is being taught

Pin the task to a specific moment in Chapters 3–8 of the textbook. If the
task is "build the §8.3.5 reduced-cost calculation," the textbook event is
"compute c̄_new = C_B·B⁻¹·a_new − c_new and decide whether x_new enters."
If the task can't be pinned to a textbook event, ask the user to clarify.

### Step 2 — Decompose into Episodes

Each Episode is one Attention/Question/Commitment/Feedback/Reveal cycle. The
simplex pivot decomposes into Episode A (entering variable) + Episode B
(leaving variable), plus optional Episode 0 for Big-M / Two-Phase Z-row
setup. Most §8.3 operations decompose into 2–4 Episodes:

- **§8.3.1 / §8.3.2 (OF coefficient change)**: pick the affected
  C_B (or C_N) entry → compute new reduced costs symbolically with Δ →
  set up the optimality inequalities → solve for the Δ-range → compare
  against the asked Δ.
- **§8.3.3 (RHS change)**: pick the column of B⁻¹ for the changed
  constraint → multiply by Δ → set up feasibility inequalities → solve
  for the Δ-range → check.
- **§8.3.5 (add activity)**: compute B⁻¹·a_new → compute reduced cost →
  decide.
- **§8.3.6 (add constraint)**: substitute current x* → if violated, add
  row, EROs, dual simplex.

### Step 3 — Define the state machine in a hook

Add to `SolveSubPhase` in
[src/app/hooks/useGuidedSensitivity.ts](../../../src/app/hooks/useGuidedSensitivity.ts)
or create a new hook with the same shape. Each state has explicit allowed
actions; every action is guarded on the current phase. Reject any action
that doesn't match the phase. The shape to follow is in
[src/app/hooks/useGuidedSimplex.ts](../../../src/app/hooks/useGuidedSimplex.ts).

### Step 4 — Render with `?` slots, not form inputs

Empty values get a dashed-border `?` slot. Filled values get a `fill-pop`
animation and a solid card. The contrast is intentional. The reference
implementation is in
[src/app/pages/workspace/GuidedLearnPage.tsx](../../../src/app/pages/workspace/GuidedLearnPage.tsx)
under the comment "Canvas: the LP as a gameboard."

### Step 5 — Hook the graph (Rule 2: two-language coherence)

Whatever the Episode asks the student to commit to, find its geometric
counterpart and update the graph at the same time. If the operation has no
geometric counterpart (e.g. add a new variable in a 5-variable LP), say so
explicitly — that's a valid answer, but it must be acknowledged so the
student doesn't expect a graph that won't appear.

Reuse `DiscoveryGraph` from
[src/app/pages/workspace/DiscoveryGraph.tsx](../../../src/app/pages/workspace/DiscoveryGraph.tsx)
when possible. Don't build a new SVG graph — the calibration / colors /
optimum-marker styling are tuned and the rest of the app uses them.

### Step 6 — Write hints by hand

Per-step, per-attempt-count. Attempts 1–2 get minimal feedback ("not
quite, try another"). Attempt 3 gets a hint ("compare values"). Attempt
4+ exposes "Show reasoning" (which explains the rule but does NOT
auto-select the answer — student must still click).

Do NOT auto-generate hints from an LLM at runtime. Every problem in
[src/app/data/wordProblems.ts](../../../src/app/data/wordProblems.ts) carries
hand-crafted `formulationHints`, `methodExplanation`, and `solvingHints`.
That hand-craft is why the explanations land.

### Step 7 — Color-code consistently

Six colors, one meaning each. Reuse the Tailwind classes already used
elsewhere — don't introduce a new color for a new state.

| Meaning | Tailwind |
|---|---|
| Attention target | subtle border emphasis |
| Candidate (selected, unjudged) | `bg-amber-500/10 border-amber-500/40 text-amber-200` |
| Suboptimal but valid | amber + dual-button + note |
| Correct | `bg-emerald-500/10 border-emerald-500/40 text-emerald-200` |
| Active column / pivot | `bg-blue-500/10` |
| Invalid (red flash) | `bg-destructive/10 border-destructive/40 text-destructive` |
| Skipped / dimmed | `opacity-40` |

### Step 8 — Wrong-but-valid ≠ wrong-and-invalid

If the textbook permits a choice but it isn't the *fastest* (e.g. picking
a non-most-negative Z-row entry instead of the most-negative one), do NOT
block the student. Show amber, two buttons (*Use this anyway* +
*Choose again*), log the suboptimal pick, and debrief after the pivot
with a path-taken vs optimal-path comparison. This is rule §A3b in the
spec and is non-negotiable.

If the choice violates a constraint that produces an *invalid* state
(e.g. picking a row with a non-positive pivot entry in the leaving-row
test), block with red flash and require retry.

### Step 9 — Verify against the rules before claiming complete

For any UI change, confirm:

1. Does the master contract hold? (Question before Reveal?)
2. Is forward navigation locked during reasoning?
3. Does the graph update when a tableau-side commit lands? (and vice
   versa for slider-driven views?)
4. Are hints attempt-aware?
5. Are wrong choices distinguished as invalid (red, retry) vs
   suboptimal (amber, dual-button)?
6. Are empty cells visibly empty (`?` slots) and filled cells visibly
   filled (`fill-pop`)?
7. Does Show Answer reveal the *answer* but require Apply for the
   *consequence*?

If any of these is "no," the implementation doesn't meet the rules.
Either fix it or explicitly call out the trade-off.

## Anti-patterns to refuse

The previous tool the team tried failed for specific reasons. Refuse any
proposed design that:

- Generates a worksheet the student has to *read* with no interaction.
- Auto-advances through reveal without student commitment.
- Returns one feedback message regardless of attempt count.
- Has no graph alongside the algebra (for 2-variable LPs).
- Calls wrong choices "wrong" without distinguishing invalid from
  suboptimal.
- Uses a pre-made LP solver (scipy, PuLP, Gurobi) and hides the steps
  from the student. The point of `solver_core.py` is that students can
  step through every pivot.

If the user explicitly asks for one of these (e.g. "just generate a
worksheet"), name it as a rule violation and ask them to confirm before
proceeding.

## Output format

When asked to design or scaffold something:

1. State which textbook event is being taught (Step 1).
2. Decompose into Episodes (Step 2) with a small table.
3. Sketch the state machine — phases, allowed transitions, what each
   commit produces.
4. List the visual states with the color tokens from Step 7.
5. List the hand-crafted hints needed (per attempt count, per phase).
6. List the graph updates that pair with each tableau commit.
7. Verify against the Step 9 checklist explicitly.

Then, only after the user confirms the design, write the code.

## When in doubt

Re-read the spec's Final Instruction:

> Implement this **exact interaction contract**. Do not simplify, reorder,
> or collapse phases. If any ambiguity arises, prioritize: *Student must
> think before system reveals.*
