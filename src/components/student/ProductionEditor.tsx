import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, AlertCircle, CheckCircle, Save, Send, ShieldAlert, BarChart, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ProductionRules {
  min_words: number;
  max_words: number | null;
  required_words: string[];
  prohibited_words: string[];
  instructions: string | null;
  extra_rules: {
    min_paragraphs?: number;
    forbidden_first_person?: boolean;
    required_apa_citations?: number;
    required_sections?: string[];
  };
}

interface IntegrityEvent {
  type: string;
  at: string;
  penalty: number;
  detail?: string;
}

interface Production {
  id: string;
  content: string;
  word_count: number;
  status: string;
  score: number | null;
  feedback: string | null;
  attempts: number;
  compliance_score: number;
  integrity_score: number;
  integrity_events: IntegrityEvent[];
  time_on_task: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ProductionEditor({ lessonId, onBack }: { lessonId: string; onBack: () => void }) {
  const { profile } = useAuth();

  const [rules, setRules]           = useState<ProductionRules | null>(null);
  const [production, setProduction] = useState<Production | null>(null);
  const [content, setContent]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Métricas
  const [integrityScore, setIntegrityScore]   = useState(100);
  const [complianceScore, setComplianceScore] = useState(0);
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityEvent[]>([]);
  const [timeOnTask, setTimeOnTask]           = useState(0);

  const isSubmitted = production?.status === 'submitted' || production?.status === 'reviewed';
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const devtoolsRef = useRef<number>(window.outerWidth);

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => { loadRules(); loadProduction(); }, [lessonId]);
  useEffect(() => { validateContent(); }, [content, rules]);

  // ── Timer de tiempo en tarea ──────────────────────────────────────────────

  useEffect(() => {
    if (isSubmitted) return;
    timerRef.current = setInterval(() => setTimeOnTask(t => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isSubmitted]);

  // ── Registro forense de eventos ───────────────────────────────────────────

  const addEvent = useCallback((type: string, penalty: number, detail?: string) => {
    const event: IntegrityEvent = { type, at: new Date().toISOString(), penalty, detail };
    setIntegrityEvents(prev => [...prev, event]);
    setIntegrityScore(prev => Math.max(0, prev - penalty));
  }, []);

  // Cambio de pestaña
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && !isSubmitted && !submitting) {
        addEvent('tab_switch', 10);
        alert('⚠️ Cambio de pestaña detectado. Tu integridad ha sido penalizada (-10).');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isSubmitted, submitting, addEvent]);

