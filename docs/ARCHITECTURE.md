# System Architecture & Deployment Guide

How the Interactive LP UI runs from source code on GitHub to a live URL on
Render, and how to duplicate the setup from scratch.

## High-level picture

```
                     ┌─────────────────────────────────┐
                     │          User's browser         │
                     │   React/TypeScript SPA running  │
                     │   on the Vite-built bundle      │
                     └──┬───────────────┬──────────────┘
                        │               │
                        │               │ supabase-js (anon key + JWT)
                        │               │ direct browser ↔ Postgres
                        │               ▼
                        │     ┌─────────────────────────┐
                        │     │  Supabase Project       │
                        │     │  ─ Auth (GoTrue)        │
                        │     │  ─ Postgres + RLS       │
                        │     │  ─ banks, problems      │
                        │     └─────────────────────────┘
                        │
                        │ HTTPS  /, /api/*
                        ▼
                ┌──────────────────────────────┐
                │   Render Web Service         │
                │   ─ uvicorn (ASGI server)    │
                │   ─ FastAPI app (main.py)    │
                │     • /api/solve             │
                │     • /api/sensitivity       │
                │     • /api/admin/agent/draft │
                │     • + SPA catch-all        │
                │       serves dist/ at /      │
                └──────────────────────────────┘
                          ▲
                          │ build/deploy
                          │
                ┌─────────────────────┐
                │   GitHub repo       │
                │   ─ main branch     │
                │   ─ webhook → Render│
                └─────────────────────┘
```

## Three pieces, two languages

This repository contains three independently-deployable pieces:

| Piece | Language | What it does |
|---|---|---|
| Frontend | TypeScript (React + Vite) | Every page, every interaction the user sees. Compiled to a static bundle. |
| Backend | Python (FastAPI + uvicorn) | LP solver, sensitivity analysis, agent draft proxy. Serves the compiled frontend bundle from the same web service. |
| Database | (managed by Supabase) | User accounts, problem banks, problem definitions. |

The **frontend** and **backend** ship together as a single Render Web Service.
The **database** is a separate Supabase project that both the browser and the
backend can talk to (the browser does most of the talking).

## Why one Render service serves both frontend and backend

The FastAPI app in `backend/main.py` has a deliberate SPA catch-all:

```python
@app.get('/{full_path:path}', include_in_schema=False)
def _spa(full_path: str):
    if full_path.startswith('api/'):
        raise HTTPException(status_code=404)
    candidate = os.path.join(_DIST, full_path)
    if os.path.isfile(candidate):
        return FileResponse(candidate)
    return FileResponse(os.path.join(_DIST, 'index.html'))
```

The build pipeline compiles the React frontend into `dist/`, and FastAPI
serves files from there. URLs like `/admin` and `/airline-demo` fall through
to `index.html` so React Router takes over client-side. URLs starting with
`api/` go to the FastAPI route handlers normally.

This means **one Render service, one URL, one deploy**. There is no
"frontend service" and "backend service" to keep in sync.

## What runs where

### In the browser (the user's machine)

- The compiled React bundle (`dist/index-*.js`, ~300 KB gzipped)
- React Router client-side routing
- Direct Supabase Postgres queries via `supabase-js` (the bank dropdown,
  reading problems, saving problems if signed in)
- LocalStorage state (active bank pick, slider state on `/airline-demo`,
  BYO LLM API key for `/admin`)
- The standalone airline-demo simplex (no network call)

### On the Render Web Service

- `uvicorn` listens on `$PORT` (assigned by Render)
- FastAPI handles `/api/*` routes:
  - `/api/health` — liveness probe
  - `/api/solve` — full LP solve
  - `/api/pivot` — apply one interactive pivot
  - `/api/explain-cell` — natural-language tableau cell explanation
  - `/api/sensitivity` — sensitivity analysis report
  - `/api/educator/validate` — schema check for a proposed problem
  - `/api/admin/agent/draft` — BYO-key LLM proxy
- FastAPI serves static files from `dist/` for any other URL

### In the Supabase project

