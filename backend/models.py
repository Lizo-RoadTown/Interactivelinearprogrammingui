"""
models.py
=========
Pydantic models — these are the canonical data contract between the Python
backend and the React frontend.  The TypeScript types in src/app/types.ts
mirror these exactly.
"""

from typing import Optional
from pydantic import BaseModel


# ── Request models ────────────────────────────────────────────────────────────

class ConstraintIn(BaseModel):
    id: str
    coefficients: list[float]      # one per variable, in var order
    operator: str                  # "<=" | ">=" | "="
    rhs: float
    label: Optional[str] = None


class LPProblemIn(BaseModel):
    objectiveType: str             # "max" | "min"
    objectiveCoefficients: list[float]
    variables: list[str]           # e.g. ["x1", "x2"]
    variableSigns: Optional[list[str]] = None  # "nonneg" | "nonpos" | "urs" per variable
    constraints: list[ConstraintIn]
    method: str = "simplex"        # "simplex" | "big-m" | "two-phase"


class PivotRequest(BaseModel):
    """Apply one interactive pivot to a live matrix."""
    matrix: list[list[float]]      # (m+1) x (n+1) tableau
    basis: list[int]               # length m
    varNames: list[str]            # length n_total
    colTypes: list[str]            # length n_total
    pivotRow: int
    pivotCol: int
    sense: str                     # "max" | "min"


class CellExplainRequest(BaseModel):
    """Get a plain-English explanation for a cell in a live matrix."""
    matrix: list[list[float]]
    basis: list[int]
    varNames: list[str]
    colTypes: list[str]
    row: int
    col: int
    sense: str


# ── Response models ───────────────────────────────────────────────────────────

class TableauCellOut(BaseModel):
    value: float
    displayValue: str              # pre-formatted string (handles M, fractions)
    isPivot: bool = False
    isPivotRow: bool = False
    isPivotCol: bool = False
    isChanged: bool = False
    colType: str = "decision"      # "decision" | "slack" | "surplus" | "artificial"


class TableauOut(BaseModel):
    rows: list[list[TableauCellOut]]  # constraint rows + z-row last
    basisVariables: list[str]         # display names for BV column
    allVariables: list[str]           # column headers (all vars)
    colTypes: list[str]               # parallel to allVariables
    ratios: Optional[list[Optional[float]]] = None
    # Raw matrix for interactive pivot computation (sent alongside)
    rawMatrix: list[list[float]]
    rawBasis: list[int]


class SimplexStepOut(BaseModel):
    iteration: int
    # "initial"|"select_pivot"|"after_pivot"|"optimal"|"infeasible"
    # "unbounded"|"phase1_initial"|"phase1_complete"|"phase2_initial"
    stepType: str
    tableau: TableauOut
    explanation: str
    pivotRow: Optional[int] = None
    pivotCol: Optional[int] = None
    enteringVar: Optional[str] = None
    leavingVar: Optional[str] = None
    rowOperations: Optional[list[str]] = None
    objectiveValue: float
    hasAlternative: Optional[bool] = None
    isDegenerate: Optional[bool] = None
    specialCase: Optional[str] = None   # "alternative" | "degenerate" | "cycling_risk"


class PointOut(BaseModel):
    x: float
    y: float
    label: Optional[str] = None
    z: Optional[float] = None
    isCurrent: bool = False
    isOptimal: bool = False
    isDegenerate: bool = False


class SolverResponse(BaseModel):
    steps: list[SimplexStepOut]
    cornerPoints: list[PointOut]
    feasibleRegionPolygon: list[PointOut]
    simplexPath: list[PointOut]     # BFS sequence visited by solver
    axisBounds: dict                # {"maxX": float, "maxY": float}
    standardFormText: str
    status: str                     # "optimal" | "infeasible" | "unbounded"
    optimalValue: Optional[float] = None
    optimalSolution: Optional[dict[str, float]] = None
    is2Variable: bool


class PivotResponse(BaseModel):
    step: SimplexStepOut
    newPoint: Optional[PointOut] = None   # None if > 2 variables
    warning: Optional[str] = None
    isOptimal: bool


class CellExplainResponse(BaseModel):
    explanation: str
