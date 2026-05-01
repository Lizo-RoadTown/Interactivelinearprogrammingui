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
from pydantic import BaseModel

from .models import (
    LPProblemIn, PivotRequest, CellExplainRequest,
    SolverResponse, PivotResponse, CellExplainResponse,
    SimplexStepOut, TableauOut, TableauCellOut, PointOut,
    SensitivityRequest, SensitivityResponse,
    ListProblemsRequest, ValidateProblemRequest, ExportProblemRequest,
    EducatorProblemsResponse, EducatorValidationResponse, EducatorExportResponse,
)
from .solver_core import (
    SimplexSolver, TwoPhaseSolver, compute_graphical_data,
    _bfs_from_tab, _cell_explanation, _optimal_pivot_info, _apply_pivot_to_T,
    _fmt_cell, BIG_M,
)
from . import sensitivity as sa
from .educator import bank as edu_bank
from .educator import listing as edu_listing
from .educator import validation as edu_validation
from .educator import export as edu_export
from .educator import db as edu_db

# Initialize SQLite-backed bank store. Creates the schema on first run
# and seeds the 'demo' bank from problems.json if it's empty. This is
# idempotent — safe to call every startup.
edu_db.init()

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
    """Liveness + storage-backend probe.

    Reports whether the bank storage layer is using Postgres (production
    via DATABASE_URL) or SQLite (local dev fallback). Useful for quickly
    confirming a Render deploy actually picked up the env var without
    having to dig through deploy logs. Hit it in the browser at
    /api/health.
    """
    backend = "postgres" if edu_db.is_postgres() else "sqlite"
    db_ok = True
    try:
        # Cheap probe: just count the demo bank. If the connection is
        # broken (wrong password, wrong host, network), this raises.
        edu_db.list_banks()
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "status": "ok",
        "storage": backend,
        "storage_connected": db_ok,
    }


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


# ══════════════════════════════════════════════════════════════════════════════
#  CHAPTER 8 — SENSITIVITY ANALYSIS
# ══════════════════════════════════════════════════════════════════════════════

def _solve_for_sensitivity(problem: LPProblemIn):
    """Re-solve the problem and return a solver in 'optimal' status."""
    sense, obj, constraints, var_names = _problem_in_to_solver_args(problem)
    if problem.method == 'two-phase':
        solver = TwoPhaseSolver(sense, obj, constraints, var_names)
    else:
        solver = SimplexSolver(sense, obj, constraints, var_names)
    if solver.status != 'optimal':
        raise HTTPException(status_code=409,
                            detail=f"Problem not optimal (status={solver.status}); "
                                   f"sensitivity analysis requires an optimal solution.")
    return solver


def _matrix_form_result(solver) -> dict:
    """Convert extract_matrix_form output to JSON-serializable dict."""
    mf = sa.extract_matrix_form(solver)
    return {
        'B': mf['B'].tolist(),
        'B_inv': mf['B_inv'].tolist(),
        'N': mf['N'].tolist(),
        'CB': mf['CB'].tolist(),
        'CN': mf['CN'].tolist(),
        'b': mf['b'].tolist(),
        'xB': mf['xB'].tolist(),
        'z_star': mf['z_star'],
        'basis_variables': [mf['all_vars'][j] for j in mf['basis']],
        'nonbasic_variables': [mf['all_vars'][j] for j in mf['nonbasic']],
        'sense': mf['sense'],
    }