  // Salir de la ventana (blur)
  useEffect(() => {
    const onBlur = () => {
      if (!isSubmitted && !submitting && !document.hidden) {
        addEvent('window_blur', 5);
      }
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [isSubmitted, submitting, addEvent]);

  // Clic derecho
  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      if (!isSubmitted) {
        e.preventDefault();
        addEvent('right_click', 3);
      }
    };
    document.addEventListener('contextmenu', onContext);
    return () => document.removeEventListener('contextmenu', onContext);
  }, [isSubmitted, addEvent]);

  // Atajos de teclado sospechosos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isSubmitted) return;
      if (e.ctrlKey && e.key === 'c') addEvent('ctrl_c', 5, 'Intento de copiar texto');
      if (e.ctrlKey && e.key === 'a') addEvent('ctrl_a', 3, 'Selección total del texto');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSubmitted, addEvent]);

  // Detección de DevTools (cambio brusco de ancho de ventana)
  useEffect(() => {
    const onResize = () => {
      const diff = Math.abs(window.outerWidth - devtoolsRef.current);
      if (diff > 160 && !isSubmitted) {
        addEvent('devtools_suspected', 20, `Cambio de ancho: ${diff}px`);
        alert('⚠️ Se detectó apertura probable de herramientas de desarrollo. Integridad penalizada (-20).');
      }
      devtoolsRef.current = window.outerWidth;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isSubmitted, addEvent]);

  // Auto-envío si integridad crítica
  useEffect(() => {
    if (integrityScore <= 50 && !isSubmitted && !submitting && rules) {
      alert('⚠️ Integridad crítica (≤50%). El sistema enviará tu ensayo automáticamente.');
      submitProduction(true);
    }
  }, [integrityScore, isSubmitted, rules]);

  // ── Carga de datos ────────────────────────────────────────────────────────

  async function loadRules() {
    const { data } = await supabase
      .from('production_rules').select('*').eq('lesson_id', lessonId).maybeSingle();
    if (data) setRules(data);
  }

  async function loadProduction() {
    const { data } = await supabase
      .from('productions').select('*')
      .eq('student_id', profile?.id).eq('lesson_id', lessonId).maybeSingle();
    if (data) {
      setProduction(data);
      setContent(data.content ?? '');
      setIntegrityScore(data.integrity_score ?? 100);
      setComplianceScore(data.compliance_score ?? 0);
      setIntegrityEvents(data.integrity_events ?? []);
      setTimeOnTask(data.time_on_task ?? 0);
    }
  }

  // ── Validación de compliance ──────────────────────────────────────────────

  function validateContent() {
    if (!rules) return;
    const errors: string[] = [];
    const words      = content.trim().split(/\s+/).filter(Boolean);
    const wc         = words.length;
    const lower      = content.toLowerCase();
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const extra      = rules.extra_rules ?? {};

    let met = 0, total = 0;

    // Palabras mínimas
    total++;
    if (wc < rules.min_words) errors.push(`Mínimo ${rules.min_words} palabras (actual: ${wc})`);
    else met++;

    // Palabras máximas
    if (rules.max_words) {
      total++;
      if (wc > rules.max_words) errors.push(`Máximo ${rules.max_words} palabras (actual: ${wc})`);
      else met++;
    }

    // Palabras requeridas
    rules.required_words.forEach(w => {
      total++;
      if (!lower.includes(w.toLowerCase())) errors.push(`Falta la palabra clave: "${w}"`);
      else met++;
    });

    // Palabras prohibidas
    rules.prohibited_words.forEach(w => {
      total++;
      if (lower.includes(w.toLowerCase())) errors.push(`Palabra prohibida detectada: "${w}"`);
      else met++;
    });

    // Párrafos mínimos
    if (extra.min_paragraphs) {
      total++;
      if (paragraphs.length < extra.min_paragraphs)
        errors.push(`Mínimo ${extra.min_paragraphs} párrafos (actual: ${paragraphs.length})`);
      else met++;
    }

    // Primera persona prohibida
    if (extra.forbidden_first_person) {
      total++;
      const firstPerson = /\b(yo|me\b|mi\b|mis\b|mío|mía)\b/i.test(content);
      if (firstPerson) errors.push('No se permite redacción en primera persona (yo, me, mi...)');
      else met++;
    }

    // Citas APA requeridas: patrón (Apellido, año) o (Apellido & Apellido, año)
    if (extra.required_apa_citations) {
      total++;
      const apaPattern = /\([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s*[&y]\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?,\s*\d{4}\)/g;
      const found = (content.match(apaPattern) || []).length;
      if (found < extra.required_apa_citations)
        errors.push(`Requiere al menos ${extra.required_apa_citations} cita(s) APA (encontradas: ${found})`);
      else met++;
    }

    // Secciones requeridas
    if (extra.required_sections?.length) {
      extra.required_sections.forEach(section => {
        total++;
        if (!lower.includes(section.toLowerCase()))
          errors.push(`Falta la sección: "${section}"`);
        else met++;
      });
    }

    setValidationErrors(errors);
    setComplianceScore(total > 0 ? Math.round((met / total) * 100) : 0);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!isSubmitted) {
      e.preventDefault();
      addEvent('paste_attempt', 15, 'Intento de pegar texto externo');
      alert('⚠️ Pegar texto está prohibido. Penalización: -15 integridad.');
    }
  };

  // ── Persistencia ──────────────────────────────────────────────────────────

  function buildPayload(status?: string) {
    return {
      content,
      word_count: countWords(content),
      compliance_score: complianceScore,
      integrity_score: integrityScore,
      integrity_events: integrityEvents,
      time_on_task: timeOnTask,
      ...(status ? { status, submitted_at: new Date().toISOString() } : {}),
    };
  }

  async function saveProduction() {
    setSaving(true);
    try {
      if (production) {
        await supabase.from('productions').update(buildPayload()).eq('id', production.id);
      } else {
        const { data } = await supabase.from('productions')
          .insert({ student_id: profile?.id!, lesson_id: lessonId, status: 'draft', ...buildPayload() })
          .select().single();
        if (data) setProduction(data);
      }
      alert('Borrador guardado.');
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function submitProduction(forced = false) {
    if (!forced && validationErrors.length > 0) { alert('Corrige los errores antes de enviar.'); return; }
    if (!forced && !confirm('¿Enviar producción? No podrás editarla después.')) return;
    setSubmitting(true);
    try {
      if (production) {
        await supabase.from('productions').update(buildPayload('submitted')).eq('id', production.id);
      } else {
        await supabase.from('productions').insert({
          student_id: profile?.id!, lesson_id: lessonId, ...buildPayload('submitted'),
        });
      }
      if (!forced) alert('Producción enviada exitosamente.');
      loadProduction();
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setSubmitting(false); }
  }

  async function retryProduction() {
    if (!confirm('Esto consume tu último intento y reinicia el ensayo. ¿Proceder?')) return;
    setSubmitting(true);
    try {
      if (production) {
        await supabase.from('productions').update({
          status: 'draft', score: null, feedback: null, submitted_at: null,
          integrity_score: 100, integrity_events: [], time_on_task: 0,
          attempts: (production.attempts || 1) + 1,
        }).eq('id', production.id);
        setIntegrityScore(100);
        setIntegrityEvents([]);
        setTimeOnTask(0);
        loadProduction();
      }
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }

  // ── Derivados ─────────────────────────────────────────────────────────────

  const wordCount = countWords(content);
  const isValid   = validationErrors.length === 0 && wordCount > 0;
  const attempts  = production?.attempts || 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-white shadow z-10 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-800 mb-3 transition text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver a la lección
          </button>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Redacción Final</h1>
              {rules?.instructions && <p className="text-gray-600 mt-1 text-sm">{rules.instructions}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" /> {formatTime(timeOnTask)}
              </span>
              {isSubmitted && (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                  Intento {attempts} de 2
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Barras de métricas */}
        <div className="bg-gray-800 text-white px-4 py-3">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs font-semibold mb-1 uppercase tracking-wide">
                <span className="flex items-center gap-1"><BarChart className="w-3 h-3" /> Cumplimiento</span>
                <span>{complianceScore}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-500 ${complianceScore === 100 ? 'bg-green-400' : complianceScore > 50 ? 'bg-blue-400' : 'bg-red-400'}`}
                  style={{ width: `${complianceScore}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs font-semibold mb-1 uppercase tracking-wide">
                <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-red-300" /> Integridad</span>
                <span className={integrityScore <= 50 ? 'text-red-400 font-bold' : 'text-green-300'}>{integrityScore}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-500 ${integrityScore > 80 ? 'bg-green-400' : integrityScore > 50 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${integrityScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Calificación del profesor */}
        {production?.status === 'reviewed' && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-blue-900">Revisado por el Profesor</h3>
              {attempts < 2 && (
                <button onClick={retryProduction} disabled={submitting}
                  className="bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                  Usar Intento Extra
                </button>
              )}
            </div>
            <p className="text-blue-800 font-medium mb-3">
              Calificación: <span className="text-xl font-bold bg-white px-2 py-0.5 rounded border">{production.score}/100</span>
            </p>
            {production.feedback && (
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Comentarios:</p>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{production.feedback}</p>
              </div>
            )}
          </div>
        )}

        {/* Requisitos */}
        {rules && !isSubmitted && (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" /> Requisitos de Escritura
            </h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• Mínimo <strong>{rules.min_words}</strong> palabras{rules.max_words ? `, máximo ${rules.max_words}` : ''}.</li>
              {rules.required_words.length > 0 && <li>• Debes incluir: <strong className="text-green-700">{rules.required_words.join(', ')}</strong></li>}
              {rules.prohibited_words.length > 0 && <li>• Prohibido usar: <strong className="text-red-600">{rules.prohibited_words.join(', ')}</strong></li>}
              {rules.extra_rules?.min_paragraphs && <li>• Mínimo <strong>{rules.extra_rules.min_paragraphs}</strong> párrafos.</li>}
              {rules.extra_rules?.forbidden_first_person && <li>• Redacción en tercera persona (sin "yo", "me", "mi").</li>}
              {rules.extra_rules?.required_apa_citations && <li>• Al menos <strong>{rules.extra_rules.required_apa_citations}</strong> cita(s) en formato APA.</li>}
              {rules.extra_rules?.required_sections?.map(s => <li key={s}>• Debe incluir la sección: <strong>"{s}"</strong></li>)}
            </ul>
          </div>
        )}

        {/* Errores de validación */}
        {validationErrors.length > 0 && !isSubmitted && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h4 className="font-bold text-red-800 mb-2 text-sm uppercase">Pendiente por corregir:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {isValid && wordCount > 0 && !isSubmitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-green-800 font-bold">El ensayo cumple todos los requisitos.</p>
          </div>
        )}

        {/* Editor */}
        <div className="bg-white rounded-xl shadow p-6 flex flex-col flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-800">Hoja de Trabajo</h3>
            <span className={`text-sm font-bold px-2 py-0.5 rounded ${wordCount < (rules?.min_words || 0) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {wordCount} palabras
            </span>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onPaste={handlePaste}
            disabled={isSubmitted || integrityScore <= 50 || submitting}
            rows={16}
            placeholder="Escribe tu ensayo aquí. No se permite pegar texto externo."
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition resize-none text-gray-700 leading-relaxed"
          />
          {!isSubmitted && (
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button onClick={saveProduction} disabled={saving || wordCount === 0 || submitting}
                className="flex-1 bg-gray-100 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-200 transition font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar borrador'}
              </button>
              <button onClick={() => submitProduction(false)} disabled={submitting || !isValid || integrityScore <= 50}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-200">
                <Send className="w-4 h-4" /> {submitting ? 'Enviando...' : 'Entregar Ensayo'}
              </button>
            </div>
          )}
        </div>

        {/* Log de eventos de integridad (visible para el estudiante) */}
        {integrityEvents.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-bold text-gray-700 text-sm uppercase mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" /> Registro de Eventos de Integridad
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {integrityEvents.map((ev, i) => (
                <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
                  <span className="font-medium text-red-700">{ev.type.replace(/_/g, ' ')}</span>
                  {ev.detail && <span className="text-gray-500 mx-2">{ev.detail}</span>}
                  <span className="text-red-600 font-bold">-{ev.penalty}</span>
                  <span className="text-gray-400 ml-2">{new Date(ev.at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
