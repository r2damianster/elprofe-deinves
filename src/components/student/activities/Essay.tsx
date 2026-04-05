import { useState } from 'react';
import { useIntegrity } from './useIntegrity';
import MetricsBar from './MetricsBar';

interface EssayProps {
  content: { prompt: string; minWords?: number };
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}

export default function Essay({ content, onSubmit, disabled, points }: EssayProps) {
  const [text, setText] = useState('');
  const { score: integrity, events, onPaste } = useIntegrity(disabled);

  const minWords   = content.minWords || 50;
  const wordCount  = text.trim().split(/\s+/).filter(Boolean).length;
  const meetsMin   = wordCount >= minWords;
  const compliance = Math.min(100, Math.round((wordCount / minWords) * 100));

  const complianceLabel = meetsMin
    ? '✓ Mínimo alcanzado'
    : `Faltan ${minWords - wordCount} palabras`;

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{content.prompt}</p>

      <MetricsBar
        compliance={compliance}
        complianceLabel={complianceLabel}
        integrity={integrity}
        events={events}
      />

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          disabled={disabled}
          rows={10}
          placeholder="Escribe tu respuesta aquí..."
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition text-gray-800 text-sm"
        />
        <div className="flex justify-between text-sm mt-1">
          <span className={meetsMin ? 'text-green-600 font-medium' : 'text-gray-500'}>
            {wordCount} palabras
          </span>
          <span className="text-gray-500">Mínimo: {minWords} palabras</span>
        </div>
      </div>

      <button
        onClick={() => onSubmit({ text, wordCount, integrity_score: integrity }, points)}
        disabled={disabled || !meetsMin}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
      >
        Enviar Respuesta
      </button>
    </div>
  );
}
