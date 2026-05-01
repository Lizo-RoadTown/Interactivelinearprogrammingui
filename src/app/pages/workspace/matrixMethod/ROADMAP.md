# Matrix Method Gameboard — Roadmap

Paused on `2026-04-30` to prioritize the educator-facing UI for the
problem bank. Foundation + first UI cut are committed and working;
remaining work is sequenced below for when this picks up again.

## Already shipped

- **Data layer** — `types.ts`, `matrix.ts` (general n×n inverse via
  Gauss-Jordan with partial pivoting, fraction formatter), `examples.ts`
  (3×3 chalkboard problem + Toy Factory 2×2 sanity check), `derived.ts`
  (one function in: `SolvedLP` → all derived quantities out, including
  the Step 12 payoff pairs).
- **Layout shell** — `MatrixMethodWorkspace.tsx` with three zones
  (Problem / Identification / Tableau), example switcher in the header,
  Step 12 preview panel at the bottom of Zone 3.
- **Routes** — `/matrix-method` and `/matrix-method/:exampleId`,
  linked from the MainWorkspace footer.

Verified numerically on the 3×3 example: B⁻¹b = [24, 8, 2]; Z-row
non-basic = (5, 10, 10); z* = 280.

## Remaining slices (in build order)

1. **Step sequencer.** Replace "everything visible" with `?` slots that
   unlock one group at a time. State machine over the 12 `StepId`s
   from `types.ts`. Add a step indicator + Next button.

2. **Zone 1 step-driven highlighting.** Each step flags which Zone 1
   elements should pulse: identifying CB highlights the basic
   variables' coefficients in the objective function; building B
   highlights the basic-variable columns in the constraints; etc.

3. **Zone 3 layered cells.** Each cell gets three layers:
   formula label above (e.g. "B⁻¹aⱼ"), expandable calculation panel
   showing the arithmetic with numbers substituted in, and the
   final result. Per the spec these are non-negotiable for the
   pedagogy — never just the result.

4. **Step 12 full payoff panel.** Promote the preview row at the
   bottom of Zone 3 into a dedicated panel with the two columns
   side by side, an explicit equals bar between, and a caption
   explaining the language equivalence. Already-derived data is in
   `derived.payoff`.

5. **Side-panel graph.** Optional but in the spec: feasible region
   graph that responds to each step (binding constraints highlight
   when B is identified, optimum corner lights up when B⁻¹b is
   computed, objective line appears at Step 12). Reuse
   `DiscoveryGraph` component if the LP has 2 decision variables;
   for 3+ decision variables, the graph degrades gracefully to a
   "graph not shown — too many dimensions" placeholder.

6. **Homework "check your tableau" mode.** Given the four candidate
   tableaus from a homework problem (the screenshot you shared
   earlier had them), let the student click the one that matches
   the reconstructed Zone 3 tableau. Closes the loop from "I built
   this" to "I picked the right answer."

## Files

```
src/app/pages/workspace/matrixMethod/
  types.ts                       data model (SolvedLP, LPVariable, StepId)
  matrix.ts                      generic matrix utilities + fmtFrac
  examples.ts                    canonical problems
  derived.ts                     SolvedLP → all derived values
  MatrixMethodWorkspace.tsx      page (3-zone layout + Step 12 preview)
  ROADMAP.md                     this file
```

## Why this is paused

The educator portal needs to be presentation-ready first so the
professors can populate the problem bank. Without that, the matrix
method gameboard would have nothing meaningful to point at — the
pedagogy depends on real problems flowing through.
