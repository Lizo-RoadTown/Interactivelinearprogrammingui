# UX Best Practices — Why Chapters 3–6 Work

A reference for what's working in the implemented chapters and what to apply
to the chapters that are still being built. The patterns below are pulled
from the actual code that students have used in `/practice`, `/learn/:id`,
and `/workspace`, plus the authoritative interaction spec at
[guidelines/simplex_spec_v2.md](../guidelines/simplex_spec_v2.md).

The reason these chapters work is not that the LP is easy. It's that **every
interaction follows the same shape**. The same shape used 50 times in a row
is what makes a student feel oriented. When a later chapter abandons the
shape, the student gets stuck in the first 30 seconds and never recovers.

---

## The master contract

> **Attention → Question → Commitment → Feedback → Reveal**

Said in one sentence: the system asks a question, the student commits to an
answer, the system tells them what their answer means, *then* the system
reveals the structure that the answer connects to. The student must think
before the system explains.

This is the rule every other rule below is in service of. It comes from
[guidelines/simplex_spec_v2.md](../guidelines/simplex_spec_v2.md) §0 and is
quoted in the source-code comments of every page that follows it (search
the repo for "Attention → Question" — it's tagged on PracticeMode.tsx and
on the click-to-pivot tableau).

---

## The 14 rules that make it work

### 1. No forward navigation during active reasoning

The Next button, the timeline, the keyboard shortcuts — all locked until
the student commits. Auto-advance is forbidden except for purely visual
transitions under 300 ms.

Source: [simplex_spec_v2.md §1.2 navigation table](../guidelines/simplex_spec_v2.md).
Implementation: see the `phase` state machine in
[useGuidedSimplex.ts](../src/app/hooks/useGuidedSimplex.ts) — every action
is guarded on `phase`, and the only way to advance is through a commit
event.

**Why students don't get stuck**: they always know whose turn it is. If the
button is disabled, the system is waiting on them. If it's enabled, the
system is ready to move. There is no third state.

### 2. Two-language coherence (graph ↔ tableau)

Every event in the algorithm gets two simultaneous renderings: one in the
tableau and one on the graph. They share data and update at the same
instant.

| Algorithm event | Tableau view | Graph view |
|---|---|---|
| Entering variable picked | Pivot column glows blue | Direction arrow extends from current vertex |
| Leaving variable picked | Pivot row + ratio column appear | Constraint line highlighted, ghost destination vertex shown |
| Pivot applied | Row operations animate | Optimum point hops along the edge |
| Z-row negative entry | Cell flagged | Objective contour rotates |

Source: [simplex_spec_v2.md §5 Graph ↔ Tableau Mapping](../guidelines/simplex_spec_v2.md).
Implementation: `DiscoveryGraph` and `TableauWorkspace` both subscribe to
the same step record from the solver, so a student looking at either gets
the same truth at the same time.

**Why this matters**: students who think geometrically see "we walked along
this edge"; students who think algebraically see "we divided this row and
subtracted." Both groups see both views simultaneously. Nobody is left
behind because their preferred mode wasn't shown.

### 3. Wrong-but-valid ≠ wrong-and-invalid

The textbook teaches Dantzig's rule (most negative Z-row entry enters), but
*any* negative entry is mathematically valid — Dantzig is just fastest.
The system distinguishes:

- **Invalid choice** (e.g. picking a positive Z-row entry to enter): red
  flash, no progression. Student must pick again.
- **Valid but suboptimal** (e.g. picking a negative entry that's not the
  most negative): amber, with TWO buttons:
  1. *Use this variable anyway* — proceeds with the choice, logs that a
     suboptimal pick was made, debriefs after pivot showing path-taken vs
     optimal-path.
  2. *Choose again* — clears, lets the student retry.

Source: [simplex_spec_v2.md A3b](../guidelines/simplex_spec_v2.md) — the
spec is explicit that this is non-negotiable: "do not revert to retry-only."

**Why this matters**: a student who picks `-2` instead of `-3` did
something the textbook permits. Forcing them to retry would teach the
opposite of what the textbook says. Letting them proceed and then showing
the consequence ("we needed two extra pivots") teaches the *reason* for
Dantzig's rule, not just the rule.

### 4. Inline feedback, near the interaction

Feedback never lives in a separate panel at the bottom of the screen. It
appears next to the cell, the slider, or the field the student just acted
on.

Source: [simplex_spec_v2.md §4.2](../guidelines/simplex_spec_v2.md) —
"No bottom-panel-only explanations."
Implementation: PracticeMode renders a `feedbackKind: 'correct' | 'wrong' | 'hint'`
banner next to the current step. The click-to-pivot tableau shows
explanations adjacent to the clicked cell.

