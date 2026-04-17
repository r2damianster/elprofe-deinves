import { useState } from 'react';
import { useIntegrity } from './useIntegrity';
import MetricsBar from './MetricsBar';

interface Section {
  label: string;
  min_words: number;
  placeholder: string;
}

export default function StructuredEssay({ content, onSubmit, disabled, points }: any) {
  const { question, sections, rubric_criteria }: { question: string; sections: Section[]; rubric_criteria?: string[] } = content;
  const [responses, setResponses] = useState<string[]>(sections.map(() => ''));
  const { score: integrity, events, onPaste } = useIntegrity(disabled);

  function wordCount(text: string) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  const totalMinWords  = sections.reduce((acc: number, s: Section) => acc + s.min_words, 0);
  const totalWords     = responses.reduce((acc, r) => acc + wordCount(r), 0);
  
  const reqWords: string[] = content.required_words || [];
  const fobWords: string[] = content.forbidden_words || [];
  const lowerText = responses.join(' ').toLowerCase();

  const reqMet = reqWords.filter(w => lowerText.includes(w.toLowerCase()));
  const fobUsed = fobWords.filter(w => lowerText.includes(w.toLowerCase()));

  const scoreWords = totalMinWords > 0 ? Math.min(100, Math.round((totalWords / totalMinWords) * 100)) : 100;
  const scoreReq = reqWords.length > 0 ? (reqMet.length / reqWords.length) * 100 : 100;
  const scoreFob = fobWords.length > 0 ? ((fobWords.length - fobUsed.length) / fobWords.length) * 100 : 100;

  const totalWeight = 1 + (reqWords.length > 0 ? 1 : 0) + (fobWords.length > 0 ? 1 : 0);
  const compliance = Math.min(100, Math.round((scoreWords + (reqWords.length > 0 ? scoreReq : 0) + (fobWords.length > 0 ? scoreFob : 0)) / totalWeight));

  const sectionsOk     = sections.filter((s: Section, i: number) => wordCount(responses[i]) >= s.min_words).length;
  const complianceLabel = compliance === 100
    ? '✓ Todas las secciones completas y vocabularios correctos'
    : `${sectionsOk}/${sections.length} secciones (Progreso: ${compliance}%)`;

  return (
    <div className="space-y-5">
      <p className="text-gray-700 font-medium">{question}</p>

      {/* Rúbrica */}
      {rubric_criteria && rubric_criteria.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Criterios de evaluación</p>
          <ul className="flex flex-wrap gap-2">
            {rubric_criteria.map((c: string, i: number) => (
              <li key={i} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{c}</li>
            ))}
          </ul>
        </div>
      )}

      <MetricsBar
        compliance={compliance}
        complianceLabel={complianceLabel}
        integrity={integrity}
        events={events}
      />

      {(reqWords.length > 0 || fobWords.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-2">
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

      {/* Secciones */}
      {sections.map((section: Section, i: number) => {
        const wc       = wordCount(responses[i]);
        const meetsMin = wc >= section.min_words;
        const pct      = section.min_words > 0
          ? Math.min(100, Math.round((wc / section.min_words) * 100))
          : 100;

        return (
          <div key={i} className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700">{section.label}</label>
              <span className={`text-xs font-medium ${meetsMin ? 'text-green-600' : 'text-red-500'}`}>
                {wc}/{section.min_words} palabras
              </span>
            </div>

            {/* Mini barra por sección */}
            <div className="w-full bg-gray-200 rounded-full h-1 mb-1">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${meetsMin ? 'bg-green-500' : 'bg-blue-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <textarea
              value={responses[i]}
              onChange={(e) => {
                const updated = [...responses];
                updated[i] = e.target.value;
                setResponses(updated);
              }}
              onPaste={onPaste}
              disabled={disabled}
              rows={5}
              placeholder={section.placeholder}
              className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
            />
          </div>
        );
      })}

      <button
        onClick={() => onSubmit({ responses, integrity_score: integrity }, (compliance / 100) * points)}
        disabled={disabled || totalWords === 0}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300 transition"
      >
        Enviar ensayo
      </button>
    </div>
  );
}
