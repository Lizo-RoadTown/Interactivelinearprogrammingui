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
}

// Dimensions
const W = 420, H = 420;
const PAD = 40;

export default function DiscoveryGraph({
  draft, linesDrawn, sideDrawnFor, feasibleRegionRevealed,
  objectiveZ, optimumConfirmed, optimumTarget, bfsPoint,
}: Props) {
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

  // Intersection of all half-planes → the feasible region polygon
  const feasiblePolygon = useMemo(() => {
    if (!feasibleRegionRevealed) return null;
    // Start with non-negative quadrant rectangle
    let poly: { x: number; y: number }[] = [
      { x: 0, y: 0 }, { x: maxX, y: 0 }, { x: maxX, y: maxY }, { x: 0, y: maxY },
    ];
    for (let idx = 0; idx < draft.constraints.length; idx++) {
      const c = draft.constraints[idx];
      if (!c || c.rhs == null) return null;
      const [a, b] = c.coefficients;
      if (a == null || b == null) return null;
      const rhs = c.rhs;
      // Clip poly to ax + by ≤ rhs (the student chose "below" for these toy factory constraints)
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
    return poly.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ');
  }, [draft, feasibleRegionRevealed, maxX, maxY]);

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

      {/* Half-plane shading (per-constraint) */}
      {Array.from(sideDrawnFor).map(idx => {
        const poly = halfPlanePolygon(idx);
        if (!poly) return null;
        const color = CONSTRAINT_COLORS[idx % CONSTRAINT_COLORS.length];
        return (
          <polygon
            key={`shade-${idx}`}
            points={poly}
            fill={color}
            fillOpacity={feasibleRegionRevealed ? 0.08 : 0.18}
            className="animate-region-fade"
          />
        );
      })}

      {/* Feasible region overlay (after revealed) */}
      {feasiblePolygon && (
        <polygon
          points={feasiblePolygon}
          fill="#06b6d4"
          fillOpacity="0.28"
          stroke="#06b6d4"
          strokeWidth="2"
          className="animate-fill-pop"
        />
      )}

      {/* Constraint lines (drawn-in animation) */}
      {Array.from(linesDrawn).map(idx => {
        const pts = lineFor(idx);
        if (!pts) return null;
        const color = CONSTRAINT_COLORS[idx % CONSTRAINT_COLORS.length];
        const [a, b] = [pts[0], pts[1]];
        const dx = scaleX(b.x) - scaleX(a.x);
        const dy = scaleY(b.y) - scaleY(a.y);
        const length = Math.hypot(dx, dy);
        return (
          <g key={`line-${idx}`}>
            <line
              x1={scaleX(a.x)} y1={scaleY(a.y)} x2={scaleX(b.x)} y2={scaleY(b.y)}
              stroke={color} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={length}
              strokeDashoffset={length}
              style={{ animation: `line-draw 700ms 120ms cubic-bezier(0.4, 0, 0.2, 1) forwards` }}
            />
            {/* Label near the middle of the line */}
            <text
              x={scaleX((a.x + b.x) / 2) + 6}
              y={scaleY((a.y + b.y) / 2) - 6}
              fontSize="12"
              fill={color}
              fontWeight="700"
              className="animate-fill-pop"
            >
              C{idx + 1}
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
                  {/* Floating label "s_i = value" */}
                  <rect
                    x={scaleX(midX) - 22} y={scaleY(midY) - 9}
                    width="44" height="16" rx="8"
                    fill={colorForFill(idx, 0.9)}
                  />
                  <text
                    x={scaleX(midX)} y={scaleY(midY) + 3}
                    fontSize="10" fontWeight="700" textAnchor="middle" fill="#ffffff"
                  >
                    s{idx + 1}={fmt(slack)}
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
    </svg>
  );
}

function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}
