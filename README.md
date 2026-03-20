# Interactive Linear Programming UI

An interactive educational tool for teaching the **Simplex Method** in Linear Programming. Students work through word problems, build formulations, watch the graphical and algebraic solution unfold step by step, and make their own pivot choices — with immediate feedback on both correct and incorrect decisions.

---

## Quick Start

### Prerequisites

- **Python 3.10+** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)

### One-command launch

**Windows** — double-click `start.bat` or run:
```
start.bat
```

**Mac / Linux:**
```bash
./start.sh
```

This creates a virtual environment, installs all dependencies, and starts both servers. Open **http://localhost:5173** when ready.

### Manual setup

If you prefer to run the servers separately:

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

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` requests to the backend.

---

## What's Inside

### Practice Mode

- Choose from **Beginner**, **Intermediate**, or **Advanced** word problems
- **Formulation wizard**: identify decision variables, objective, and constraints from the word problem — relevant text highlights as you answer
- **Graphical phase** (2-variable problems): build the feasible region interactively
- **Guided simplex**: the tableau itself is interactive — click Z-row cells to choose the entering variable, click pivot-column rows for the leaving variable
- Feedback follows the **Attention → Question → Commitment → Feedback → Reveal** pattern from educational design research
- Supports standard Simplex, Big-M, and Two-Phase methods

### Free-form Solver

- Enter any LP problem: MAX or MIN, any number of variables, mixed constraint types (≤, ≥, =)
- 4-tab tableau: **Current · Select Pivot · After Pivot · Final**
- Graphical view with feasible region, corner points, and simplex path
- Click any cell for a plain-English explanation

### Guided Lessons

Six structured lessons covering the LP curriculum (Chapters 3–7):
Graphical Method · Simplex MAX · Simplex MIN · Big-M · Two-Phase · Special Cases

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, Radix UI |
| Backend | Python 3.11, FastAPI, NumPy |

---

## Project Structure

```
InteractiveLPUI/
├── backend/
│   ├── main.py            ← API endpoints
│   ├── solver_core.py     ← Simplex, Big-M, Two-Phase solvers
│   ├── models.py          ← Request/response models
│   └── requirements.txt
├── src/app/
│   ├── types.ts
│   ├── hooks/
│   │   ├── useLPSolver.ts         ← API calls + solver state
│   │   └── useGuidedSimplex.ts    ← Practice mode state machine
│   ├── data/
│   │   ├── wordProblems.ts        ← Word problems by difficulty
│   │   └── lessons.ts             ← Guided lesson curriculum
│   ├── components/
│   │   ├── TableauWorkspace.tsx   ← Interactive tableau
│   │   ├── GraphView.tsx          ← SVG feasible region
│   │   └── ...
│   └── pages/
│       ├── MainWorkspace.tsx      ← Solver + landing page
│       └── PracticeMode.tsx       ← Practice mode flow
├── start.bat                       ← Windows launcher
├── start.sh                        ← Mac/Linux launcher
└── package.json
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/solve` | Full solve → all steps, graph data, simplex path |
| `POST` | `/api/pivot` | Apply one interactive pivot |
| `POST` | `/api/explain-cell` | Plain-English cell explanation |
| `GET`  | `/api/health` | Health check |

---

## Supported Problem Types

- MAX and MIN objectives
- Constraint types: `≤`, `≥`, `=`
- Methods: standard Simplex, Big-M, Two-Phase
- Special case detection: alternative optima, degeneracy, unbounded, infeasible
- Bland's Rule tie-breaking for degenerate problems

---

## Design Philosophy

> **Learning clarity over computational efficiency.** Every number on screen should be explainable.

- Wrong pivot choices are **executed and explained**, not blocked
- The interaction model enforces reasoning before revealing answers
- Word problem text highlights connect formulation choices back to the source
