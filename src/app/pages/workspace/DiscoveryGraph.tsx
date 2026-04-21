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

interface Props {
  draft: LPDraft;
  /** Which constraints have had their LINE revealed (intercepts earned). */
  linesDrawn: Set<number>;
  /** Which constraints have had their FEASIBLE SIDE chosen. */
  sideDrawnFor: Set<number>;
  /** Whether the final feasible intersection has been revealed. */
  feasibleRegionRevealed: boolean;
}

const CONSTRAINT_COLORS = ['#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

// Dimensions
const W = 420, H = 420;
const PAD = 40;

export default function DiscoveryGraph({
  draft, linesDrawn, sideDrawnFor, feasibleRegionRevealed,
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
    </svg>
  );
}
