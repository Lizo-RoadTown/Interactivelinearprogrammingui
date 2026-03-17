import { Tableau } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface TableauWorkspaceProps {
  tableau: Tableau;
  showRatioTest: boolean;
  onCellClick?: (row: number, col: number) => void;
  selectedCell?: { row: number; col: number };
  isInteractive?: boolean;
}

export default function TableauWorkspace({
  tableau,
  showRatioTest,
  onCellClick,
  selectedCell,
  isInteractive = false
}: TableauWorkspaceProps) {
  const headers = [...tableau.nonBasisVariables, ...tableau.basisVariables.map(v => `Slack`), 'RHS'];
  
  const getCellClassName = (row: number, col: number) => {
    const cell = tableau.rows[row][col];
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    
    let classes = 'px-4 py-3 text-center border border-gray-200 transition-all';
    
    if (isSelected) {
      classes += ' ring-2 ring-purple-500 bg-purple-50';
    } else if (cell.isPivot) {
      classes += ' bg-amber-400 font-bold text-white';
    } else if (cell.isPivotRow) {
      classes += ' bg-amber-100';
    } else if (cell.isPivotCol) {
      classes += ' bg-blue-100';
    } else if (cell.isChanged) {
      classes += ' bg-green-100 font-medium';
    }
    
    if (isInteractive && !isSelected) {
      classes += ' cursor-pointer hover:bg-purple-50';
    }
    
    return classes;
  };

  const formatNumber = (num: number): string => {
    if (Number.isInteger(num)) return num.toString();
    
    // Check if it's a simple fraction
    const fractions: { [key: string]: string } = {
      '0.333': '1/3',
      '0.3333333333333333': '1/3',
      '0.6666666666666666': '2/3',
      '0.667': '2/3',
      '2.3333333333333335': '7/3',
      '-0.6666666666666666': '-2/3',
      '-2': '-2'
    };
    
    if (fractions[num.toString()]) return fractions[num.toString()];
    
    return num.toFixed(2);
  };

  const getCellExplanation = (row: number, col: number) => {
    const cell = tableau.rows[row][col];
    
    if (cell.isPivot) {
      return "Pivot element: This is the element we use to perform the pivot operation. The entering variable's column and leaving variable's row intersect here.";
    }
    if (cell.isPivotRow) {
      return "Pivot row: The leaving variable's row. This row will be divided by the pivot element.";
    }
    if (cell.isPivotCol) {
      return "Pivot column: The entering variable's column. We'll eliminate this variable from all other rows.";
    }
    if (cell.isChanged) {
      return "Changed value: This value was updated in the last pivot operation.";
    }
    
    return "Click to select this cell as a potential pivot element (Interactive Mode).";
  };

  return (
    <div className="h-full bg-white p-4 flex flex-col overflow-auto">
      <div className="mb-4">
        <h3 className="font-semibold">Simplex Tableau</h3>
        <p className="text-xs text-gray-600">
          {isInteractive ? 'Click a cell to select pivot element' : 'Step through iterations'}
        </p>
      </div>

      <Tabs defaultValue="current" className="flex-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="select-pivot">Select Pivot</TabsTrigger>
          <TabsTrigger value="after-pivot">After Pivot</TabsTrigger>
          <TabsTrigger value="final">Final State</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-4">
          <div className="overflow-x-auto">
            <TooltipProvider>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-4 py-2 bg-gray-100 border border-gray-300 font-semibold">Basis</th>
                    {headers.map((header, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-2 bg-gray-100 border border-gray-300 font-semibold"
                      >
                        {header}
                      </th>
                    ))}
                    {showRatioTest && (
                      <th className="px-4 py-2 bg-purple-100 border border-gray-300 font-semibold">
                        Ratio
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tableau.rows.slice(0, -1).map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <td className="px-4 py-3 bg-gray-50 border border-gray-300 font-medium text-center">
                        {tableau.basisVariables[rowIdx]}
                      </td>
                      {row.map((cell, colIdx) => (
                        <Tooltip key={colIdx}>
                          <TooltipTrigger asChild>
                            <td
                              className={getCellClassName(rowIdx, colIdx)}
                              onClick={() => isInteractive && onCellClick?.(rowIdx, colIdx)}
                            >
                              {formatNumber(cell.value)}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs text-xs">{getCellExplanation(rowIdx, colIdx)}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {showRatioTest && (
                        <td className="px-4 py-3 bg-purple-50 border border-gray-300 text-center">
                          {tableau.ratios && tableau.ratios[rowIdx] !== null
                            ? formatNumber(tableau.ratios[rowIdx] as number)
                            : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                  
                  {/* Z-row */}
                  <tr className="bg-blue-50">
                    <td className="px-4 py-3 border border-gray-300 font-semibold text-center">
                      Z
                    </td>
                    {tableau.rows[tableau.rows.length - 1].map((cell, colIdx) => (
                      <td
                        key={colIdx}
                        className={`px-4 py-3 border border-gray-300 text-center font-medium ${
                          cell.isChanged ? 'bg-green-100' : ''
                        }`}
                      >
                        {formatNumber(cell.value)}
                      </td>
                    ))}
                    {showRatioTest && (
                      <td className="px-4 py-3 bg-purple-50 border border-gray-300"></td>
                    )}
                  </tr>
                </tbody>
              </table>
            </TooltipProvider>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-400 border border-gray-300"></div>
              <span>Pivot Element</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-100 border border-gray-300"></div>
              <span>Pivot Row</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-100 border border-gray-300"></div>
              <span>Pivot Column</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 border border-gray-300"></div>
              <span>Changed Value</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="select-pivot" className="mt-4">
          <div className="text-center py-8 text-gray-500">
            <p>Pivot selection view - highlights potential pivot elements</p>
            <p className="text-sm mt-2">Based on ratio test and optimality conditions</p>
          </div>
        </TabsContent>

        <TabsContent value="after-pivot" className="mt-4">
          <div className="text-center py-8 text-gray-500">
            <p>After pivot view - shows the result of pivot operation</p>
            <p className="text-sm mt-2">Changed values are highlighted</p>
          </div>
        </TabsContent>

        <TabsContent value="final" className="mt-4">
          <div className="text-center py-8 text-gray-500">
            <p>Final optimal tableau</p>
            <p className="text-sm mt-2">All Z-row coefficients are non-negative</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}