@app.post("/api/sensitivity", response_model=SensitivityResponse)
def sensitivity_analysis(req: SensitivityRequest):
    solver = _solve_for_sensitivity(req.problem)
    params = req.params or {}

    try:
        op = req.operation

        if op == 'summary':
            # Aggregated single-call summary for the interactive Sensitivity lens.
            # Returns all coefficient ranges, RHS ranges, shadow prices, and the
            # matrix-form pieces the frontend needs to compute x* / z* locally
            # as a slider moves within the allowable range.
            summary = sa.sensitivity_summary(solver)
            return SensitivityResponse(
                operation='§8.2 + §8.3 — sensitivity summary',
                formula='All allowable ranges + shadow prices + matrix form',
                steps=[
                    f"Optimal basis: {summary['basis_vars']}",
                    f"Nonbasic:       {summary['nonbasic_vars']}",
                    f"z* = {summary['z_star']}",
                    f"Shadow prices y = {summary['shadow_prices']}",
                ],
                result=summary,
                conclusion='Sensitivity slider panel ready. Drag sliders within the '
                           'highlighted range and the basis stays optimal.',
            )

        if op == 'matrix_form':
            mf_dict = _matrix_form_result(solver)
            # Render B, B⁻¹ visually in steps
            B = np.array(mf_dict['B'])
            B_inv = np.array(mf_dict['B_inv'])
            steps = [
                f"Basic variables: {mf_dict['basis_variables']}",
                f"Nonbasic variables: {mf_dict['nonbasic_variables']}",
                f"C_B = {mf_dict['CB']}   C_N = {mf_dict['CN']}",
                f"b = {mf_dict['b']}",
                "B = ", *(f"   {list(row)}" for row in B),
                "B⁻¹ = ", *(f"   {[round(x, 4) for x in row]}" for row in B_inv),
                f"xB = B⁻¹·b = {[round(x, 4) for x in mf_dict['xB']]}",
                f"z* = C_B · B⁻¹ · b = {mf_dict['z_star']}",
            ]
            return SensitivityResponse(
                operation='§8.2 — simplex matrix form',
                formula='Optimal table from basis: [I | B⁻¹N | B⁻¹b],  z-row: [0 | C_B·B⁻¹N − C_N | C_B·B⁻¹·b]',
                steps=steps,
                result=mf_dict,
                conclusion='Matrix form reconstructs the optimal tableau from the basis alone — '
                           'no simplex iterations needed. All sensitivity operations build on this.',
            )

        if op == 'of_coeff_basic':
            var = params.get('variable')
            if not var:
                raise HTTPException(status_code=422, detail="params.variable required")
            out = sa.of_coeff_range_basic(solver, var)
            return SensitivityResponse(**out)

        if op == 'of_coeff_nonbasic':
            var = params.get('variable')
            if not var:
                raise HTTPException(status_code=422, detail="params.variable required")
            out = sa.of_coeff_range_nonbasic(solver, var)
            return SensitivityResponse(**out)

        if op == 'rhs_range':
            idx = params.get('constraint_index')
            if idx is None:
                raise HTTPException(status_code=422, detail="params.constraint_index required (0-based)")
            out = sa.rhs_range(solver, int(idx))
            return SensitivityResponse(**out)

        if op == 'shadow_prices':
            out = sa.shadow_prices(solver)
            return SensitivityResponse(**out)

        if op == 'add_activity':
            a_new = params.get('a_new')
            c_new = params.get('c_new')
            label = params.get('var_label', 'x_new')
            if a_new is None or c_new is None:
                raise HTTPException(status_code=422, detail="params.a_new and params.c_new required")
            out = sa.add_activity(solver, a_new=list(a_new), c_new=float(c_new), var_label=label)
            return SensitivityResponse(**out)

        if op == 'add_constraint':
            coefs = params.get('coefficients')
            operator = params.get('operator')
            rhs = params.get('rhs')
            if coefs is None or operator is None or rhs is None:
                raise HTTPException(status_code=422,
                                    detail="params.coefficients, .operator, and .rhs required")
            out = sa.add_constraint(solver, coefficients=list(coefs),
                                    operator=str(operator), rhs=float(rhs))
            return SensitivityResponse(**out)

        raise HTTPException(status_code=422, detail=f"Unknown operation: {op!r}")

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sensitivity error: {e}")


# ══════════════════════════════════════════════════════════════════════════════
#  EDUCATOR PORTAL — word problem bank
#  Endpoints delegate to student-written functions in backend/educator/.
#  When a beginner function is not yet implemented, the endpoint returns
#  `implemented: false` and a fallback so the UI stays functional.
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/educator/list", response_model=EducatorProblemsResponse)
def educator_list(req: ListProblemsRequest):
    """List & filter the problem bank. Delegates to BEGINNER A's list_problems().

    Reads from the SQLite-backed 'demo' bank so the team-project demo page
    sees the same data as the new admin tool.
    """
    bank = edu_db.list_problems('demo')
    try:
        result = edu_listing.list_problems(
            bank,
            difficulty=req.difficulty,
            category=req.category,
            search=req.search,
        )
        return EducatorProblemsResponse(problems=result, implemented=True)
    except NotImplementedError:
        return EducatorProblemsResponse(problems=bank, implemented=False)


@app.post("/api/educator/validate", response_model=EducatorValidationResponse)
def educator_validate(req: ValidateProblemRequest):
    """Validate a proposed problem. Delegates to BEGINNER B's validate_problem()."""
    try:
        errors = edu_validation.validate_problem(req.problem)
        return EducatorValidationResponse(errors=list(errors), implemented=True)
    except NotImplementedError:
        return EducatorValidationResponse(errors=[], implemented=False)


