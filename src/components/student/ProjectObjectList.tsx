import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft, ChevronDown, ChevronUp,
  Save, Send, Lock, AlertCircle, CheckCircle,
} from 'lucide-react';
import ProjectPresentation from './ProjectPresentation';

type Project = {
  id: string; title: string; description: string | null;
  object_logic: 'ordinal' | 'causal' | 'structural';
};
type ObjectType = {
  id: string; name: string; description: string | null; instructions: string | null;
  order_index: number; parent_object_type_id: string | null;
  min_words: number; max_words: number | null; required_words: string[];
  edit_policy: 'always' | 'requires_approval' | 'locked_after_submit';
};
type ProjectObject = {
  id: string; object_type_id: string; content: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  word_count: number; score: number | null; version: number;
  feedback: string | null; submitted_at: string | null;
};
type Submission = {
  id: string; status: 'draft' | 'submitted' | 'reviewed';
  score: number | null; feedback: string | null; submitted_at: string | null;
};

const LOGIC_LABELS = { ordinal: 'Secuencial', causal: 'Causal', structural: 'Estructural' };

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Editor inline de un objeto (solo borrador) ───────────────────────────────
function ObjectEditor({
  type, object, projectId, userId, locked, onSaved,
}: {
  type: ObjectType; object: ProjectObject | null;
  projectId: string; userId: string; locked: boolean;
  onSaved: (updated: ProjectObject) => void;
}) {
  const [content, setContent] = useState(object?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function saveDraft() {
    if (locked) return;
    setSaving(true);
    const wc = countWords(content);
    const { data, error } = await sb.from('project_objects')
      .upsert({
        project_id: projectId, object_type_id: type.id, student_id: userId,
        content, status: 'draft', word_count: wc,
        version: object ? object.version : 1,
        submitted_at: object?.submitted_at ?? null,
      }, { onConflict: 'object_type_id,student_id' })
      .select().single();
    if (error) showToast(error.message, false);
    else { showToast('Borrador guardado.'); onSaved(data as ProjectObject); }
    setSaving(false);
  }

  const wc = countWords(content);
  const missingWords = type.required_words.filter(
    w => !content.toLowerCase().includes(w.toLowerCase())
  );

  if (locked) {
    return (
      <div className="px-4 pb-4 space-y-2">
        {type.instructions && (
          <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">{type.instructions}</p>
        )}
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[80px]">
          {object?.content || <span className="italic text-gray-400">Sin contenido</span>}
        </div>
        {object && <p className="text-xs text-gray-400">{object.word_count} palabras</p>}
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {type.instructions && (
        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 leading-relaxed">{type.instructions}</p>
      )}
      <textarea
        value={content} onChange={e => setContent(e.target.value)}
        rows={10} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400"
        placeholder={type.instructions ?? 'Escribe tu borrador aquí...'}
      />
      <div className="flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={wc < type.min_words ? 'text-red-500' : 'text-gray-500'}>
            {wc} palabras{type.min_words > 0 ? ` / mín. ${type.min_words}` : ''}
            {type.max_words ? ` — máx. ${type.max_words}` : ''}
          </span>
          {type.required_words.length > 0 && (
            <span className="flex items-center gap-1 flex-wrap">
              {type.required_words.map(w => (
                <span key={w} className={`px-1 rounded ${content.toLowerCase().includes(w.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{w}</span>
              ))}
            </span>
          )}
        </div>
        {toast && (
          <span className={`flex items-center gap-1 ${toast.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {toast.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {toast.msg}
          </span>
        )}
      </div>
      <button onClick={saveDraft} disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
        <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar borrador'}
      </button>
      {missingWords.length > 0 && (
        <p className="text-xs text-amber-600">Faltan palabras requeridas: {missingWords.join(', ')}</p>
      )}
    </div>
  );
}

function CausalArrow() {
  return (
    <div className="flex justify-center py-1 text-gray-300">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

export default function ProjectObjectList({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [types, setTypes] = useState<ObjectType[]>([]);
  const [objects, setObjects] = useState<Record<string, ProjectObject>>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    const [projRes, typesRes, objsRes, subRes] = await Promise.all([
      sb.from('projects').select('id,title,description,object_logic').eq('id', projectId).single(),
      sb.from('project_object_types').select('*').eq('project_id', projectId).order('order_index'),
      sb.from('project_objects').select('*').eq('project_id', projectId).eq('student_id', user!.id),
      sb.from('project_submissions').select('*').eq('project_id', projectId).eq('student_id', user!.id).maybeSingle(),
    ]);
    if (projRes.data) setProject(projRes.data);
    setTypes((typesRes.data ?? []) as ObjectType[]);
    const map: Record<string, ProjectObject> = {};
    (objsRes.data ?? []).forEach((o: ProjectObject) => { map[o.object_type_id] = o; });
    setObjects(map);
    setSubmission(subRes.data ?? null);
    setLoading(false);
  }

  function toggleExpand(typeId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId); else next.add(typeId);
      return next;
    });
  }

  function handleSaved(typeId: string, updated: ProjectObject) {
    setObjects(prev => ({ ...prev, [typeId]: updated }));
  }

  async function submitProject() {
    if (!confirm('¿Enviar el proyecto completo al profesor? No podrás editarlo hasta que te lo devuelva.')) return;
    setSubmitting(true);
    await sb.from('project_submissions').upsert({
      project_id: projectId,
      student_id: user!.id,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'project_id,student_id' });
    await load();
    setSubmitting(false);
  }

  if (showPresentation && project) {
    return <ProjectPresentation projectId={projectId} onBack={() => setShowPresentation(false)} />;
  }
  if (loading || !project) {
    return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando...</div>;
  }

  const locked = submission?.status === 'submitted' || submission?.status === 'reviewed';
  const objectsWithContent = types.filter(t => objects[t.id]?.content?.trim());
  const canSubmit = !locked && objectsWithContent.length > 0;

  function flattenStructural(parentId: string | null = null, depth = 0): Array<{ type: ObjectType; depth: number }> {
    return types
      .filter(t => t.parent_object_type_id === parentId)
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap(t => [{ type: t, depth }, ...flattenStructural(t.id, depth + 1)]);
  }

  const flatTypes = project.object_logic === 'structural'
    ? flattenStructural()
    : types.sort((a, b) => a.order_index - b.order_index).map(t => ({ type: t, depth: 0 }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-800 truncate">{project.title}</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{LOGIC_LABELS[project.object_logic]}</span>
            <span>{objectsWithContent.length}/{types.length} objetos con contenido</span>
          </div>
        </div>
      </div>

      {/* Banner de estado del envío */}
      {submission?.status === 'submitted' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Lock className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Proyecto enviado al profesor</p>
            <p className="text-xs text-blue-600">En espera de evaluación. No puedes editar hasta recibir respuesta.</p>
          </div>
        </div>
      )}
      {submission?.status === 'reviewed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-emerald-800">
            Proyecto evaluado {submission.score !== null ? `· ${submission.score}/10` : ''}
          </p>
          {submission.feedback && <p className="text-sm text-emerald-700">{submission.feedback}</p>}
        </div>
      )}

      {project.description && <p className="text-sm text-gray-500">{project.description}</p>}

      {/* Botón enviar proyecto */}
      {!locked && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">
            Cuando termines todos los objetos, envía el proyecto al profesor.
          </p>
          <button
            onClick={submitProject}
            disabled={!canSubmit || submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            <Send className="w-4 h-4" /> {submitting ? 'Enviando...' : 'Enviar proyecto'}
          </button>
        </div>
      )}

      {/* Acordeón */}
      <div className="space-y-2">
        {flatTypes.map(({ type: t, depth }, i) => {
          const obj = objects[t.id] ?? null;
          const isExpanded = expandedIds.has(t.id);
          const isLast = i === flatTypes.length - 1;
          const hasContent = !!obj?.content?.trim();

          return (
            <div key={t.id} style={{ marginLeft: `${depth * 20}px` }}>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button onClick={() => toggleExpand(t.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${isExpanded ? 'bg-indigo-50 border-b border-indigo-100' : 'hover:bg-gray-50'}`}>
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                    hasContent ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-800">{t.name}</span>
                      {hasContent
                        ? <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">{obj!.word_count} palabras</span>
                        : <span className="text-xs text-gray-400">Sin contenido</span>
                      }
                    </div>
                    {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <ObjectEditor
                      type={t} object={obj} projectId={projectId}
                      userId={user!.id} locked={locked}
                      onSaved={(updated) => handleSaved(t.id, updated)}
                    />
                  </div>
                )}
              </div>
              {project.object_logic === 'causal' && !isLast && <CausalArrow />}
            </div>
          );
        })}
      </div>

      {types.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed rounded-xl">
          Este proyecto aún no tiene objetos definidos.
        </div>
      )}
    </div>
  );
}
