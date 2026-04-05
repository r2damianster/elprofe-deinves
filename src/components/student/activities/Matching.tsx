import { useState } from 'react';

interface Pair {
  left: string;
  right: string;
}

export default function Matching({ content, onSubmit, disabled, points }: any) {
  // pairs puede ser array de {left, right} o un objeto legado {key: value}
  const rawPairs: Pair[] = Array.isArray(content.pairs)
    ? content.pairs
    : Object.entries(content.pairs || {}).map(([left, right]) => ({ left, right: right as string }));

  const rightOptions = rawPairs.map((p) => p.right);
  const [selections, setSelections] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <p className="text-gray-600 italic">Relaciona cada concepto con su definición:</p>
      <div className="grid gap-4">
        {rawPairs.map((pair, index) => (
          <div key={index} className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex-1 p-3 bg-gray-50 border rounded-lg font-medium">{pair.left}</div>
            <select
              disabled={disabled}
              className="flex-1 p-3 border rounded-lg bg-white"
              value={selections[pair.left] ?? ''}
              onChange={(e) => setSelections({ ...selections, [pair.left]: e.target.value })}
            >
              <option value="">Seleccionar pareja...</option>
              {rightOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button
        onClick={() => onSubmit(selections, points)}
        disabled={disabled || Object.keys(selections).length < rawPairs.length}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300"
      >
        Enviar Relaciones
      </button>
    </div>
  );
}