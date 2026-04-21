import { useState } from 'react';
import { Constraint, Point } from '../types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { GuidedGraphProps } from '../hooks/useGuidedSimplex';

interface GraphViewProps {
  constraints: Constraint[];
  cornerPoints: Point[];
  feasibleRegionPolygon?: Point[];
  simplexPath?: Point[];
  objectiveCoefficients: number[];
  showObjectiveLine: boolean;
  currentPoint?: Point;
  /** Show only the first N constraints (undefined = all). Used during graph building. */
  visibleConstraintCount?: number;
  /** Draw objective line at this z value regardless of currentPoint.z. */
  zOverride?: number;
  /** Guided simplex interaction state for per-phase graph updates. */
  guidedGraph?: GuidedGraphProps;
}

export default function GraphView({
  constraints,
  cornerPoints,
  feasibleRegionPolygon = [],
  simplexPath = [],
  objectiveCoefficients,
  showObjectiveLine,
  currentPoint,
  visibleConstraintCount,
  zOverride,
  guidedGraph,
}: GraphViewProps) {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [hoveredConstraint, setHoveredConstraint] = useState<string | null>(null);

  // Graph dimensions and scaling
  const width = 500;
  const height = 500;
  const padding = 60;

  // Compute viewport from instructional geometry only:
  // corner points, simplex path, current BFS.
  // Fall back to constraint intercepts only if none of those exist yet.
  // feasibleRegionPolygon intentionally excluded — it may contain Sutherland-Hodgman
  // clipping boundary points far outside the LP's interesting region.
  // cornerPoints are the actual LP vertices and are sufficient for bounds.
  const instructionalPoints: { x: number; y: number }[] = [
    ...cornerPoints,
    ...simplexPath,
    ...(currentPoint ? [currentPoint] : []),
  ];

  let maxX: number;
  let maxY: number;

  if (instructionalPoints.length > 0) {
    const rawMaxX = Math.max(...instructionalPoints.map(p => p.x), 0);
    const rawMaxY = Math.max(...instructionalPoints.map(p => p.y), 0);
    const padX = Math.max(1, 0.15 * rawMaxX);
    const padY = Math.max(1, 0.15 * rawMaxY);
    maxX = Math.ceil(rawMaxX + padX);
    maxY = Math.ceil(rawMaxY + padY);
    // Ensure a sensible minimum so the graph isn't microscopic
    maxX = Math.max(maxX, 5);
    maxY = Math.max(maxY, 5);
  } else {
    // Pre-solve: use constraint intercepts but cap at reasonable instructional range
    const interceptsX = constraints
      .map(c => c.coefficients[0] > 0 ? c.rhs / c.coefficients[0] : 0)
      .filter(v => isFinite(v) && v > 0);
    const interceptsY = constraints
      .map(c => c.coefficients[1] > 0 ? c.rhs / c.coefficients[1] : 0)
      .filter(v => isFinite(v) && v > 0);
    const rawMaxX = interceptsX.length > 0 ? Math.max(...interceptsX) : 10;
    const rawMaxY = interceptsY.length > 0 ? Math.max(...interceptsY) : 10;
    const padX = Math.max(1, 0.15 * rawMaxX);
    const padY = Math.max(1, 0.15 * rawMaxY);
    maxX = Math.max(Math.ceil(rawMaxX + padX), 5);
    maxY = Math.max(Math.ceil(rawMaxY + padY), 5);
  }

  const scaleX = (x: number) => padding + (x / maxX) * (width - 2 * padding);
  const scaleY = (y: number) => height - padding - (y / maxY) * (height - 2 * padding);

  // Calculate constraint lines
  const getConstraintLine = (c: Constraint) => {
    const [a, b] = c.coefficients;
    const rhs = c.rhs;
    if (b !== 0) {
      return { x1: 0, y1: rhs / b, x2: rhs / a, y2: 0 };
    } else {
      return { x1: rhs / a, y1: 0, x2: rhs / a, y2: maxY };
    }
  };

  // Use real feasible region polygon from API, or fall back to empty
  const feasiblePath = feasibleRegionPolygon
    .map((p: Point) => `${scaleX(p.x)},${scaleY(p.y)}`)
    .join(' ');

  // Objective line: drawn at zOverride if set, otherwise at currentPoint.z
  const getObjectiveLine = () => {
    if (!showObjectiveLine) return null;
    const z = zOverride !== undefined ? zOverride : (currentPoint?.z ?? null);
    if (z === null) return null;
    const [c1, c2] = objectiveCoefficients;
    return { x1: 0, y1: z / c2, x2: z / c1, y2: 0 };
  };

  const objectiveLine = getObjectiveLine();

  return (
    <div className="h-full bg-card flex flex-col overflow-hidden">
      <TooltipProvider>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          className="flex-1 min-h-0"
        >
          {/* Grid lines — dynamic */}
          {(() => {
            const step = maxX <= 15 ? 2 : maxX <= 30 ? 5 : 10;
            const xLines = Array.from({ length: Math.floor(maxX / step) + 1 }, (_, i) => i * step);
            const yLines = Array.from({ length: Math.floor(maxY / step) + 1 }, (_, i) => i * step);
            return (
              <>
                {xLines.map(i => <line key={`gx-${i}`} x1={scaleX(i)} y1={scaleY(0)} x2={scaleX(i)} y2={scaleY(maxY)} stroke="#1e293b" strokeWidth="1" />)}
                {yLines.map(i => <line key={`gy-${i}`} x1={scaleX(0)} y1={scaleY(i)} x2={scaleX(maxX)} y2={scaleY(i)} stroke="#1e293b" strokeWidth="1" />)}
              </>
            );
          })()}

          {/* Axes */}
          <line
            x1={scaleX(0)}
            y1={scaleY(0)}
            x2={scaleX(maxX)}
            y2={scaleY(0)}
            stroke="#64748b"
            strokeWidth="2"
          />
          <line
            x1={scaleX(0)}
            y1={scaleY(0)}
            x2={scaleX(0)}
            y2={scaleY(maxY)}
            stroke="#64748b"
            strokeWidth="2"
          />

          {/* Axis labels */}
          <text x={scaleX(maxX) - 10} y={scaleY(0) - 10} className="text-sm font-medium">
            x₁
          </text>
          <text x={scaleX(0) + 10} y={scaleY(maxY) + 5} className="text-sm font-medium">
            x₂
          </text>

          {/* Tick marks and labels — dynamic based on axis bounds */}
          {(() => {
            const step = maxX <= 15 ? 2 : maxX <= 30 ? 5 : 10;
            const xTicks = Array.from({ length: Math.floor(maxX / step) + 1 }, (_, i) => i * step);
            const yTicks = Array.from({ length: Math.floor(maxY / step) + 1 }, (_, i) => i * step);
            return (
              <>
                {xTicks.map(i => (
                  <text key={`xt-${i}`} x={scaleX(i)} y={scaleY(0) + 20} fontSize="14" textAnchor="middle" fill="#94a3b8">{i}</text>
                ))}
                {yTicks.map(i => (
                  <text key={`yt-${i}`} x={scaleX(0) - 20} y={scaleY(i) + 5} fontSize="14" textAnchor="middle" fill="#94a3b8">{i}</text>
                ))}
              </>
            );
          })()}

          {/* Feasible region */}
          <polygon
            points={feasiblePath}
            fill="#06b6d4"
            fillOpacity="0.18"
            stroke="none"
          />

          {/* Constraint lines — respects visibleConstraintCount */}
          {(visibleConstraintCount !== undefined ? constraints.slice(0, visibleConstraintCount) : constraints).map((c, idx) => {
            const line = getConstraintLine(c);
            const colors = ['#ef4444', '#10b981', '#f59e0b'];
            const color = colors[idx % colors.length];
            
            return (
              <g key={c.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <line
                      x1={scaleX(line.x1)}
                      y1={scaleY(line.y1)}
                      x2={scaleX(line.x2)}
                      y2={scaleY(line.y2)}
                      stroke={color}
                      strokeWidth="2.5"
                      strokeDasharray={hoveredConstraint === c.id ? "5,5" : "none"}
                      onMouseEnter={() => setHoveredConstraint(c.id)}
                      onMouseLeave={() => setHoveredConstraint(null)}
                      className="cursor-pointer transition-all"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-semibold">{c.label}</div>
                      <div className="text-xs text-muted-foreground">Constraint {idx + 1}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
                
                {/* Constraint label */}
                <text
                  x={scaleX(line.x1 + 1)}
                  y={scaleY(line.y1 - 0.5)}
                  className="text-xs font-medium"
                  fill={color}
                >
                  C{idx + 1}
                </text>
              </g>
            );
          })}

          {/* Objective line */}
          {objectiveLine && (
            <line
              x1={scaleX(objectiveLine.x1)}
              y1={scaleY(objectiveLine.y1)}
              x2={scaleX(objectiveLine.x2)}
              y2={scaleY(objectiveLine.y2)}
              stroke="#d946ef"
              strokeWidth="2"
              strokeDasharray="8,4"
            />
          )}

          {/* Simplex path */}
          {simplexPath.length > 1 && (
            <polyline
              points={simplexPath.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ')}
              fill="none"
              stroke="#d946ef"
              strokeWidth="3"
              strokeDasharray="none"
              markerEnd="url(#arrowhead)"
            />
          )}

          {/* Arrow marker definitions */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#d946ef" />
            </marker>
            <marker
              id="direction-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#059669" />
            </marker>
          </defs>

          {/* Guided: direction arrow from current vertex */}
          {guidedGraph?.showDirectionArrow && currentPoint && guidedGraph.enteringVarName && (() => {
            const name = guidedGraph.enteringVarName.toLowerCase();
            // Determine direction based on variable name
            const isX1 = name === 'x1' || name === 'x₁';
            const isX2 = name === 'x2' || name === 'x₂';
            const arrowLen = Math.max(maxX, maxY) * 0.15;
            const dx = isX1 ? arrowLen : isX2 ? 0 : arrowLen * 0.7;
            const dy = isX2 ? arrowLen : isX1 ? 0 : arrowLen * 0.7;
            return (
              <line
                x1={scaleX(currentPoint.x)}
                y1={scaleY(currentPoint.y)}
                x2={scaleX(currentPoint.x + dx)}
                y2={scaleY(currentPoint.y + dy)}
                stroke="#059669"
                strokeWidth="3"
                strokeDasharray="6,3"
                markerEnd="url(#direction-arrow)"
                opacity="0.8"
              />
            );
          })()}

          {/* Guided: constraint highlight for leaving variable */}
          {guidedGraph?.highlightedConstraintIdx != null && (() => {
            const idx = guidedGraph.highlightedConstraintIdx;
            const c = constraints[idx];
            if (!c) return null;
            const line = getConstraintLine(c);
            return (
              <line
                x1={scaleX(line.x1)}
                y1={scaleY(line.y1)}
                x2={scaleX(line.x2)}
                y2={scaleY(line.y2)}
                stroke="#dc2626"
                strokeWidth="5"
                opacity="0.6"
                strokeDasharray="none"
                className="animate-pulse"
              />
            );
          })()}

          {/* Corner points */}
          {cornerPoints.map((point, idx) => {
            const isCurrent = point.isCurrent || (currentPoint && point.x === currentPoint.x && point.y === currentPoint.y);
            const isOnPath = simplexPath.some(p => p.x === point.x && p.y === point.y);
            
            return (
              <g key={`point-${idx}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <circle
                      cx={scaleX(point.x)}
                      cy={scaleY(point.y)}
                      r={isCurrent ? 8 : 6}
                      fill={isCurrent ? '#8b5cf6' : isOnPath ? '#3b82f6' : '#fff'}
                      stroke={isCurrent ? '#8b5cf6' : '#3b82f6'}
                      strokeWidth={isCurrent ? 3 : 2}
                      onMouseEnter={() => setHoveredPoint(point.label || '')}
                      onMouseLeave={() => setHoveredPoint(null)}
                      className="cursor-pointer transition-all"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-semibold">{point.label}</div>
                      {point.z !== undefined && (
                        <div className="text-xs">z = {point.z}</div>
                      )}
                      {isCurrent && (
                        <div className="text-xs text-primary font-medium">Current solution</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
                
                {/* Point label */}
                <text
                  x={scaleX(point.x) + 12}
                  y={scaleY(point.y) - 8}
                  className="text-xs font-medium"
                  fill={isCurrent ? '#d946ef' : '#06b6d4'}
                >
                  {point.label}
                </text>
                {point.z !== undefined && (
                  <text
                    x={scaleX(point.x) + 12}
                    y={scaleY(point.y) + 5}
                    className="text-xs"
                    fill="#94a3b8"
                  >
                    z={point.z}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </TooltipProvider>

      {/* Compact legend */}
      <div className="flex items-center gap-4 px-3 py-1 border-t border-border text-xs text-muted-foreground shrink-0 flex-wrap">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-accent opacity-40 border border-accent" />Feasible</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-primary" />Simplex path</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-primary" />Current</span>
        {showObjectiveLine && <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-primary/60 border-dashed" />Objective</span>}
      </div>
    </div>
  );
}
