import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Save, Loader2, Wand2, Plus, ChevronUp, ChevronDown,
  BookOpen, Video, Image, Link2, FileText, Settings, X, AlertTriangle,
} from 'lucide-react';
import MediaUploader from './MediaUploader';
import TagInput from './TagInput';

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
  step, index, total, onChange, onRemove, onMove
}: {
  step: ContentStep; index: number; total: number;
  onChange: (s: ContentStep) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
      {/* Header del paso */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer select-none border-b border-gray-100"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-gray-400">{STEP_ICONS[step.type]}</span>
        <span className="text-sm font-medium text-gray-700 flex-1">
          {STEP_LABELS[step.type]}
          {step.type === 'activity' && step._activity_title && (
            <span className="ml-2 text-xs text-blue-600 font-normal">— {step._activity_title}</span>
          )}
          {step.type === 'text' && step.content?.es && (
            <span className="ml-2 text-xs text-gray-400 font-normal truncate">
              — {step.content.es.slice(0, 40)}...
            </span>
          )}
        </span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove('up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={() => onMove('down')} disabled={index === total - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
          <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-600 ml-2"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Contenido del paso */}
      {expanded && (
        <div className="px-4 py-4">
          {step.type === 'text' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-sm">Contenido (🇪🇸)</label>
                <textarea
                  rows={4}
                  value={step.content?.es ?? ''}
                  onChange={e => onChange({ ...step, content: { ...step.content, es: e.target.value } as any })}
                  className="input-field text-sm"
                  placeholder="Escribe el contenido en español..."
                />
              </div>
              <div>
                <label className="label-sm">Content (🇺🇸)</label>
                <textarea
                  rows={4}
                  value={step.content?.en ?? ''}
                  onChange={e => onChange({ ...step, content: { ...step.content, en: e.target.value } as any })}
                  className="input-field text-sm"
                  placeholder="Write the content in English..."
                />
              </div>
            </div>
          )}

          {step.type === 'video' && (
            <div className="space-y-4">
              <MediaUploader value={step.url ?? ''} onChange={url => onChange({ ...step, url })} accept="video" label="URL del video (YouTube, Vimeo, MP4...)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Pie de video (🇪🇸)</label>
                  <input type="text" value={step.caption?.es ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, es: e.target.value } as any })} className="input-field" placeholder="Ver el siguiente video..." />
                </div>
                <div>
                  <label className="label-sm">Caption (🇺🇸)</label>
                  <input type="text" value={step.caption?.en ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, en: e.target.value } as any })} className="input-field" placeholder="Watch the following video..." />
                </div>
              </div>
            </div>
          )}

          {step.type === 'slides' && (
            <div className="space-y-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Título (🇪🇸)</label>
                  <input type="text" value={step.caption?.es ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, es: e.target.value } as any })} className="input-field" placeholder="Título de la presentación" />
                </div>
                <div>
                  <label className="label-sm">Title (🇺🇸)</label>
                  <input type="text" value={step.caption?.en ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, en: e.target.value } as any })} className="input-field" placeholder="Presentation title" />
                </div>
              </div>
            </div>
          )}

          {step.type === 'image' && (
            <div className="space-y-4">
              <MediaUploader value={step.url ?? ''} onChange={url => onChange({ ...step, url })} accept="image" label="Imagen" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Descripción (🇪🇸)</label>
                  <input type="text" value={step.caption?.es ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, es: e.target.value } as any })} className="input-field" />
                </div>
                <div>
                  <label className="label-sm">Description (🇺🇸)</label>
                  <input type="text" value={step.caption?.en ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, en: e.target.value } as any })} className="input-field" />
                </div>
              </div>
            </div>
          )}

          {step.type === 'audio' && (
            <div className="space-y-4">
              <MediaUploader value={step.url ?? ''} onChange={url => onChange({ ...step, url })} accept="audio" label="Audio" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Descripción (🇪🇸)</label>
                  <input type="text" value={step.caption?.es ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, es: e.target.value } as any })} className="input-field" />
                </div>
                <div>
                  <label className="label-sm">Description (🇺🇸)</label>
                  <input type="text" value={step.caption?.en ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, en: e.target.value } as any })} className="input-field" />
                </div>
              </div>
            </div>
          )}

          {step.type === 'link' && (
            <div className="space-y-4">
              <div>
                <label className="label-sm">URL</label>
                <input type="url" value={step.url ?? ''} onChange={e => onChange({ ...step, url: e.target.value })} className="input-field" placeholder="https://..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Texto del enlace (🇪🇸)</label>
                  <input type="text" value={step.caption?.es ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, es: e.target.value } as any })} className="input-field" placeholder="Ver recurso..." />
                </div>
                <div>
                  <label className="label-sm">Link text (🇺🇸)</label>
                  <input type="text" value={step.caption?.en ?? ''} onChange={e => onChange({ ...step, caption: { ...step.caption, en: e.target.value } as any })} className="input-field" placeholder="View resource..." />
                </div>
              </div>
            </div>
          )}

          {step.type === 'activity' && (
            <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
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
  
  // Extra Meta
  const [tags, setTags] = useState<string[]>(lesson?.content?.tags ?? []);

  // Pasos
  const [steps, setSteps] = useState<ContentStep[]>(Array.isArray(lesson?.content) ? lesson.content : (lesson?.content?.steps ?? []));

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
          instructions: (() => {
            const raw = data.instructions;
            if (!raw) return { es: '', en: '' };
            if (typeof raw === 'object') return raw;
            if (typeof raw === 'string' && raw.startsWith('{')) {
              try { return JSON.parse(raw); } catch { /* ignorar */ }
            }
            return { es: raw, en: '' };
          })(),
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
    const contentSteps: any[] = Array.isArray(lesson.content) ? lesson.content : ((lesson.content as any)?.steps ?? []);
    const activityIds = contentSteps.filter((s: any) => s.type === 'activity' && s.activity_id).map((s: any) => s.activity_id);
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

  // IA
  async function improveTitle(lang: Lang) {
    const title = lang === 'es' ? titleEs : titleEn;
    const improved = await enhance('improve_title', lang, { title });
    if (improved) { lang === 'es' ? setTitleEs(improved) : setTitleEn(improved); }
  }

  async function generateDesc(lang: Lang) {
    const title = lang === 'es' ? titleEs : titleEn;
    const improved = await enhance('improve_description', lang, { title });
    if (improved) { lang === 'es' ? setDescEs(improved) : setDescEn(improved); }
  }

  async function suggestWords(lang: Lang) {
    const title = lang === 'es' ? titleEs : titleEn;
    const result = await enhance('suggest_required_words', lang, { lessonTitle: title });
    if (result?.required_words) {
      setProdRules(r => ({ ...r, required_words: result.required_words.join(', ') }));
    }
  }

  // Guardar
  async function handleSave() {
    if (!titleEs.trim() && !titleEn.trim()) { setError('Debes proveer un título en al menos un idioma.'); return; }
    setSaving(true); setError('');

    // Limpiar helpers internos antes de guardar
    const cleanSteps = steps.map(({ _activity_title, ...rest }) => rest);

    try {
      const payload = {
        title: { es: titleEs, en: titleEn },
        description: { es: descEs, en: descEn },
        content: { steps: cleanSteps, tags },
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

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div>
           <h2 className="text-xl font-bold text-gray-800">
             {lesson?.id ? 'Editar lección bilingüe' : 'Nueva lección bilingüe'}
           </h2>
           <p className="text-xs text-gray-500 mt-1">Puedes completar los datos en un solo idioma o en ambos para soportar modalidad bilingüe.</p>
        </div>
        <button onClick={onCancel} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {hasStudents && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Hay estudiantes con progreso en esta lección. Los cambios de orden de actividades pueden afectar su experiencia.
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
        {/* ── Metadatos ── */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">Metadatos Principales</h3>

          {/* Títulos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label-sm">Título (🇪🇸)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={titleEs}
                  onChange={e => setTitleEs(e.target.value)}
                  className="input-field flex-1"
                  placeholder="Ej: Saludos básicos en inglés"
                />
                <button onClick={() => improveTitle('es')} disabled={aiLoading === 'improve_titlees' || !titleEs}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100 disabled:opacity-40 transition">
                  {aiLoading === 'improve_titlees' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
                </button>
              </div>
            </div>
            <div>
              <label className="label-sm">Title (🇺🇸)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={titleEn}
                  onChange={e => setTitleEn(e.target.value)}
                  className="input-field flex-1"
                  placeholder="E.g.: Basic greetings in English"
                />
                <button onClick={() => improveTitle('en')} disabled={aiLoading === 'improve_titleen' || !titleEn}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100 disabled:opacity-40 transition">
                  {aiLoading === 'improve_titleen' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
                </button>
              </div>
            </div>
          </div>

          {/* Descripciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label-sm">Descripción (🇪🇸)</label>
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={descEs}
                  onChange={e => setDescEs(e.target.value)}
                  className="input-field flex-1"
                />
                <button onClick={() => generateDesc('es')} disabled={aiLoading === 'improve_descriptiones' || !titleEs}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100 disabled:opacity-40 self-start transition">
                  {aiLoading === 'improve_descriptiones' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
                </button>
              </div>
            </div>
            <div>
              <label className="label-sm">Description (🇺🇸)</label>
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={descEn}
                  onChange={e => setDescEn(e.target.value)}
                  className="input-field flex-1"
                />
                <button onClick={() => generateDesc('en')} disabled={aiLoading === 'improve_descriptionen' || !titleEn}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100 disabled:opacity-40 self-start transition">
                  {aiLoading === 'improve_descriptionen' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="label-sm">Palabras clave / Etiquetas de la Lección</label>
            <TagInput tags={tags} onChange={setTags} placeholder="Ej: [gramática] [básico] [conversación]" />
          </div>

          <div className="w-32">
            <label className="label-sm">Orden de Lección</label>
            <input type="number" min={0} value={orderIndex} onChange={e => setOrderIndex(Number(e.target.value))} className="input-field text-center font-bold text-gray-700" />
          </div>
        </section>

        {/* ── Constructor de pasos ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Contenido de la Lección ({steps.length} pasos)
            </h3>
          </div>

          {steps.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm bg-gray-50/50">
              La lección está vacía. Empecemos agregando tu primer bloque interactivo.
            </div>
          )}

          <div className="space-y-4">
            {steps.map((step, idx) => (
              <StepCard
                key={idx}
                step={step}
                index={idx}
                total={steps.length}
                onChange={updated => setSteps(prev => prev.map((s, i) => i === idx ? updated : s))}
                onRemove={() => setSteps(prev => prev.filter((_, i) => i !== idx))}
                onMove={dir => moveStep(idx, dir)}
              />
            ))}
          </div>

          {/* Botones agregar paso */}
          <div className="flex flex-wrap gap-2 pt-2">
            {(['text','video','slides','image','audio','link'] as StepType[]).map(type => (
              <button key={type} onClick={() => addStep(type)}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 shadow-sm rounded-lg text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-700 transition bg-white">
                <Plus className="w-4 h-4" /> {STEP_LABELS[type]}
              </button>
            ))}
          </div>
        </section>

        {/* ── Producción ── */}
        <section className="border border-purple-200 rounded-xl overflow-hidden shadow-sm">
          <div
            className="flex items-center justify-between px-5 py-4 bg-purple-50 cursor-pointer hover:bg-purple-100/50 transition-colors"
            onClick={() => setHasProduction(p => !p)}
          >
            <div className="flex items-center gap-4">
              <input type="checkbox" checked={hasProduction} onChange={() => {}} className="accent-purple-600 w-5 h-5 cursor-pointer" />
              <div>
                <p className="text-sm font-bold text-purple-900">Actividad de Producción Final (Requisito Integrador)</p>
                <p className="text-xs text-purple-700/70 mt-0.5">El estudiante escribe un texto libre estructurado evaluado por el profesor como cierre de lección</p>
              </div>
            </div>
          </div>

          {hasProduction && (
            <div className="px-5 py-5 space-y-6 bg-white border-t border-purple-100">
              {loadingRules && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando reglas...</div>}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="label-sm">% Mínimo en Actividades</label>
                  <input type="number" min={0} max={100} value={unlockPct} onChange={e => setUnlockPct(Number(e.target.value))} className="input-field" />
                  <p className="text-xs text-gray-400 mt-1">El estudiante debe completar este % interactivo para acceder.</p>
                </div>
                <div>
                  <label className="label-sm">Mínimo de palabras</label>
                  <input type="number" min={0} value={prodRules.min_words} onChange={e => setProdRules(r => ({ ...r, min_words: Number(e.target.value) }))} className="input-field" />
                </div>
                <div>
                  <label className="label-sm">Máximo de palabras</label>
                  <input type="number" min={0} value={prodRules.max_words ?? ''} onChange={e => setProdRules(r => ({ ...r, max_words: e.target.value ? Number(e.target.value) : null }))} className="input-field" placeholder="Sin límite" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label-sm">Instrucciones (🇪🇸)</label>
                  <div className="flex gap-2">
                    <textarea
                      rows={3}
                      value={prodRules.instructions.es ?? ''}
                      onChange={e => setProdRules(r => ({ ...r, instructions: { ...r.instructions, es: e.target.value } }))}
                      className="input-field flex-1"
                      placeholder="Ej: Redacta un párrafo presentándote usando los verbos de la lección."
                    />
                    <button
                      onClick={async () => {
                        const improved = await enhance('improve_instructions', 'es', { instructions: prodRules.instructions.es, lessonTitle: titleEs });
                        if (improved) setProdRules(r => ({ ...r, instructions: { ...r.instructions, es: improved } }));
                      }}
                      disabled={aiLoading === 'improve_instructionses' || !titleEs}
                      className="self-start flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100 disabled:opacity-40 transition"
                    >
                      {aiLoading === 'improve_instructionses' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label-sm">Instructions (🇺🇸)</label>
                  <div className="flex gap-2">
                    <textarea
                      rows={3}
                      value={prodRules.instructions.en ?? ''}
                      onChange={e => setProdRules(r => ({ ...r, instructions: { ...r.instructions, en: e.target.value } }))}
                      className="input-field flex-1"
                      placeholder="E.g.: Write a paragraph introducing yourself using lesson verbs."
                    />
                    <button
                      onClick={async () => {
                        const improved = await enhance('improve_instructions', 'en', { instructions: prodRules.instructions.en, lessonTitle: titleEn });
                        if (improved) setProdRules(r => ({ ...r, instructions: { ...r.instructions, en: improved } }));
                      }}
                      disabled={aiLoading === 'improve_instructionsen' || !titleEn}
                      className="self-start flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100 disabled:opacity-40 transition"
                    >
                      {aiLoading === 'improve_instructionsen' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} IA
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                  <label className="label-sm text-green-700">Palabras / Conceptos Requeridos (separados por coma)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={prodRules.required_words}
                      onChange={e => setProdRules(r => ({ ...r, required_words: e.target.value }))}
                      className="input-field flex-1 !border-green-300 focus:!ring-green-400"
                      placeholder="hello, good morning, introduce"
                    />
                    <button
                      onClick={() => suggestWords('es')}
                      disabled={aiLoading === 'suggest_required_wordses'}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs hover:bg-green-100 disabled:opacity-40 transition"
                      title="Sugerir basados en el título ES"
                    >
                      {aiLoading === 'suggest_required_wordses' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Auto
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label-sm text-red-700">Palabras Prohibidas (separadas por coma)</label>
                  <input
                    type="text"
                    value={prodRules.prohibited_words}
                    onChange={e => setProdRules(r => ({ ...r, prohibited_words: e.target.value }))}
                    className="input-field !border-red-300 focus:!ring-red-400"
                    placeholder="hola, gracias (útil para prohibir lengua nativa o jerga)"
                  />
                </div>
              </div>

            </div>
          )}
        </section>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-gray-100 background-white">
        <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {lesson?.id ? 'Guardar Cambios' : 'Crear Lección Bilingüe'}
        </button>
      </div>

    </div>
  );
}
