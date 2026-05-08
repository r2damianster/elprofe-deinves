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
type EditRequest = { id: string; status: 'pending' | 'approved' | 'denied'; professor_note: string | null };

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-500',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  needs_revision: 'bg-amber-100 text-amber-700',
};
const STATUS_LABELS = {
  draft: 'Borrador', submitted: 'Enviado',
  approved: 'Aprobado', needs_revision: 'Revisar',
};
const LOGIC_LABELS = { ordinal: 'Secuencial', causal: 'Causal', structural: 'Estructural' };

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Editor inline ────────────────────────────────────────────────────────────
function ObjectEditor({
  type, object, projectId, userId, onSaved,
}: {
  type: ObjectType;
  object: ProjectObject | null;
  projectId: string;
  userId: string;
  onSaved: (updated: ProjectObject) => void;
}) {
  const [content, setContent] = useState(object?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (object && (object.status === 'submitted' || object.status === 'approved')) {
      sb.from('project_object_edit_requests')
        .select('id, status, professor_note')
        .eq('project_object_id', object.id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()
        .then(({ data }: any) => setEditRequest(data));
    }
  }, [object?.id]);

  const canEdit = useCallback((): boolean => {
    if (!object) return true;
    const { status } = object;
    const { edit_policy } = type;
    if (status === 'draft' || status === 'needs_revision') return true;
    if (edit_policy === 'always') return true;
    if (edit_policy === 'locked_after_submit') return false;
    if (edit_policy === 'requires_approval') return editRequest?.status === 'approved';
    return false;
  }, [object, type, editRequest]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function upsert(newStatus: 'draft' | 'submitted') {
    setSaving(true);
    const wc = countWords(content);
    const payload = {
      project_id: projectId, object_type_id: type.id, student_id: userId,
      content, status: newStatus, word_count: wc,
      version: object ? object.version : 1,
      submitted_at: newStatus === 'submitted' ? new Date().toISOString() : object?.submitted_at ?? null,
    };
    const { data, error } = await sb.from('project_objects')
      .upsert(payload, { onConflict: 'object_type_id,student_id' })
      .select().single();
    if (error) { showToast(error.message, false); }
    else {
      showToast(newStatus === 'submitted' ? 'Enviado.' : 'Borrador guardado.');
      setConfirmSubmit(false);
      onSaved(data as ProjectObject);
    }
    setSaving(false);
  }

  async function sendRequest() {
    if (!object || !requestReason.trim()) return;
    setSubmitting(true);
    const { error } = await sb.from('project_object_edit_requests').insert({
      project_object_id: object.id, student_id: userId, reason: requestReason.trim(),
    });
    if (error) showToast(error.message, false);
    else {
      showToast('Solicitud enviada.');
      setShowRequestForm(false); setRequestReason('');
      const { data } = await sb.from('project_object_edit_requests')
        .select('id, status, professor_note').eq('project_object_id', object.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      setEditRequest(data);
    }
    setSubmitting(false);
  }

  const wc = countWords(content);
  const editable = canEdit();
  const missingWords = type.required_words.filter(
    w => !content.toLowerCase().includes(w.toLowerCase())
  );
  const isValid = wc >= type.min_words && missingWords.length === 0;

  return (
    <div className="px-4 pb-4 space-y-3">
      {type.instructions && (
        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 leading-relaxed">
          {type.instructions}
        </p>
      )}
      {object?.feedback && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-1">Retroalimentación del profesor</p>
          <p className="text-sm text-amber-800">{object.feedback}</p>
        </div>
      )}
      {editRequest && !editable && (
        <div className={`p-3 rounded-lg border text-sm ${
          editRequest.status === 'pending' ? 'bg-blue-50 border-blue-200 text-blue-800' :
          editRequest.status === 'denied'  ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {editRequest.status === 'pending' && 'Solicitud de edición pendiente.'}
          {editRequest.status === 'denied'  && `Solicitud denegada.${editRequest.professor_note ? ` Nota: ${editRequest.professor_note}` : ''}`}
        </div>
      )}
      <textarea
        value={content} onChange={e => setContent(e.target.value)}
        disabled={!editable} rows={10}
        className={`w-full border rounded-xl px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          !editable ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200' : 'border-gray-300'
        }`}
        placeholder={editable ? (type.instructions ?? 'Escribe aquí...') : 'No editable en este momento.'}
      />
      <div className="flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={wc < type.min_words ? 'text-red-500' : 'text-gray-500'}>
            {wc} palabras{type.min_words > 0 ? ` / mín. ${type.min_words}` : ''}
            {type.max_words ? ` — máx. ${type.max_words}` : ''}
          </span>
          {type.required_words.length > 0 && (
            <span className="flex items-center gap-1 flex-wrap">
              Requeridas:{' '}
              {type.required_words.map(w => (
                <span key={w} className={`px-1 rounded ${content.toLowerCase().includes(w.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {w}
                </span>
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
      {editable ? (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => upsert('draft')} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> Guardar borrador
          </button>
          {confirmSubmit ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">¿Confirmar envío?</span>
              <button onClick={() => upsert('submitted')} disabled={saving || !isValid}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                Sí, enviar
              </button>
              <button onClick={() => setConfirmSubmit(false)} className="text-xs text-gray-500">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmSubmit(true)} disabled={saving || !isValid}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              title={!isValid ? `Mín. ${type.min_words} palabras` : ''}>
              <Send className="w-3.5 h-3.5" /> Enviar
            </button>
          )}
        </div>
      ) : (
        type.edit_policy === 'requires_approval' && (!editRequest || editRequest.status === 'denied') && (
          !showRequestForm ? (
            <button onClick={() => setShowRequestForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-400 text-amber-700 text-sm rounded-lg hover:bg-amber-50">
              <Lock className="w-3.5 h-3.5" /> Solicitar permiso de edición
            </button>
          ) : (
            <div className="space-y-2">
              <textarea value={requestReason} onChange={e => setRequestReason(e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="¿Por qué necesitas modificar este texto?" />
              <div className="flex gap-2">
                <button onClick={sendRequest} disabled={submitting || !requestReason.trim()}
                  className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {submitting ? 'Enviando...' : 'Enviar solicitud'}
                </button>
                <button onClick={() => setShowRequestForm(false)} className="text-xs text-gray-500">Cancelar</button>
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}

// ─── Flecha causal ────────────────────────────────────────────────────────────
function CausalArrow() {
  return (
    <div className="flex justify-center py-1 text-gray-300">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProjectObjectList({
  projectId, onBack,
}: {
  projectId: string; onBack: () => void;
}) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [types, setTypes] = useState<ObjectType[]>([]);
  const [objects, setObjects] = useState<Record<string, ProjectObject>>({});
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showPresentation, setShowPresentation] = useState(false);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    const [projRes, typesRes, objsRes] = await Promise.all([
      sb.from('projects').select('id,title,description,object_logic').eq('id', projectId).single(),
      sb.from('project_object_types').select('*').eq('project_id', projectId).order('order_index'),
      sb.from('project_objects').select('*').eq('project_id', projectId).eq('student_id', user!.id),
    ]);
    if (projRes.data) setProject(projRes.data as Project);
    setTypes((typesRes.data ?? []) as ObjectType[]);
    const objMap: Record<string, ProjectObject> = {};
    (objsRes.data ?? []).forEach((o: ProjectObject) => { objMap[o.object_type_id] = o; });
    setObjects(objMap);
    setLoading(false);
  }

  function toggleExpand(typeId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  }

  function handleSaved(typeId: string, updated: ProjectObject) {
    setObjects(prev => ({ ...prev, [typeId]: updated }));
  }

  if (showPresentation && project) {
    return <ProjectPresentation projectId={projectId} onBack={() => setShowPresentation(false)} />;
  }

  if (loading || !project) {
    return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando...</div>;
  }

  const completedCount = types.filter(t => {
    const o = objects[t.id];
    return o?.status === 'submitted' || o?.status === 'approved';
  }).length;
  const allDone = completedCount === types.length && types.length > 0;

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
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-800 truncate">{project.title}</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{LOGIC_LABELS[project.object_logic]}</span>
            <span>{completedCount}/{types.length} completados</span>
          </div>
        </div>
        {allDone && (
          <button onClick={() => setShowPresentation(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition">
            Ver proyecto completo
          </button>
        )}
      </div>

      {project.description && <p className="text-sm text-gray-500">{project.description}</p>}

      {/* Barra de progreso */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progreso</span>
          <span>{types.length > 0 ? Math.round((completedCount / types.length) * 100) : 0}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-indigo-500 transition-all"
            style={{ width: types.length > 0 ? `${(completedCount / types.length) * 100}%` : '0%' }} />
        </div>
      </div>

      {/* Acordeón */}
      <div className="space-y-2">
        {flatTypes.map(({ type: t, depth }, i) => {
          const obj = objects[t.id] ?? null;
          const isExpanded = expandedIds.has(t.id);
          const isLast = i === flatTypes.length - 1;
          const isReadOnly = obj && (obj.status === 'submitted' || obj.status === 'approved') && t.edit_policy === 'locked_after_submit';

          return (
            <div key={t.id} style={{ marginLeft: `${depth * 20}px` }}>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Cabecera */}
                <button
                  onClick={() => toggleExpand(t.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                    isExpanded ? 'bg-indigo-50 border-b border-indigo-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                    obj?.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    obj?.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                    obj?.status === 'needs_revision' ? 'bg-amber-100 text-amber-700' :
                    obj?.status === 'draft' ? 'bg-gray-200 text-gray-600' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {i + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 text-sm">{t.name}</span>
                      {obj ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[obj.status]}`}>
                          {STATUS_LABELS[obj.status]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin iniciar</span>
                      )}
                      {obj?.score !== null && obj?.score !== undefined && (
                        <span className="text-xs text-emerald-600 font-semibold">{obj.score}/10</span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>
                    )}
                    {obj && !isExpanded && (
                      <p className="text-xs text-gray-400 mt-0.5">{obj.word_count} palabras escritas</p>
                    )}
                  </div>

                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  }
                </button>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div>
                    {isReadOnly && obj ? (
                      /* Solo lectura: texto formateado + feedback */
                      <div className="px-4 py-4 space-y-3">
                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[80px]">
                          {obj.content}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>{obj.word_count} palabras</span>
                          {obj.score !== null && <span className="text-emerald-600 font-semibold">{obj.score}/10</span>}
                        </div>
                        {obj.feedback && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs font-semibold text-amber-700 mb-1">Retroalimentación</p>
                            <p className="text-sm text-amber-800">{obj.feedback}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Editor (borrador, revisión, sin iniciar, o política editable) */
                      <ObjectEditor
                        type={t} object={obj} projectId={projectId}
                        userId={user!.id}
                        onSaved={(updated) => handleSaved(t.id, updated)}
                      />
                    )}
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
