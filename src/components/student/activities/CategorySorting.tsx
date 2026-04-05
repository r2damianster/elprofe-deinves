import { useState } from 'react';

export default function CategorySorting({ content, onSubmit, disabled, points }: any) {
  const { question, categories, items } = content;
  // selections: { [itemIndex]: categoryIndex | null }
  const [selections, setSelections] = useState<Record<number, number | null>>(
    Object.fromEntries(items.map((_: any, i: number) => [i, null]))
  );

  function handleSubmit() {
    let correct = 0;
    items.forEach((item: any, i: number) => {
      if (selections[i] === item.category) correct++;
    });
    const score = Math.round((correct / items.length) * points);
    onSubmit(selections, score);
  }

  const allAnswered = Object.values(selections).every((v) => v !== null);

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{question}</p>
      <div className="grid gap-3">
        {items.map((item: any, i: number) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-gray-50 border rounded-xl">
            <span className="flex-1 text-gray-800 text-sm font-medium">{item.text}</span>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat: string, ci: number) => (
                <button
                  key={ci}
                  disabled={disabled}
                  onClick={() => setSelections({ ...selections, [i]: ci })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    selections[i] === ci
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || !allAnswered}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300"
      >
        Enviar clasificación
      </button>
    </div>
  );
}
