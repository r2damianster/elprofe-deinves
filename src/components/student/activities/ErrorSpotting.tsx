import { useState } from 'react';

export default function ErrorSpotting({ content, onSubmit, disabled, points }: any) {
  const { text, errors, question, explanation } = content;
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Partir el texto en segmentos: errores son clicables, el resto es texto plano
  const segments: { value: string; isError: boolean }[] = [];
  let remaining = text;
  const sorted = [...errors].sort((a: string, b: string) => text.indexOf(a) - text.indexOf(b));

  for (const err of sorted) {
    const idx = remaining.indexOf(err);
    if (idx === -1) continue;
    if (idx > 0) segments.push({ value: remaining.slice(0, idx), isError: false });
    segments.push({ value: err, isError: true });
    remaining = remaining.slice(idx + err.length);
  }
  if (remaining) segments.push({ value: remaining, isError: false });

  function toggle(seg: string) {
    if (disabled || submitted) return;
    setSelected((prev) =>
      prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]
    );
  }

  function handleSubmit() {
    const correct = errors.every((e: string) => selected.includes(e)) && selected.length === errors.length;
    const score = correct ? points : Math.round(points * (selected.filter((s: string) => errors.includes(s)).length / errors.length));
    setSubmitted(true);
    onSubmit(selected, score);
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{question}</p>
      <div className="p-4 bg-gray-50 rounded-xl border leading-relaxed text-gray-800 text-base">
        {segments.map((seg, i) =>
          seg.isError ? (
            <span
              key={i}
              onClick={() => toggle(seg.value)}
              className={`cursor-pointer px-0.5 rounded transition-colors ${
                submitted
                  ? selected.includes(seg.value)
                    ? 'bg-green-200 text-green-800'
                    : 'bg-red-100 text-red-700 underline decoration-red-400'
                  : selected.includes(seg.value)
                  ? 'bg-yellow-200 text-yellow-800 underline'
                  : 'hover:bg-yellow-100 underline decoration-dashed decoration-gray-400'
              }`}
            >
              {seg.value}
            </span>
          ) : (
            <span key={i}>{seg.value}</span>
          )
        )}
      </div>
      <p className="text-xs text-gray-500">Haz clic en las partes del texto que consideras incorrectas.</p>
      {submitted && explanation && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>Explicación:</strong> {explanation}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={disabled || submitted || selected.length === 0}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300"
      >
        Enviar selección
      </button>
    </div>
  );
}
