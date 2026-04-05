import { useState } from 'react';
import { useIntegrity } from './useIntegrity';
import MetricsBar from './MetricsBar';

export default function LongResponse({ content, onSubmit, disabled, points }: any) {
  const { question, min_characters = 0, max_characters = 3000, show_word_count = true } = content;
  const [text, setText] = useState('');
  const { score: integrity, events, onPaste } = useIntegrity(disabled);

  const charCount  = text.length;
  const wordCount  = text.trim() ? text.trim().split(/\s+/).length : 0;
  const meetsMin   = charCount >= min_characters;
  const compliance = min_characters > 0
    ? Math.min(100, Math.round((charCount / min_characters) * 100))
    : 100;

  const complianceLabel = meetsMin
    ? '✓ Mínimo alcanzado'
    : `Faltan ${min_characters - charCount} caracteres`;

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{question}</p>

      <MetricsBar
        compliance={compliance}
        complianceLabel={complianceLabel}
        integrity={integrity}
        events={events}
      />

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, max_characters))}
          onPaste={onPaste}
          disabled={disabled}
          rows={8}
          placeholder="Escribe tu respuesta aquí..."
          className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
          <span className={meetsMin ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
            {charCount}/{min_characters} mín.
          </span>
          {show_word_count && (
            <span>{wordCount} palabras · {charCount}/{max_characters} caracteres</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onSubmit({ text, integrity_score: integrity }, points)}
        disabled={disabled || !meetsMin}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300 transition"
      >
        Enviar respuesta
      </button>
    </div>
  );
}