- **Auth (GoTrue)** issues JWTs on sign-in/sign-up, manages email
  confirmation, password reset
- **Postgres** stores:
  - `auth.users` (managed by Supabase, contains professor accounts)
  - `public.banks` — bank slugs claimed by professors (PK: bank_name,
    FK: user_id → auth.users)
  - `public.problems` — LP word problems keyed by (bank_name, problem_id)
- **Row-Level Security policies** enforce who can read/write — anyone can
  SELECT, only the bank owner can INSERT/UPDATE/DELETE

The SQL migration that creates all of this lives in
[backend/educator/migrations/001_supabase_auth_schema.sql](../backend/educator/migrations/001_supabase_auth_schema.sql)
and is run once in the Supabase SQL editor.

## What does NOT run on Render

- The Supabase database. Render and Supabase are separate cloud services.
  The browser talks to Supabase directly using the project's anon key
  (which is designed to be public — RLS does the security).
- The professor's LLM API key. It lives only in the browser's localStorage
  and is forwarded one request at a time via `/api/admin/agent/draft`. The
  backend never persists it.

## How a code change reaches users

```
1. Developer commits to local main:           git commit
2. Developer pushes to GitHub:                git push origin main
3. GitHub fires a webhook to Render
4. Render starts a build on a fresh container
5. Build runs:
     npm install
     npm run build              ← Vite compiles frontend → dist/
     pip install -r backend/requirements.txt
6. Render starts uvicorn:
     python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
7. Render does a health check (HEAD /), promotes the new container,
   tears down the old one
8. Live at https://<service-name>.onrender.com
```

The whole pipeline takes 4–7 minutes for a clean build. There is no manual
step between push and live.

## Render Web Service configuration

The values currently in use:

| Setting | Value |
|---|---|
| Repo | `Lizo-RoadTown/Interactivelinearprogrammingui` |
| Branch | `main` |
| Runtime | Python 3 |
| Build command | `npm install && npm run build && pip install -r backend/requirements.txt` |
| Start command | `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| Instance type | Free |
| Auto-deploy | On (every push to `main` triggers a rebuild) |

### Environment variables (set in Render's dashboard)

Both must be present **at build time** because Vite inlines them into the
JavaScript bundle:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The "anon public" key from Supabase → Project Settings → API Keys |

If these are missing or set after the build starts, the app will load but
sign-in won't work and the bank dropdown will be empty.

## How to duplicate the deployment from scratch

The full sequence to bring up a clean copy of this app on a new account:

### Step 1 — Fork the GitHub repo

Fork `Lizo-RoadTown/Interactivelinearprogrammingui` to the new owner's
GitHub account, or push the same source to a new repo.

### Step 2 — Create the Supabase project

1. Sign in at [supabase.com](https://supabase.com) and click **New project**.
2. Name it (e.g. `lp-app`), set a strong database password, pick a region
   close to the target users.
3. Wait ~1 minute for provisioning.
4. Open the project → **SQL Editor** → **New query**.
5. Open
   `backend/educator/migrations/001_supabase_auth_schema.sql` from the
   repo, paste the entire file into the SQL editor, click **Run**. This
   creates the `banks` and `problems` tables and the RLS policies. It will
   prompt to confirm a destructive operation (it drops a non-existent
   legacy table) — confirm.
6. Open **Project Settings → API**. Copy the **Project URL** and the
   **anon public key**. Save these for step 4.
7. Open **Authentication → Providers → Email**. If you want fast testing,
   toggle **Confirm email** off so professor sign-ups work without an
   inbox round-trip. Toggle it back on for production.

### Step 3 — Create the Render Web Service

1. Sign in at [render.com](https://render.com) and click **+ New →
   Web Service**.
2. Connect to the GitHub repo (forked or new) on the `main` branch.
3. Fill in the configuration:
   - **Name**: anything memorable (this becomes the URL prefix).
   - **Runtime**: Python 3.
   - **Build command**:
     ```
     npm install && npm run build && pip install -r backend/requirements.txt
     ```
   - **Start command**:
     ```
     python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance type**: Free tier is sufficient for classroom use (note:
     free instances sleep after 15 min idle, with a 30–60 s cold start
     on the next request).
