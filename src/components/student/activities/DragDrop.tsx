import { useState } from 'react';
import { GripVertical } from 'lucide-react';

interface DragDropProps {
  content: {
    instruction: string;
    items: string[];
    correctOrder: number[];
  };
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}

export default function DragDrop({ content, onSubmit, disabled, points }: DragDropProps) {
  const [items, setItems] = useState(content.items);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);

    setItems(newItems);
    setDraggedIndex(index);
  }

  function handleSubmit() {
    const userOrder = items.map((item) => content.items.indexOf(item));
    const correctCount = userOrder.filter((idx, i) => idx === content.correctOrder[i]).length;
    const score = Math.round((correctCount / content.items.length) * points);

    onSubmit({ order: userOrder, correctCount }, score);
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{content.instruction}</p>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            className="flex items-center p-4 border-2 border-gray-200 rounded-lg bg-white cursor-move hover:border-blue-300 transition"
          >
            <GripVertical className="w-5 h-5 text-gray-400 mr-3" />
            <span className="text-gray-800">{item}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {disabled ? 'Enviando...' : 'Enviar Respuesta'}
      </button>
    </div>
  );
}
