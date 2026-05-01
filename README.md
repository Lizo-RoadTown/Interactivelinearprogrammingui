# Interactive Linear Programming UI

A web app for teaching the Simplex Method, Big-M, and Two-Phase methods. Students work through word problems by formulating the LP, watching the graphical and algebraic solutions develop step by step, and choosing pivots themselves. Professors can sign in to manage their own bank of word problems, which appears for any student who picks the bank slug they share with the class.

**Live demo:** [interactivelinearprogrammingui-1.onrender.com](https://interactivelinearprogrammingui-1.onrender.com/)

The first load on Render's free tier can take 30–60 seconds while the backend wakes up.

## What it does

**For students** (no account required):

- Pick a class problem bank from a dropdown on the splash, or skip it and use the built-in problems.
- **Practice Mode** — pick a difficulty, get a random word problem, formulate the LP step by step, then solve it interactively. Wrong pivot choices are executed and explained rather than blocked.
- **Free-form Solver** — enter any LP from scratch (MAX or MIN, mixed `≤` `≥` `=` constraints, any number of variables). Tableau, graphical view, and click-for-explanation on any cell.
- **Guided Lessons** — six structured walkthroughs covering Graphical, Simplex MAX/MIN, Big-M, Two-Phase, and special cases (alternative optima, degeneracy, unbounded, infeasible).
- **Matrix Method gameboard** — Chapter 8 walkthrough that builds the simplex tableau in three zones (problem, identification, Table 8.1).

**For professors** (sign in at `/admin`):

- Claim a globally unique bank slug (e.g. `jenkins-orie310-fall26`) — that's what students type to find your problems.
- Add, edit, and delete LP word problems. Schema validation runs on save.
- Optional: paste your own Anthropic or OpenAI API key in the Agent panel to draft problems with an LLM. The key stays in your browser's localStorage and is forwarded one request at a time to the provider — never persisted on the backend.
- Optional curriculum context — paste your syllabus and the agent uses it for context on every draft request.

## How it works

```text
                ┌────────────────┐
                │     Browser    │
                │  React + Vite  │
                └────────┬───────┘
                         │
        ┌────────────────┼─────────────────────────────────┐
        │                │                                 │
   reads problem   FastAPI on Render                  Supabase
   bank directly   /api/solve, /api/pivot,            (Postgres + Auth)
   via supabase-js /api/sensitivity, /api/educator/   • banks table
                   validate, /api/admin/agent/draft   • problems table
                                                      • RLS: anyone reads,
                                                        only owner writes
```

- Bank reads/writes go directly from the browser to Supabase. Postgres Row-Level Security enforces that a professor can only mutate banks they own.
- The FastAPI backend handles the math (LP solving, sensitivity, pivots) and the LLM proxy. It has no Supabase credentials.
- LLM API keys (the professor's BYO key) live only in the professor's browser localStorage and are forwarded once per draft request.

## Local setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Supabase project (free tier). The `banks` and `problems` tables and the RLS policies are created by [backend/educator/migrations/001_supabase_auth_schema.sql](backend/educator/migrations/001_supabase_auth_schema.sql) — run it once in the Supabase SQL editor.

### Environment variables

Copy [.env.example](.env.example) to `.env.local` and fill in the two Supabase values from your project's API settings (Dashboard → Project Settings → API):

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key, also called "publishable">
```

Both are safe to commit if you choose to — the anon key is designed for browser code, and RLS policies do the actual security.

### One-command launch

**Windows:**

```bat
start.bat
```

**Mac / Linux:**

```bash
./start.sh
```

Creates a Python venv, installs dependencies, and starts both servers. Open [http://localhost:5173](http://localhost:5173).

### Manual setup

```bash
# Terminal 1 — Backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to the FastAPI backend on port 8000.

## Deployment

The repo is set up to deploy as a single Render service that runs FastAPI and serves the built React bundle from `dist/`. On Render:

1. Connect the GitHub repo. Build command: `npm install && npm run build && pip install -r backend/requirements.txt`. Start command: `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the service's Environment tab. **Vite inlines these at build time**, so adding them after the deploy starts means the next deploy picks them up — use *Manual Deploy → Clear build cache & deploy* if needed.
3. Push to `main`. Render auto-builds and deploys.

## API endpoints

The backend keeps a small surface — anything bank-related now goes directly to Supabase from the browser.

| Method | Path                     | Description                                          |
| ------ | ------------------------ | ---------------------------------------------------- |
| GET    | `/api/health`            | Liveness check                                       |
| POST   | `/api/solve`             | Full solve → all simplex steps, graphical data, path |
| POST   | `/api/pivot`             | Apply one interactive pivot to a live tableau        |
| POST   | `/api/explain-cell`      | Plain-English explanation of a tableau cell          |
| POST   | `/api/sensitivity`       | Sensitivity analysis (objective + RHS ranges)        |
| POST   | `/api/educator/validate` | Schema check for a proposed word problem             |
| POST   | `/api/admin/agent/draft` | BYO-key LLM proxy for /admin's draft button          |

## Project structure

```text
InteractiveLPUI/
├── backend/
│   ├── main.py                          FastAPI endpoints
│   ├── solver_core.py                   Simplex, Big-M, Two-Phase
│   ├── sensitivity.py                   Sensitivity analysis
│   ├── models.py                        Request/response schemas
│   ├── requirements.txt
│   └── educator/
│       ├── validation.py                Problem-schema validator
│       └── migrations/
│           └── 001_supabase_auth_schema.sql
├── src/app/
│   ├── lib/supabase.ts                  Supabase JS client singleton
│   ├── auth/
│   │   ├── AuthProvider.tsx             Session context
│   │   ├── RequireAuth.tsx              Route gate
│   │   └── AdminGuarded.tsx             /admin wrapper
│   ├── data/
│   │   ├── wordProblems.ts              Built-in problems (rich pedagogy)
│   │   └── bankProblems.ts              useAllProblems / useAllBanks hooks
│   ├── components/
│   │   ├── BankPickerStudent.tsx        Splash dropdown
│   │   ├── TableauWorkspace.tsx         Interactive tableau
│   │   ├── GraphView.tsx                SVG feasible region
│   │   └── …
│   └── pages/
│       ├── MainWorkspace.tsx            Splash + free-form solver
│       ├── PracticeMode.tsx             Guided practice
│       ├── SignInPage.tsx               Professor sign-in / sign-up
│       ├── AdminPortal.tsx              Per-professor bank CRUD
│       └── workspace/                   Guided learn + Matrix Method
├── start.bat / start.sh                 One-command local launch
└── package.json
```

## Supported problem types

- MAX and MIN objectives
- Constraint operators: `≤`, `≥`, `=`
- Methods: standard Simplex, Big-M, Two-Phase
- Special-case detection: alternative optima, degeneracy, unbounded, infeasible
- Bland's Rule tie-breaking for degeneracy

## Design notes

- The `banks` table holds bank slugs (one row per claimed slug, owned by one professor). The `problems` table is keyed on `(bank_name, problem_id)` and stores the LP word problem as a JSONB blob.
- Built-in `WORD_PROBLEMS` (in [src/app/data/wordProblems.ts](src/app/data/wordProblems.ts)) carry rich pedagogy data — formulation hints, scenario highlights, solving hints. Bank-saved problems carry the LP shape only; the coercer in [bankProblems.ts](src/app/data/bankProblems.ts) fills the missing fields with empty defaults so student pages render without crashing.
- When a bank-saved problem has the same id as a built-in, the bank version wins — that's intentional, so a professor can override a built-in by saving with the same id.
- Wrong pivot choices in Practice Mode are executed and explained, not blocked. The interaction model enforces reasoning before revealing the answer.
