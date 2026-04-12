import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { X, Plus, Trash2, Loader2, Wand2, GripVertical } from 'lucide-react';
import MediaUploader from './MediaUploader';
import type { ActivityType } from '../../../lib/database.types';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  content: any; // { es: {...}, en: {...} }
  points: number;
  media_url: string | null;
  created_by: string | null;
}

interface Props {
  activity?: Activity | null;   // null = crear nueva
  onSave: (activity: Activity) => void;
  onCancel: () => void;
}

type Lang = 'es' | 'en';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPES: { value: ActivityType; label: string }[] = [
  { value: 'multiple_choice',  label: 'Opción múltiple' },
  { value: 'true_false',       label: 'Verdadero / Falso' },
  { value: 'fill_blank',       label: 'Completar espacio' },
  { value: 'short_answer',     label: 'Respuesta corta' },
  { value: 'matching',         label: 'Relacionar' },
  { value: 'ordering',         label: 'Ordenar' },
  { value: 'drag_drop',        label: 'Arrastrar y soltar' },
  { value: 'image_question',   label: 'Pregunta con imagen' },
  { value: 'listening',        label: 'Comprensión auditiva' },
  { value: 'essay',            label: 'Ensayo (producción)' },
  { value: 'long_response',    label: 'Respuesta larga (producción)' },
  { value: 'structured_essay', label: 'Ensayo estructurado (producción)' },
  { value: 'open_writing',     label: 'Escritura abierta (producción)' },
];

function emptyContent(type: ActivityType): any {
  switch (type) {
    case 'multiple_choice':
    case 'image_question':
      return { question: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }], correct_id: 'a' };
    case 'true_false':
      return { statement: '', correct: true };
    case 'fill_blank':
      return { text: '', answers: [''] };
    case 'short_answer':
      return { question: '', accepted_answers: [''], hint: '' };
    case 'matching':
      return { instruction: '', pairs: [{ id: '1', left: '', right: '' }, { id: '2', left: '', right: '' }] };
    case 'ordering':
      return { instruction: '', items: [{ id: '1', text: '' }, { id: '2', text: '' }], correct_order: ['1', '2'] };
    case 'drag_drop':
      return { instruction: '', categories: [{ id: '1', name: '', items: [''] }, { id: '2', name: '', items: [''] }] };
    case 'listening':
      return { question: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }], correct_id: 'a', transcript: '' };
    case 'essay':
    case 'open_writing':
      return { prompt: '', min_words: 50, max_words: 200 };
    case 'long_response':
      return { prompt: '', guiding_questions: [''], min_words: 80 };
    case 'structured_essay':
      return { prompt: '', sections: [{ id: 'intro', title: 'Introducción', min_words: 30 }, { id: 'body', title: 'Desarrollo', min_words: 80 }, { id: 'conclusion', title: 'Conclusión', min_words: 30 }] };
    default:
      return {};
  }
}

// ─── Hook IA ─────────────────────────────────────────────────────────────────

function useAI() {
  const [loading, setLoading] = useState<string | null>(null);

  async function enhance(task: string, lang: Lang, data: Record<string, any>): Promise<any | null> {
    setLoading(task + lang);
    try {
      const { data: result, error } = await supabase.functions.invoke('ai-enhance', {
        body: { task, lang, data },
      });
      if (error) throw error;
      return result?.result ?? null;
    } catch (e) {
      console.error('AI error:', e);
      return null;
    } finally {
      setLoading(null);
    }
  }

  return { enhance, loading };
}

// ─── Sub-formularios por tipo ────────────────────────────────────────────────

