"""
solver_core.py
==============
Pure-Python LP solver logic extracted from lp_interactive.py.
No GUI imports (no tkinter, no matplotlib).

Exports:
  parse_problem(obj_text, sense_text, constraint_lines)
  compute_graphical_data(sense, obj, constraints, var_names)
  SimplexSolver(sense, obj, constraints, var_names)
  _bfs_from_tab(tab, var_names)
  _cell_explanation(row, col, tab, sense, var_names)
  _optimal_pivot_info(T, m)
  _apply_pivot_to_T(T, basis, pivot_row, pivot_col)
"""

import re
import itertools
import numpy as np

BIG_M = 1_000_000


# ══════════════════════════════════════════════════════════════════════════════
#  PARSER
# ══════════════════════════════════════════════════════════════════════════════

def parse_expr(text):
    """'3x1 - 2x2' → {'X1': 3.0, 'X2': -2.0}"""
    text = text.replace(" ", "").replace("-", "+-")
    coeffs = {}
    for tok in text.split("+"):
        tok = tok.strip()
        if not tok:
            continue
        m = re.match(r'^([+-]?\d*\.?\d*)\*?([A-Za-z]\w*)$', tok)
        if m:
            c_str, var = m.groups()
            c = 1.0 if c_str in ("", "+") else (-1.0 if c_str == "-" else float(c_str))
            coeffs[var.upper()] = c
        else:
            raise ValueError(f"Cannot parse term: '{tok}'")
    return coeffs


def parse_problem(obj_text, sense_text, constraint_lines):
    """Returns (sense, obj_dict, constraints_list, var_names_sorted)."""
    sense = sense_text.strip().lower()
    obj = parse_expr(obj_text)
    constraints = []
    for line in constraint_lines:
        line = line.strip()
        if not line:
            continue
        for rel in ["<=", ">=", "=", "<", ">"]:
            if rel in line:
                parts = line.split(rel, 1)
                coeffs = parse_expr(parts[0])
                rhs = float(parts[1].strip())
                constraints.append((coeffs, rel, rhs))
                break
        else:
            raise ValueError(f"No relation found in: '{line}'")
    all_vars = set(obj.keys())
    for c, _, _ in constraints:
        all_vars.update(c.keys())
    var_names = sorted(all_vars)
    return sense, obj, constraints, var_names


def _fmt_expr(coeffs, var_names):
    parts = []
    for v in var_names:
        c = coeffs.get(v, 0.0)
        if c == 0:
            continue
        vl = v.lower()
        if not parts:
            parts.append(vl if c == 1 else (f"-{vl}" if c == -1 else f"{c:g}{vl}"))
        else:
            ac = abs(c)
            sign = " + " if c > 0 else " - "
            parts.append(f"{sign}{vl}" if ac == 1 else f"{sign}{ac:g}{vl}")
    return "".join(parts) if parts else "0"


def _fmt_cell(v, M=BIG_M):
    """Format a tableau value; shows symbolic M for large multiples."""
    if abs(v) < 1e-9:
        return "0"
    m_coeff = round(v / M, 8)
    remainder = v - round(m_coeff) * M
    if abs(round(m_coeff)) >= 1 and abs(remainder) < 0.5:
        k = int(round(m_coeff))
        if k == 1:  return "M"
        if k == -1: return "-M"
        return f"{k}M"
    if abs(v - round(v, 4)) < 1e-6:
        v = round(v, 4)
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return f"{v:.4g}"


# ══════════════════════════════════════════════════════════════════════════════
#  GEOMETRY  (2-variable graphical method)
# ══════════════════════════════════════════════════════════════════════════════

