"""
main.py
=======
FastAPI backend for the LP Interactive Simulator.

Run:
  cd backend
  uvicorn main:app --reload --port 8000

Endpoints:
  POST /api/solve          Run full solver, return all steps + graph data
  POST /api/pivot          Apply one interactive pivot to a live matrix
  POST /api/explain-cell   Get explanation for a cell in a live matrix
  GET  /api/health         Liveness check
"""

import os
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .models import (
    LPProblemIn, PivotRequest, CellExplainRequest,
    SolverResponse, PivotResponse, CellExplainResponse,
    SimplexStepOut, TableauOut, TableauCellOut, PointOut,
)
from .solver_core import (
    SimplexSolver, TwoPhaseSolver, compute_graphical_data,
    _bfs_from_tab, _cell_explanation, _optimal_pivot_info, _apply_pivot_to_T,
    _fmt_cell, BIG_M,
)

app = FastAPI(title="LP Simulator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tightened per-host in production via env var if needed
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve React frontend in production (when dist/ exists next to backend/)
_DIST = os.path.join(os.path.dirname(__file__), '..', 'dist')
if os.path.isdir(_DIST):
    app.mount('/assets', StaticFiles(directory=os.path.join(_DIST, 'assets')), name='assets')

    @app.get('/', include_in_schema=False)
    def _root():
        return FileResponse(os.path.join(_DIST, 'index.html'))

    @app.get('/{full_path:path}', include_in_schema=False)
    def _spa(full_path: str):
        candidate = os.path.join(_DIST, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_DIST, 'index.html'))


# ══════════════════════════════════════════════════════════════════════════════
#  CONVERSION HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _problem_in_to_solver_args(problem: LPProblemIn):
    """Convert API request model → (sense, obj, constraints, var_names)."""
    sense = problem.objectiveType  # "max" | "min"
    var_names = [v.upper() for v in problem.variables]

    obj = {var_names[i]: c for i, c in enumerate(problem.objectiveCoefficients)}

    constraints = []
    for con in problem.constraints:
        coeffs = {var_names[i]: c for i, c in enumerate(con.coefficients)}
        constraints.append((coeffs, con.operator, con.rhs))

    return sense, obj, constraints, var_names


def _tableau_dict_to_out(tab: dict, prev_tab: dict | None = None) -> TableauOut:
    """Convert a solver tableau dict to the API TableauOut model."""
    T         = tab['matrix']
    basis     = tab['basis']
    all_vars  = tab['all_vars']
    col_types = tab['col_types']
    pivot_col = tab.get('pivot_col')
    pivot_row = tab.get('pivot_row')
    ratios    = tab.get('ratios')
    m         = len(basis)
    n_total   = len(all_vars)   # columns excluding RHS

    # Which cells changed compared to previous tableau?
    prev_T = prev_tab['matrix'] if prev_tab is not None else None

    rows_out: list[list[TableauCellOut]] = []

    # Constraint rows (0..m-1), then z-row (index m)
    for r in range(m + 1):
        row_cells: list[TableauCellOut] = []
        for c in range(n_total + 1):  # +1 for RHS
            val = float(T[r, c])
            is_pivot     = (pivot_row is not None and pivot_col is not None
                            and r == pivot_row and c == pivot_col)
            is_pivot_row = (pivot_row is not None and r == pivot_row)
            is_pivot_col = (pivot_col is not None and c == pivot_col and r != pivot_row)
            is_changed   = (prev_T is not None and abs(val - float(prev_T[r, c])) > 1e-9)
            ct = col_types[c] if c < len(col_types) else 'rhs'

            row_cells.append(TableauCellOut(
                value=val,
                displayValue=_fmt_cell(val),
                isPivot=is_pivot,
                isPivotRow=is_pivot_row,
                isPivotCol=is_pivot_col,
                isChanged=is_changed,
                colType=ct,
            ))
        rows_out.append(row_cells)

    basis_var_names = [
        all_vars[basis[i]].lower() if 0 <= basis[i] < len(all_vars) else '?'
        for i in range(m)
    ]

    # Ratios: append None for z-row slot so length = m+1
    ratios_out = None
    if ratios is not None:
        ratios_out = [float(r) if r is not None else None for r in ratios] + [None]

    return TableauOut(
        rows=rows_out,
        basisVariables=basis_var_names,
        allVariables=[v.lower() for v in all_vars] + ['RHS'],
        colTypes=col_types + ['rhs'],
        ratios=ratios_out,
        rawMatrix=T.tolist(),
        rawBasis=list(basis),
    )