**Why this matters**: the student's eye is already on the thing they
clicked. Feedback that lives there is read; feedback in a footer is
ignored.

### 5. Always-visible hints (no dead ends)

Every page exposes a Lightbulb-icon hint for the current step. The student
can ignore it; they cannot run out of options. There is never a moment
where the student is stuck and has no on-screen path forward.

Source: PracticeMode.tsx comment block at the top: *"Always-visible hints
and feedback — student never feels alone."*
Implementation: `feedbackKind: 'hint'` plus the `hintVisible` boolean in
PracticeMode, and the `hint` field on every `Question` object in
[wordProblems.ts](../src/app/data/wordProblems.ts).

**Why this matters**: the previous tool the team tried (an LLM that
generated a worksheet and then went silent) failed precisely because a
stuck student had nowhere to turn. Always-visible hints close the dead end.

### 6. Empty `?` slots, not blank text fields

When a value has not yet been determined, the UI shows a dashed-border
"slot" with a `?` prompt — visibly empty, visibly waiting. Once the answer
lands, the slot flips to a filled card with a `fill-pop` animation. The
contrast between empty and filled is dramatic and intentional.

Source: comment in [GuidedLearnPage.tsx](../src/app/pages/workspace/GuidedLearnPage.tsx) §
"Canvas: the LP as a gameboard": *"Empty slots are big, obvious, inviting —
dashed boxes with a '?' waiting to be filled. When an answer lands, the
slot flips to a bright solid card with the value rendered large."*

**Why this matters**: a blank text input looks like a form. Forms feel
like work. A `?` gameboard slot looks like a quiz, and a quiz feels like
play. Same data captured, completely different student behavior.

### 7. Color semantics — consistent and few

Six colors, each with one meaning. Used the same way on every page.

| Meaning | Color | Where it appears |
|---|---|---|
| Attention target (system asking student to look) | subtle border emphasis | Z-row outline at start of pivot |
| Candidate (student-selected, not yet judged) | amber | Click on a Z-row cell, before correctness check |
| Suboptimal but valid | amber + note + dual-button | A3b state |
| Correct | emerald | After a correct selection lands |
| Active column (currently driving a pivot) | blue | Pivot column highlight |
| Invalid | red flash | After a clearly-wrong click |
| Skipped (non-positive ratio row) | dimmed grey | Rows with ≤0 pivot entries during ratio test |

Source: [simplex_spec_v2.md §4 Color Semantics](../guidelines/simplex_spec_v2.md).

**Why this matters**: a student who has used the app for ten minutes knows
that amber means "you've made a choice, the system is checking" — without
having to read any text. This frees their attention for the actual math.

### 8. Explicit Apply / Continue, no auto-advance

After the student has correctly picked the entering variable and the
correct leaving row, the system does NOT auto-apply the pivot. It shows
an "Apply Pivot" button. The student clicks. Then the pivot animates.

Source: [simplex_spec_v2.md §6 Timing Rules](../guidelines/simplex_spec_v2.md):
*"No auto-advance except minor UI transitions (<300ms). No auto-apply
pivot. All major transitions require user action."*

**Why this matters**: the student must internalize that they made a
decision. Auto-applying robs them of the moment of commitment. Slowing
down between commitment and consequence is where the learning happens.

### 9. Attempt-aware hint escalation

Hints scale up over wrong tries:

| Attempts | System response |
|---|---|
| 1–2 | Minimal feedback ("not quite, try another") |
| 3 | Add a hint ("compare values") |
| 4+ | Offer "Show reasoning" |

Source: [simplex_spec_v2.md §3 Retry / Support Model](../guidelines/simplex_spec_v2.md).
Implementation: `attemptCount` field in
[useGuidedSensitivity.ts](../src/app/hooks/useGuidedSensitivity.ts) and
[useGuidedSimplex.ts](../src/app/hooks/useGuidedSimplex.ts).

**Why this matters**: a student on attempt 1 doesn't want a paragraph of
explanation; a student on attempt 4 desperately does. Same UI, different
scaffolding based on what the student has already tried.

### 10. Show Answer ≠ Skip Reasoning

There is a "Show Answer" escape hatch but it does NOT skip the reasoning
visualization. It performs:

1. Highlight the correct selection.
2. Show the explanation.
3. Trigger the reveal phase.
4. *Then* enable Apply.

The student still clicks Apply. The student still sees the "what does
this answer connect to" reveal. The escape hatch only removes the
*finding* of the answer, not the seeing of why it's right.

Source: [simplex_spec_v2.md §1.3 Show Answer Behavior](../guidelines/simplex_spec_v2.md).