@app.post("/api/educator/export", response_model=EducatorExportResponse)
def educator_export(req: ExportProblemRequest):
    """Export a problem to Markdown. Delegates to BEGINNER C's export_to_markdown()."""
    problem = edu_db.get_problem('demo', req.problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail=f"Problem {req.problem_id!r} not found")
    try:
        md = edu_export.export_to_markdown(problem)
        return EducatorExportResponse(markdown=md, implemented=True)
    except NotImplementedError:
        stub = f"# {problem.get('title', req.problem_id)}\n\n(export_to_markdown not yet implemented)"
        return EducatorExportResponse(markdown=stub, implemented=False)


@app.get("/api/educator/problems")
def educator_all_problems():
    """Unfiltered bank dump — useful for frontend to seed dropdowns.

    The legacy team-demo /educator page expects this to return the demo
    bank. Both that page and the new /admin page now read from SQLite.
    """
    return {"problems": edu_db.list_problems('demo')}


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN — professor-facing CRUD on per-bank problems
#  Each professor picks a bank_id and that's their personal bank, partitioned
#  in SQLite. No authentication: bank_id is just a partitioning key, treated
#  as a remembered preference rather than a secret.
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/admin/banks")
def admin_list_banks():
    """All bank ids currently in storage (for the admin's bank-picker UI)."""
    return {"banks": edu_db.list_banks()}


@app.get("/api/admin/banks/{bank_id}/problems")
def admin_list_problems(bank_id: str):
    """All problems in one bank."""
    return {"bank_id": bank_id, "problems": edu_db.list_problems(bank_id)}


@app.post("/api/admin/banks/{bank_id}/problems")
def admin_save_problem(bank_id: str, problem: dict):
    """Insert or update a problem in this bank.

    Validation runs first (Beginner B's function). Save is rejected if
    validation returns errors. The professor sees the error list in the
    UI and fixes before retrying.
    """
    try:
        errors = edu_validation.validate_problem(problem)
    except NotImplementedError:
        # Validator stub: be permissive so the admin can still save.
        # In production with the validator implemented, errors block save.
        errors = []
    if errors:
        return {"saved": False, "errors": errors}
    try:
        edu_db.upsert_problem(bank_id, problem)
    except ValueError as e:
        return {"saved": False, "errors": [str(e)]}
    return {"saved": True, "errors": []}


@app.delete("/api/admin/banks/{bank_id}/problems/{problem_id}")
def admin_delete_problem(bank_id: str, problem_id: str):
    """Remove one problem from a bank. Idempotent — already-gone is fine."""
    deleted = edu_db.delete_problem(bank_id, problem_id)
    return {"deleted": deleted}


class ForkBankRequest(BaseModel):
    source_bank: str
    target_bank: str


class AgentDraftRequest(BaseModel):
    """Bring-your-own-agent draft request from /admin.

    The professor pastes their API key in the UI; the browser sends it
    here, we forward to the chosen provider, and never persist the key.
    """
    provider: str             # 'anthropic' | 'openai'
    api_key: str
    model: str | None = None  # falls back to a sensible default per provider
    prompt: str               # the professor's natural-language request
    curriculum_context: str | None = None  # optional course material
    nDecVars_hint: int | None = None       # optional size suggestion


class AgentDraftResponse(BaseModel):
    problem: dict | None = None
    raw: str | None = None       # raw model output for debugging
    error: str | None = None
    model: str | None = None


@app.post("/api/admin/banks/fork")
def admin_fork_bank(req: ForkBankRequest):
    """Copy every problem from one bank into another (overwrites conflicts).

    Useful for a new professor to seed their bank from the demo bank as a
    starting point, then customize.
    """
    if not req.target_bank.strip():
        raise HTTPException(status_code=422, detail="target_bank is required")
    count = edu_db.fork_bank(req.source_bank, req.target_bank)
    return {"copied": count, "source": req.source_bank, "target": req.target_bank}


# ── Agent passthrough — bring-your-own-key LLM drafts ──────────────────────

