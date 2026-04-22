/**
 * DiscoveryGraph — the graph as the student is earning it.
 *
 * Progressive reveal:
 *   - Axes + grid always visible
 *   - For each constraint the student has solved the intercepts for:
 *     the line draws itself (SVG stroke-dasharray animation) with the
 *     reward-pop feel
 *   - For each side the student has picked: half-plane shades in
 *   - When all sides are set: the intersection fills as the "feasible
 *     region" with a brighter overlay
 *
 * No objective line in 2a; that's Phase 2b's discovery moment.
 */

import { useMemo } from 'react';
import { LPDraft } from './guidedTypes';
import { CONSTRAINT_COLORS, colorFor, colorForFill } from './constraintColors';
import type { QuestionHighlight } from '../../data/tutorialScripts';

interface Props {
  draft: LPDraft;
  /** Which constraints have had their LINE revealed (intercepts earned). */
  linesDrawn: Set<number>;
  /** Which constraints have had their FEASIBLE SIDE chosen. */
  sideDrawnFor: Set<number>;
  /** Whether the final feasible intersection has been revealed. */
  feasibleRegionRevealed: boolean;
  /** Live objective-line z value during the drag-to-discover phase. null hides the line. */
  objectiveZ?: number | null;
  /** Whether the student has confirmed the optimum (show optimum marker). */
  optimumConfirmed?: boolean;
  /** Target optimum value (to place the marker). */
  optimumTarget?: number;
  /**
   * Current basic feasible solution point in (x₁, x₂) space. When set, a
   * dot is drawn there and a dashed perpendicular reaches out to each
   * constraint line — the perpendicular's length IS the slack value.
   * Makes "binding ⇔ slack = 0" visible geometrically.
   */
  bfsPoint?: { x: number; y: number } | null;
  /**
   * Once slacks have been introduced, fade the half-plane shading and
   * lean on the LINES themselves — because `=` pins each constraint to
   * its line, and everything that used to be "inside the region" has
   * been collected into the slack variable. The perpendicular-from-bfs
   * still shows the slack as a geometric distance.
   */
  slacksMode?: boolean;
  /** Constraint-wide highlight — emphasize one constraint line, dim the rest. */
  highlight?: QuestionHighlight | null;

  /**
   * Entering-variable direction arrow. When set, draw an arrow from the
   * current BFS point along the axis of the named variable — so picking
   * "x₂ enters" shows up as "slide up the x₂ axis from here" on the graph.
   * This is the graph-language counterpart to the tableau's entering-column
   * click in Phase 4 pivots: one action, two views.
   */
  enteringDirection?: 'x1' | 'x2' | null;

  // ── Vertex-selection props (Phase 6: basis = vertex) ──────────────────
  /** When true, the corners of the feasible polygon become clickable dots. */
  vertexSelectable?: boolean;
  /** Currently selected vertex — matched by coords. */
  selectedVertex?: FeasibleVertex | null;
  /** Called with a vertex descriptor when the student clicks a corner. */
  onVertexSelect?: (v: FeasibleVertex) => void;
  /**
   * When a click-vertex question is active, the target corner's dot
   * gets an attention-pulse to invite the click. null = no active
   * click-vertex question → no pulse.
   */
  activeClickVertexTarget?: { x: number; y: number } | null;
}

/**
 * One corner of the feasible polygon, with the algebraic information the
 * Phase 6 walkthrough needs: which constraints are tight at this corner
 * (their slacks are 0, i.e. non-basic) and which decision variables are
 * zero (also non-basic). The basis at this vertex is everything NOT in
 * those lists.
 */
export interface FeasibleVertex {
  x: number;
  y: number;
  /** Indices of constraints that are tight (ax+by = rhs) at this corner. */
  tightConstraints: number[];
  /** Decision-variable indices (0-based) that equal zero at this corner. */
  zeroDecisionVars: number[];
}

// Dimensions
const W = 420, H = 420;
const PAD = 40;

