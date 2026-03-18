# Interactive Linear Programming UI — Project Brief

## What This Is

An **interactive educational tool** for teaching the Simplex Method in Linear Programming. Students enter an LP problem, watch the graphical and algebraic solution unfold step-by-step, interrogate any part of the tableau, and practice making their own pivot choices — including wrong ones, which the system flags with explanations.

Priority: **learning clarity over computational efficiency**. Every number on screen should be explainable.

---

## Architecture

**Option A (what we chose):** React frontend + Python FastAPI backend.

```
C:\Users\Liz\InteractionLPUI\
├── backend/                  ← FastAPI Python backend
│   ├── main.py               ← API endpoints
│   ├── solver_core.py        ← Simplex solver (Big-M, graphical)
│   ├── models.py             ← Pydantic request/response models
│   └── requirements.txt      ← fastapi, uvicorn, numpy, pydantic
├── src/
│   └── app/
│       ├── types.ts           ← All TypeScript interfaces
│       ├── hooks/
│       │   └── useLPSolver.ts ← Main hook: API calls + state machine
│       ├── components/
│       │   ├── TableauWorkspace.tsx  ← 4-tab tableau (FULLY IMPLEMENTED)
│       │   ├── GraphView.tsx         ← SVG feasible region + simplex path
│       │   ├── ExplanationConsole.tsx← Step explanations + row ops
│       │   ├── TopControlBar.tsx     ← Problem input + controls
│       │   └── StepTimeline.tsx      ← Step navigation
│       └── pages/
│           └── MainWorkspace.tsx     ← Main layout (wired to API)
├── tsconfig.json
├── package.json              ← React 18, Vite, Tailwind 4, Radix UI
└── .gitignore
```

**GitHub repo:** https://github.com/Lizo-RoadTown/Interactivelinearprogrammingui

**Python solver (separate repo/file):**
`C:\Users\Liz\OneDrive\Desktop\Spring 2026\Linear Programming\lp_interactive.py`
— This is the original working Tkinter desktop app. `solver_core.py` is extracted from it.

---

## How to Run

**Start backend** (Anaconda Python required):
```powershell
cd C:\Users\Liz\InteractionLPUI
.venv\Scripts\activate        # or: C:\Users\Liz\anaconda3\python.exe -m ...
python -m uvicorn backend.main:app --reload --port 8000
```

**Start frontend** (separate terminal):
```powershell
cd C:\Users\Liz\InteractionLPUI
npm run dev
```

Open `http://localhost:5173`

**First-time setup after cloning:**
```powershell
cd C:\Users\Liz\InteractionLPUI
C:\Users\Liz\anaconda3\python.exe -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
npm install
```

---

## What's Built and Working

### Backend (`backend/`)
- `POST /solve` — takes an LP problem, returns all simplex steps, corner points, feasible region polygon, simplex path, standard form text
- `POST /pivot` — applies one pivot to a live matrix, returns new tableau + row operations
- `POST /explain-cell` — returns plain-English explanation of any tableau cell (row, col)
- `GET /feasible-region` — computes the feasible polygon from constraints (Sutherland-Hodgman clipping)
- Supports: MAX/MIN, `<=` / `>=` / `=` constraints, Big-M method for `>=` and `=`

### Frontend (`src/`)
- **TableauWorkspace** — 4 tabs, all implemented:
  - **Current** — live tableau with pivot highlighting, cell tooltips
  - **Select Pivot** — highlights negative z-row entries (candidates), marks most negative as optimal entering variable, shows ratio test column with min-ratio annotation
  - **After Pivot** — row operations list + result tableau with changed cells in green
  - **Final** — optimal solution variable grid + annotated optimal tableau
- **GraphView** — SVG graph with feasible region polygon, constraint lines, corner points with z-values, simplex path with arrows, current BFS highlighted
- **ExplanationConsole** — step explanation text, entering/leaving variable, row operations, step history
- **useLPSolver hook** — manages all state: solver response, step navigation, interactive mode state machine, cell explanations

### TypeScript
- Clean compile (`npx tsc --noEmit` = 0 errors)
- Production build passes (`npm run build` = 1708 modules, ~3s)

---

## What Still Needs Work

1. **End-to-end test** — servers haven't been run together yet. Most likely failure: `solver_core.py` API shape vs what the frontend expects. Check `useLPSolver.ts` API call responses against `backend/models.py`.

2. **Interactive mode in React** — the `useLPSolver.ts` hook has the state machine scaffolded (`choose_entering` → `choose_leaving` → pivot → repeat), but the UI wiring in `MainWorkspace.tsx` may need finishing. The Python desktop version (`lp_interactive.py`) has the full working interactive logic to reference.

3. **GraphView scale** — currently uses `axisBounds` from the API response. Should auto-scale to fit all corner points with padding.

4. **`solver_core.py` completeness** — was written to match the interface expected by the frontend. May need debugging against the original `lp_interactive.py` solver logic, especially for Big-M problems and edge cases (unbounded, infeasible).

5. **Problem input UI** — `TopControlBar.tsx` needs to wire up to actually call `/solve`. Currently the problem form may be using sample data.

---

## Key Design Decisions

- **Mistakes allowed in interactive mode** — wrong pivot choices execute and are flagged with warnings, not blocked. Students learn from bad choices.
- **Z-row sign convention** — `z_row[j] = -c_j` for MAX, `+c_j` for MIN. Pivot on most negative. At optimality: `z* = T[m,-1]` for MAX, `z* = -T[m,-1]` for MIN.
- **Big-M method** — single-phase. Slack for `<=`, surplus+artificial for `>=`, artificial for `=`. Artificials get +M in z-row.
- **Select Pivot tab logic** — candidates = negative z-row entries. Optimal entering = most negative. Pivot row = min positive ratio (RHS ÷ col entry).
- **Tailwind 4 + Radix UI (shadcn)** — UI component library already scaffolded in `src/app/components/ui/`.

---

## The Original Desktop App

`lp_interactive.py` is a fully working Tkinter app with:
- Unified graph + tableau layout (PanedWindow, no tabs)
- Interactive mode state machine (identical logic to what React needs)
- Big-M solver, graphical method, Sutherland-Hodgman feasible region
- Cell click detection, row operation display, step navigation

Use it as the **reference implementation** when debugging the web version.
