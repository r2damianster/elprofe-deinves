import { useState } from 'react';

export default function MatrixGrid({ content, onSubmit, disabled, points }: any) {
  const { question, rows, columns, correct_map } = content;
  // selections: { [rowIndex]: colIndex | null }
  const [selections, setSelections] = useState<Record<number, number | null>>(
    Object.fromEntries(rows.map((_: any, i: number) => [i, null]))
  );

  function handleSubmit() {
    let correct = 0;
    correct_map.forEach(([row, col]: [number, number]) => {
      if (selections[row] === col) correct++;
    });
    const score = Math.round((correct / correct_map.length) * points);
    onSubmit(selections, score);
  }

  const allAnswered = Object.values(selections).every((v) => v !== null);

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{question}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-3 text-left text-gray-600 bg-gray-50 border border-gray-200 w-1/3"></th>
              {columns.map((col: string, ci: number) => (
                <th key={ci} className="p-3 text-center text-gray-700 bg-gray-50 border border-gray-200 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: string, ri: number) => (
              <tr key={ri} className="hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800 border border-gray-200">{row}</td>
                {columns.map((_: string, ci: number) => (
                  <td key={ci} className="p-3 text-center border border-gray-200">
                    <button
                      disabled={disabled}
                      onClick={() => setSelections({ ...selections, [ri]: ci })}
                      className={`w-6 h-6 rounded-full border-2 transition-colors mx-auto block ${
                        selections[ri] === ci
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-400 hover:border-blue-400'
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || !allAnswered}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300"
      >
        Enviar matriz
      </button>
    </div>
  );
}
