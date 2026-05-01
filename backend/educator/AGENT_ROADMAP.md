# Bring-Your-Own-Agent Roadmap

`/admin` (the professor's workspace) ships in a basic CRUD form first.
Adding LLM authoring on top happens in slices, each one a small
incremental change.

## Slice 1 — shipped

CRUD on a per-professor bank, partitioned by `bank_id` in SQLite.
Live validation on save (Beginner B's `validate_problem` is the
gate). No agent yet.

## Slice 2 — BYO API key + one-shot draft

Settings panel inside `/admin`:

- Provider picker (Anthropic / OpenAI).
- API key field — stored ONLY in the professor's localStorage with
  a clear "stays on your machine" notice. Never sent to anything
  except the named provider.
- Endpoint preference (e.g. which model to call).

In the editor, a new "Ask agent to draft this" button. Single text
prompt ("a transportation problem for chapter 4"). Backend route
`POST /api/admin/agent/draft` forwards the request to the chosen
provider, attaching:

1. The professor's API key (from the request, not stored).
2. A system prompt that defines the problem schema (the same one
   Beginner B's validator enforces) so the agent's output is
   structured to drop straight into the form.
3. The professor's prompt.

The returned problem dict pre-fills the editor. Professor reviews,
edits, validates (existing path), saves.

## Slice 3 — curriculum profiles

A "Curriculum" panel where the professor pastes/uploads documents
that describe what they're teaching: a syllabus, a chapter, a
textbook excerpt, a list of constraints they want every problem to
satisfy ("must be solvable by hand in under 10 minutes," "use only
≤ constraints," "scenarios must be food-related").

These get saved as named profiles per `bank_id` in SQLite (new
`curriculum_profiles` table: `bank_id`, `name`, `text`,
`updated_at`). When the agent drafts, the active profile gets
injected into the system prompt as additional context.

Multiple profiles per professor — one per course, one per chapter,
etc. They pick which is active before generating.

## Slice 4 — multi-turn "negotiate"

Replace the one-shot draft button with a chat panel. The
conversation persists in memory for the session. Each turn:

- "Generate a transportation problem for chapter 4" → draft
- "Make it harder" → revised draft
- "Change the scenario to be about hospital logistics" → revised
- "Add a third constraint about staffing" → revised
- "Save this" → form populated with final draft, validation
  runs, professor saves.

Conversation history is held client-side; not stored beyond the
session unless we add a "save this conversation" button later.

## Slice 5 — bank-aware generation

When the agent drafts, send the existing bank (or relevant subset
filtered by category/difficulty) as additional context. The system
prompt instruction: "do not generate a problem too similar to one
in the existing bank." Optionally surface duplicate-detection
warnings to the professor before save.

## Why this order

Slice 1 lets a professor use the tool today. Slice 2 cuts authoring
time roughly in half once they have a key. Slice 3 makes the agent
align to specific course material — that's where it stops feeling
like generic LLM output and starts feeling like "my TA who reads
my syllabus." Slice 4 is what "negotiate" actually means in
practice: refine through conversation. Slice 5 is the polish that
keeps the bank coherent over time.

Each slice depends only on the previous one. None require rework
of the storage layer (SQLite already takes JSON and isn't shape-
constrained), the validation pipeline (Beginner B's function
guards every save regardless of source), or the editor UI (it
just gets pre-filled by the agent instead of typed by hand).

## Security notes

- Keys never persist on the server. The forwarding endpoint takes
  the key in the request, calls the provider, returns the result,
  forgets the key.
- Professors are responsible for their own quota / rate limits.
  If they enter a bad key, they see the provider's error verbatim.
- Never send the key over a non-HTTPS connection in production.
- Optionally: a server-side proxy that the institution operates
  with a shared key (and per-professor quota tracking). That's a
  later product decision.
