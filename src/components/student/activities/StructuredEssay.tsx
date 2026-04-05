import { useState } from 'react';

interface Section {
  label: string;
  min_words: number;
  placeholder: string;
}

export default function StructuredEssay({ content, onSubmit, disabled, points }: any) {
  const { question, sections, rubric_criteria }: { question: string; sections: Section[]; rubric_criteria?: string[] } = content;
  const [responses, setResponses] = useState<string[]>(sections.map(() => ''));

  function wordCount(text: string) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  const allMeetMin = sections.every((s: Section, i: number) => wordCount(responses[i]) >= s.min_words);

  function handleSubmit() {
    onSubmit(responses, points);
  }

  return (
    <div className="space-y-5">
      <p className="text-gray-700 font-medium">{question}</p>

      {rubric_criteria && rubric_criteria.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">Criterios de evaluación</p>
          <ul className="flex flex-wrap gap-2">
            {rubric_criteria.map((c: string, i: number) => (
              <li key={i} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{c}</li>
            ))}
          </ul>
        </div>
      )}

      {sections.map((section: Section, i: number) => {
        const wc = wordCount(responses[i]);
        const meetsMin = wc >= section.min_words;
        return (
          <div key={i} className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700">{section.label}</label>
              <span className={`text-xs ${meetsMin ? 'text-green-600' : 'text-red-500'}`}>
                {wc} / {section.min_words} palabras mínimas
              </span>
            </div>
            <textarea
              value={responses[i]}
              onChange={(e) => {
                const updated = [...responses];
                updated[i] = e.target.value;
                setResponses(updated);
              }}
              disabled={disabled}
              rows={5}
              placeholder={section.placeholder}
              className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
            />
          </div>
        );
      })}

      <button
        onClick={handleSubmit}
        disabled={disabled || !allMeetMin}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300"
      >
        Enviar ensayo
      </button>
    </div>
  );
}