export default function DiscoveryGraph({
  draft, linesDrawn, sideDrawnFor, feasibleRegionRevealed,
  objectiveZ, optimumConfirmed, optimumTarget, bfsPoint,
  slacksMode = false, highlight,
  vertexSelectable = false, selectedVertex = null, onVertexSelect,
  activeClickVertexTarget = null,
  enteringDirection = null,
}: Props) {
  const focusedConstraint =
    highlight?.target === 'constraint' ? highlight.constraintIndex : -1;
  // Work out the axis extents from whatever constraints have coefficients +
  // RHS set so far. Fall back to a 0..20 window if nothing yet.
  const { maxX, maxY } = useMemo(() => {
    let mx = 10, my = 10;
    draft.constraints.forEach(c => {
      if (c.rhs == null) return;
      const [a, b] = c.coefficients;
      if (a && a > 0) mx = Math.max(mx, c.rhs / a);
      if (b && b > 0) my = Math.max(my, c.rhs / b);
    });
    // Pad 15% for headroom
    return { maxX: mx * 1.15, maxY: my * 1.15 };
  }, [draft]);

  const scaleX = (x: number) => PAD + (x / maxX) * (W - 2 * PAD);
  const scaleY = (y: number) => H - PAD - (y / maxY) * (H - 2 * PAD);

  // Compute each constraint's line endpoints within the viewport
  const lineFor = (idx: number) => {
    const c = draft.constraints[idx];
    if (!c || c.rhs == null) return null;
    const [a, b] = c.coefficients;
    if (a == null || b == null) return null;

    // Two endpoints of the line within viewport
    const pts: { x: number; y: number }[] = [];
    if (Math.abs(b) > 1e-9) {
      const yAtX0 = c.rhs / b;
      const yAtXMax = (c.rhs - a * maxX) / b;
      pts.push({ x: 0, y: yAtX0 });
      pts.push({ x: maxX, y: yAtXMax });
    } else if (Math.abs(a) > 1e-9) {
      const xFixed = c.rhs / a;
      pts.push({ x: xFixed, y: 0 });
      pts.push({ x: xFixed, y: maxY });
    }
    return pts.length === 2 ? pts : null;
  };

  // For shading: build the polygon of the half-plane within the viewport.
  // Simple approach: construct a rectangle polygon of the visible quadrant
  // (0,0) to (maxX,maxY) and clip it against ax + by ≤ rhs (or ≥ depending on side).
  const halfPlanePolygon = (idx: number): string | null => {
    const c = draft.constraints[idx];
    if (!c || c.rhs == null) return null;
    const [a, b] = c.coefficients;
    if (a == null || b == null) return null;
    const rhs = c.rhs;

    const originIsFeasible = (a * 0 + b * 0) <= rhs;
    const targetFeasibleAtOrigin = originIsFeasible; // for '<=' constraints + "below" side

    // Start with the non-negative quadrant rectangle
    const rect: { x: number; y: number }[] = [
      { x: 0, y: 0 }, { x: maxX, y: 0 }, { x: maxX, y: maxY }, { x: 0, y: maxY },
    ];
    // Clip against ax + by ≤ rhs (or the flipped side)
    const evalSigned = (p: { x: number; y: number }) => a * p.x + b * p.y - rhs;
    // If student picked "below" (origin side), we want points with ax + by ≤ rhs
    // If student picked "above", we want points with ax + by ≥ rhs
    // For correctness check we stored side as 'below'/'above' relative to origin.
    const wantLeqSide = targetFeasibleAtOrigin; // below = origin side → leq direction
    const inside = (p: { x: number; y: number }) =>
      wantLeqSide ? evalSigned(p) <= 1e-9 : evalSigned(p) >= -1e-9;

    // Sutherland-Hodgman against a single edge (the line itself)
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < rect.length; i++) {
      const curr = rect[i];
      const prev = rect[(i - 1 + rect.length) % rect.length];
      const cIn = inside(curr);
      const pIn = inside(prev);
      if (pIn !== cIn) {
        // intersection
        const t = (c.rhs - a * prev.x - b * prev.y) / (a * (curr.x - prev.x) + b * (curr.y - prev.y));
        out.push({
          x: prev.x + t * (curr.x - prev.x),
          y: prev.y + t * (curr.y - prev.y),
        });
      }
      if (cIn) out.push(curr);
    }
    if (out.length === 0) return null;
    return out.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ');
  };

  // Intersection of all half-planes → the feasible region polygon.
  // Returns both a scaled-string for the SVG polygon AND the raw corner
  // list in problem coordinates, annotated with which constraints are
  // tight and which decision vars are zero at each corner. The corner
  // list is what Phase 6 uses to make vertices clickable and to show
  // "the basis at this vertex is X".
  const feasibleData = useMemo(() => {
    if (!feasibleRegionRevealed) return null;
    let poly: { x: number; y: number }[] = [
      { x: 0, y: 0 }, { x: maxX, y: 0 }, { x: maxX, y: maxY }, { x: 0, y: maxY },
    ];
    for (let idx = 0; idx < draft.constraints.length; idx++) {
      const c = draft.constraints[idx];
      if (!c || c.rhs == null) return null;
      const [a, b] = c.coefficients;
      if (a == null || b == null) return null;
      const rhs = c.rhs;
      const evalSigned = (p: { x: number; y: number }) => a * p.x + b * p.y - rhs;
      const inside = (p: { x: number; y: number }) => evalSigned(p) <= 1e-9;
      const next: { x: number; y: number }[] = [];
      for (let i = 0; i < poly.length; i++) {
        const curr = poly[i];
        const prev = poly[(i - 1 + poly.length) % poly.length];
        const cIn = inside(curr);
        const pIn = inside(prev);
        if (pIn !== cIn) {
          const t = (rhs - a * prev.x - b * prev.y) / (a * (curr.x - prev.x) + b * (curr.y - prev.y));
          next.push({ x: prev.x + t * (curr.x - prev.x), y: prev.y + t * (curr.y - prev.y) });
        }
        if (cIn) next.push(curr);
      }
      poly = next;
      if (poly.length === 0) return null;
    }

    // Deduplicate near-identical corners (clipping can produce them).
    const unique: { x: number; y: number }[] = [];
    for (const p of poly) {
      if (!unique.some(q => Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6)) {
        unique.push(p);
      }
    }

    // For each corner, identify which constraints are tight and which
    // decision vars are zero — that's the non-basic set at that vertex.
    const vertices: FeasibleVertex[] = unique.map(p => {
      const tightConstraints: number[] = [];
      draft.constraints.forEach((c, i) => {
        if (c.rhs == null) return;
        const a = c.coefficients[0], b = c.coefficients[1];
        if (a == null || b == null) return;
        if (Math.abs(a * p.x + b * p.y - c.rhs) < 1e-6) tightConstraints.push(i);
      });
      const zeroDecisionVars: number[] = [];
      if (Math.abs(p.x) < 1e-6) zeroDecisionVars.push(0);
      if (Math.abs(p.y) < 1e-6) zeroDecisionVars.push(1);
      return { x: p.x, y: p.y, tightConstraints, zeroDecisionVars };
    });

    return {
      pointsStr: unique.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' '),
      vertices,
    };
  }, [draft, feasibleRegionRevealed, maxX, maxY]);

  const feasiblePolygon = feasibleData?.pointsStr ?? null;
  const feasibleVertices = feasibleData?.vertices ?? [];

  // Tick marks
  const xStep = maxX <= 15 ? 2 : maxX <= 40 ? 5 : 10;
  const yStep = maxY <= 15 ? 2 : maxY <= 40 ? 5 : 10;
  const xTicks = Array.from({ length: Math.floor(maxX / xStep) + 1 }, (_, i) => i * xStep);
  const yTicks = Array.from({ length: Math.floor(maxY / yStep) + 1 }, (_, i) => i * yStep);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid */}
      {xTicks.map(x => (
        <line key={`gx-${x}`} x1={scaleX(x)} y1={scaleY(0)} x2={scaleX(x)} y2={scaleY(maxY)}
              stroke="#1e293b" strokeWidth="1" />
      ))}
      {yTicks.map(y => (
        <line key={`gy-${y}`} x1={scaleX(0)} y1={scaleY(y)} x2={scaleX(maxX)} y2={scaleY(y)}
              stroke="#1e293b" strokeWidth="1" />
      ))}

      {/* Axes */}
      <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(maxX)} y2={scaleY(0)} stroke="#64748b" strokeWidth="2" />
      <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(0)} y2={scaleY(maxY)} stroke="#64748b" strokeWidth="2" />

      {/* Axis labels */}
      <text x={scaleX(maxX) - 10} y={scaleY(0) - 6} fontSize="13" textAnchor="end" fill="#94a3b8" fontWeight="600">x₁</text>
      <text x={scaleX(0) + 6} y={scaleY(maxY) + 10} fontSize="13" fill="#94a3b8" fontWeight="600">x₂</text>

      {/* Tick labels */}
      {xTicks.map(x => (
        <text key={`xt-${x}`} x={scaleX(x)} y={scaleY(0) + 16} fontSize="11" textAnchor="middle" fill="#94a3b8">{x}</text>
      ))}
      {yTicks.map(y => (
        y === 0 ? null :
        <text key={`yt-${y}`} x={scaleX(0) - 8} y={scaleY(y) + 4} fontSize="11" textAnchor="end" fill="#94a3b8">{y}</text>
      ))}

      {/* Half-plane shading (per-constraint). When slacks arrive, we pin
          each constraint to its line (= rhs), so the shading fades way
          back — the lines are now the main event. */}
      {Array.from(sideDrawnFor).map(idx => {
        const poly = halfPlanePolygon(idx);
        if (!poly) return null;
        const color = CONSTRAINT_COLORS[idx % CONSTRAINT_COLORS.length];
        const fo = slacksMode ? 0.04 : feasibleRegionRevealed ? 0.08 : 0.18;
        return (
          <polygon
            key={`shade-${idx}`}
            points={poly}
            fill={color}
            fillOpacity={fo}
            className="animate-region-fade"
            style={{ transition: 'fill-opacity 600ms ease' }}
          />
        );
      })}

      {/* Feasible region overlay (after revealed). Also fades in slacksMode. */}
      {feasiblePolygon && (
        <polygon
          points={feasiblePolygon}
          fill="#06b6d4"
          fillOpacity={slacksMode ? 0.08 : 0.28}
          stroke="#06b6d4"
          strokeWidth="2"
          className="animate-fill-pop"
          style={{ transition: 'fill-opacity 600ms ease' }}
        />
      )}

      {/* Constraint lines (drawn-in animation). In slacksMode the stroke
          gets thicker and the label switches to "= rhs" to emphasize that
          the constraint is now pinned to the line. */}
      {Array.from(linesDrawn).map(idx => {
        const pts = lineFor(idx);
        if (!pts) return null;
        const color = CONSTRAINT_COLORS[idx % CONSTRAINT_COLORS.length];
        const [a, b] = [pts[0], pts[1]];
        const dx = scaleX(b.x) - scaleX(a.x);
        const dy = scaleY(b.y) - scaleY(a.y);
        const length = Math.hypot(dx, dy);
        const constraint = draft.constraints[idx];
        const rhsLabel = constraint?.rhs != null ? fmt(constraint.rhs) : '?';
        // Constraint-wide highlight: matching line boosts its stroke and
        // stays full-opacity; non-matching lines dim to 35% so the student's
        // eye goes to the one under discussion.
        const focused = focusedConstraint === idx;
        const dimmed = focusedConstraint !== -1 && !focused;
        const baseWidth = slacksMode ? 4 : 3;
        const strokeW = focused ? baseWidth + 2 : baseWidth;
        const lineOpacity = dimmed ? 0.35 : 1;
        return (
          <g key={`line-${idx}`} style={{ opacity: lineOpacity, transition: 'opacity 300ms ease' }}>
            <line
              x1={scaleX(a.x)} y1={scaleY(a.y)} x2={scaleX(b.x)} y2={scaleY(b.y)}
              stroke={color}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={length}
              strokeDashoffset={length}
              style={{
                animation: `line-draw 700ms 120ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
                transition: 'stroke-width 400ms ease',
              }}
            />
            {/* Label near the middle of the line */}
            <text
              x={scaleX((a.x + b.x) / 2) + 6}
              y={scaleY((a.y + b.y) / 2) - 6}
              fontSize={slacksMode ? 13 : 12}
              fill={color}
              fontWeight="700"
              className="animate-fill-pop"
            >
              {slacksMode ? `C${idx + 1} pinned: = ${rhsLabel}` : `C${idx + 1}`}
            </text>
          </g>
        );
      })}

      {/* Objective line (interactive) — parallel-shift as the student drags z */}
      {typeof objectiveZ === 'number' && draft.objectiveCoefficients[0] != null && draft.objectiveCoefficients[1] != null && (() => {
        const c1 = draft.objectiveCoefficients[0] as number;
        const c2 = draft.objectiveCoefficients[1] as number;
        // Line: c1·x1 + c2·x2 = z. Find endpoints within viewport.
        // Point 1: at x1 = 0 → x2 = z/c2.  Point 2: at x2 = 0 → x1 = z/c1.
        // If either is outside the viewport, clip to x1 = maxX or x2 = maxY.
        const p1 = { x: 0, y: c2 !== 0 ? objectiveZ / c2 : 0 };
        const p2 = { x: c1 !== 0 ? objectiveZ / c1 : 0, y: 0 };
        // A second render at x1 = maxX (for lines that extend past the viewport)
        const p3 = { x: maxX, y: c2 !== 0 ? (objectiveZ - c1 * maxX) / c2 : 0 };
        const p4 = { x: c1 !== 0 ? (objectiveZ - c2 * maxY) / c1 : 0, y: maxY };

        // Use the pair that's most inside the viewport
        const candidates = [p1, p2, p3, p4].filter(p =>
          p.x >= -0.01 && p.x <= maxX + 0.01 &&
          p.y >= -0.01 && p.y <= maxY + 0.01
        );
        if (candidates.length < 2) return null;
        // Pick two endpoints farthest apart
        let best: [typeof candidates[0], typeof candidates[0]] | null = null;
        let bestD = -1;
        for (let i = 0; i < candidates.length; i++) {
          for (let j = i + 1; j < candidates.length; j++) {
            const d = Math.hypot(candidates[i].x - candidates[j].x, candidates[i].y - candidates[j].y);
            if (d > bestD) { bestD = d; best = [candidates[i], candidates[j]]; }
          }
        }
        if (!best) return null;

        // Is any feasible point at or above this z? For now just use the
        // optimumTarget heuristic: if student is within tolerance, tint green;
        // past target (outside feasible), tint red.
        const lineIsInFeasible = optimumTarget != null
          ? objectiveZ <= optimumTarget + 1
          : true;
        const strokeColor = lineIsInFeasible ? '#fb923c' : '#ef4444';

        return (
          <g>
            <line
              x1={scaleX(best[0].x)} y1={scaleY(best[0].y)}
              x2={scaleX(best[1].x)} y2={scaleY(best[1].y)}
              stroke={strokeColor} strokeWidth="3" strokeDasharray="8,4"
              strokeLinecap="round"
            />
            {/* z label floating near the line */}
            <rect
              x={scaleX((best[0].x + best[1].x) / 2) - 26}
              y={scaleY((best[0].y + best[1].y) / 2) - 12}
              width="52" height="20" rx="10"
              fill={strokeColor} fillOpacity="0.95"
            />
            <text
              x={scaleX((best[0].x + best[1].x) / 2)}
              y={scaleY((best[0].y + best[1].y) / 2) + 3}
              fontSize="12" fontWeight="700" textAnchor="middle" fill="#ffffff"
            >
              z = {Math.round(objectiveZ)}
            </text>
          </g>
        );
      })()}

      {/* Current BFS point + slack perpendiculars — geometric view of sᵢ */}
      {bfsPoint && (() => {
        const px = bfsPoint.x;
        const py = bfsPoint.y;
        // For each constraint with a defined line, draw a dashed segment from
        // the point to the closest point on the line. The length of that
        // segment IS the slack (scaled by the line's normal magnitude). We
        // label each segment with the slack value so the student can connect
        // "perpendicular distance on the graph" ↔ "sᵢ value in the bucket".
        return (
          <g>
            {draft.constraints.map((c, idx) => {
              if (!linesDrawn.has(idx)) return null;
              if (c.rhs == null) return null;
              const a = c.coefficients[0];
              const b = c.coefficients[1];
              if (a == null || b == null) return null;
              const rhs = c.rhs;
              const denom = a * a + b * b;
              if (denom < 1e-12) return null;
              const signed = a * px + b * py - rhs;   // negative when inside (≤)
              const slack = Math.max(0, -signed);     // slack = rhs - (a·x + b·y) if nonneg
              const footX = px - (signed * a) / denom;
              const footY = py - (signed * b) / denom;
              // If point is effectively on the line, nothing to draw
              if (slack < 1e-6) return null;
              const color = colorFor(idx);
              // Midpoint for label
              const midX = (px + footX) / 2;
              const midY = (py + footY) / 2;
              return (
                <g key={`slack-${idx}`}>
                  <line
                    x1={scaleX(px)} y1={scaleY(py)}
                    x2={scaleX(footX)} y2={scaleY(footY)}
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                    opacity="0.75"
                  />
                  {/* Tiny tick at the foot */}
                  <circle cx={scaleX(footX)} cy={scaleY(footY)} r="3" fill={color} opacity="0.8" />
                  {/* Floating label — in slacksMode we call it a TAIL
                      because that word ties to the Canvas equation where
                      the slack term just slid in. */}
                  <rect
                    x={scaleX(midX) - (slacksMode ? 38 : 22)} y={scaleY(midY) - 9}
                    width={slacksMode ? 76 : 44} height="16" rx="8"
                    fill={colorForFill(idx, 0.92)}
                  />
                  <text
                    x={scaleX(midX)} y={scaleY(midY) + 3}
                    fontSize="10" fontWeight="700" textAnchor="middle" fill="#ffffff"
                  >
                    {slacksMode ? `tail s${idx + 1} = ${fmt(slack)}` : `s${idx + 1}=${fmt(slack)}`}
                  </text>
                </g>
              );
            })}
            {/* Dot at the BFS point itself */}
            <circle
              cx={scaleX(px)} cy={scaleY(py)} r="6"
              fill="#f8fafc" stroke="#0f172a" strokeWidth="2"
            />
          </g>
        );
      })()}

      {/* Entering-direction arrow — when the student has picked an entering
          variable in the tableau, draw an arrow from the current vertex in
          that variable's axis direction on the graph. This is the graph-
          language description of the same click: picking a column in the
          z-row IS picking a direction to slide across the feasible region. */}
      {bfsPoint && enteringDirection && (() => {
        const px = bfsPoint.x;
        const py = bfsPoint.y;
        // Choose an end point that goes far along the named axis but stays
        // visible on the graph (we'll clip to the viewport).
        const endX = enteringDirection === 'x1' ? Math.min(px + 12, maxX) : px;
        const endY = enteringDirection === 'x2' ? Math.min(py + 12, maxY) : py;
        if (Math.abs(endX - px) < 0.1 && Math.abs(endY - py) < 0.1) return null;
        const sx = scaleX(px);
        const sy = scaleY(py);
        const ex = scaleX(endX);
        const ey = scaleY(endY);
        // Small arrowhead
        const dx = ex - sx;
        const dy = ey - sy;
        const len = Math.hypot(dx, dy);
        if (len < 1) return null;
        const ux = dx / len;
        const uy = dy / len;
        const headBack = 10;
        const headSide = 5;
        const hx1 = ex - ux * headBack - uy * headSide;
        const hy1 = ey - uy * headBack + ux * headSide;
        const hx2 = ex - ux * headBack + uy * headSide;
        const hy2 = ey - uy * headBack - ux * headSide;
        return (
          <g className="animate-attention-pulse">
            <line
              x1={sx} y1={sy} x2={ex} y2={ey}
              stroke="#fb923c" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="6,4"
            />
            <polygon
              points={`${ex},${ey} ${hx1},${hy1} ${hx2},${hy2}`}
              fill="#fb923c"
            />
            <rect
              x={(sx + ex) / 2 - 40} y={(sy + ey) / 2 - 26}
              width="80" height="18" rx="9"
              fill="#fb923c" fillOpacity="0.9"
            />
            <text
              x={(sx + ex) / 2} y={(sy + ey) / 2 - 13}
              fontSize="11" fontWeight="700" textAnchor="middle" fill="#0f172a"
            >
              slide along {enteringDirection}
            </text>
          </g>
        );
      })()}

      {/* Optimum marker — glowing vertex once confirmed */}
      {optimumConfirmed && optimumTarget != null && draft.objectiveCoefficients[0] != null && draft.objectiveCoefficients[1] != null && (() => {
        // Find the optimal vertex analytically: it's at the intersection of
        // the binding constraints. For Toy Factory, (10, 15). We solve for it
        // by finding corner points of the feasible polygon at max z.
        const c1 = draft.objectiveCoefficients[0] as number;
        const c2 = draft.objectiveCoefficients[1] as number;
        // Iterate corner candidates: all pairwise intersections of constraint
        // lines + the axes, filter to feasible ones, pick the one matching target z.
        const corners: { x: number; y: number }[] = [];
        const lines = draft.constraints
          .map(c => ({ a: c.coefficients[0], b: c.coefficients[1], rhs: c.rhs }))
          .filter(l => l.a != null && l.b != null && l.rhs != null) as { a: number; b: number; rhs: number }[];
        // Include x1-axis (y=0) and x2-axis (x=0) as boundary "lines"
        const axisLines = [
          { a: 0, b: 1, rhs: 0 },  // x2 = 0
          { a: 1, b: 0, rhs: 0 },  // x1 = 0
        ];
        const all = [...lines, ...axisLines];
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const L1 = all[i], L2 = all[j];
            const det = L1.a * L2.b - L2.a * L1.b;
            if (Math.abs(det) < 1e-9) continue;
            const x = (L1.rhs * L2.b - L2.rhs * L1.b) / det;
            const y = (L1.a * L2.rhs - L2.a * L1.rhs) / det;
            if (x < -1e-6 || y < -1e-6) continue;
            // Check feasibility against all constraints
            const feasible = lines.every(l => l.a * x + l.b * y <= l.rhs + 1e-6);
            if (feasible) corners.push({ x, y });
          }
        }
        // Pick corner with z closest to target
        let best: { x: number; y: number } | null = null;
        let bestDiff = Infinity;
        for (const c of corners) {
          const z = c1 * c.x + c2 * c.y;
          const diff = Math.abs(z - optimumTarget);
          if (diff < bestDiff) { bestDiff = diff; best = c; }
        }
        if (!best) return null;

        return (
          <g className="animate-fill-pop">
            <circle cx={scaleX(best.x)} cy={scaleY(best.y)} r="14" fill="#10b981" fillOpacity="0.2" />
            <circle cx={scaleX(best.x)} cy={scaleY(best.y)} r="7" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
            <text
              x={scaleX(best.x) + 14}
              y={scaleY(best.y) - 10}
              fontSize="12"
              fontWeight="700"
              fill="#10b981"
            >
              ({fmt(best.x)}, {fmt(best.y)})  z* = {Math.round(optimumTarget)}
            </text>
          </g>
        );
      })()}

      {/* ── Clickable feasible-polygon vertices (Phase 6) ─────────────────
          Every corner of the feasible polygon IS a basis. Clicking one
          tells the sidebar what variables are basic at that vertex, which
          is the starting point for reconstructing the tableau via B⁻¹. */}
      {vertexSelectable && feasibleVertices.map((v, i) => {
        const isSelected = !!selectedVertex &&
          Math.abs(selectedVertex.x - v.x) < 1e-4 &&
          Math.abs(selectedVertex.y - v.y) < 1e-4;
        // Is this vertex the target of an active click-vertex question?
        // If so it gets an attention-pulse ring to invite the click.
        const isTarget = !!activeClickVertexTarget &&
          Math.abs(activeClickVertexTarget.x - v.x) < 0.5 &&
          Math.abs(activeClickVertexTarget.y - v.y) < 0.5;
        return (
          <g
            key={`vx-${i}`}
            style={{ cursor: onVertexSelect ? 'pointer' : 'default' }}
            onClick={() => onVertexSelect?.(v)}
          >
            <circle
              cx={scaleX(v.x)} cy={scaleY(v.y)} r="14"
              fill="transparent"
            />
            {/* Target ring — pulses to invite the click */}
            {isTarget && !isSelected && (
              <circle
                cx={scaleX(v.x)} cy={scaleY(v.y)} r="12"
                fill="none" stroke="#fb923c" strokeWidth="2.5"
                strokeDasharray="3,3"
                className="animate-attention-pulse"
              />
            )}
            {/* Selection ring — stays on after click */}
            {isSelected && (
              <circle
                cx={scaleX(v.x)} cy={scaleY(v.y)} r="11"
                fill="none" stroke="#fb923c" strokeWidth="3"
                className="animate-attention-pulse"
              />
            )}
            <circle
              cx={scaleX(v.x)} cy={scaleY(v.y)} r={isSelected || isTarget ? 7 : 5}
              fill={isSelected ? '#fb923c' : isTarget ? '#fde68a' : '#f8fafc'}
              stroke="#0f172a" strokeWidth="2"
              style={{ transition: 'r 200ms ease, fill 200ms ease' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}
