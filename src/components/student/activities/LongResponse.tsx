import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, BarChart } from 'lucide-react';

export default function LongResponse({ content, onSubmit, disabled, points }: any) {
  const { question, min_characters = 0, max_characters = 3000, show_word_count = true } = content;

  const [text, setText]                   = useState('');
  const [integrityScore, setIntegrityScore] = useState(100);
  const [events, setEvents]               = useState<{ label: string; penalty: number }[]>([]);

  const charCount    = text.length;
  const wordCount    = text.trim() ? text.trim().split(/\s+/).length : 0;
  const meetsMin     = charCount >= min_characters;
  const compliance   = min_characters > 0
    ? Math.min(100, Math.round((charCount / min_characters) * 100))
    : 100;

  // ── Detección de integridad ──────────────────────────────────────────────

  const penalize = useCallback((label: string, penalty: number) => {
    if (disabled) return;
    setEvents(prev => [...prev, { label, penalty }]);
    setIntegrityScore(prev => Math.max(0, prev - penalty));
  }, [disabled]);

  // Cambio de pestaña
  useEffect(() => {
    if (disabled) return;
    const handler = () => { if (document.hidden) penalize('Cambio de pestaña', 10); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [disabled, penalize]);

  // Salir de la ventana
  useEffect(() => {
    if (disabled) return;
    const handler = () => { if (!document.hidden) penalize('Salida de ventana', 5); };
    window.addEventListener('blur', handler);
    return () => window.removeEventListener('blur', handler);
  }, [disabled, penalize]);

  // Clic derecho
  useEffect(() => {
    if (disabled) return;
    const handler = (e: MouseEvent) => { e.preventDefault(); penalize('Clic derecho', 3); };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, [disabled, penalize]);

  // ── Colores de métricas ───────────────────────────────────────────────────

  function barColor(pct: number, invert = false) {
    const high = invert ? pct < 50 : pct >= 80;
    const mid  = invert ? pct < 80 : pct >= 50;
    if (high) return 'bg-green-500';
    if (mid)  return 'bg-yellow-400';
    return 'bg-red-500';
  }

  function textColor(pct: number) {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{question}</p>

      {/* Barras de métricas */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-gray-800 rounded-xl text-white text-xs">

        {/* Cumplimiento */}
        <div>
          <div className="flex justify-between mb-1 font-semibold uppercase tracking-wide">
            <span className="flex items-center gap-1"><BarChart className="w-3 h-3" /> Cumplimiento</span>
            <span className={compliance === 100 ? 'text-green-400' : 'text-yellow-300'}>{compliance}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${barColor(compliance)}`}
              style={{ width: `${compliance}%` }}
            />
          </div>
          <p className="mt-1 text-gray-400">
            {charCount < min_characters
              ? `Faltan ${min_characters - charCount} caracteres`
              : '✓ Mínimo alcanzado'}
          </p>
        </div>

        {/* Integridad */}
        <div>
          <div className="flex justify-between mb-1 font-semibold uppercase tracking-wide">
            <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-red-300" /> Integridad</span>
            <span className={integrityScore <= 50 ? 'text-red-400 font-bold' : 'text-green-400'}>{integrityScore}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${barColor(integrityScore)}`}
              style={{ width: `${integrityScore}%` }}
            />
          </div>
          <p className="mt-1 text-gray-400">
            {events.length === 0 ? 'Sin infracciones' : `${events.length} infracción(es) detectada(s)`}
          </p>
        </div>
      </div>

      {/* Log de eventos (solo si hay infracciones) */}
      {events.length > 0 && (
        <div className="space-y-1 px-1">
          {events.map((ev, i) => (
            <div key={i} className="flex justify-between text-xs px-3 py-1 bg-red-50 border border-red-100 rounded-lg">
              <span className="text-red-700 font-medium">{ev.label}</span>
              <span className="text-red-500 font-bold">-{ev.penalty} integridad</span>
            </div>
          ))}
        </div>
      )}

      {/* Textarea */}
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, max_characters))}
          onPaste={(e) => { e.preventDefault(); penalize('Intento de pegar texto', 15); }}
          disabled={disabled}
          rows={8}
          placeholder="Escribe tu respuesta aquí..."
          className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
          <span className={`font-medium ${textColor(compliance)}`}>
            {charCount}/{min_characters} mín.
          </span>
          {show_word_count && (
            <span>{wordCount} palabras · {charCount}/{max_characters} caracteres</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onSubmit({ text, integrity_score: integrityScore }, points)}
        disabled={disabled || !meetsMin}
        className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold disabled:bg-gray-300 transition"
      >
        Enviar respuesta
      </button>
    </div>
  );
}
