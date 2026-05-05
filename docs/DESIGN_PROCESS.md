# How This Was Built — Design Process & AI Collaboration

This document is for the professor reading the rest of the documentation. It
states plainly how this app was made, where the line is between human work
and AI-assisted work, and what the project demonstrates that I (the
student) understand.

## The plain statement

**I do not write code.** Every Python file, every TypeScript file, every
SQL migration, every line of JSX in this repository was written by an AI
coding assistant (Claude Code) under my direction. This documentation
itself was drafted by the same assistant, then reviewed by me.

This is not hidden, and not framed as a strength I do not possess. The
question this project actually answers is different:

> Given that I cannot write code, what *can* I do, and is that enough to
> ship a working educational tool that maps to the textbook chapter by
> chapter?

The rest of this doc is the answer.

## What required me — the human work

These are the pieces no AI can do for you. They are the reason this
project exists in the form it does, and they are the skills the
collaboration depends on:

### 1. Conceptual mastery of the curriculum

The textbook material — graphical method, simplex, Big-M, two-phase,
duality, sensitivity analysis — is mine. Before any code was written, I
had to understand what each algorithm does, what each method's pain
points are, and what a student trying to learn it would actually want to
see on screen. The shadow-price-as-coefficient framing in the airline
demo, the "binding constraints corner the optimum" intuition driving the
sensitivity walkthrough, the decision that §8.3 should be the
presentation centerpiece — those came from my reading of the textbook,
not from the AI.

When the AI's first sensitivity report draft listed only "BINDING / not
binding" per constraint, *I* knew that wasn't enough — the textbook's
§8.3.3 deliverable is the allowable RHS range and the shadow price, and
I asked for both explicitly. The AI implemented it; I knew it was
missing.

### 2. Stack selection and infrastructure decisions

The choice of FastAPI + React + Vite + Supabase + Render was mine. So
were the consequent decisions:

- One Render Web Service serving both frontend and backend, so deploys
  are atomic and there's nothing to keep in sync between two services.
- Supabase Postgres with row-level security policies, so the student
  side can read problem banks without authentication while professors
  must authenticate to write.
- BYO LLM API key for the agent draft feature, so the project owner
  doesn't pay for any user's model usage.
- Free-tier everything, so the cost to operate is $0/month and a
  professor can fork and run it without a budget conversation.

I cannot hand-write a FastAPI route or a Supabase RLS policy. I can
explain why those choices are correct.

### 3. The integration layer — git, GitHub, Render, Supabase

I am the operator of this app. Specifically, I am responsible for:

- Creating the GitHub repo, branching, pulling, pushing, resolving merge
  questions.
- Creating the Supabase project, opening the SQL editor, running the
  migration, copying the anon key.
- Creating the Render Web Service, setting environment variables at the
  right time (before the build, not after), reading deploy logs when a
  build hangs.
- Connecting the GitHub webhook to Render so pushes auto-deploy.
- Watching the live deploy and rolling back when something is wrong.
- Running the bring-up steps in
  [ARCHITECTURE.md](ARCHITECTURE.md) without an AI sitting next to
  me — and being able to walk a professor through doing the same.

This is not a code skill. It is an operations skill, and it is what
turns code on a laptop into a URL students can hit.

### 4. Pain-point identification

Almost every commit in this repository exists because I noticed
something was wrong, missing, or confusing, and articulated it precisely
enough that the AI could fix it. Examples:

- The admin page "worked" — Pydantic validation was running silently —
  but no semantic validation was actually firing, because the
  student-stub `validate_problem` raised `NotImplementedError`. I caught
  this by asking *where the real validation script lives* when the live
  app behaved like nothing was being checked.
- The splash page tiles were getting cut off on shorter screens. I
  diagnosed it from a screenshot before the AI did.
- The bank picker dropdown changed the active bank in localStorage but
  no button took the student INTO that bank's problems. I noticed this
  the moment I tried to demo it.
- The airline demo crashed with a `toFixed` error after the sensitivity
  upgrade because old localStorage state had 5 RHS values and the new
  code expected 6. I reported the exact runtime error from the
  production site.

In each case, the AI's contribution was the patch. The contribution
that mattered first was the diagnosis.

### 5. Specification — telling the AI exactly what to build

Code-writing is downstream of specification. Bad specification produces
bad code, and an AI cannot tell you what your project should be — only
what it should do given a specification you provide.