**Why this matters**: this is the difference between "I'm letting them
cheat" and "I'm meeting them where they are." The student who clicks
Show Answer still has to read the explanation and click Apply. They are
still building the chain of reasoning, just with a head start on the
hardest specific decision.

### 11. Per-step state machine, not free-form interaction

The interaction is a finite-state machine. Every state has explicit
allowed actions. There is no global "anything goes" mode.

Implementation: [useGuidedSimplex.ts](../src/app/hooks/useGuidedSimplex.ts)
defines `GuidedEpisode = 'idle' | 'episode0' | 'episodeA' | 'episodeB'`
and `GuidedPhase` with values like `e0_arrive`, `e0_attention`,
`a3_commitment`, `b4_reveal`, etc. The reducer rejects any action that
doesn't match the current phase.

**Why this matters**: free-form is exhausting. Every click in a free-form
UI requires the student to ask "what should I do now?" A state machine
narrows the question to "what does THIS step ask of me?" and the answer
is always one of two or three things.

### 12. Live, simultaneous updates across all panels

When a student drags a slider, every dependent panel updates at the same
instant: the graph reshapes, the meters tick, the formulas recompute, the
tableau cells refresh. There is no "click Apply to recalculate." The
calculation is the visualization.

Implementation: the sensitivity playground in GuidedLearnPage Phase 6 and
the airline demo's full page. Every consumer subscribes to the same draft
state and recomputes on render.

**Why this matters**: the slope of `Δz` over a slider's range *is* the
shadow price. Students don't have to be told this — they see it in the
constant rate at which `z*` changes as they drag. When the rate visibly
changes, they've crossed the allowable range. The math is taught by the
animation.

### 13. Highlighted source text (scenario ↔ formulation traceability)

The word problem text gets color-coded as the student fills in the
formulation: variables in indigo, objective in purple, each constraint in
its own color. Hovering a slot lights up the substring of the scenario
that justified it.

Implementation: `ScenarioHighlights` type in
[wordProblems.ts](../src/app/data/wordProblems.ts), rendered by
[HighlightedScenario.tsx](../src/app/components/HighlightedScenario.tsx).

**Why this matters**: the hardest moment in formulation is "where in this
paragraph does the constraint come from?" The highlighting answers that
question without the student having to ask. It also debugs wrong
formulations: if a student wrote `2x₁ + 5x₂ ≤ 100` and the scenario only
says "5 cookies per pound", the highlighting shows them which words they
were trying to encode.

### 14. Lessons carry rich metadata, not just LPs

Every word problem in [wordProblems.ts](../src/app/data/wordProblems.ts)
carries:

- The LP itself (objective, constraints).
- `formulationHints` — one hint per stage of the formulation walkthrough.
- `methodExplanation` — a paragraph of why this method (Big-M vs
  Two-Phase, etc.) is the right tool.
- `solvingHints` — keyed by tableau step type (`initial`, `select_pivot`,
  `after_pivot`, `optimal`, etc.).
- `highlights` — the scenario substring map per formulation stage.
- `specialCaseNote` — a banner for special cases.

Implementation: the `WordProblem` interface in
[wordProblems.ts](../src/app/data/wordProblems.ts).

**Why this matters**: the system does not generate teaching content at
runtime. Every problem ships with hand-crafted pedagogical scaffolding.
That's why the explanations land — they were written for the specific
problem, not auto-generated.

---

## What Chapters 3–6 do that the later chapters don't (yet)

The later chapters (`/sensitivity`, `/matrix-method`, `/airline-demo`)
have parts that work and parts that don't. The parts that don't work are
the parts where the rules above were skipped. Below is a triage list.

### `/sensitivity` (Chapter 8.3)

| Layer | Status | Which rules applied |
|---|---|---|
| Browse → Arrive → Identify Op | Works | Rules 1, 4, 5, 7, 11 (state machine, color semantics, inline feedback) |
| Solve | Placeholder | None of the rules — the operation-specific algebra UI was never built |
| Reveal (sliders + graph) | Works | Rules 2, 12 (graph ↔ slider coherence, live updates) |
| Debrief | Works | Rule 4 (inline feedback with actual numbers) |

**The hole**: the Solve layer is where rules 1, 3, 6, 8, 9, 10 should
apply but currently does not. Each §8.3 operation needs the same
Episode-A/Episode-B treatment the simplex pivot has — *click on the cell
in B⁻¹ that matters, click the column of N affected, commit, see
feedback, reveal the next step*. Without it, students arrive at the
operation, see "Phase 2 coming next," and bounce out. The state machine
in [useGuidedSensitivity.ts](../src/app/hooks/useGuidedSensitivity.ts)
already declares the `SolveSubPhase` enum with the right granularity
(`ofcoeff_row_pick`, `rhs_binv_col`, `addact_transform`, etc.) — none of
those sub-phases have UI yet.

