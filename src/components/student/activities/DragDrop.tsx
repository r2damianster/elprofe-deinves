import { useState } from 'react';
import { GripVertical } from 'lucide-react';

interface Category { id: string; name: string; items: string[]; }

export default function DragDrop({ content, onSubmit, disabled, points }: {
  content: any; onSubmit: (r: any, s: number) => void; disabled: boolean; points: number;
}) {
  const safe: { instruction: string; categories: Category[] } = content ?? { instruction: '', categories: [] };
  const categories = safe.categories ?? [];

  const allItems = categories.flatMap((cat) =>
    (cat.items ?? []).filter(Boolean).map((text: string) => ({ text, correctCat: cat.id }))
  );

  const [assignments, setAssignments] = useState<Record<number, string | null>>(
    Object.fromEntries(allItems.map((_, i) => [i, null]))
  );

  function assign(itemIdx: number, catId: string) {
    if (disabled) return;
    setAssignments(prev => ({ ...prev, [itemIdx]: prev[itemIdx] === catId ? null : catId }));
  }

  function handleSubmit() {
    let correct = 0;
    allItems.forEach((item, i) => { if (assignments[i] === item.correctCat) correct++; });
    const total = allItems.length || 1;
    onSubmit({ assignments, correct, total }, Math.round((correct / total) * points));
  }

  const allAssigned = allItems.length > 0 && Object.values(assignments).every(v => v !== null);

  if (allItems.length === 0) {
    return <p className="text-gray-400 italic text-sm py-4 text-center">Esta actividad no tiene elementos configurados.</p>;
  }

  return (
    <div className="space-y-5">
      {safe.instruction && <p className="text-gray-700 font-medium">{safe.instruction}</p>}
      <div className="space-y-3">
        {allItems.map((item, idx) => (
          <div key={idx} className="p-3 bg-gray-50 border rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-800">{item.text}</span>
            </div>
            <div className="flex gap-2 flex-wrap pl-6">
              {categories.map((cat) => (
                <button key={cat.id} type="button" disabled={disabled}
                  onClick={() => assign(idx, cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                    assignments[idx] === cat.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >{cat.name || cat.id}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={handleSubmit} disabled={disabled || !allAssigned}
        className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm disabled:bg-gray-300 transition">
        Confirmar clasificación
      </button>
    </div>
  );
}