def line_intersect(a1, b1, c1, a2, b2, c2):
    det = a1 * b2 - a2 * b1
    if abs(det) < 1e-10:
        return None
    return ((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det)


def point_satisfies(x, y, coeffs, rel, rhs, var_names, tol=1e-6):
    a = coeffs.get(var_names[0], 0.0)
    b = coeffs.get(var_names[1], 0.0)
    val = a * x + b * y
    if rel == '<=': return val <= rhs + tol
    if rel == '>=': return val >= rhs - tol
    if rel == '<':  return val <  rhs + tol
    if rel == '>':  return val >  rhs - tol
    if rel == '=':  return abs(val - rhs) <= tol
    return False


def is_feasible(x, y, constraints, var_names, tol=1e-6):
    if x < -tol or y < -tol:
        return False
    for coeffs, rel, rhs in constraints:
        if not point_satisfies(x, y, coeffs, rel, rhs, var_names, tol):
            return False
    return True


def _count_binding(x, y, constraints, var_names, tol=1e-6):
    v1, v2 = var_names
    count = 0
    for coeffs, rel, rhs in constraints:
        a, b = coeffs.get(v1, 0.0), coeffs.get(v2, 0.0)
        if abs(a * x + b * y - rhs) <= tol:
            count += 1
    if abs(x) <= tol: count += 1
    if abs(y) <= tol: count += 1
    return count


def _binding_labels(x, y, constraints, var_names, tol=1e-6):
    v1, v2 = var_names
    labels = []
    for i, (coeffs, rel, rhs) in enumerate(constraints):
        a, b = coeffs.get(v1, 0.0), coeffs.get(v2, 0.0)
        if abs(a * x + b * y - rhs) <= tol:
            labels.append(f"C{i+1}")
    if abs(x) <= tol: labels.append(f"{v1.lower()}=0")
    if abs(y) <= tol: labels.append(f"{v2.lower()}=0")
    return labels


def sh_clip(polygon, a, b, c):
    """Sutherland-Hodgman clip of polygon by half-plane ax + by <= c."""
    if not polygon:
        return []
    def inside(p):   return a * p[0] + b * p[1] <= c + 1e-9
    def edge_int(p1, p2):
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        denom = a * dx + b * dy
        if abs(denom) < 1e-12: return p1
        t = (c - a * p1[0] - b * p1[1]) / denom
        return (p1[0] + t * dx, p1[1] + t * dy)
    output, n = [], len(polygon)
    for i in range(n):
        curr, nxt = polygon[i], polygon[(i + 1) % n]
        c_in, n_in = inside(curr), inside(nxt)
        if c_in:
            output.append(curr)
            if not n_in: output.append(edge_int(curr, nxt))
        elif n_in:
            output.append(edge_int(curr, nxt))
    return output


def compute_graphical_data(sense, obj, constraints, var_names):
    """Solve a 2-variable LP graphically. Returns a rich dict with polygon,
    corner points, status, optimal solution, etc."""
    v1, v2 = var_names
    intercepts = [1]
    for coeffs, rel, rhs in constraints:
        a, b = coeffs.get(v1, 0.0), coeffs.get(v2, 0.0)
        if abs(a) > 1e-12: intercepts.append(abs(rhs / a))
        if abs(b) > 1e-12: intercepts.append(abs(rhs / b))
        intercepts.append(abs(rhs))
    plot_max = max(intercepts) * 1.5 + 1

    big = plot_max * 3
    polygon = [(0, 0), (big, 0), (big, big), (0, big)]
    for coeffs, rel, rhs in constraints:
        a, b = coeffs.get(v1, 0.0), coeffs.get(v2, 0.0)
        if rel in ('<=', '<'):    polygon = sh_clip(polygon,  a,  b,  rhs)
        elif rel in ('>=', '>'):  polygon = sh_clip(polygon, -a, -b, -rhs)
        elif rel == '=':
            polygon = sh_clip(polygon,  a,  b,  rhs + 1e-4)
            polygon = sh_clip(polygon, -a, -b, -rhs + 1e-4)

    obj_a, obj_b = obj.get(v1, 0), obj.get(v2, 0)
    parallel_con_idx = None
    for i, (coeffs, _, _) in enumerate(constraints):
        a, b = coeffs.get(v1, 0.0), coeffs.get(v2, 0.0)
        if abs(obj_a * b - obj_b * a) < 1e-8 and (abs(a) > 1e-12 or abs(b) > 1e-12):
            parallel_con_idx = i
            break

    all_lines = []
    for i, (coeffs, rel, rhs) in enumerate(constraints):
        all_lines.append((coeffs.get(v1, 0.0), coeffs.get(v2, 0.0), rhs, f"C{i+1}"))
    all_lines += [(1, 0, 0, f"{v1}=0"), (0, 1, 0, f"{v2}=0")]

    corners, seen = [], set()
    for i, j in itertools.combinations(range(len(all_lines)), 2):
        a1, b1, c1, l1 = all_lines[i]
        a2, b2, c2, l2 = all_lines[j]
        pt = line_intersect(a1, b1, c1, a2, b2, c2)
        if pt is None: continue
        x, y = pt
        key = (round(x, 6), round(y, 6))
        if key in seen: continue
        seen.add(key)
        if is_feasible(x, y, constraints, var_names):
            z = obj.get(v1, 0) * x + obj.get(v2, 0) * y
            bc = _count_binding(x, y, constraints, var_names)
            bl = _binding_labels(x, y, constraints, var_names)
            corners.append({'x': x + 0.0, 'y': y + 0.0, 'z': z + 0.0,
                            'binding': [l1, l2], 'binding_count': bc,
                            'binding_labels': bl, 'degenerate': bc > 2})
    corners.sort(key=lambda c: c['z'])

    base = dict(polygon=polygon, corners=corners, plot_max=plot_max,
                sense=sense, obj=obj, constraints=constraints,
                var_names=var_names, parallel_con_idx=parallel_con_idx)

    if not corners:
        return dict(**base, status='infeasible', optimal=None, optimal_z=None,
                    alt_edge=None, is_degenerate=False, opt_corners=[])

    z_vals = [c['z'] for c in corners]
    optimal_z = max(z_vals) if sense == 'max' else min(z_vals)
    opt_corners = [c for c in corners if abs(c['z'] - optimal_z) < 1e-6]
    optimal = (opt_corners[0]['x'], opt_corners[0]['y'])

    is_unbounded = any(
        (px > big * 0.8 or py > big * 0.8) and
        ((sense == 'max' and obj_a * px + obj_b * py > optimal_z + 1) or
         (sense == 'min' and obj_a * px + obj_b * py < optimal_z - 1))
        for px, py in polygon)

    is_degenerate = any(c['degenerate'] for c in corners)
    degenerate_at_optimal = any(c['degenerate'] for c in opt_corners)

    if is_unbounded:            status = 'unbounded'
    elif len(opt_corners) > 1:  status = 'alternative'
    elif degenerate_at_optimal: status = 'degenerate'
    else:                       status = 'optimal'

    alt_edge = None
    if status == 'alternative' and len(opt_corners) >= 2:
        alt_edge = ((opt_corners[0]['x'], opt_corners[0]['y']),
                    (opt_corners[1]['x'], opt_corners[1]['y']))

    return dict(**base, status=status, optimal=optimal, optimal_z=optimal_z,
                alt_edge=alt_edge, is_degenerate=is_degenerate,
                opt_corners=opt_corners)


# ══════════════════════════════════════════════════════════════════════════════
#  SIMPLEX SOLVER  (Big-M)
# ══════════════════════════════════════════════════════════════════════════════

class SimplexSolver:
    """Big-M simplex solver with full step-by-step tableau history."""

    MAX_ITERS = 60

    def __init__(self, sense, obj, constraints, var_names):
        self.sense = sense
        self.obj = obj
        self.constraints = constraints
        self.var_names = list(var_names)
        self.tableaus = []
        self.status = 'running'
        self.z_optimal = None
        self.solution = {}
        self._solve()

    def _solve(self):
        M = BIG_M
        n = len(self.var_names)
        m = len(self.constraints)

        all_vars = list(self.var_names)
        col_types = ['decision'] * n
        row_aux = {i: [] for i in range(m)}
        s_cnt = e_cnt = a_cnt = 0

        for i, (coeffs, rel, rhs) in enumerate(self.constraints):
            if rel in ('<=', '<'):
                s_cnt += 1
                row_aux[i].append((len(all_vars), 'slack'))
                all_vars.append(f's{s_cnt}')
                col_types.append('slack')
            elif rel in ('>=', '>'):
                e_cnt += 1
                row_aux[i].append((len(all_vars), 'surplus'))
                all_vars.append(f'e{e_cnt}')
                col_types.append('surplus')
                a_cnt += 1
                row_aux[i].append((len(all_vars), 'artificial'))
                all_vars.append(f'a{a_cnt}')
                col_types.append('artificial')
            elif rel == '=':
                a_cnt += 1
                row_aux[i].append((len(all_vars), 'artificial'))
                all_vars.append(f'a{a_cnt}')
                col_types.append('artificial')

        n_total = len(all_vars)
        T = np.zeros((m + 1, n_total + 1))

        for i, (coeffs, rel, rhs) in enumerate(self.constraints):
            for j, v in enumerate(self.var_names):
                T[i, j] = coeffs.get(v, 0.0)
            for col_idx, vtype in row_aux[i]:
                if vtype == 'slack':        T[i, col_idx] =  1.0
                elif vtype == 'surplus':    T[i, col_idx] = -1.0
                elif vtype == 'artificial': T[i, col_idx] =  1.0
            T[i, -1] = rhs

        basis = [-1] * m
        for i in range(m):
            for col_idx, vtype in row_aux[i]:
                if vtype in ('slack', 'artificial'):
                    basis[i] = col_idx

        for j, v in enumerate(self.var_names):
            c = self.obj.get(v, 0.0)
            T[m, j] = -c if self.sense == 'max' else c

        for i in range(m):
            for col_idx, vtype in row_aux[i]:
                if vtype == 'artificial':
                    T[m, col_idx] = M

        # Big-M elimination: clear artificials from z-row using their rows
        for i, bv in enumerate(basis):
            if bv >= 0 and col_types[bv] == 'artificial':
                T[m] -= T[m, bv] * T[i]

        self._save(T, basis, all_vars, col_types,
                   pivot_col=None, pivot_row=None, ratios=None,
                   entering=None, leaving=None, row_ops=None,
                   message="Initial tableau — Big-M applied to z-row. "
                           "Look for the most negative value in the z-row to choose the entering variable.")

        for iteration in range(self.MAX_ITERS):
            z_row = T[m, :-1]
            pivot_col = int(np.argmin(z_row))
            if z_row[pivot_col] >= -1e-8:
                break

            ratios = []
            pivot_row = -1
            min_ratio = float('inf')
            for i in range(m):
                elem = T[i, pivot_col]
                if elem > 1e-8:
                    r = T[i, -1] / elem
                    ratios.append(round(r, 6))
                    if r < min_ratio - 1e-10:
                        min_ratio = r
                        pivot_row = i
                    elif abs(r - min_ratio) < 1e-10 and pivot_row == -1:
                        min_ratio = r
                        pivot_row = i
                else:
                    ratios.append(None)

            if pivot_row == -1:
                self._save(T, basis, all_vars, col_types,
                           pivot_col=pivot_col, pivot_row=None, ratios=ratios,
                           entering=all_vars[pivot_col], leaving=None, row_ops=None,
                           message="UNBOUNDED: pivot column has no positive entries.")
                self.status = 'unbounded'
                return

            entering = all_vars[pivot_col]
            leaving  = all_vars[basis[pivot_row]]

            self._save(T, basis, all_vars, col_types,
                       pivot_col=pivot_col, pivot_row=pivot_row, ratios=ratios,
                       entering=entering, leaving=leaving, row_ops=None,
                       message=f"SELECT PIVOT  |  Entering: {entering.lower()} "
                               f"(most negative z-row = {_fmt_cell(T[m, pivot_col])})  |  "
                               f"Leaving: {leaving.lower()} (min ratio = {_fmt_cell(min_ratio)})  |  "
                               f"Pivot element = {_fmt_cell(T[pivot_row, pivot_col])}")

            pivot_elem = T[pivot_row, pivot_col]
            ops = []
            p = pivot_row
            if abs(pivot_elem - 1.0) > 1e-9:
                ops.append(f"R{p+1} / {_fmt_cell(pivot_elem)}  ->  new R{p+1}")
            else:
                ops.append(f"R{p+1} stays (pivot element = 1)")
            for i in range(m + 1):
                if i == p: continue
                coeff = T[i, pivot_col]
                if abs(coeff) < 1e-9: continue
                row_label = "Rz" if i == m else f"R{i+1}"
                if coeff > 0:
                    ops.append(f"{row_label} <- {row_label} - ({_fmt_cell(coeff)}) x R{p+1}")
                else:
                    ops.append(f"{row_label} <- {row_label} + ({_fmt_cell(abs(coeff))}) x R{p+1}")

            T[pivot_row] = T[pivot_row] / pivot_elem
            for i in range(m + 1):
                if i != pivot_row:
                    T[i] -= T[i, pivot_col] * T[pivot_row]
            basis[pivot_row] = pivot_col

            self._save(T, basis, all_vars, col_types,
                       pivot_col=pivot_col, pivot_row=pivot_row, ratios=None,
                       entering=entering, leaving=leaving, row_ops=ops,
                       message=f"AFTER PIVOT {iteration+1}  |  "
                               f"{entering.lower()} entered, {leaving.lower()} left  |  "
                               f"z = {_fmt_cell(T[m, -1])}")

        infeasible = any(
            col_types[basis[i]] == 'artificial' and T[i, -1] > 1e-6
            for i in range(m))

        if infeasible:
            msg = "INFEASIBLE: an artificial variable remains in the basis with nonzero value."
            self.status = 'infeasible'
        else:
            W = T[m, -1]
            z_star = W if self.sense == 'max' else -W
            msg = f"OPTIMAL  z* = {z_star:.6g}"
            self.status = 'optimal'
            self.z_optimal = z_star
            for j, v in enumerate(self.var_names):
                self.solution[v] = 0.0
            for i in range(m):
                bv = basis[i]
                if bv < n:
                    self.solution[self.var_names[bv]] = round(T[i, -1], 8)

        self._save(T, basis, all_vars, col_types,
                   pivot_col=None, pivot_row=None, ratios=None,
                   entering=None, leaving=None, row_ops=None, message=msg)

    def _save(self, T, basis, all_vars, col_types,
              pivot_col, pivot_row, ratios, entering, leaving, row_ops, message):
        self.tableaus.append({
            'matrix':    T.copy(),
            'basis':     list(basis),
            'all_vars':  list(all_vars),
            'col_types': list(col_types),
            'pivot_col': pivot_col,
            'pivot_row': pivot_row,
            'ratios':    list(ratios) if ratios is not None else None,
            'entering':  entering,
            'leaving':   leaving,
            'row_ops':   list(row_ops) if row_ops is not None else None,
            'message':   message,
        })

    def standard_form_text(self):
        lines = []
        sense_word = "Minimize" if self.sense == 'min' else "Maximize"
        obj_str = _fmt_expr(self.obj, self.var_names)
        lines.append("ORIGINAL PROBLEM")
        lines.append(f"  {sense_word}  z = {obj_str}")
        lines.append("  Subject to:")
        for i, (coeffs, rel, rhs) in enumerate(self.constraints):
            lines.append(f"    C{i+1}:  {_fmt_expr(coeffs, self.var_names)} {rel} {rhs:g}")
        lines.append(f"    {', '.join(v.lower() for v in self.var_names)} >= 0")
        return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
#  INTERACTIVE HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _bfs_from_tab(tab, var_names):
    """Extract decision-variable values from a tableau dict. Returns dict."""
    T        = tab['matrix']
    basis    = tab['basis']
    all_vars = tab['all_vars']
    vals = {v: 0.0 for v in var_names}
    for i, bv_idx in enumerate(basis):
        if 0 <= bv_idx < len(all_vars):
            vname = all_vars[bv_idx]
            if vname in vals:
                vals[vname] = round(float(T[i, -1]), 8)
    return vals


def _cell_explanation(row, col, tab, sense, var_names):
    """Return a plain-English explanation for tableau cell (row, col)."""
    T         = tab['matrix']
    basis     = tab['basis']
    all_vars  = tab['all_vars']
    col_types = tab['col_types']
    m         = len(basis)
    n_cols    = T.shape[1]
    val       = T[row, col]
    vs        = _fmt_cell(val)

    # RHS column
    if col == n_cols - 1:
        if row == m:
            if sense == 'max':
                return (f"z-row RHS = {vs}. This is the current objective value z. "
                        f"It increases toward z* with each pivot.")
            else:
                return (f"z-row RHS = {vs} (internally stored as -z). "
                        f"True objective = {_fmt_cell(-val)}. "
                        f"We minimize z by driving this toward -z*.")
        bv = all_vars[basis[row]].lower() if 0 <= basis[row] < len(all_vars) else '?'
        ct = col_types[basis[row]] if 0 <= basis[row] < len(col_types) else ''
        notes = {
            'slack':      f" Slack variable — {vs} units of unused capacity in constraint {row+1}.",
            'surplus':    f" Surplus variable — {vs} units above the constraint {row+1} RHS.",
            'artificial': " WARNING: artificial variable still basic. If nonzero at optimality, problem is INFEASIBLE.",
            'decision':   f" Decision variable {bv} = {vs} at the current BFS.",
        }
        return f"Row {row+1} RHS: {bv} = {vs}.{notes.get(ct, '')}"

    vname = all_vars[col].lower() if col < len(all_vars) else '?'

    # z-row
    if row == m:
        if abs(val) < 1e-9:
            if any(basis[i] == col for i in range(m)):
                return (f"z-row[{vname}] = 0. {vname} is currently BASIC. "
                        f"Basic variables always have z-row coefficient = 0.")
            return f"z-row[{vname}] = 0. No improvement from entering {vname}."
        if val < -1e-8:
            gain = _fmt_cell(abs(val))
            if sense == 'max':
                return (f"z-row[{vname}] = {vs}  <- NEGATIVE candidate. "
                        f"Each unit of {vname} added improves z by {gain}. "
                        f"The most negative z-row value gives the best improvement per step (Dantzig rule).")
            else:
                return (f"z-row[{vname}] = {vs}  <- NEGATIVE candidate (minimization). "
                        f"Entering {vname} reduces z by {gain} per unit.")
        return (f"z-row[{vname}] = {vs} (non-negative). "
                f"Entering {vname} would not improve the objective. "
                f"When ALL z-row values >= 0, the current BFS is OPTIMAL.")

    # Constraint body cell
    bv  = all_vars[basis[row]].lower() if 0 <= basis[row] < len(all_vars) else '?'
    rhs = T[row, -1]
    if abs(val) < 1e-9:
        return (f"Row {row+1} (BV: {bv}), column {vname}: coefficient = 0. "
                f"{vname} does not appear in this constraint — no ratio to compute.")
    if val > 1e-8:
        ratio = rhs / val
        min_r = min((T[k, -1] / T[k, col]) for k in range(m) if T[k, col] > 1e-8)
        is_min = abs(ratio - min_r) < 1e-6
        return (f"Row {row+1} (BV: {bv}), column {vname}: coefficient = {vs}. "
                f"Ratio test: {_fmt_cell(rhs)} / {vs} = {_fmt_cell(ratio)}. "
                + (f"<- MINIMUM ratio — {bv} leaves the basis if {vname} enters." if is_min
                   else f"Not the minimum ratio (min = {_fmt_cell(min_r)}). "
                        f"Choosing this row leaves a better BFS on the table."))
    return (f"Row {row+1} (BV: {bv}), column {vname}: coefficient = {vs} (negative). "
            f"Negative entries are SKIPPED in the min-ratio test — "
            f"they would make {vname} negative after pivoting (infeasible).")


def _optimal_pivot_info(T, m):
    """Return (best_pivot_col, best_pivot_row, ratios) for the current T."""
    z_row = T[m, :-1]
    pivot_col = int(np.argmin(z_row))
    if z_row[pivot_col] >= -1e-8:
        return None, None, None
    ratios, pivot_row, min_ratio = [], -1, float('inf')
    for i in range(m):
        elem = T[i, pivot_col]
        if elem > 1e-8:
            r = T[i, -1] / elem
            ratios.append(r)
            if r < min_ratio - 1e-10:
                min_ratio, pivot_row = r, i
        else:
            ratios.append(None)
    return pivot_col, (pivot_row if pivot_row >= 0 else None), ratios


def _apply_pivot_to_T(T, basis, pivot_row, pivot_col):
    """
    Apply one simplex pivot.
    Returns (new_T, new_basis, row_ops, warning_str).
    warning_str is None for a valid pivot; otherwise explains the problem.
    """
    m    = len(basis)
    T    = T.copy()
    basis = list(basis)
    pivot_elem = T[pivot_row, pivot_col]
    warning = None

    if abs(pivot_elem) < 1e-12:
        return T, basis, [], "Cannot pivot: element is zero."

    if pivot_elem < 0:
        new_rhs = T[pivot_row, -1] / pivot_elem
        warning = (f"Pivot element is negative ({_fmt_cell(pivot_elem)}). "
                   f"After the pivot the leaving variable's RHS = {_fmt_cell(new_rhs)} < 0 "
                   f"(infeasible). The min-ratio test exists to prevent exactly this.")

    ops = []
    if abs(pivot_elem - 1.0) > 1e-9:
        ops.append(f"R{pivot_row+1} / {_fmt_cell(pivot_elem)}  ->  new R{pivot_row+1}")
    else:
        ops.append(f"R{pivot_row+1} stays (pivot element already = 1)")

    for i in range(m + 1):
        if i == pivot_row: continue
        coeff = T[i, pivot_col]
        if abs(coeff) < 1e-9: continue
        row_label = "Rz" if i == m else f"R{i+1}"
        if coeff > 0:
            ops.append(f"{row_label} <- {row_label} - ({_fmt_cell(coeff)}) x R{pivot_row+1}")
        else:
            ops.append(f"{row_label} <- {row_label} + ({_fmt_cell(abs(coeff))}) x R{pivot_row+1}")

    T[pivot_row] /= pivot_elem
    for i in range(m + 1):
        if i != pivot_row:
            T[i] -= T[i, pivot_col] * T[pivot_row]
    basis[pivot_row] = pivot_col
    return T, basis, ops, warning