### `/matrix-method` (Chapter 8.2)

| Aspect | Status | Which rules applied |
|---|---|---|
| Three-zone layout | Works | Rule 6 (gameboard zones, not form fields) |
| Step 12 payoff preview | Works | Rule 13 (two-language alignment between Step 12 z* values) |
| Step sequencer with `?` slots | Not built | Rules 1, 6, 8, 11 — all missing |
| Zone 1 step-driven highlighting | Not built | Rule 13 (source highlighting) — scope was identified, not implemented |
| Side-graph integration | Not built | Rule 2 (graph coherence) |

**The hole**: the gameboard *layout* is there, but the *interaction* —
the `?` slots that unlock one at a time as the student commits — is not.
Right now everything is visible at once, which collapses the master
contract from "Attention → Question → Commitment → Feedback → Reveal"
into "Reveal." Students see the answer immediately, so there is no
question to commit to.

### `/airline-demo` (final-presentation page)

| Aspect | Status | Which rules applied |
|---|---|---|
| Cost slider drives profit slider in same box | Works | Rule 12 (live updates), Rule 6 (paired-box gameboard) |
| RHS slider paired with utilization bar | Works | Rule 6, Rule 12 |
| Graph with constraint lines + optimum | Works | Rule 2 (consistent with the rest of the app via DiscoveryGraph) |
| State machine / commit → reveal flow | N/A | The page is a free-exploration sandbox — by design, no episodes |

**Why the rules don't all apply here**: the airline demo is intentionally
*not* a guided learning page. It is a presentation prop. It uses Rules 6
(gameboard), 12 (live updates), and 2 (graph coherence) but skips the
state-machine rules because the audience is the professor, not a student
discovering the algorithm. This is a legitimate exception — the rules
are scoped to the **student-facing learning path**, and this page is
outside that path.

---

## Where to start when adding a new chapter

1. **Pick the textbook event you're teaching** (e.g. "the §8.3.5 reduced
   cost calculation").
2. **Decompose into Episodes**. Each Episode is one
   Attention/Question/Commitment/Feedback/Reveal cycle. The simplex pivot
   has two Episodes (entering, leaving) plus an optional Episode 0 (Z-row
   setup). Most §8.3 operations have 2–4 Episodes each.
3. **Define the state machine in a hook.** Add to `SolveSubPhase` in
   [useGuidedSensitivity.ts](../src/app/hooks/useGuidedSensitivity.ts) or
   create a new hook with the same shape. Each state has explicit allowed
   actions; every action is guarded on phase.
4. **Render with `?` slots, not form inputs.** Empty cells get dashed
   borders and a `?`. Filled cells use the `fill-pop` animation.
5. **Hook the graph.** Whatever the Episode is asking the student to
   commit to, find its geometric counterpart and update the graph at the
   same time. If the operation has no geometric counterpart, say so
   (the "this operation doesn't map to a single slider" branch on
   `/sensitivity` is a valid answer).
6. **Write the hints by hand.** Per-step, per-attempt-count. No
   LLM-generated explanations at runtime.
7. **Color-code consistently.** Reuse the seven semantic colors from
   §4 of [simplex_spec_v2.md](../guidelines/simplex_spec_v2.md).

---

## What NOT to do

The previous tool the team tried failed because:

- It generated worksheets the student had to *read* with no
  interaction — Rule 1, 2, 6, 11 all violated at once.
- It auto-advanced through reveal — Rule 8 violated.
- It gave one feedback message regardless of attempt count — Rule 9
  violated.
- It had no graph alongside the algebra — Rule 2 violated.
- Wrong answers were "wrong" with no distinction between invalid and
  suboptimal — Rule 3 violated.

The cumulative effect was a student who opened the page, read for 30
seconds, found nothing to do, and closed the tab. That outcome is the
design failure mode the rules above are constructed to prevent.

---

## A one-paragraph summary for the syllabus

> The system enforces *Attention → Question → Commitment → Feedback →
> Reveal* on every interaction. The student is never shown an answer
> they have not committed to first. Every algorithmic event renders in
> two languages simultaneously (tableau + graph). Wrong-but-valid moves
> are permitted with consequence-shown debriefs; wrong-and-invalid moves
> are blocked. Hints scale with attempts. Feedback is inline at the
> point of interaction. Empty cells are visibly empty (`?` slots,
> dashed borders) so the student is never confused about whose turn it
> is. The state of the interaction is a finite-state machine — every
> click resolves to exactly one allowed transition. These rules together
> are why students complete a chapter rather than abandoning it.
