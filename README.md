# Interactive Linear Programming UI

An interactive, educational web application for teaching the **Simplex Method** in Linear Programming. Students enter LP problems, watch the graphical and algebraic solution unfold step by step, interrogate any cell in the tableau, and practice making their own pivot choices — including wrong ones, which the system explains and flags.

**Live demo:** [Deployed on Render](https://interactivelinearprogrammingui.onrender.com) *(frontend — backend spins up on first request)*

---

## What It Does

### Free-form Solver (`/solver`)
- Enter any LP problem: MAX or MIN objective, any number of variables, mixed constraint types (≤, ≥, =)
- Choose the solution method: **Simplex**, **Big-M**, or **Two-Phase**
- Watch the tableau animate step by step with full annotations:
  - Pivot column and row highlighted
  - Changed cells highlighted in green after each pivot
  - Ratio test column visible alongside the tableau
  - Row operations listed (e.g., `R₁ ← R₁ − 2·R₃`)
- **4-tab tableau view**: Current · Select Pivot · After Pivot · Final
- **Interactive mode**: click any cell in the Z-row to choose the entering variable, then click a row to choose the leaving variable — the app validates your choice, explains why it's optimal or suboptimal, and applies the pivot
- **Graphical view** (2-variable problems): SVG feasible region polygon, constraint lines, all corner points with z-values, animated simplex path with arrows, objective line

### Guided Learning Mode (`/guided`)
Six structured lessons covering the full LP curriculum:

| # | Title | Chapter | Key Concept |
|---|-------|---------|-------------|
| 1 | Graphical Method | Ch 3 | Feasible region, corner points, geometric optimum |
| 2 | Simplex MAX | Ch 4 | Standard form, slack variables, pivot rules |
| 3 | Simplex MIN | Ch 4 | Minimization with ≥ constraints, surplus variables |
| 4 | Big-M Method | Ch 5 | Artificial variables, penalty-based feasibility |
| 5 | Two-Phase Method | Ch 5 | Phase I (find BFS) → Phase II (optimize) |
| 6 | Special Cases | Ch 6 | Alternative optima, degeneracy, unbounded, infeasible |

Each lesson:
- Auto-solves the problem via the backend when you open it
- Shows a **contextual hint** for every step type (Initial, Select Pivot, After Pivot, Optimal, Phase I/II, etc.)
- Presents an **embedded quiz question** at the first pivot-selection step — pick A/B/C/D and get immediate feedback with an explanation
- Displays **special case banners** when the solver detects alternative optimal solutions or degeneracy
- Uses the same tableau + graph layout as the free-form solver

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v4, shadcn/ui (Radix UI) |
| Backend | Python 3.11, FastAPI, uvicorn |
| Math | NumPy |
| Deployment | Render (Web Service + Static Site) |

---

## Architecture

```
InteractiveLPUI/
├── backend/
│   ├── main.py          ← FastAPI app, API endpoints, serves dist/ in production
│   ├── solver_core.py   ← SimplexSolver, TwoPhaseSolver, graphical data
│   ├── models.py        ← Pydantic request/response models
│   └── requirements.txt
├── src/app/
│   ├── types.ts                     ← All TypeScript interfaces
│   ├── hooks/useLPSolver.ts         ← API calls + all solver state
│   ├── data/
│   │   └── lessons.ts               ← 6-lesson curriculum with hints + quizzes
│   ├── components/
│   │   ├── TableauWorkspace.tsx     ← 4-tab tableau with pivot highlighting
│   │   ├── GraphView.tsx            ← SVG feasible region + simplex path
│   │   ├── ExplanationConsole.tsx   ← Step explanations + row operations
│   │   ├── TopControlBar.tsx        ← Problem input + controls
│   │   └── StepTimeline.tsx         ← Step slider navigation
│   └── pages/
│       ├── MainWorkspace.tsx        ← Free-form solver page
│       └── GuidedMode.tsx           ← Lesson curriculum page
├── vite.config.ts
└── package.json
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/solve` | Run full solver → all steps, corner points, feasible polygon, simplex path |
| `POST` | `/api/pivot` | Apply one interactive pivot to a live matrix |
| `POST` | `/api/explain-cell` | Plain-English explanation of any tableau cell |
| `GET`  | `/api/health` | Liveness check |

---

## Running Locally

**Requirements:** Node.js 18+, Python 3.10+, Anaconda (or any virtualenv)

### 1. Backend

```powershell
cd InteractiveLPUI
python -m venv .venv
.venv\Scripts\activate          # Windows
# or: source .venv/bin/activate  # Mac/Linux

pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

### 2. Frontend (separate terminal)

```powershell
cd InteractiveLPUI
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` requests to `localhost:8000`.

---

## Deploying to Render

The project deploys as two Render services:

### Backend — Web Service
- **Root Directory:** *(leave blank)*
- **Build command:** `pip install -r backend/requirements.txt`
- **Start command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

### Frontend — Static Site
- **Build command:** `npm install && npm run build`
- **Publish directory:** `dist`
- **Environment variable:** `VITE_API_URL = https://your-backend.onrender.com`

The backend also serves the React `dist/` folder directly, so a single Web Service deployment works too (just set the Static Site's build to output into `dist/` and point the backend at it).

---

## Supported Problem Types

- MAX and MIN objectives
- Variables: non-negative (≥ 0), non-positive (≤ 0), or unrestricted in sign
- Constraints: `≤`, `≥`, `=`
- Methods: standard Simplex, Big-M, Two-Phase
- Special case detection: alternative optimal solutions, degeneracy, unboundedness, infeasibility
- Bland's Rule tie-breaking to prevent cycling in degenerate problems

---

## Design Philosophy

> **Learning clarity over computational efficiency.** Every number on screen should be explainable.

- Wrong pivot choices in interactive mode are **executed and explained**, not blocked — students learn from bad choices
- The Z-row sign convention (`z_row[j] = −cⱼ` for MAX) is consistent throughout
- Big-M uses M = 1,000,000 as a concrete number, so students can see the actual values
- Two-Phase avoids Big-M numerical issues by using unit Phase I coefficients