def _tab_to_step(tab: dict, iteration: int, prev_tab: dict | None,
                 sense: str) -> SimplexStepOut:
    """Convert a solver tableau dict to a SimplexStepOut."""
    msg = tab.get('message', '')

    # Classify step type — by message content, not iteration index
    if msg.startswith('Z_ROW_SETUP'):
        step_type = 'z_row_setup'
    elif msg.startswith('Initial tableau') or (iteration == 0 and not msg.startswith('PHASE')):
        step_type = 'initial'
    elif msg.startswith('PHASE I COMPLETE'):
        step_type = 'phase1_complete'
    elif msg.startswith('PHASE I SELECT PIVOT') or msg.startswith('PHASE II SELECT PIVOT') or msg.startswith('SELECT PIVOT'):
        step_type = 'select_pivot'
    elif msg.startswith('PHASE I AFTER PIVOT') or msg.startswith('PHASE II AFTER PIVOT') or msg.startswith('AFTER PIVOT'):
        step_type = 'after_pivot'
    elif msg.startswith('PHASE II:'):
        step_type = 'phase2_initial'
    elif msg.startswith('PHASE I:'):
        step_type = 'phase1_initial'
    elif msg.startswith('OPTIMAL'):
        step_type = 'optimal'
    elif msg.startswith('INFEASIBLE'):
        step_type = 'infeasible'
    elif msg.startswith('UNBOUNDED'):
        step_type = 'unbounded'
    else:
        step_type = 'after_pivot'

    has_alt = 'ALTERNATIVE' in msg
    is_degen = 'DEGENERATE' in msg

    T = tab['matrix']
    m = len(tab['basis'])
    z_rhs = float(T[m, -1])
    obj_val = z_rhs if sense == 'max' else -z_rhs

    return SimplexStepOut(
        iteration=iteration,
        stepType=step_type,
        tableau=_tableau_dict_to_out(tab, prev_tab),
        explanation=msg,
        pivotRow=tab.get('pivot_row'),
        pivotCol=tab.get('pivot_col'),
        enteringVar=tab.get('entering'),
        leavingVar=tab.get('leaving'),
        rowOperations=tab.get('row_ops'),
        objectiveValue=round(obj_val, 8),
        hasAlternative=has_alt if has_alt else None,
        isDegenerate=is_degen if is_degen else None,
        specialCase='alternative' if has_alt else ('degenerate' if is_degen else None),
    )


def _build_simplex_path(solver) -> list[PointOut]:
    """Extract the sequence of BFS points from solver tableau history."""
    var_names = solver.var_names
    if len(var_names) != 2:
        return []

    path = []
    seen = set()
    for tab in solver.tableaus:
        msg = tab.get('message', '')
        # Only collect path points at initial and AFTER PIVOT / OPTIMAL steps
        if not (tab is solver.tableaus[0]
                or msg.startswith('AFTER PIVOT')
                or msg.startswith('OPTIMAL')):
            continue
        vals = _bfs_from_tab(tab, var_names)
        x = round(vals[var_names[0]], 6)
        y = round(vals[var_names[1]], 6)
        key = (x, y)
        if key in seen:
            continue
        seen.add(key)
        T = tab['matrix']
        m = len(tab['basis'])
        z_rhs = float(T[m, -1])
        z = z_rhs if solver.sense == 'max' else -z_rhs
        path.append(PointOut(x=x, y=y, z=round(z, 6)))

    # Mark the last point as current
    if path:
        last = path[-1]
        path[-1] = PointOut(x=last.x, y=last.y, z=last.z, isCurrent=True)

    return path


def _corner_points_to_out(corners: list[dict], optimal_z: float | None,
                          sense: str) -> list[PointOut]:
    out = []
    for c in corners:
        is_opt = (optimal_z is not None and abs(c['z'] - optimal_z) < 1e-6)
        label = f"({_fmt_cell(c['x'])}, {_fmt_cell(c['y'])})"
        out.append(PointOut(
            x=round(c['x'], 6),
            y=round(c['y'], 6),
            z=round(c['z'], 6),
            label=label,
            isOptimal=is_opt,
            isDegenerate=c.get('degenerate', False),
        ))
    return out


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/solve", response_model=SolverResponse)
def solve(problem: LPProblemIn):
    try:
        sense, obj, constraints, var_names = _problem_in_to_solver_args(problem)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Problem parsing error: {e}")

    try:
        if problem.method == 'two-phase':
            solver = TwoPhaseSolver(sense, obj, constraints, var_names)
        else:
            solver = SimplexSolver(sense, obj, constraints, var_names)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {e}")

    # Build steps list
    steps: list[SimplexStepOut] = []
    for i, tab in enumerate(solver.tableaus):
        prev = solver.tableaus[i - 1] if i > 0 else None
        steps.append(_tab_to_step(tab, i, prev, sense))

    is_2var = len(var_names) == 2

    # Graph data (only meaningful for 2-variable problems)
    corner_points: list[PointOut] = []
    feasible_polygon: list[PointOut] = []
    axis_bounds = {"maxX": 20.0, "maxY": 20.0}

    if is_2var:
        try:
            gdata = compute_graphical_data(sense, obj, constraints, var_names)
            optimal_z = gdata.get('optimal_z')
            corner_points = _corner_points_to_out(gdata['corners'], optimal_z, sense)

            poly = gdata.get('polygon', [])
            feasible_polygon = [PointOut(x=round(px, 6), y=round(py, 6))
                                for px, py in poly]

            pm = gdata.get('plot_max', 20)
            axis_bounds = {"maxX": round(pm, 2), "maxY": round(pm, 2)}
        except Exception:
            pass  # graph data is optional; solver result still valid

    simplex_path = _build_simplex_path(solver)

    return SolverResponse(
        steps=steps,
        cornerPoints=corner_points,
        feasibleRegionPolygon=feasible_polygon,
        simplexPath=simplex_path,
        axisBounds=axis_bounds,
        standardFormText=solver.standard_form_text(),
        status=solver.status,
        optimalValue=solver.z_optimal,
        optimalSolution=solver.solution if solver.status == 'optimal' else None,
        is2Variable=is_2var,
    )


