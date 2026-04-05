import { useState } from 'react';

export default function LongResponse({ content, onSubmit, disabled, points }: any) {
  const { question, min_characters = 0, max_characters = 3000, show_word_count = true } = content;
  const [text, setText] = useState('');

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const meetsMin = charCount >= min_characters;

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{question}</p>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, max_characters))}
          disabled={disabled}
          rows={10}
          placeholder="Escribe tu respuesta aquí..."
          className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
        />
        <div className="flex justify-between items-center mt-1 text-xs text-gray-400 px-1">
          <span className={charCount < min_characters ? 'text-red-500' : 'text-green-600'}>
            {charCount < min_characters
              ? `Mínimo ${min_characters} caracteres (faltan ${min_characters - charCount})`
              : `Mínimo alcanzado`}
          </span>
          <span>
            {show_word_count && `${wordCount} palabras · `}{charCount}/{max_characters} caracteres
          </span>
        </div>
      </div>
      <button
        onClick={() => onSubmit(text, points)}
        disabled={disabled || !meetsMin}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300"
      >
        Enviar respuesta
      </button>
    </div>
  );
}