function MultipleChoiceForm({ c, onChange }: { c: any; onChange: (c: any) => void }) {
  const options = c.options ?? [];

  function setOption(idx: number, text: string) {
    const updated = options.map((o: any, i: number) => i === idx ? { ...o, text } : o);
    onChange({ ...c, options: updated });
  }

  function addOption() {
    const id = String.fromCharCode(97 + options.length);
    onChange({ ...c, options: [...options, { id, text: '' }] });
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    const updated = options.filter((_: any, i: number) => i !== idx);
    onChange({ ...c, options: updated, correct_id: updated[0]?.id ?? 'a' });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label-sm">Pregunta</label>
        <textarea
          value={c.question ?? ''}
          onChange={e => onChange({ ...c, question: e.target.value })}
          rows={2}
          className="input-field"
          placeholder="¿Cuál es...?"
        />
      </div>
      <div>
        <label className="label-sm">Opciones</label>
        <div className="space-y-2">
          {options.map((opt: any, idx: number) => (
            <div key={opt.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct_${c._lang}`}
                checked={c.correct_id === opt.id}
                onChange={() => onChange({ ...c, correct_id: opt.id })}
                title="Marcar como correcta"
                className="accent-green-600 flex-shrink-0"
              />
              <span className="text-xs font-mono text-gray-400 w-4">{opt.id}.</span>
              <input
                type="text"
                value={opt.text}
                onChange={e => setOption(idx, e.target.value)}
                placeholder={`Opción ${opt.id}`}
                className="input-field flex-1"
              />
              <button type="button" onClick={() => removeOption(idx)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addOption} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Plus className="w-3 h-3" /> Agregar opción
        </button>
        <p className="text-xs text-gray-400 mt-1">Selecciona el radio de la opción correcta</p>
      </div>
    </div>
  );
}

function TrueFalseForm({ c, onChange }: { c: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="label-sm">Enunciado</label>
        <textarea value={c.statement ?? ''} onChange={e => onChange({ ...c, statement: e.target.value })} rows={2} className="input-field" placeholder="El enunciado que el estudiante debe evaluar..." />
      </div>
      <div>
        <label className="label-sm">Respuesta correcta</label>
        <div className="flex gap-4">
          {[true, false].map(val => (
            <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={c.correct === val} onChange={() => onChange({ ...c, correct: val })} className="accent-green-600" />
              <span className={`text-sm font-medium ${val ? 'text-green-700' : 'text-red-700'}`}>{val ? 'Verdadero' : 'Falso'}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function FillBlankForm({ c, onChange }: { c: any; onChange: (c: any) => void }) {
  const answers = c.answers ?? [''];
  return (
    <div className="space-y-3">
      <div>
        <label className="label-sm">Texto (usa ___ para cada espacio)</label>
        <textarea value={c.text ?? ''} onChange={e => onChange({ ...c, text: e.target.value })} rows={3} className="input-field font-mono" placeholder="In the morning we say ___ and at night we say ___." />
        <p className="text-xs text-gray-400 mt-1">
          Espacios detectados: <span className="font-mono font-bold">{(c.text ?? '').split('___').length - 1}</span>
          {' '}— debe coincidir con el número de respuestas abajo
        </p>
      </div>
      <div>
        <label className="label-sm">Respuestas correctas (en orden)</label>
        <div className="space-y-2">
          {answers.map((ans: string, idx: number) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
              <input type="text" value={ans} onChange={e => { const a = [...answers]; a[idx] = e.target.value; onChange({ ...c, answers: a }); }} className="input-field flex-1" placeholder={`Respuesta ${idx + 1}`} />
              <button type="button" onClick={() => { const a = answers.filter((_: string, i: number) => i !== idx); onChange({ ...c, answers: a }); }} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onChange({ ...c, answers: [...answers, ''] })} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Plus className="w-3 h-3" /> Agregar respuesta
        </button>
      </div>
    </div>
  );
}

function ShortAnswerForm({ c, onChange }: { c: any; onChange: (c: any) => void }) {
  const answers = c.accepted_answers ?? [''];
  return (
    <div className="space-y-3">
      <div>
        <label className="label-sm">Pregunta</label>
        <textarea value={c.question ?? ''} onChange={e => onChange({ ...c, question: e.target.value })} rows={2} className="input-field" />
      </div>
      <div>
        <label className="label-sm">Respuestas aceptadas (variantes)</label>
        <div className="space-y-2">
          {answers.map((ans: string, idx: number) => (
            <div key={idx} className="flex gap-2">
              <input type="text" value={ans} onChange={e => { const a = [...answers]; a[idx] = e.target.value; onChange({ ...c, accepted_answers: a }); }} className="input-field flex-1" placeholder="Variante de respuesta" />
              <button type="button" onClick={() => onChange({ ...c, accepted_answers: answers.filter((_: string, i: number) => i !== idx) })} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onChange({ ...c, accepted_answers: [...answers, ''] })} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Plus className="w-3 h-3" /> Agregar variante
        </button>
      </div>
      <div>
        <label className="label-sm">Pista (opcional)</label>
        <input type="text" value={c.hint ?? ''} onChange={e => onChange({ ...c, hint: e.target.value })} className="input-field" placeholder="Pista visible al estudiante..." />
      </div>
    </div>
  );
}

function MatchingForm({ c, onChange }: { c: any; onChange: (c: any) => void }) {
  const pairs = c.pairs ?? [];
  function setPair(idx: number, side: 'left' | 'right', val: string) {
    onChange({ ...c, pairs: pairs.map((p: any, i: number) => i === idx ? { ...p, [side]: val } : p) });
  }
  function addPair() {
    onChange({ ...c, pairs: [...pairs, { id: String(pairs.length + 1), left: '', right: '' }] });
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="label-sm">Instrucción</label>
        <input type="text" value={c.instruction ?? ''} onChange={e => onChange({ ...c, instruction: e.target.value })} className="input-field" placeholder="Relaciona cada elemento con su equivalente..." />
      </div>
      <div>
        <div className="grid grid-cols-2 gap-2 mb-1">
          <span className="text-xs font-medium text-gray-500">Columna A</span>
          <span className="text-xs font-medium text-gray-500">Columna B</span>
        </div>
        <div className="space-y-2">
          {pairs.map((p: any, idx: number) => (
            <div key={p.id} className="flex gap-2 items-center">
              <input type="text" value={p.left} onChange={e => setPair(idx, 'left', e.target.value)} className="input-field flex-1" placeholder="A..." />
              <span className="text-gray-400">↔</span>
              <input type="text" value={p.right} onChange={e => setPair(idx, 'right', e.target.value)} className="input-field flex-1" placeholder="B..." />
              <button type="button" onClick={() => onChange({ ...c, pairs: pairs.filter((_: any, i: number) => i !== idx) })} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addPair} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus className="w-3 h-3" /> Agregar par</button>
      </div>
    </div>
  );
}

function OrderingForm({ c, onChange }: { c: any; onChange: (c: any) => void }) {
  const items = c.items ?? [];
  function setItem(idx: number, text: string) {
    onChange({ ...c, items: items.map((it: any, i: number) => i === idx ? { ...it, text } : it), correct_order: items.map((it: any) => it.id) });
  }
  function addItem() {
    const newId = String(items.length + 1);
    const newItems = [...items, { id: newId, text: '' }];
    onChange({ ...c, items: newItems, correct_order: newItems.map((it: any) => it.id) });
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="label-sm">Instrucción</label>
        <input type="text" value={c.instruction ?? ''} onChange={e => onChange({ ...c, instruction: e.target.value })} className="input-field" placeholder="Ordena los siguientes elementos..." />
      </div>
      <div>
        <label className="label-sm">Elementos (en el orden correcto)</label>
        <p className="text-xs text-gray-400 mb-2">Ingresa los elementos ya en el orden correcto. El sistema los mezclará para el estudiante.</p>
        <div className="space-y-2">
          {items.map((it: any, idx: number) => (
            <div key={it.id} className="flex gap-2 items-center">
              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
              <input type="text" value={it.text} onChange={e => setItem(idx, e.target.value)} className="input-field flex-1" placeholder={`Elemento ${idx + 1}`} />
              <button type="button" onClick={() => { const newItems = items.filter((_: any, i: number) => i !== idx); onChange({ ...c, items: newItems, correct_order: newItems.map((i: any) => i.id) }); }} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus className="w-3 h-3" /> Agregar elemento</button>
      </div>
    </div>
  );
}

function DragDropForm({ c, onChange }: { c: any; onChange: (c: any) => void }) {
  const categories = c.categories ?? [];
  function setCategory(idx: number, field: 'name', val: string) {
    onChange({ ...c, categories: categories.map((cat: any, i: number) => i === idx ? { ...cat, [field]: val } : cat) });
  }
  function setItem(catIdx: number, itemIdx: number, val: string) {
    const cats = categories.map((cat: any, i: number) => {
      if (i !== catIdx) return cat;
      const items = [...cat.items];
      items[itemIdx] = val;
      return { ...cat, items };
    });
    onChange({ ...c, categories: cats });
  }
  function addItem(catIdx: number) {
    const cats = categories.map((cat: any, i: number) => i === catIdx ? { ...cat, items: [...cat.items, ''] } : cat);
    onChange({ ...c, categories: cats });
  }
  function addCategory() {
    onChange({ ...c, categories: [...categories, { id: String(categories.length + 1), name: '', items: [''] }] });
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="label-sm">Instrucción</label>
        <input type="text" value={c.instruction ?? ''} onChange={e => onChange({ ...c, instruction: e.target.value })} className="input-field" />
      </div>
      {categories.map((cat: any, catIdx: number) => (
        <div key={cat.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex gap-2 items-center">
            <input type="text" value={cat.name} onChange={e => setCategory(catIdx, 'name', e.target.value)} className="input-field flex-1 font-medium" placeholder={`Nombre categoría ${catIdx + 1}`} />
            <button type="button" onClick={() => onChange({ ...c, categories: categories.filter((_: any, i: number) => i !== catIdx) })} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
          {cat.items.map((item: string, itemIdx: number) => (
            <div key={itemIdx} className="flex gap-2 pl-3">
              <input type="text" value={item} onChange={e => setItem(catIdx, itemIdx, e.target.value)} className="input-field flex-1 text-sm" placeholder={`Elemento ${itemIdx + 1}`} />
              <button type="button" onClick={() => { const cats = categories.map((c2: any, i: number) => i === catIdx ? { ...c2, items: c2.items.filter((_: string, j: number) => j !== itemIdx) } : c2); onChange({ ...c, categories: cats }); }} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button type="button" onClick={() => addItem(catIdx)} className="pl-3 flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus className="w-3 h-3" /> Agregar elemento</button>
        </div>
      ))}
      <button type="button" onClick={addCategory} className="flex items-center gap-1 text-sm text-blue-600 hover:underline"><Plus className="w-4 h-4" /> Agregar categoría</button>
    </div>
  );
}

function EssayForm({ c, onChange, type }: { c: any; onChange: (c: any) => void; type: ActivityType }) {
  if (type === 'structured_essay') {
    return (
      <div className="space-y-3">
        <div>
          <label className="label-sm">Consigna</label>
          <textarea value={c.prompt ?? ''} onChange={e => onChange({ ...c, prompt: e.target.value })} rows={3} className="input-field" />
        </div>
        <div>
          <label className="label-sm">Secciones</label>
          <div className="space-y-2">
            {(c.sections ?? []).map((sec: any, idx: number) => (
              <div key={sec.id} className="flex gap-2 items-center">
                <input type="text" value={sec.title} onChange={e => { const s = [...c.sections]; s[idx] = { ...s[idx], title: e.target.value }; onChange({ ...c, sections: s }); }} className="input-field flex-1" placeholder="Título sección" />
                <input type="number" value={sec.min_words} onChange={e => { const s = [...c.sections]; s[idx] = { ...s[idx], min_words: Number(e.target.value) }; onChange({ ...c, sections: s }); }} className="input-field w-24" placeholder="Min." />
                <span className="text-xs text-gray-400">palabras</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (type === 'long_response') {
    return (
      <div className="space-y-3">
        <div><label className="label-sm">Consigna</label><textarea value={c.prompt ?? ''} onChange={e => onChange({ ...c, prompt: e.target.value })} rows={3} className="input-field" /></div>
        <div>
          <label className="label-sm">Preguntas guía</label>
          <div className="space-y-2">
            {(c.guiding_questions ?? ['']).map((q: string, idx: number) => (
              <div key={idx} className="flex gap-2">
                <input type="text" value={q} onChange={e => { const qs = [...c.guiding_questions]; qs[idx] = e.target.value; onChange({ ...c, guiding_questions: qs }); }} className="input-field flex-1" placeholder={`Pregunta guía ${idx + 1}`} />
                <button type="button" onClick={() => onChange({ ...c, guiding_questions: c.guiding_questions.filter((_: string, i: number) => i !== idx) })} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onChange({ ...c, guiding_questions: [...(c.guiding_questions ?? []), ''] })} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus className="w-3 h-3" /> Agregar pregunta guía</button>
        </div>
        <div className="flex gap-3">
          <div className="flex-1"><label className="label-sm">Mín. palabras</label><input type="number" value={c.min_words ?? 80} onChange={e => onChange({ ...c, min_words: Number(e.target.value) })} className="input-field" /></div>
        </div>
      </div>
    );
  }
  // essay / open_writing
  return (
    <div className="space-y-3">
      <div><label className="label-sm">Consigna</label><textarea value={c.prompt ?? ''} onChange={e => onChange({ ...c, prompt: e.target.value })} rows={3} className="input-field" /></div>
      <div className="flex gap-3">
        <div className="flex-1"><label className="label-sm">Mín. palabras</label><input type="number" value={c.min_words ?? 50} onChange={e => onChange({ ...c, min_words: Number(e.target.value) })} className="input-field" /></div>
        <div className="flex-1"><label className="label-sm">Máx. palabras</label><input type="number" value={c.max_words ?? 200} onChange={e => onChange({ ...c, max_words: Number(e.target.value) })} className="input-field" /></div>
      </div>
    </div>
  );
}

function ListeningForm({ c, onChange }: { c: any; onChange: (c: any) => void }) {
  const options = c.options ?? [];
  return (
    <div className="space-y-3">
      <div><label className="label-sm">Pregunta</label><textarea value={c.question ?? ''} onChange={e => onChange({ ...c, question: e.target.value })} rows={2} className="input-field" /></div>
      <div>
        <label className="label-sm">Opciones</label>
        <div className="space-y-2">
          {options.map((opt: any, idx: number) => (
            <div key={opt.id} className="flex items-center gap-2">
              <input type="radio" name={`listening_correct_${c._lang}`} checked={c.correct_id === opt.id} onChange={() => onChange({ ...c, correct_id: opt.id })} className="accent-green-600 flex-shrink-0" />
              <span className="text-xs font-mono text-gray-400 w-4">{opt.id}.</span>
              <input type="text" value={opt.text} onChange={e => onChange({ ...c, options: options.map((o: any, i: number) => i === idx ? { ...o, text: e.target.value } : o) })} className="input-field flex-1" />
              <button type="button" onClick={() => { if (options.length <= 2) return; onChange({ ...c, options: options.filter((_: any, i: number) => i !== idx), correct_id: options[0]?.id }); }} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => { const id = String.fromCharCode(97 + options.length); onChange({ ...c, options: [...options, { id, text: '' }] }); }} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus className="w-3 h-3" /> Agregar opción</button>
      </div>
      <div><label className="label-sm">Transcripción (opcional, para accesibilidad)</label><textarea value={c.transcript ?? ''} onChange={e => onChange({ ...c, transcript: e.target.value })} rows={2} className="input-field text-sm" /></div>
    </div>
  );
}

// ─── Formulario por idioma ─────────────────────────────────────────────────

function ContentFormForLang({ type, content, onChange }: { type: ActivityType; content: any; onChange: (c: any) => void }) {
  const c = { ...content, _lang: undefined };
  switch (type) {
    case 'multiple_choice':
    case 'image_question': return <MultipleChoiceForm c={c} onChange={onChange} />;
    case 'true_false':     return <TrueFalseForm c={c} onChange={onChange} />;
    case 'fill_blank':     return <FillBlankForm c={c} onChange={onChange} />;
    case 'short_answer':   return <ShortAnswerForm c={c} onChange={onChange} />;
    case 'matching':       return <MatchingForm c={c} onChange={onChange} />;
    case 'ordering':       return <OrderingForm c={c} onChange={onChange} />;
    case 'drag_drop':      return <DragDropForm c={c} onChange={onChange} />;
    case 'listening':      return <ListeningForm c={c} onChange={onChange} />;
    case 'essay':
    case 'long_response':
    case 'structured_essay':
    case 'open_writing':   return <EssayForm c={c} onChange={onChange} type={type} />;
    default: return <p className="text-sm text-gray-400">Tipo no soportado en el editor</p>;
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ActivityEditor({ activity, onSave, onCancel }: Props) {
  const { profile } = useAuth();
  const { enhance, loading: aiLoading } = useAI();

  const [type, setType] = useState<ActivityType>(activity?.type ?? 'multiple_choice');
  const [title, setTitle] = useState(activity?.title ?? '');
  const [points, setPoints] = useState(activity?.points ?? 1);
  const [mediaUrl, setMediaUrl] = useState(activity?.media_url ?? '');
  const [activeLang, setActiveLang] = useState<Lang>('es');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rawContent = activity?.content ?? {};
  const [contentEs, setContentEs] = useState<any>(rawContent?.es ?? emptyContent(type));
  const [contentEn, setContentEn] = useState<any>(rawContent?.en ?? emptyContent(type));

  function handleTypeChange(newType: ActivityType) {
    setType(newType);
    setContentEs(emptyContent(newType));
    setContentEn(emptyContent(newType));
  }

  async function handleImproveTitle() {
    const improved = await enhance('improve_title', activeLang, { title });
    if (improved) setTitle(improved);
  }

  async function handleSave() {
    if (!title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    setError('');

    const contentPayload = { es: contentEs, en: contentEn };

    try {
      const db = supabase as any;
      let saved: Activity;
      if (activity?.id) {
        const { data, error: err } = await db
          .from('activities')
          .update({ type, title, content: contentPayload, points, media_url: mediaUrl || null })
          .eq('id', activity.id)
          .select()
          .single();
        if (err) throw err;
        saved = data as Activity;
      } else {
        const { data, error: err } = await db
          .from('activities')
          .insert({ type, title, content: contentPayload, points, media_url: mediaUrl || null, created_by: profile?.id })
          .select()
          .single();
        if (err) throw err;
        saved = data as Activity;
      }
      onSave(saved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const needsMedia = type === 'image_question' || type === 'listening';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {activity?.id ? 'Editar actividad' : 'Nueva actividad'}
          </h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Tipo */}
          <div>
            <label className="label-sm">Tipo de actividad</label>
            <select
              value={type}
              onChange={e => handleTypeChange(e.target.value as ActivityType)}
              disabled={!!activity?.id}
              className="input-field"
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {activity?.id && <p className="text-xs text-gray-400 mt-1">El tipo no se puede cambiar en una actividad existente.</p>}
          </div>

          {/* Título + IA */}
          <div>
            <label className="label-sm">Título / Instrucción para el estudiante</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="input-field flex-1"
                placeholder="Ej: Selecciona el saludo correcto para la mañana"
              />
              <button
                type="button"
                onClick={handleImproveTitle}
                disabled={!title || aiLoading === 'improve_title' + activeLang}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm hover:bg-purple-100 transition disabled:opacity-40"
              >
                {aiLoading === 'improve_title' + activeLang ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                IA
              </button>
            </div>
          </div>

          {/* Puntos */}
          <div className="w-32">
            <label className="label-sm">Puntos</label>
            <input type="number" min={0} max={100} value={points} onChange={e => setPoints(Number(e.target.value))} className="input-field" />
          </div>

          {/* Media (imagen/audio) */}
          {needsMedia && (
            <MediaUploader
              value={mediaUrl}
              onChange={setMediaUrl}
              accept={type === 'image_question' ? 'image' : 'audio'}
              label={type === 'image_question' ? 'Imagen de la actividad' : 'Archivo de audio'}
            />
          )}

          {/* Contenido bilingüe */}
          <div>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm font-semibold text-gray-700">Contenido</span>
              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
                {(['es', 'en'] as Lang[]).map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveLang(lang)}
                    className={`px-4 py-1.5 font-medium transition ${activeLang === lang ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {lang === 'es' ? '🇪🇸 Español' : '🇺🇸 English'}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              {activeLang === 'es' ? (
                <ContentFormForLang type={type} content={contentEs} onChange={setContentEs} />
              ) : (
                <ContentFormForLang type={type} content={contentEn} onChange={setContentEn} />
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {activity?.id ? 'Guardar cambios' : 'Crear actividad'}
          </button>
        </div>
      </div>
    </div>
  );
}
