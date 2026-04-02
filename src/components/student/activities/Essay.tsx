import { useState } from 'react';

interface EssayProps {
  content: {
    prompt: string;
    minWords?: number;
  };
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}

export default function Essay({ content, onSubmit, disabled, points }: EssayProps) {
  const [text, setText] = useState('');

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minWords = content.minWords || 50;
  const meetsRequirement = wordCount >= minWords;

  function handleSubmit() {
    if (!meetsRequirement) {
      alert(`Debes escribir al menos ${minWords} palabras`);
      return;
    }

    onSubmit({ text, wordCount }, points);
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{content.prompt}</p>

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
          rows={10}
          placeholder="Escribe tu respuesta aquí..."
          disabled={disabled}
        />
        <div className="flex justify-between text-sm mt-2">
          <span className={`${meetsRequirement ? 'text-green-600' : 'text-gray-600'}`}>
            {wordCount} palabras
          </span>
          <span className="text-gray-600">Mínimo: {minWords} palabras</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || !meetsRequirement}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {disabled ? 'Enviando...' : 'Enviar Respuesta'}
      </button>
    </div>
  );
}
