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
  
  const reqWords: string[] = content.required_words || [];
  const fobWords: string[] = content.forbidden_words || [];
  const lowerText = text.toLowerCase();

  const reqMet = reqWords.filter(w => lowerText.includes(w.toLowerCase()));
  const fobUsed = fobWords.filter(w => lowerText.includes(w.toLowerCase()));

  const scoreWords = Math.min(100, Math.round((wordCount / minWords) * 100));
  const scoreReq = reqWords.length > 0 ? (reqMet.length / reqWords.length) * 100 : 100;
  const scoreFob = fobWords.length > 0 ? ((fobWords.length - fobUsed.length) / fobWords.length) * 100 : 100;

  const totalWeight = 1 + (reqWords.length > 0 ? 1 : 0) + (fobWords.length > 0 ? 1 : 0);
  const compliance = Math.min(100, Math.round((scoreWords + (reqWords.length > 0 ? scoreReq : 0) + (fobWords.length > 0 ? scoreFob : 0)) / totalWeight));

  const complianceLabel = compliance === 100
    ? '✓ Requisitos alcanzados'
    : `Progreso: ${compliance}%`;

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
          <span className={wordCount >= minWords ? 'text-green-600 font-medium' : 'text-gray-500'}>
            {wordCount} palabras
          </span>
          <span className="text-gray-500">Mínimo: {minWords} palabras</span>
        </div>
        
        {(reqWords.length > 0 || fobWords.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {reqWords.map(w => {
              const met = lowerText.includes(w.toLowerCase());
              return (
                <span key={w} className={`text-xs px-2 py-1 rounded-full border ${met ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {met ? '✓' : '○'} {w}
                </span>
              );
            })}
            {fobWords.map(w => {
              const used = lowerText.includes(w.toLowerCase());
              return (
                <span key={w} className={`text-xs px-2 py-1 rounded-full border ${used ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {used ? '✗' : '🚫'} {w}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => onSubmit({ text, wordCount, integrity_score: integrity }, (compliance / 100) * points)}
        disabled={disabled || wordCount === 0}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
      >
        Enviar Respuesta
      </button>
    </div>
  );
}
