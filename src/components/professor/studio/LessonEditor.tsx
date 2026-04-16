import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Save, Loader2, Wand2, Plus, ChevronUp, ChevronDown,
  BookOpen, Video, Image, Link2, FileText, Settings, X, AlertTriangle,
} from 'lucide-react';
import MediaUploader from './MediaUploader';
import ActivityBank from './ActivityBank';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Lang = 'es' | 'en';

type StepType = 'text' | 'video' | 'slides' | 'image' | 'audio' | 'link' | 'activity';

interface ContentStep {
  type: StepType;
  // text
  content?: { es: string; en: string };
  // media (video, slides, image, audio, link)
  url?: string;
  caption?: { es: string; en: string };
  // activity
  activity_id?: string;
  // local helpers (not saved)
  _activity_title?: string;
}

interface ProductionRules {
  min_words: number;
  max_words: number | null;
  required_words: string;   // string separada por comas para el form
  prohibited_words: string;
  instructions: { es: string; en: string };
}

interface Lesson {
  id: string;
  title: any;
  description: any;
  content: any[];
  has_production: boolean;
  production_unlock_percentage: number;
  order_index: number;
  created_by: string | null;
  created_at?: string;
}

interface Props {
  lesson?: Lesson | null;
  onSaved: (lesson: Lesson) => void;
  onCancel: () => void;
}

// ─── Hook IA ─────────────────────────────────────────────────────────────────

function useAI() {
  const [loading, setLoading] = useState<string | null>(null);
  async function enhance(task: string, lang: Lang, data: Record<string, any>): Promise<any | null> {
    setLoading(task + lang);
    try {
      const { data: res, error } = await supabase.functions.invoke('ai-enhance', { body: { task, lang, data } });
      if (error) throw error;
      return res?.result ?? null;
    } catch (e) { console.error(e); return null; }
    finally { setLoading(null); }
  }
  return { enhance, loading };
}

// ─── Íconos por tipo de paso ─────────────────────────────────────────────────

const STEP_ICONS: Record<StepType, React.ReactNode> = {
  text:     <FileText className="w-4 h-4" />,
  video:    <Video className="w-4 h-4" />,
  slides:   <BookOpen className="w-4 h-4" />,
  image:    <Image className="w-4 h-4" />,
  audio:    <FileText className="w-4 h-4" />,
  link:     <Link2 className="w-4 h-4" />,
  activity: <Settings className="w-4 h-4" />,
};

const STEP_LABELS: Record<StepType, string> = {
  text:     'Texto',
  video:    'Video',
  slides:   'Presentación',
  image:    'Imagen',
  audio:    'Audio',
  link:     'Enlace',
  activity: 'Actividad',
};

// ─── Editor de un paso individual ────────────────────────────────────────────

