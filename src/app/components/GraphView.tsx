import { useState } from 'react';
import { Constraint, Point } from '../types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface GraphViewProps {
  constraints: Constraint[];
  cornerPoints: Point[];
  feasibleRegionPolygon?: Point[];
  simplexPath?: Point[];
  objectiveCoefficients: number[];
  showObjectiveLine: boolean;
  currentPoint?: Point;
  axisBounds?: { maxX: number; maxY: number };
}

export default function GraphView({
  constraints,
  cornerPoints,
  feasibleRegionPolygon = [],
  simplexPath = [],
  objectiveCoefficients,
  showObjectiveLine,
  currentPoint,
  axisBounds,
}: GraphViewProps) {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [hoveredConstraint, setHoveredConstraint] = useState<string | null>(null);

  // Graph dimensions and scaling
  const width = 500;
  const height = 500;
  const padding = 60;
  const maxX = axisBounds?.maxX ?? 20;
  const maxY = axisBounds?.maxY ?? 20;

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

  // Objective line (isoprofit line through current point)
  const getObjectiveLine = () => {
    if (!currentPoint || !showObjectiveLine) return null;
    
    const [c1, c2] = objectiveCoefficients;
    // c1*x + c2*y = z
    // y = (z - c1*x) / c2
    
    const z = currentPoint.z || 0;
    const x1 = 0;
    const y1 = z / c2;
    const x2 = z / c1;
    const y2 = 0;
    
    return { x1, y1, x2, y2 };
  };

  const objectiveLine = getObjectiveLine();

  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 flex flex-col">
      <div className="mb-3">
        <h3 className="font-semibold">Graphical View</h3>
        <p className="text-xs text-gray-600">Feasible region and optimal solution</p>
      </div>
      
      <TooltipProvider>
        <svg width={width} height={height} className="border border-gray-200 rounded">
          {/* Grid lines */}
          {[...Array(21)].map((_, i) => (
            <g key={`grid-${i}`}>
              <line
                x1={scaleX(i)}
                y1={scaleY(0)}
                x2={scaleX(i)}
                y2={scaleY(maxY)}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
              <line
                x1={scaleX(0)}
                y1={scaleY(i)}
                x2={scaleX(maxX)}
                y2={scaleY(i)}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* Axes */}
          <line
            x1={scaleX(0)}
            y1={scaleY(0)}
            x2={scaleX(maxX)}
            y2={scaleY(0)}
            stroke="#000"
            strokeWidth="2"
          />
          <line
            x1={scaleX(0)}
            y1={scaleY(0)}
            x2={scaleX(0)}
            y2={scaleY(maxY)}
            stroke="#000"
            strokeWidth="2"
          />

          {/* Axis labels */}
          <text x={scaleX(maxX) - 10} y={scaleY(0) - 10} className="text-sm font-medium">
            x₁
          </text>
          <text x={scaleX(0) + 10} y={scaleY(maxY) + 5} className="text-sm font-medium">
            x₂
          </text>

          {/* Tick marks and labels */}
          {[0, 5, 10, 15, 20].map(i => (
            <g key={`tick-${i}`}>
              <text x={scaleX(i)} y={scaleY(0) + 20} className="text-xs" textAnchor="middle">
                {i}
              </text>
              <text x={scaleX(0) - 20} y={scaleY(i) + 5} className="text-xs" textAnchor="middle">
                {i}
              </text>
            </g>
          ))}

          {/* Feasible region */}
          <polygon
            points={feasiblePath}
            fill="#3b82f6"
            fillOpacity="0.15"
            stroke="none"
          />

          {/* Constraint lines */}
          {constraints.map((c, idx) => {
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
                      <div className="text-xs text-gray-500">Constraint {idx + 1}</div>
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
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeDasharray="8,4"
            />
          )}

          {/* Simplex path */}
          {simplexPath.length > 1 && (
            <polyline
              points={simplexPath.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ')}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="3"
              strokeDasharray="none"
              markerEnd="url(#arrowhead)"
            />
          )}

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#8b5cf6" />
            </marker>
          </defs>

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
                        <div className="text-xs text-purple-600 font-medium">Current solution</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
                
                {/* Point label */}
                <text
                  x={scaleX(point.x) + 12}
                  y={scaleY(point.y) - 8}
                  className="text-xs font-medium"
                  fill={isCurrent ? '#8b5cf6' : '#3b82f6'}
                >
                  {point.label}
                </text>
                {point.z !== undefined && (
                  <text
                    x={scaleX(point.x) + 12}
                    y={scaleY(point.y) + 5}
                    className="text-xs"
                    fill="#666"
                  >
                    z={point.z}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </TooltipProvider>

      {/* Legend */}
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 opacity-15 border border-blue-500"></div>
          <span>Feasible Region</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-purple-500"></div>
          <span>Simplex Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-600"></div>
          <span>Current Solution</span>
        </div>
        {showObjectiveLine && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-purple-500" style={{ backgroundImage: 'repeating-linear-gradient(to right, #8b5cf6 0, #8b5cf6 8px, transparent 8px, transparent 12px)' }}></div>
            <span>Objective Line</span>
          </div>
        )}
      </div>
    </div>
  );
}
