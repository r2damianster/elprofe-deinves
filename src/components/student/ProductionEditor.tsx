import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, AlertCircle, CheckCircle, Save, Send,
  ShieldAlert, BarChart, Clock, FileText, Info, X,
  Sparkles, PanelLeftClose, PanelLeftOpen, ThumbsUp, Lightbulb,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveField } from '../../lib/i18n';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ProductionRules {
  min_words: number;
  max_words: number | null;
  required_words: { es: string[]; en: string[] } | string[] | null;
  prohibited_words: { es: string[]; en: string[] } | string[] | null;
  instructions: string | { es: string; en: string } | null;
  extra_rules: {
    min_paragraphs?: number;
    forbidden_first_person?: boolean;
    required_apa_citations?: number;
    required_sections?: string[];
  };
  compliance_threshold: number;  // % mínimo requerido para submit (default 100)
  integrity_threshold: number;   // % mínimo de integridad para advertencia (default 0)
}

function resolveWords(field: { es: string[]; en: string[] } | string[] | null | undefined, lang: 'es' | 'en'): string[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  return field[lang] ?? [];
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
  attempts: number | null;
  compliance_score: number | null;
  integrity_score: number | null;
  integrity_events: IntegrityEvent[] | null;
  time_on_task: number | null;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'warning';
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
  const [rulesLoading, setRulesLoading] = useState(true);

  // Métricas
  const [integrityScore, setIntegrityScore]   = useState(100);
  const [complianceScore, setComplianceScore] = useState(0);
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityEvent[]>([]);
  const [timeOnTask, setTimeOnTask]           = useState(0);

  // UI state
  const [activeTab, setActiveTab]         = useState<'instructions' | 'status' | 'integrity' | 'ia'>('instructions');
  const [toasts, setToasts]               = useState<Toast[]>([]);
  const [pasteBanner, setPasteBanner]     = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lastSaved, setLastSaved]         = useState<Date | null>(null);
  const [focusMode, setFocusMode]         = useState(false);
  const autoSaveRef                       = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorsRef                         = useRef<HTMLDivElement | null>(null);

  // IA feedback state
  // Estado de grupo
  const [myGroupId, setMyGroupId]   = useState<string | null>(null);
  const [groupLock, setGroupLock]   = useState<{ student_name: string; submitted_at: string } | null>(null);

  const [aiFeedback, setAiFeedback] = useState<{
    score: number;
    summary: string;
    strengths: string[];
    improvements: string[];
  } | null>(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState<string | null>(null);
  const [aiCooldownMin, setAiCooldownMin] = useState<number | null>(null);

  const AI_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 horas
  const aiStorageKey   = `ai_review_${lessonId}`;

  const isSubmitted = production?.status === 'submitted' || production?.status === 'reviewed';
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const devtoolsRef = useRef<number>(window.outerWidth);

  // ── Toast helper ─────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => { loadRules(); loadProduction(); loadGroupLock(); }, [lessonId]);
  useEffect(() => { validateContent(); }, [content, rules]);

  // ── Timer de tiempo en tarea ──────────────────────────────────────────────

  useEffect(() => {
    if (isSubmitted) return;
    timerRef.current = setInterval(() => setTimeOnTask(t => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isSubmitted]);

  // ── Auto-guardado silencioso cada 30 segundos ─────────────────────────────

  useEffect(() => {
    if (isSubmitted) return;
    autoSaveRef.current = setInterval(async () => {
      if (content.trim().length === 0) return;
      try {
        const payload = buildPayload();
        if (production) {
          await supabase.from('productions').update(payload).eq('id', production.id);
        } else if (profile?.id) {
          const { data } = await supabase.from('productions')
            .insert({ student_id: profile.id, lesson_id: lessonId, status: 'draft', ...payload })
            .select().single();
          if (data) setProduction(data);
        }
        setLastSaved(new Date());
      } catch {
        // silencioso
      }
    }, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [isSubmitted, content, production, profile?.id]);

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
        showToast('Cambio de pestaña detectado. -10 integridad.', 'warning');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isSubmitted, submitting, addEvent, showToast]);

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
        showToast('DevTools detectado. -20 integridad.', 'warning');
      }
      devtoolsRef.current = window.outerWidth;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isSubmitted, addEvent, showToast]);

  // Auto-envío si integridad crítica
  useEffect(() => {
    if (integrityScore <= 50 && !isSubmitted && !submitting && rules) {
      showToast('Integridad crítica. Enviando ensayo...', 'error');
      submitProduction(true);
    }
  }, [integrityScore, isSubmitted, rules]);

  // ── Carga de datos ────────────────────────────────────────────────────────

  async function loadRules() {
    setRulesLoading(true);
    const { data } = await supabase
      .from('production_rules').select('*').eq('lesson_id', lessonId).maybeSingle();
    if (data) setRules(data);
    setRulesLoading(false);
  }

  async function loadProduction() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('productions').select('*')
      .eq('student_id', profile.id).eq('lesson_id', lessonId).maybeSingle();
    if (data) {
      setProduction(data);
      setContent(data.content ?? '');
      setIntegrityScore(data.integrity_score ?? 100);
      setComplianceScore(data.compliance_score ?? 0);
      setIntegrityEvents(data.integrity_events ?? []);
      setTimeOnTask(data.time_on_task ?? 0);
    }
  }

  async function loadGroupLock() {
    if (!profile?.id) return;
    const { data: myGroups } = await supabase
      .from('group_members').select('group_id').eq('student_id', profile.id);
    if (!myGroups?.length) return;

    const { data: assignment } = await (supabase as any)
      .from('group_lesson_assignments').select('group_id')
      .eq('lesson_id', lessonId).in('group_id', myGroups.map((g: any) => g.group_id))
      .maybeSingle();
    if (!assignment) return;
    setMyGroupId(assignment.group_id);

    const { data: lock } = await (supabase as any)
      .from('group_production_locks')
      .select('student_id, submitted_at, profiles!student_id(full_name)')
      .eq('group_id', assignment.group_id).eq('lesson_id', lessonId).maybeSingle();

    if (lock && lock.student_id !== profile.id) {
      setGroupLock({
        student_name: lock.profiles?.full_name ?? 'Un compañero',
        submitted_at: lock.submitted_at,
      });
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

    // Palabras requeridas (se normalizan eliminando puntuación periférica)
    resolveWords(rules.required_words, 'es').forEach(w => {
      total++;
      const clean = w.replace(/^[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ]+|[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ]+$/g, '').toLowerCase();
      if (!lower.includes(clean)) errors.push(`Falta la palabra clave: "${w}"`);
      else met++;
    });

    // Palabras prohibidas
    resolveWords(rules.prohibited_words, 'es').forEach(w => {
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
      setPasteBanner(true);
      setTimeout(() => setPasteBanner(false), 2500);
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
          .insert({ student_id: profile!.id, lesson_id: lessonId, status: 'draft' as const, ...buildPayload() })
          .select().single();
        if (data) setProduction(data);
      }
      setLastSaved(new Date());
      showToast('Borrador guardado', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function submitProduction(forced = false) {
    if (!rules) { showToast('Las reglas aún no han cargado. Espera un momento.', 'warning'); return; }
    if (!forced && validationErrors.length > 0) {
      errorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveTab('status');
      return;
    }
    setSubmitting(true);
    try {
      if (production) {
        await supabase.from('productions').update(buildPayload('submitted')).eq('id', production.id);
      } else {
        await supabase.from('productions').insert({
          student_id: profile!.id, lesson_id: lessonId, ...buildPayload('submitted'),
        });
      }

      // Registrar lock grupal si corresponde (solo el primero en entregar)
      if (myGroupId) {
        const prodId = production?.id ?? null;
        await (supabase as any).from('group_production_locks').upsert(
          { group_id: myGroupId, lesson_id: lessonId, student_id: profile!.id, production_id: prodId },
          { onConflict: 'group_id,lesson_id', ignoreDuplicates: true }
        );
      }

      // Bug-009 Fix A: garantizar student_progress aunque la lección no tenga actividades
      await (supabase as any).from('student_progress').upsert({
        student_id:            profile!.id,
        lesson_id:             lessonId,
        completion_percentage: 100,
        completed_at:          new Date().toISOString(),
        attempts:              1,
        started_at:            new Date().toISOString(),
      }, { onConflict: 'student_id,lesson_id', ignoreDuplicates: false });

      if (!forced) {
        setSubmitSuccess(true);
        setTimeout(() => onBack(), 2000);
        return;
      }
      loadProduction();
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  }

  async function retryProduction() {
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
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setSubmitting(false); }
  }

  // ── Cooldown IA ───────────────────────────────────────────────────────────

  function getAiCooldownRemaining(): number {
    const raw = localStorage.getItem(aiStorageKey);
    if (!raw) return 0;
    const elapsed = Date.now() - parseInt(raw, 10);
    return Math.max(0, AI_COOLDOWN_MS - elapsed);
  }

  // Inicializa y refresca el cooldown cada minuto
  useEffect(() => {
    const refresh = () => {
      const ms = getAiCooldownRemaining();
      setAiCooldownMin(ms > 0 ? Math.ceil(ms / 60000) : null);
    };
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [lessonId]);

  // ── Análisis con IA ───────────────────────────────────────────────────────

  async function analyzeWithAI() {
    const remaining = getAiCooldownRemaining();
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      showToast(`Disponible en ${mins} min. Solo 1 análisis cada 2 horas.`, 'warning');
      return;
    }

    setAiLoading(true);
    setAiFeedback(null);
    setAiError(null);
    setActiveTab('ia');
    try {
      const { data: invokeData, error: invokeError } = await (supabase as any).functions.invoke('ai-enhance', {
        body: {
          task: 'review_production',
          lang: 'es',
          data: {
            content,
            instructions: rules?.instructions
              ? resolveField(rules.instructions, 'es')
              : 'Redacción libre',
            min_words: rules?.min_words,
            max_words: rules?.max_words,
            required_words: resolveWords(rules?.required_words, 'es'),
            prohibited_words: resolveWords(rules?.prohibited_words, 'es'),
          },
        },
      });
      if (invokeError) throw new Error(invokeError.message);
      const json = invokeData;
      // Guardar timestamp del uso exitoso
      localStorage.setItem(aiStorageKey, Date.now().toString());
      setAiCooldownMin(120);
      setAiFeedback(json.result);
    } catch (err: any) {
      setAiError(err.message);
      showToast('Error al analizar con IA', 'error');
    } finally {
      setAiLoading(false);
    }
  }

  // ── Derivados ─────────────────────────────────────────────────────────────

  const wordCount           = countWords(content);
  const complianceThreshold = rules?.compliance_threshold ?? 100;
  const integrityThreshold  = rules?.integrity_threshold  ?? 0;
  const isValid = !rulesLoading && rules !== null
    && wordCount >= rules.min_words
    && complianceScore >= complianceThreshold;
  const attempts  = production?.attempts || 1;

  // Colores del contador de palabras
  const minWords = rules?.min_words ?? 0;
  const pct      = minWords > 0 ? Math.min(100, Math.round((wordCount / minWords) * 100)) : 100;
  const wordBarColor =
    wordCount >= minWords
      ? 'bg-green-500'
      : pct >= 80
      ? 'bg-yellow-400'
      : 'bg-red-500';
  const wordCountColor =
    wordCount >= minWords
      ? 'text-green-700 bg-green-50 border-green-200'
      : pct >= 80
      ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
      : 'text-red-700 bg-red-50 border-red-200';

  // Texto del auto-guardado
  const savedAgo = lastSaved
    ? (() => {
        const diff = Math.round((Date.now() - lastSaved.getTime()) / 1000);
        if (diff < 60) return `hace ${diff}s`;
        return `hace ${Math.round(diff / 60)}min`;
      })()
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  // Grupo ya entregó — mostrar pantalla de solo lectura
  if (groupLock) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Producción ya entregada</h2>
          <p className="text-gray-600 mb-1">
            <strong>{groupLock.student_name}</strong> ya entregó la producción del grupo.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            {new Date(groupLock.submitted_at).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          <button onClick={onBack} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
            Volver a la lección
          </button>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Produccion enviada</h2>
          <p className="text-gray-600">Tu ensayo fue entregado exitosamente. El profesor lo revisara pronto.</p>
          <p className="text-sm text-gray-400 mt-4">Volviendo a la leccion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header limpio */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Volver a la leccion
          </button>
          <h1 className="font-bold text-gray-800 text-lg">Redaccion Final</h1>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Clock className="w-4 h-4" /> {formatTime(timeOnTask)}
            </span>
            {isSubmitted && (
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                Intento {attempts} de 2
              </span>
            )}
            <button
              onClick={() => setFocusMode(f => !f)}
              title={focusMode ? 'Mostrar panel' : 'Modo enfoque'}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-400 px-2.5 py-1.5 rounded-lg transition"
            >
              {focusMode
                ? <><PanelLeftOpen className="w-3.5 h-3.5" /> Panel</>
                : <><PanelLeftClose className="w-3.5 h-3.5" /> Enfoque</>
              }
            </button>
          </div>
        </div>
      </header>

      {/* Layout principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">

        {/* Calificacion del profesor (si revisado) — antes del doble panel */}
        {production?.status === 'reviewed' && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
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
              Calificacion: <span className="text-xl font-bold bg-white px-2 py-0.5 rounded border">{production.score}/10</span>
            </p>
            {production.feedback && (
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Comentarios:</p>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{production.feedback}</p>
              </div>
            )}
          </div>
        )}

        {/* Doble panel */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* Panel izquierdo — informativo (40%) */}
          <aside className={`flex flex-col gap-4 transition-all duration-300 ${focusMode ? 'hidden' : 'w-full lg:w-2/5'}`}>

            {/* Tabs del panel */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="flex border-b">
                {(
                  [
                    { id: 'instructions', label: 'Instrucciones', icon: FileText    },
                    { id: 'status',       label: 'Estado',        icon: Info        },
                    { id: 'integrity',    label: 'Integridad',    icon: ShieldAlert },
                    { id: 'ia',           label: 'IA',            icon: Sparkles    },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition border-b-2 ${
                      activeTab === id
                        ? 'border-blue-600 text-blue-700 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {id === 'status' && validationErrors.length > 0 && !isSubmitted && (
                      <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {validationErrors.length}
                      </span>
                    )}
                    {id === 'integrity' && integrityEvents.length > 0 && (
                      <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {integrityEvents.length}
                      </span>
                    )}
                    {id === 'ia' && aiFeedback && (
                      <span className="ml-1 bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {aiFeedback.score}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab: Instrucciones */}
              {activeTab === 'instructions' && (
                <div className="p-5">
                  {rules?.instructions && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-blue-800 leading-relaxed">
                        {resolveField(rules.instructions, 'es')}
                      </p>
                    </div>
                  )}
                  {rules ? (
                    <>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Requisitos</h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                          Minimo <strong className="mx-1">{rules.min_words}</strong> palabras
                          {rules.max_words ? <>, maximo <strong className="mx-1">{rules.max_words}</strong></> : ''}.
                        </li>
                        {resolveWords(rules.required_words, 'es').length > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-green-400 shrink-0" />
                            Incluir: <strong className="text-green-700 ml-1">{resolveWords(rules.required_words, 'es').join(', ')}</strong>
                          </li>
                        )}
                        {resolveWords(rules.prohibited_words, 'es').length > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-red-400 shrink-0" />
                            Prohibido: <strong className="text-red-600 ml-1">{resolveWords(rules.prohibited_words, 'es').join(', ')}</strong>
                          </li>
                        )}
                        {rules.extra_rules?.min_paragraphs && (
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                            Minimo <strong className="mx-1">{rules.extra_rules.min_paragraphs}</strong> parrafos.
                          </li>
                        )}
                        {rules.extra_rules?.forbidden_first_person && (
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                            Redaccion en tercera persona (sin "yo", "me", "mi").
                          </li>
                        )}
                        {rules.extra_rules?.required_apa_citations && (
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                            Al menos <strong className="mx-1">{rules.extra_rules.required_apa_citations}</strong> cita(s) APA.
                          </li>
                        )}
                        {rules.extra_rules?.required_sections?.map(s => (
                          <li key={s} className="flex items-start gap-2">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                            Seccion requerida: <strong className="ml-1">"{s}"</strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 italic">El docente no ha configurado requisitos especificos. Redacta libremente.</p>
                  )}
                </div>
              )}

              {/* Tab: Estado */}
              {activeTab === 'status' && (
                <div className="p-5 space-y-4">
                  {/* Metricas */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                      <span className="flex items-center gap-1"><BarChart className="w-3 h-3" /> Cumplimiento</span>
                      <span className={complianceScore >= complianceThreshold ? 'text-green-600' : complianceScore > 50 ? 'text-blue-600' : 'text-red-600'}>
                        {complianceScore}%
                        {complianceThreshold < 100 && (
                          <span className="ml-1 text-gray-400 font-normal">/ mín. {complianceThreshold}%</span>
                        )}
                      </span>
                    </div>
                    <div className="relative w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          complianceScore >= complianceThreshold ? 'bg-green-500' : complianceScore > 50 ? 'bg-blue-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${complianceScore}%` }}
                      />
                      {complianceThreshold > 0 && complianceThreshold < 100 && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-purple-500 opacity-70"
                          style={{ left: `${complianceThreshold}%` }} />
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                      <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Integridad</span>
                      <span className={integrityScore <= 50 ? 'text-red-600 font-bold' : 'text-green-600'}>
                        {integrityScore}%
                        {integrityThreshold > 0 && (
                          <span className="ml-1 text-gray-400 font-normal">/ mín. {integrityThreshold}%</span>
                        )}
                      </span>
                    </div>
                    <div className="relative w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          integrityScore > 80 ? 'bg-green-500' : integrityScore > 50 ? 'bg-yellow-400' : 'bg-red-500'
                        }`}
                        style={{ width: `${integrityScore}%` }}
                      />
                      {integrityThreshold > 0 && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500 opacity-70"
                          style={{ left: `${integrityThreshold}%` }} />
                      )}
                    </div>
                    {integrityThreshold > 0 && integrityScore < integrityThreshold && !isSubmitted && (
                      <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Integridad por debajo del mínimo requerido ({integrityThreshold}%).
                      </p>
                    )}
                  </div>

                  {/* Errores de validacion */}
                  {!isSubmitted && (
                    <div ref={errorsRef}>
                      {validationErrors.length > 0 ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <h4 className="font-bold text-red-800 mb-2 text-xs uppercase tracking-wide">Pendiente por corregir:</h4>
                          <ul className="space-y-1">
                            {validationErrors.map((e, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                {e}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : isValid && wordCount > 0 ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                          <p className="text-green-800 font-semibold text-sm">El ensayo cumple todos los requisitos.</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic text-center py-2">
                          Escribe tu ensayo para ver el estado de validacion.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Integridad */}
              {activeTab === 'integrity' && (
                <div className="p-5">
                  {!isSubmitted && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <h4 className="font-bold text-amber-800 mb-2 text-xs uppercase tracking-wide">Reglas</h4>
                      <ul className="space-y-1.5 text-sm text-amber-900">
                        <li>Cambiar de pestana: <strong>-10</strong></li>
                        <li>Perder el foco: <strong>-5</strong></li>
                        <li>Pegar texto: <strong>-15</strong> (bloqueado)</li>
                        <li>Copiar (Ctrl+C): <strong>-5</strong></li>
                        <li>Clic derecho: <strong>-3</strong></li>
                        <li className="text-red-700 font-semibold">Integridad &le;50 envio automatico.</li>
                      </ul>
                    </div>
                  )}
                  {integrityEvents.length > 0 ? (
                    <div>
                      <h4 className="font-bold text-gray-600 text-xs uppercase tracking-wide mb-2">Registro de eventos</h4>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {integrityEvents.map((ev, i) => (
                          <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
                            <span className="font-medium text-red-700 truncate">{ev.type.replace(/_/g, ' ')}</span>
                            {ev.detail && <span className="text-gray-500 mx-2 truncate hidden sm:block">{ev.detail}</span>}
                            <span className="text-red-600 font-bold shrink-0">-{ev.penalty}</span>
                            <span className="text-gray-400 ml-2 shrink-0">{new Date(ev.at).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic text-center py-4">Sin eventos registrados.</p>
                  )}
                </div>
              )}

              {/* Tab: IA */}
              {activeTab === 'ia' && (
                <div className="p-5">
                  {aiLoading && (
                    <div className="flex flex-col items-center gap-3 py-8 text-purple-600">
                      <Sparkles className="w-8 h-8 animate-pulse" />
                      <p className="text-sm font-medium">Analizando tu ensayo...</p>
                    </div>
                  )}

                  {aiError && !aiLoading && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                      <p className="font-semibold mb-1">Error al analizar</p>
                      <p className="text-xs">{aiError}</p>
                    </div>
                  )}

                  {aiFeedback && !aiLoading && (
                    <div className="space-y-4">
                      {/* Score */}
                      <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <div>
                          <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-0.5">Puntuación estimada</p>
                          <p className="text-xs text-purple-700 leading-snug">{aiFeedback.summary}</p>
                        </div>
                        <span className={`text-3xl font-black shrink-0 ml-3 ${
                          aiFeedback.score >= 80 ? 'text-green-600' : aiFeedback.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {aiFeedback.score}
                        </span>
                      </div>

                      {/* Fortalezas */}
                      {aiFeedback.strengths.length > 0 && (
                        <div>
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
                            <ThumbsUp className="w-3.5 h-3.5" /> Fortalezas
                          </h4>
                          <ul className="space-y-1.5">
                            {aiFeedback.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Mejoras */}
                      {aiFeedback.improvements.length > 0 && (
                        <div>
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
                            <Lightbulb className="w-3.5 h-3.5" /> Sugerencias de mejora
                          </h4>
                          <ul className="space-y-1.5">
                            {aiFeedback.improvements.map((m, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                {m}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-xs text-gray-400 text-center pt-1">
                        Feedback orientativo. La calificación oficial la asigna el profesor.
                      </p>
                    </div>
                  )}

                  {!aiFeedback && !aiLoading && !aiError && (
                    <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
                      <Sparkles className="w-8 h-8" />
                      <p className="text-sm text-center">Escribe al menos {rules?.min_words ?? 50} palabras y pulsa el botón de análisis.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Panel derecho — editor (60% normal, 100% en modo enfoque) */}
          <section className={`flex flex-col gap-4 transition-all duration-300 ${focusMode ? 'w-full' : 'w-full lg:w-3/5'}`}>
            <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-800">Hoja de Trabajo</h3>
                {savedAgo && (
                  <span className="text-xs text-gray-400">Guardado automaticamente {savedAgo}</span>
                )}
              </div>

              {/* Banner de paste bloqueado */}
              {pasteBanner && (
                <div className="mb-3 bg-red-100 border border-red-300 text-red-800 text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Pegar texto esta prohibido. Penalizacion: -15 integridad.
                </div>
              )}

              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                onPaste={handlePaste}
                disabled={isSubmitted || integrityScore <= 50 || submitting}
                rows={20}
                placeholder="Escribe tu ensayo aqui. No se permite pegar texto externo."
                className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition resize-none text-gray-700 leading-relaxed text-base lg:min-h-[480px]"
              />

              {/* Contador de palabras con barra de progreso */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-sm font-bold px-2.5 py-0.5 rounded-md border ${wordCountColor}`}>
                    {wordCount} palabras
                  </span>
                  {rules && (
                    <span className="text-xs text-gray-400">
                      {rules.max_words
                        ? `${rules.min_words} – ${rules.max_words} requeridas`
                        : `Minimo ${rules.min_words}`}
                    </span>
                  )}
                </div>
                {rules && (
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${wordBarColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {savedAgo === null && content.length > 0 && !isSubmitted && (
                  <p className="text-xs text-gray-400 mt-1">Auto-guardado cada 30 segundos</p>
                )}
              </div>

              {/* Botón IA — visible al cumplir mínimo de palabras */}
              {wordCount >= (rules?.min_words ?? 50) && (
                <div className="mt-4">
                  <button
                    onClick={analyzeWithAI}
                    disabled={aiLoading || aiCooldownMin !== null}
                    title={aiCooldownMin ? `Disponible en ${aiCooldownMin} min` : 'Analizar con IA'}
                    className="w-full border-2 border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-500 py-2.5 rounded-xl transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    {aiLoading
                      ? 'Analizando...'
                      : aiCooldownMin
                      ? `IA disponible en ${aiCooldownMin} min`
                      : 'Analizar con IA (orientativo)'}
                  </button>
                </div>
              )}

              {/* Botones de guardar/enviar */}
              {!isSubmitted && (
                <div className="flex flex-col gap-3 mt-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={saveProduction}
                      disabled={saving || wordCount === 0 || submitting}
                      className="flex-1 bg-gray-100 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-200 transition font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar borrador'}
                    </button>
                    <button
                      onClick={() => submitProduction(false)}
                      disabled={submitting || !isValid || integrityScore <= 50}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                    >
                      <Send className="w-4 h-4" /> {submitting ? 'Enviando...' : 'Entregar Ensayo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      </main>

      {/* Toasts — esquina inferior derecha */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold max-w-xs w-full pointer-events-auto transition-all duration-300 ${
              t.type === 'success'
                ? 'bg-green-600 text-white'
                : t.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-amber-500 text-white'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
            {t.type === 'error'   && <AlertCircle className="w-4 h-4 shrink-0" />}
            {t.type === 'warning' && <ShieldAlert  className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
