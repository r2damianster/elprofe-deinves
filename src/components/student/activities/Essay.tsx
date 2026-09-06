import { useState } from 'react';
import { callAiEnhance } from '../../../lib/aiEnhance';
import { Wand2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useIntegrity } from './useIntegrity';
import MetricsBar from './MetricsBar';

function ExamplePanel({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50 hover:bg-blue-100 transition text-sm font-semibold text-blue-700">
        <span>👁 Ver ejemplo del profesor</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-white text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-blue-100">
          {text}
        </div>
      )}
    </div>
  );
}

interface AiResult {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

interface EssayProps {
  content: {
    prompt: string;
    min_words?: number;
    max_words?: number;
    required_words?: string[];
    forbidden_words?: string[];
    compliance_threshold?: number;
    rubric?: string;
    example_text?: string;
  };
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}

export default function Essay({ content, onSubmit, disabled, points }: EssayProps) {
  const [text, setText] = useState('');
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { score: integrity, events, onPaste } = useIntegrity(disabled);

  const minWords  = content.min_words ?? 50;
  const maxWords  = content.max_words ?? null;
  const threshold = content.compliance_threshold ?? 100;

  const reqWords: string[] = content.required_words ?? [];
  const fobWords: string[] = content.forbidden_words ?? [];
  const lowerText = text.toLowerCase();

  const wordCount  = text.trim().split(/\s+/).filter(Boolean).length;
  const reqMet     = reqWords.filter(w => lowerText.includes(w.toLowerCase()));
  const fobUsed    = fobWords.filter(w => lowerText.includes(w.toLowerCase()));

  const scoreWords  = Math.min(100, Math.round((wordCount / minWords) * 100));
  const scoreReq    = reqWords.length > 0 ? (reqMet.length / reqWords.length) * 100 : 100;
  const scoreFob    = fobWords.length > 0 ? ((fobWords.length - fobUsed.length) / fobWords.length) * 100 : 100;
  const totalWeight = 1 + (reqWords.length > 0 ? 1 : 0) + (fobWords.length > 0 ? 1 : 0);
  const compliance  = Math.min(100, Math.round((scoreWords + (reqWords.length > 0 ? scoreReq : 0) + (fobWords.length > 0 ? scoreFob : 0)) / totalWeight));

  const complianceLabel = compliance === 100 ? '✓ Requisitos alcanzados' : `Progreso: ${compliance}%`;
  const canSubmit = !disabled && wordCount > 0 && compliance >= threshold;

  async function handleAiReview() {
    if (!text.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await callAiEnhance<AiResult>('review_essay', 'es', {
        prompt: content.prompt,
        min_words: minWords,
        max_words: maxWords,
        required_words: reqWords,
        forbidden_words: fobWords,
        rubric: content.rubric,
        content: text,
      });
      if (result) setAiResult(result);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{content.prompt}</p>

      {content.example_text && <ExamplePanel text={content.example_text} />}

      <MetricsBar
        compliance={compliance}
        complianceLabel={complianceLabel}
        integrity={integrity}
        events={events}
      />

      <div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
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
          <span className="text-gray-500">
            Mínimo: {minWords}{maxWords ? ` · Máximo: ${maxWords}` : ''} palabras
          </span>
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

      {!disabled && (
        <button
          type="button"
          onClick={handleAiReview}
          disabled={aiLoading || wordCount < 10}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition disabled:opacity-40 text-sm font-medium"
        >
          {aiLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
            : <><Wand2 className="w-4 h-4" /> Analizar con IA</>}
        </button>
      )}

      {aiResult && (
        <div className="border border-purple-200 rounded-xl p-4 bg-purple-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-purple-800 text-sm">Revisión IA</span>
            <span className={`text-lg font-bold ${aiResult.score >= 7 ? 'text-green-600' : aiResult.score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
              {aiResult.score}/10
            </span>
          </div>
          <p className="text-sm text-gray-700 italic">{aiResult.summary}</p>
          {aiResult.strengths?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">Fortalezas</p>
              <ul className="space-y-0.5">{aiResult.strengths.map((s, i) => <li key={i} className="text-xs text-gray-700">✓ {s}</li>)}</ul>
            </div>
          )}
          {aiResult.improvements?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-orange-700 mb-1">Por mejorar</p>
              <ul className="space-y-0.5">{aiResult.improvements.map((s, i) => <li key={i} className="text-xs text-gray-700">• {s}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {threshold > 0 && compliance < threshold && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Alcanza al menos {threshold}% de cumplimiento para poder enviar ({compliance}% actual).
        </p>
      )}

      <button
        onClick={() => onSubmit({ text, wordCount, integrity_score: integrity }, (compliance / 100) * points)}
        disabled={!canSubmit}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
      >
        Enviar Respuesta
      </button>
    </div>
  );
}