Concrete example: when I asked for the airline demo to match my
presentation slides, I supplied the new coefficient values (36, 0.0429),
the new lower-bound constraint (x₂ ≥ 20), the optimum I expected to see
(x₁=398, x₂=22, x₃=472.22, z=$163,118.19), the labeling I needed
("Economy seats" not "Coach passengers"), and the level of sensitivity
report I wanted ("Tier 3 — full §8.3 deliverable, shadow prices and
allowable ranges and the optimal tableau"). The AI then wrote the code.
Without those specifications, the resulting code would not have matched
the slides — and would not have served the presentation.

### 6. Verification

I verified the optimum values against my slide deck by hand. I tested
the live app, dragged the sliders during my own preparation, asked
questions like *"what becomes the shadow price when I move this lever?"*
to make sure I understood the result. I caught when the AI's
explanations conflated reduced cost with shadow price and pushed back
until the framing was correct.

If I do not understand the output, I am the one who knows it. The AI
will happily produce confidently-worded prose around incorrect math, and
the only check on that is a human who has done the textbook reading.

The same principle applies at the page level: when the AI scaffolded
`/sensitivity` and `/matrix-method` early in the project, I made the
explicit decision not to demo those routes because I have not yet read
through Chapters 7 and 8.2 carefully enough to validate that the UI
matches the textbook. Those routes exist on the deployed site as
starting points for future work, not as completed teaching material.
Calling that out openly — in
[CURRICULUM_TO_SOLVER.md](CURRICULUM_TO_SOLVER.md) and again here — is
the verification step. The alternative would be a demo that papers over
what I do not yet know.

## What the AI assistance covered

Under my direction, Claude Code wrote:

- The Python solver (`backend/solver_core.py`, ~1,015 lines): the
  simplex algorithm, Big-M method, two-phase method, pivot operations,
  cell-explanation strings, and the step-record machinery the React UI
  consumes.
- The Python sensitivity analysis (`backend/sensitivity.py`, ~800
  lines): matrix-form extraction, the six §8.3 operations, shadow
  prices, allowable ranges.
- The TypeScript airline-demo simplex
  (`src/app/pages/AirlineModel.tsx`, ~150 lines): the in-browser solver
  used when running offline, with the variable substitution for x₂ ≥
  20, the dual extraction, and the range computations.
- The FastAPI app (`backend/main.py`): every `/api/*` route handler,
  the SPA catch-all, the BYO-key agent proxy.
- The React UI: every page, every form, every chart, every slider.
- The Supabase SQL migration
  (`backend/educator/migrations/001_supabase_auth_schema.sql`): the
  table schema, the row-level security policies.
- This documentation (drafts).
- The unit tests, the verification scripts, the production builds.
- Bug fixes, refactors, deployment troubleshooting suggestions.

In every case I gave a specification first. The AI did not decide to
build any of these things on its own.

## The mish-mash — joint work

The most accurate picture of how this app was built is **not** "human
designed, AI implemented." It is:

> My rationale, my mastery of the curriculum, my judgment about what a
> student needs to see — combined with the AI's ability to translate
> those things into working code in seconds.

This is a real collaboration, and the most honest piece of this
documentation is to call out where the abilities mixed.

| Piece | My contribution | AI's contribution |
|---|---|---|
| The solver | "It must teach the algorithm step by step. The student must see every tableau, every pivot, every reduced cost. A library function returning only `(x*, z*)` will not work." | The 1,015 lines of Python implementing simplex, Big-M, two-phase, and the step-record machinery that fulfills that requirement. |
| The §8.3 sensitivity report | "Six operations, named after the textbook section numbers (8.3.1, 8.3.2, etc.). Each one's docstring restates the textbook formula. The shadow prices and ranges must be visible in the tableau the student is looking at, not in a separate report." | The math: extracting B⁻¹ from the optimal tableau's slack columns, computing y = c_B B⁻¹, computing the allowable Δb_i range from B⁻¹'s columns, etc. |
| The airline demo presentation flow | "The killer demo moment is dragging the business-max RHS slider and watching profit jump by exactly the shadow price. That's the 'I understand sensitivity' moment for the audience. The slide before this one needs to set up that the binding constraints 'corner' the optimum." | The TypeScript simplex with sensitivity extraction, the live-recompute on slider drag, the visible decimal-aligned tableau, and the constraint cards showing shadow price + slack + RHS range. |
| The validation walkthrough | "Students will fill in `validate_problem` from a blank starter. I need a presentation-ready file that shows them how to build it line by line, with explanatory comments next to each line. The same file must be the LIVE validator the deployed admin page calls." | The implementation of the function, the line-level teaching comments, the `__main__` demo block. |
| The schema | "Each professor owns a bank slug. Students don't authenticate. RLS lets anyone read but only owners write." | The actual SQL: `CREATE TABLE`, `CREATE POLICY`, the trigger function for `updated_at`. |

In each row of that table, the left column is what makes the project a
teaching tool rather than a generic LP solver. The right column is what
makes it a real, working teaching tool rather than an idea on a slide.

Both columns are necessary. Neither is sufficient on its own.

## What this project demonstrates

A professor reading this doc and the rest of the codebase can fairly
conclude that I have demonstrated the following:

1. I understand the textbook well enough to specify, chapter by
   chapter, what an interactive teaching tool should expose, and to
   verify that what was built matches.
2. I can identify pain points in a running system precisely enough that
   they can be fixed: not "something is broken," but "the
   `/api/educator/validate` endpoint is reaching the stub and silently
   returning empty errors, so the admin page accepts garbage."
3. I can operate a real-world cloud deployment: GitHub, Render,
   Supabase, environment variables, RLS migrations, custom domains,
   build logs, rollbacks.
4. I can collaborate with an AI assistant productively. The collaboration
   here is not "AI did everything." It is a sustained back-and-forth
   over many sessions where my mastery of the curriculum and my
   judgment about what teaching needs to look like are the inputs that
   keep the AI's output aligned with the goal.
5. I can be honest about what I cannot do. I cannot write code. I am
   not pretending I can. The professor reading this knows that
   precisely, because this document says so.

What I want my professor to take away is not that I am a software
engineer — I am not. It is that the boundary between "people who can
specify, integrate, debug, and verify" and "people who can write code"
is now an interesting and useful boundary to sit on, and that this
project is evidence I can sit there productively.