function StepCard({
  step, index, total, onChange, onRemove, onMove, activeLang
}: {
  step: ContentStep; index: number; total: number;
  onChange: (s: ContentStep) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
  activeLang: Lang;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header del paso */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-gray-400">{STEP_ICONS[step.type]}</span>
        <span className="text-sm font-medium text-gray-700 flex-1">
          {STEP_LABELS[step.type]}
          {step.type === 'activity' && step._activity_title && (
            <span className="ml-2 text-xs text-blue-600 font-normal">— {step._activity_title}</span>
          )}
          {step.type === 'text' && step.content?.[activeLang] && (
            <span className="ml-2 text-xs text-gray-400 font-normal truncate">
              — {step.content[activeLang].slice(0, 40)}...
            </span>
          )}
        </span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove('up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={() => onMove('down')} disabled={index === total - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
          <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Contenido del paso */}
      {expanded && (
        <div className="px-4 py-3">
          {step.type === 'text' && (
            <div>
              <label className="label-sm">Contenido ({activeLang === 'es' ? 'Español' : 'English'})</label>
              <textarea
                rows={4}
                value={step.content?.[activeLang] ?? ''}
                onChange={e => onChange({ ...step, content: { ...step.content, [activeLang]: e.target.value } as any })}
                className="input-field text-sm"
                placeholder={activeLang === 'es' ? 'Escribe el contenido en español...' : 'Write the content in English...'}
              />
            </div>
          )}

          {step.type === 'video' && (
            <div className="space-y-3">
              <MediaUploader value={step.url ?? ''} onChange={url => onChange({ ...step, url })} accept="video" label="URL del video (YouTube, Vimeo, MP4...)" />
              <div>
                <label className="label-sm">Pie de video ({activeLang === 'es' ? 'ES' : 'EN'})</label>
                <input type="text" value={step.caption?.[activeLang] ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, [activeLang]: e.target.value } as any })} className="input-field" placeholder="Descripción opcional..." />
              </div>
            </div>
          )}

          {step.type === 'slides' && (
            <div className="space-y-3">
              <div>
                <label className="label-sm">URL de la presentación</label>
                <p className="text-xs text-gray-400 mb-1">Google Slides: Archivo → Publicar → Insertar (usa la URL del iframe). PowerPoint Online: Archivo → Compartir → Insertar.</p>
                <input
                  type="url"
                  value={step.url ?? ''}
                  onChange={e => onChange({ ...step, url: e.target.value })}
                  className="input-field font-mono text-sm"
                  placeholder="https://docs.google.com/presentation/d/..."
                />
              </div>
              <div>
                <label className="label-sm">Título ({activeLang === 'es' ? 'ES' : 'EN'})</label>
                <input type="text" value={step.caption?.[activeLang] ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, [activeLang]: e.target.value } as any })} className="input-field" placeholder="Nombre de la presentación..." />
              </div>
            </div>
          )}

          {step.type === 'image' && (
            <div className="space-y-3">
              <MediaUploader value={step.url ?? ''} onChange={url => onChange({ ...step, url })} accept="image" label="Imagen" />
              <div>
                <label className="label-sm">Descripción ({activeLang === 'es' ? 'ES' : 'EN'})</label>
                <input type="text" value={step.caption?.[activeLang] ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, [activeLang]: e.target.value } as any })} className="input-field" />
              </div>
            </div>
          )}

          {step.type === 'audio' && (
            <div className="space-y-3">
              <MediaUploader value={step.url ?? ''} onChange={url => onChange({ ...step, url })} accept="audio" label="Audio" />
              <div>
                <label className="label-sm">Descripción ({activeLang === 'es' ? 'ES' : 'EN'})</label>
                <input type="text" value={step.caption?.[activeLang] ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, [activeLang]: e.target.value } as any })} className="input-field" />
              </div>
            </div>
          )}

          {step.type === 'link' && (
            <div className="space-y-3">
              <div>
                <label className="label-sm">URL</label>
                <input type="url" value={step.url ?? ''} onChange={e => onChange({ ...step, url: e.target.value })} className="input-field" placeholder="https://..." />
              </div>
              <div>
                <label className="label-sm">Texto del enlace ({activeLang === 'es' ? 'ES' : 'EN'})</label>
                <input type="text" value={step.caption?.[activeLang] ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, [activeLang]: e.target.value } as any })} className="input-field" placeholder="Ver recurso..." />
              </div>
            </div>
          )}

          {step.type === 'activity' && (
            <p className="text-sm text-gray-500">
              Actividad vinculada: <strong className="text-blue-700">{step._activity_title ?? step.activity_id}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function LessonEditor({ lesson, onSaved, onCancel }: Props) {
  const { profile } = useAuth();
  const { enhance, loading: aiLoading } = useAI();

  // Metadatos
  const [titleEs, setTitleEs]       = useState(lesson?.title?.es ?? lesson?.title ?? '');
  const [titleEn, setTitleEn]       = useState(lesson?.title?.en ?? '');
  const [descEs,  setDescEs]        = useState(lesson?.description?.es ?? lesson?.description ?? '');
  const [descEn,  setDescEn]        = useState(lesson?.description?.en ?? '');
  const [orderIndex, setOrderIndex] = useState(lesson?.order_index ?? 0);
  const [activeLang, setActiveLang] = useState<Lang>('es');

  // Pasos
  const [steps, setSteps] = useState<ContentStep[]>(lesson?.content ?? []);
  const [showActivityBank, setShowActivityBank] = useState(false);

  // Producción
  const [hasProduction, setHasProduction] = useState(lesson?.has_production ?? false);
  const [unlockPct,  setUnlockPct]        = useState(lesson?.production_unlock_percentage ?? 80);
  const [prodRules, setProdRules]         = useState<ProductionRules>({ min_words: 50, max_words: null, required_words: '', prohibited_words: '', instructions: { es: '', en: '' } });
  const [loadingRules, setLoadingRules]   = useState(false);

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [hasStudents, setHasStudents] = useState(false);

  // Cargar reglas de producción si edita lección existente
  useEffect(() => {
    if (!lesson?.id) return;
    (async () => {
      setLoadingRules(true);
      try {
        const { data } = await (supabase.from('production_rules') as any)
          .select('*').eq('lesson_id', lesson.id).maybeSingle();
        if (data) setProdRules({
          min_words: data.min_words,
          max_words: data.max_words,
          required_words: (data.required_words ?? []).join(', '),
          prohibited_words: (data.prohibited_words ?? []).join(', '),
          instructions: typeof data.instructions === 'object' ? data.instructions : { es: data.instructions ?? '', en: '' },
        });
      } finally {
        setLoadingRules(false);
      }

      const { count } = await supabase
        .from('student_progress')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_id', lesson.id);
      setHasStudents((count ?? 0) > 0);
    })();
  }, [lesson?.id]);

  // Cargar títulos de actividades para pasos existentes
  useEffect(() => {
    if (!lesson?.content) return;
    const activityIds = lesson.content.filter((s: any) => s.type === 'activity' && s.activity_id).map((s: any) => s.activity_id);
    if (activityIds.length === 0) return;
    (async () => {
      const { data } = await supabase.from('activities').select('id, title').in('id', activityIds);
      if (data) {
        const titleMap = new Map(data.map(a => [a.id, a.title]));
        setSteps(prev => prev.map(step => 
          step.type === 'activity' && step.activity_id ? { ...step, _activity_title: titleMap.get(step.activity_id) } : step
        ));
      }
    })();
  }, [lesson?.content]);

  // Mover paso
  function moveStep(idx: number, dir: 'up' | 'down') {
    const newSteps = [...steps];
    const target = dir === 'up' ? idx - 1 : idx + 1;
    [newSteps[idx], newSteps[target]] = [newSteps[target], newSteps[idx]];
    setSteps(newSteps);
  }

  function addStep(type: StepType) {
    const base: ContentStep = { type };
    if (type === 'text')   Object.assign(base, { content: { es: '', en: '' } });
    if (['video','slides','image','audio','link'].includes(type)) Object.assign(base, { url: '', caption: { es: '', en: '' } });
    setSteps(prev => [...prev, base]);
  }

  function addActivityStep(activity: { id: string; title: string }) {
    setSteps(prev => [...prev, { type: 'activity', activity_id: activity.id, _activity_title: activity.title }]);
    setShowActivityBank(false);
  }

  // IA
  async function improveTitle() {
    const title = activeLang === 'es' ? titleEs : titleEn;
    const improved = await enhance('improve_title', activeLang, { title });
    if (improved) { activeLang === 'es' ? setTitleEs(improved) : setTitleEn(improved); }
  }

  async function generateDesc() {
    const title = activeLang === 'es' ? titleEs : titleEn;
    const improved = await enhance('improve_description', activeLang, { title });
    if (improved) { activeLang === 'es' ? setDescEs(improved) : setDescEn(improved); }
  }

  async function suggestWords() {
    const title = activeLang === 'es' ? titleEs : titleEn;
    const result = await enhance('suggest_required_words', activeLang, { lessonTitle: title });
    if (result?.required_words) {
      setProdRules(r => ({ ...r, required_words: result.required_words.join(', ') }));
    }
  }

  // Guardar
  async function handleSave() {
    if (!titleEs.trim()) { setError('El título en español es obligatorio'); return; }
    setSaving(true); setError('');

    // Limpiar helpers internos antes de guardar
    const cleanSteps = steps.map(({ _activity_title, ...rest }) => rest);

    try {
      const payload = {
        title: { es: titleEs, en: titleEn },
        description: { es: descEs, en: descEn },
        content: cleanSteps,
        has_production: hasProduction,
        production_unlock_percentage: unlockPct,
        order_index: orderIndex,
        created_by: lesson?.created_by ?? profile?.id,
      };

      let savedLesson: Lesson;

      const db = supabase as any;

      if (lesson?.id) {
        const { data, error: err } = await db.from('lessons').update(payload).eq('id', lesson.id).select().single();
        if (err) throw err;
        savedLesson = data as Lesson;
      } else {
        const { data, error: err } = await db.from('lessons').insert(payload).select().single();
        if (err) throw err;
        savedLesson = data as Lesson;
      }

      // Sincronizar lesson_activities (fuente de verdad: el content)
      const activitySteps = cleanSteps.filter(s => s.type === 'activity' && s.activity_id);
      await db.from('lesson_activities').delete().eq('lesson_id', savedLesson.id);
      if (activitySteps.length > 0) {
        await db.from('lesson_activities').insert(
          activitySteps.map((s, idx) => ({ lesson_id: savedLesson.id, activity_id: s.activity_id!, order_index: idx }))
        );
      }

      // Guardar/actualizar reglas de producción
      if (hasProduction) {
        const rulesPayload = {
          lesson_id: savedLesson.id,
          min_words: prodRules.min_words,
          max_words: prodRules.max_words,
          required_words: prodRules.required_words.split(',').map(w => w.trim()).filter(Boolean),
          prohibited_words: prodRules.prohibited_words.split(',').map(w => w.trim()).filter(Boolean),
          instructions: prodRules.instructions,
        };
        await db.from('production_rules').upsert(rulesPayload, { onConflict: 'lesson_id' });
      } else {
        if (lesson?.id) await db.from('production_rules').delete().eq('lesson_id', lesson.id);
      }

      onSaved(savedLesson);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const linkedIds = new Set(steps.filter(s => s.type === 'activity').map(s => s.activity_id!));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-800">
          {lesson?.id ? 'Editar lección' : 'Nueva lección'}
        </h2>
        <div className="flex items-center gap-2">
          {/* Selector idioma */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
            {(['es', 'en'] as Lang[]).map(lang => (
              <button key={lang} type="button" onClick={() => setActiveLang(lang)}
                className={`px-3 py-1.5 font-medium transition ${activeLang === lang ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {lang === 'es' ? '🇪🇸' : '🇺🇸'} {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={onCancel} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {hasStudents && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Hay estudiantes con progreso en esta lección. Los cambios de orden de actividades pueden afectar su experiencia.
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {/* ── Metadatos ── */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Metadatos</h3>

          {/* Título */}
          <div>
            <label className="label-sm">
              Título {activeLang === 'es' ? '(Español) *' : '(English)'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={activeLang === 'es' ? titleEs : titleEn}
                onChange={e => activeLang === 'es' ? setTitleEs(e.target.value) : setTitleEn(e.target.value)}
                className="input-field flex-1"
                placeholder={activeLang === 'es' ? 'Ej: Saludos básicos en inglés' : 'E.g.: Basic greetings in English'}
              />
              <button onClick={improveTitle} disabled={aiLoading === 'improve_title' + activeLang || !(activeLang === 'es' ? titleEs : titleEn)}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm hover:bg-purple-100 disabled:opacity-40">
                {aiLoading === 'improve_title' + activeLang ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
              </button>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="label-sm">
              Descripción {activeLang === 'es' ? '(Español)' : '(English)'}
            </label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={activeLang === 'es' ? descEs : descEn}
                onChange={e => activeLang === 'es' ? setDescEs(e.target.value) : setDescEn(e.target.value)}
                className="input-field flex-1"
                placeholder={activeLang === 'es' ? 'Breve descripción de la lección...' : 'Brief lesson description...'}
              />
              <button onClick={generateDesc} disabled={aiLoading === 'improve_description' + activeLang || !(activeLang === 'es' ? titleEs : titleEn)}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm hover:bg-purple-100 disabled:opacity-40 self-start">
                {aiLoading === 'improve_description' + activeLang ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
              </button>
            </div>
          </div>

          <div className="w-32">
            <label className="label-sm">Orden</label>
            <input type="number" min={0} value={orderIndex} onChange={e => setOrderIndex(Number(e.target.value))} className="input-field" />
          </div>
        </section>

        {/* ── Constructor de pasos ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Pasos de la lección ({steps.length})
            </h3>
          </div>

          {steps.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
              La lección está vacía. Agrega pasos usando los botones de abajo.
            </div>
          )}

          <div className="space-y-2 mb-3">
            {steps.map((step, idx) => (
              <StepCard
                key={idx}
                step={step}
                index={idx}
                total={steps.length}
                activeLang={activeLang}
                onChange={updated => setSteps(prev => prev.map((s, i) => i === idx ? updated : s))}
                onRemove={() => setSteps(prev => prev.filter((_, i) => i !== idx))}
                onMove={dir => moveStep(idx, dir)}
              />
            ))}
          </div>

          {/* Botones agregar paso */}
          <div className="flex flex-wrap gap-2">
            {(['text','video','slides','image','audio','link'] as StepType[]).map(type => (
              <button key={type} onClick={() => addStep(type)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-700 transition bg-white">
                <Plus className="w-3.5 h-3.5" /> {STEP_LABELS[type]}
              </button>
            ))}
            <button onClick={() => setShowActivityBank(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 rounded-lg text-sm text-blue-700 hover:bg-blue-50 transition bg-blue-50 font-medium">
              <Plus className="w-3.5 h-3.5" /> Actividad del banco
            </button>
          </div>
        </section>

        {/* ── Producción ── */}
        <section className="border border-gray-200 rounded-xl overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
            onClick={() => setHasProduction(p => !p)}
          >
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={hasProduction} onChange={() => {}} className="accent-blue-600 w-4 h-4" />
              <div>
                <p className="text-sm font-semibold text-gray-700">Actividad de Producción</p>
                <p className="text-xs text-gray-400">El estudiante escribe un texto libre evaluado por el profesor</p>
              </div>
            </div>
          </div>

          {hasProduction && (
            <div className="px-4 py-4 space-y-4">
              {loadingRules && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando reglas...</div>}

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label-sm">% mínimo para desbloquear</label>
                  <input type="number" min={0} max={100} value={unlockPct} onChange={e => setUnlockPct(Number(e.target.value))} className="input-field" />
                  <p className="text-xs text-gray-400 mt-1">El estudiante debe completar este % de actividades antes de acceder a la producción</p>
                </div>
                <div className="flex-1">
                  <label className="label-sm">Mínimo de palabras</label>
                  <input type="number" min={0} value={prodRules.min_words} onChange={e => setProdRules(r => ({ ...r, min_words: Number(e.target.value) }))} className="input-field" />
                </div>
                <div className="flex-1">
                  <label className="label-sm">Máximo de palabras</label>
                  <input type="number" min={0} value={prodRules.max_words ?? ''} onChange={e => setProdRules(r => ({ ...r, max_words: e.target.value ? Number(e.target.value) : null }))} className="input-field" placeholder="Sin límite" />
                </div>
              </div>

              <div>
                <label className="label-sm">Instrucciones ({activeLang === 'es' ? 'Español' : 'English'})</label>
                <div className="flex gap-2">
                  <textarea
                    rows={3}
                    value={prodRules.instructions[activeLang] ?? ''}
                    onChange={e => setProdRules(r => ({ ...r, instructions: { ...r.instructions, [activeLang]: e.target.value } }))}
                    className="input-field flex-1"
                    placeholder="Escribe un párrafo presentándote en el idioma objetivo..."
                  />
                  <button
                    onClick={async () => {
                      const improved = await enhance('improve_instructions', activeLang, {
                        instructions: prodRules.instructions[activeLang],
                        lessonTitle: activeLang === 'es' ? titleEs : titleEn,
                      });
                      if (improved) setProdRules(r => ({ ...r, instructions: { ...r.instructions, [activeLang]: improved } }));
                    }}
                    disabled={aiLoading === 'improve_instructions' + activeLang}
                    className="self-start flex items-center gap-1 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm hover:bg-purple-100 disabled:opacity-40"
                  >
                    {aiLoading === 'improve_instructions' + activeLang ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
                  </button>
                </div>
              </div>

              <div>
                <label className="label-sm">Palabras requeridas (separadas por coma)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={prodRules.required_words}
                    onChange={e => setProdRules(r => ({ ...r, required_words: e.target.value }))}
                    className="input-field flex-1"
                    placeholder="hello, good morning, introduce"
                  />
                  <button
                    onClick={suggestWords}
                    disabled={aiLoading === 'suggest_required_words' + activeLang}
                    className="flex items-center gap-1 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm hover:bg-purple-100 disabled:opacity-40"
                  >
                    {aiLoading === 'suggest_required_words' + activeLang ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Sugerir
                  </button>
                </div>
              </div>

              <div>
                <label className="label-sm">Palabras prohibidas (separadas por coma)</label>
                <input
                  type="text"
                  value={prodRules.prohibited_words}
                  onChange={e => setProdRules(r => ({ ...r, prohibited_words: e.target.value }))}
                  className="input-field"
                  placeholder="hola, gracias (L1 prohibida en producción L2)"
                />
              </div>
            </div>
          )}
        </section>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {lesson?.id ? 'Guardar cambios' : 'Crear lección'}
        </button>
      </div>

      {/* Modal banco de actividades */}
      {showActivityBank && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-800">Banco de actividades</h3>
              <button onClick={() => setShowActivityBank(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ActivityBank
                onSelectForLesson={a => addActivityStep({ id: a.id, title: a.title })}
                linkedIds={linkedIds}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