_AGENT_SYSTEM_PROMPT = """You generate LP word problems for an Operations Research textbook.

Output a SINGLE JSON object matching this schema, no prose, no Markdown fences:

{
  "id": "wp-<short-slug>",                    // unique slug, lowercase, dashes
  "title": "<short human-readable title>",
  "category": "<production|diet|transportation|finance|scheduling|...>",
  "difficulty": "<beginner|intermediate|advanced>",
  "scenario": "<the word problem the student reads, 3-6 sentences>",
  "numVars": <positive integer, typically 2 or 3>,
  "objectiveType": "<max|min>",
  "variables": ["<name1>", "<name2>", ...],   // length must equal numVars
  "objectiveCoefficients": [<n1>, <n2>, ...], // length must equal numVars
  "constraints": [
    {
      "coefficients": [<n1>, <n2>, ...],      // length must equal numVars
      "operator": "<<=|>=|=>",
      "rhs": <number>,
      "label": "<short label like 'flour' or 'budget'>"
    },
    ...                                        // 1 or more constraints
  ]
}

Requirements:
- Numbers are integers or simple decimals (no fractions in JSON).
- The problem must be feasible (an obviously feasible point exists).
- Scenarios should be realistic and concrete (specific resources, units).
- Coefficients should yield a non-trivial optimum (not all-zeros).
- Output only the JSON. No explanations, no Markdown fences."""


def _coerce_agent_json(raw: str) -> dict | None:
    """Try to extract a JSON object from the model's output.

    Models sometimes wrap the JSON in ```json ... ``` fences or add a
    leading sentence. Be lenient.
    """
    import json as _json
    import re as _re
    text = raw.strip()
    # Strip code fences if present
    fence = _re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    # If there's still leading prose, find the first { and last }
    if not text.startswith('{'):
        first = text.find('{')
        last = text.rfind('}')
        if first != -1 and last > first:
            text = text[first:last + 1]
    try:
        return _json.loads(text)
    except _json.JSONDecodeError:
        return None


@app.post("/api/admin/agent/draft", response_model=AgentDraftResponse)
async def admin_agent_draft(req: AgentDraftRequest):
    """Forward a draft request to the chosen LLM provider.

    The professor's API key is in `req.api_key`; we use it for one call
    and never store it. If the provider returns valid JSON matching the
    problem schema, we hand the dict back to the frontend so it can
    pre-fill the editor.
    """
    import httpx as _httpx

    provider = req.provider.lower().strip()
    if provider not in {'anthropic', 'openai'}:
        return AgentDraftResponse(error=f"Unknown provider {req.provider!r}")
    if not req.api_key.strip():
        return AgentDraftResponse(error="API key is required")

    user_message = req.prompt.strip()
    if req.curriculum_context:
        user_message = (
            "Curriculum context (use this to align the problem):\n"
            f"{req.curriculum_context.strip()}\n\n"
            f"Request: {user_message}"
        )
    if req.nDecVars_hint is not None:
        user_message += f"\n\n(Generate a problem with {req.nDecVars_hint} decision variables.)"

    try:
        if provider == 'anthropic':
            model = req.model or 'claude-opus-4-7'
            async with _httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    'https://api.anthropic.com/v1/messages',
                    headers={
                        'x-api-key': req.api_key,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json',
                    },
                    json={
                        'model': model,
                        'max_tokens': 1500,
                        'system': _AGENT_SYSTEM_PROMPT,
                        'messages': [{'role': 'user', 'content': user_message}],
                    },
                )
            if resp.status_code != 200:
                return AgentDraftResponse(
                    error=f"Anthropic API error {resp.status_code}: {resp.text[:300]}",
                    model=model,
                )
            data = resp.json()
            # content is a list of blocks; take the first text block
            blocks = data.get('content') or []
            raw = next((b.get('text', '') for b in blocks if b.get('type') == 'text'), '')

        else:  # openai
            model = req.model or 'gpt-4o-mini'
            async with _httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    'https://api.openai.com/v1/chat/completions',
                    headers={
                        'authorization': f'Bearer {req.api_key}',
                        'content-type': 'application/json',
                    },
                    json={
                        'model': model,
                        'temperature': 0.7,
                        'messages': [
                            {'role': 'system', 'content': _AGENT_SYSTEM_PROMPT},
                            {'role': 'user', 'content': user_message},
                        ],
                    },
                )
            if resp.status_code != 200:
                return AgentDraftResponse(
                    error=f"OpenAI API error {resp.status_code}: {resp.text[:300]}",
                    model=model,
                )
            data = resp.json()
            choices = data.get('choices') or []
            raw = choices[0]['message']['content'] if choices else ''

    except _httpx.RequestError as e:
        return AgentDraftResponse(error=f"Network error talking to {provider}: {e}")

    problem = _coerce_agent_json(raw)
    if not problem:
        return AgentDraftResponse(
            error="The model didn't return valid JSON. See `raw` for what it sent.",
            raw=raw,
            model=model,
        )
    return AgentDraftResponse(problem=problem, raw=raw, model=model)