@app.post("/api/pivot", response_model=PivotResponse)
def apply_pivot(req: PivotRequest):
    T     = np.array(req.matrix, dtype=float)
    basis = list(req.basis)
    m     = len(basis)

    if req.pivotRow < 0 or req.pivotRow >= m:
        raise HTTPException(status_code=422,
                            detail=f"pivotRow {req.pivotRow} out of range [0, {m-1}]")
    if req.pivotCol < 0 or req.pivotCol >= T.shape[1] - 1:
        raise HTTPException(status_code=422,
                            detail=f"pivotCol {req.pivotCol} out of range")

    new_T, new_basis, row_ops, warning = _apply_pivot_to_T(T, basis, req.pivotRow, req.pivotCol)

    # Check optimality
    z_row = new_T[m, :-1]
    is_optimal = bool(np.min(z_row) >= -1e-8)

    z_rhs = float(new_T[m, -1])
    obj_val = z_rhs if req.sense == 'max' else -z_rhs

    # Build entering/leaving names
    entering = req.varNames[req.pivotCol] if req.pivotCol < len(req.varNames) else '?'
    leaving  = req.varNames[basis[req.pivotRow]] if 0 <= basis[req.pivotRow] < len(req.varNames) else '?'

    # Classify step
    if is_optimal:
        step_type = 'optimal'
        explanation = f"OPTIMAL  z* = {_fmt_cell(obj_val)}"
    else:
        step_type = 'after_pivot'
        explanation = (f"AFTER PIVOT  |  {entering.lower()} entered, {leaving.lower()} left  |  "
                       f"z = {_fmt_cell(obj_val)}")

    tab_dict = {
        'matrix':    new_T,
        'basis':     new_basis,
        'all_vars':  req.varNames,
        'col_types': req.colTypes,
        'pivot_col': req.pivotCol,
        'pivot_row': req.pivotRow,
        'ratios':    None,
        'entering':  entering,
        'leaving':   leaving,
        'row_ops':   row_ops,
        'message':   explanation,
    }

    prev_dict = {
        'matrix':    T,
        'basis':     basis,
        'all_vars':  req.varNames,
        'col_types': req.colTypes,
        'pivot_col': None, 'pivot_row': None, 'ratios': None,
        'entering': None, 'leaving': None, 'row_ops': None, 'message': '',
    }

    step = SimplexStepOut(
        iteration=-1,          # caller tracks iteration count
        stepType=step_type,
        tableau=_tableau_dict_to_out(tab_dict, prev_dict),
        explanation=explanation,
        pivotRow=req.pivotRow,
        pivotCol=req.pivotCol,
        enteringVar=entering,
        leavingVar=leaving,
        rowOperations=row_ops,
        objectiveValue=round(obj_val, 8),
    )

    # Extract BFS point for graph sync (2-var only)
    new_point = None
    if len(req.varNames) >= 2:
        var_names_upper = [v.upper() for v in req.varNames]
        decision_vars = [v for v, ct in zip(req.varNames, req.colTypes) if ct == 'decision']
        if len(decision_vars) >= 2:
            vals = _bfs_from_tab(tab_dict, [v.upper() for v in decision_vars[:2]])
            dv = [v.upper() for v in decision_vars[:2]]
            x = vals.get(dv[0], 0.0)
            y = vals.get(dv[1], 0.0)
            new_point = PointOut(x=round(x, 6), y=round(y, 6),
                                  z=round(obj_val, 6), isCurrent=True)

    return PivotResponse(
        step=step,
        newPoint=new_point,
        warning=warning,
        isOptimal=is_optimal,
    )


@app.post("/api/explain-cell", response_model=CellExplainResponse)
def explain_cell(req: CellExplainRequest):
    T    = np.array(req.matrix, dtype=float)
    tab  = {
        'matrix':    T,
        'basis':     req.basis,
        'all_vars':  req.varNames,
        'col_types': req.colTypes,
    }
    explanation = _cell_explanation(req.row, req.col, tab, req.sense, req.varNames)
    return CellExplainResponse(explanation=explanation)