4. Scroll to **Environment Variables**:
   - Add `VITE_SUPABASE_URL` = the Project URL from step 2.6.
   - Add `VITE_SUPABASE_ANON_KEY` = the anon public key from step 2.6.
   - **Important**: do this *before* clicking Create, so the first
     build picks them up.
5. Click **Create Web Service**. Wait 4–7 minutes for the first build.

### Step 4 — Verify

Once Render shows "Live" with a URL like `https://<name>.onrender.com`:

1. Hit the splash URL — should show the home page with Chapter 8 cards
   and the airline-demo card.
2. Hit `/api/health` — should return `{"status":"ok"}`. If it returns
   HTML, the SPA catch-all is shadowing the API routes (this is fixed
   in the current codebase but worth verifying on a fresh fork).
3. Hit `/airline-demo` — should load and respond to slider drags.
4. Hit `/admin` — should redirect to `/signin`. Sign up a test
   professor; if email confirmation is on, click the inbox link.
5. Hit `/practice` — pick a difficulty, formulate, click Solve. The
   tableau should populate (this is what proves the FastAPI backend is
   responding to API calls, not just serving the SPA).

### Step 5 — Optional: custom domain

In Render's service settings → **Custom Domains** → add a domain you
control. Render gives you DNS records to set; once they verify, your
custom domain serves the same app.

## Local development

```bash
# Terminal 1 — Backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
npm install
npm run dev                         # Vite dev server on :5173
```

The Vite dev server proxies `/api/*` to the FastAPI backend on port 8000,
so you get hot-reload on the frontend and full backend functionality at
the same time.

`.env.local` at the repo root holds the Supabase values for local dev:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

This file is gitignored.

## Cost considerations

| Service | Free tier | When you'd outgrow it |
|---|---|---|
| Render Web Service | 1 free instance (sleeps after 15 min idle, 750 build-hours/month) | If you need 24/7 warm response (no cold start) — upgrade to paid Starter ($7/mo) |
| Supabase | 500 MB Postgres, 50 K monthly auth users, 2 GB bandwidth | Classroom-scale usage stays well within free tier indefinitely |
| GitHub | Free unlimited public repos | Never |

Total monthly cost at classroom scale: **$0**. Each professor that signs up
brings their own LLM API key (their own Anthropic or OpenAI account),
which is the only paid component and is paid by the professor, not the
app operator.

## Files relevant to deployment

| File | Purpose |
|---|---|
| `package.json` | Node dependencies + npm scripts (`dev`, `build`) |
| `vite.config.ts` | Vite build configuration |
| `backend/requirements.txt` | Python dependencies |
| `backend/main.py` | FastAPI app entrypoint, defines all `/api/*` routes and the SPA catch-all |
| `backend/educator/migrations/001_supabase_auth_schema.sql` | Database schema + RLS policies (run once in Supabase SQL editor) |
| `.env.example` | Template for `.env.local` (the gitignored real values) |
| `start.bat`, `start.sh` | One-command local launchers |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Splash loads, but `/admin` 404s on direct URL | Render configured as static site without SPA rewrite | Switch service type to Web Service with the start command above, or add a rewrite rule (`/*` → `/index.html`) on the static service. |
| `/api/health` returns HTML instead of JSON | SPA catch-all is shadowing API routes | Confirm `backend/main.py` has the `if full_path.startswith('api/'): raise HTTPException(404)` guard inside the `_spa` function. |
| Splash shows "Auth not configured" | Vite env vars missing at build time | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Render → Environment, then trigger a rebuild (`Manual Deploy → Clear build cache & deploy`). |
| First load takes 30–60 s | Free-tier Render service sleeping on idle | Upgrade to paid Starter or accept the cold start. |
| Sign-up email never arrives | Email confirmation enabled but Supabase's free SMTP is rate-limited | Disable email confirmation for testing, or configure custom SMTP in Supabase Auth settings. |
