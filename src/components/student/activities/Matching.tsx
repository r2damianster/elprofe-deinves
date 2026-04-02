import { useState } from 'react';

export default function Matching({ content, onSubmit, disabled, points }: any) {
  const pairs = content.pairs || {};
  const leftItems = Object.keys(pairs);
  const [selections, setSelections] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <p className="text-gray-600 italic">Relaciona cada concepto con su definición:</p>
      <div className="grid gap-4">
        {leftItems.map((key) => (
          <div key={key} className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex-1 p-3 bg-gray-50 border rounded-lg font-medium">{key}</div>
            <select 
              disabled={disabled}
              className="flex-1 p-3 border rounded-lg bg-white"
              onChange={(e) => setSelections({...selections, [key]: e.target.value})}
            >
              <option value="">Seleccionar pareja...</option>
              {Object.values(pairs).map((val: any) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button 
        onClick={() => onSubmit(selections, points)}
        disabled={disabled || Object.keys(selections).length < leftItems.length}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300"
      >
        Enviar Relaciones
      </button>
    </div>
  );
}