import { useState } from 'react';

export default function Ordering({ content, onSubmit, disabled, points }: any) {
  const [items, setItems] = useState<string[]>(content.items || []);

  // Simulación de reordenamiento (puedes añadir librerías como dnd-kit luego)
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setItems(newItems);
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-600 italic">Ordena los siguientes elementos correctamente:</p>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 p-3 bg-white border rounded-lg shadow-sm">
            <span className="font-bold text-blue-600 w-6">{idx + 1}.</span>
            <span className="flex-1">{item}</span>
            <div className="flex flex-col">
              <button onClick={() => handleMove(idx, 'up')} disabled={disabled || idx === 0} className="text-xs hover:text-blue-600">▲</button>
              <button onClick={() => handleMove(idx, 'down')} disabled={disabled || idx === items.length - 1} className="text-xs hover:text-blue-600">▼</button>
            </div>
          </div>
        ))}
      </div>
      <button 
        onClick={() => onSubmit({ finalOrder: items }, points)}
        disabled={disabled}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300"
      >
        Confirmar Orden
      </button>
    </div>
  );
}