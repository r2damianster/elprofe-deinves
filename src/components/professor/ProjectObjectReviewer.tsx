import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronDown, ChevronUp, CheckCircle, RotateCcw, Loader2, Sparkles
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type ObjectType = {
  id: string;
  name: string;
  order_index: number;
  min_words: number | null;
  max_words: number | null;
  required_words: string[] | null;
  project_id: string;
};

type ProjectObjectRow = {
  id: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  content: string;
  word_count: number;
  score: number | null;
  feedback: string | null;
  version: number;
  submitted_at: string | null;
  project_id: string;
  object_type_id: string;
  student: { full_name: string; email: string };
};

type StatusFilter = 'submitted' | 'approved' | 'needs_revision' | 'all';

function statusBadge(status: string) {
  switch (status) {
    case 'approved':       return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Aprobado</span>;
    case 'submitted':      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Enviado</span>;
    case 'needs_revision': return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">A revisar</span>;
    default:               return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Borrador</span>;
  }
}

export default function ProjectObjectReviewer() {
  const { profile } = useAuth();

  // Proyectos del profesor para el dropdown
  const [allProjects, setAllProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('submitted');

  const [types, setTypes] = useState<ObjectType[]>([]);
  const [objects, setObjects] = useState<ProjectObjectRow[]>([]);
  const [projectTitleMap, setProjectTitleMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const [rubricPrompt, setRubricPrompt] = useState('');
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);

  // Cargar proyectos del profesor para el dropdown (sin course_id)
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('projects')
      .select('id, title')
      .eq('professor_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const pList = (data ?? []) as { id: string; title: string }[];
        setAllProjects(pList);
        setProjectTitleMap(Object.fromEntries(pList.map(p => [p.id, p.title])));
      });
  }, [profile?.id]);

  // loadObjects usa project_id directo — no pasa por object_type_id
  const loadObjects = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setExpanded(null);

    // Obtener project_ids del profesor
    let projectQuery = supabase
      .from('projects')
      .select('id')
      .eq('professor_id', profile.id);

    if (selectedProjectId) {
      projectQuery = projectQuery.eq('id', selectedProjectId);
    }

    const { data: projectsData, error: projectsError } = await projectQuery;
    if (projectsError) {
      console.error('[ProjectObjectReviewer] projects error:', projectsError.message);
      setLoading(false);
      return;
    }

    const targetProjectIds = (projectsData ?? []).map((p: { id: string }) => p.id);
    if (targetProjectIds.length === 0) {
      setObjects([]);
      setTypes([]);
      setLoading(false);
      return;
    }

    // Obtener tipos para el typeMap (nombres, requisitos)
    const { data: typesData } = await supabase
      .from('project_object_types')
      .select('id, name, order_index, min_words, max_words, required_words, project_id')
      .in('project_id', targetProjectIds)
      .order('order_index');

    setTypes((typesData ?? []) as ObjectType[]);

    // Obtener objetos directamente por project_id
    const statusValues = statusFilter === 'all'
      ? ['submitted', 'approved', 'needs_revision']
      : [statusFilter];

    const { data, error: objsError } = await sb
      .from('project_objects')
      .select('id, status, content, word_count, score, feedback, version, submitted_at, project_id, object_type_id, student:profiles!student_id(full_name, email)')
      .in('project_id', targetProjectIds)
      .in('status', statusValues)
      .order('submitted_at', { ascending: false });

    if (objsError) {
      console.error('[ProjectObjectReviewer] objects error:', objsError.message);
    }

    setObjects(data ?? []);
    setLoading(false);
  }, [profile?.id, selectedProjectId, statusFilter]);

  useEffect(() => { loadObjects(); }, [loadObjects]);

  async function submitReview(objectId: string, newStatus: 'approved' | 'needs_revision') {
    if (newStatus === 'approved') {
      const n = parseFloat(scores[objectId] ?? '');
      if (isNaN(n) || n < 0 || n > 10) { alert('Puntuación entre 0 y 10.'); return; }
    }
    setSubmitting(objectId);
    await sb.from('project_objects').update({
      status: newStatus,
      score: newStatus === 'approved' ? parseFloat(scores[objectId]) : null,
      feedback: newStatus === 'approved' ? (feedbacks[objectId]?.trim() || null) : null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', objectId);

    setObjects(prev => prev.map(o =>
      o.id === objectId
        ? {
            ...o,
            status: newStatus,
            score: newStatus === 'approved' ? parseFloat(scores[objectId]) : null,
            feedback: newStatus === 'approved' ? (feedbacks[objectId]?.trim() || null) : null,
          }
        : o
    ));
    setExpanded(null);
    setSubmitting(null);
  }

  async function generateRubric() {
    if (!selectedProjectId) return;
    setGeneratingRubric(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const project = allProjects.find(p => p.id === selectedProjectId);
      const projectTypes = types.filter(t => t.project_id === selectedProjectId);
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          task: 'suggest_rubric',
          lang: 'es',
          data: {
            lesson_title: project?.title ?? '',
            instructions: projectTypes.map(t => t.name).join(', '),
          },
        }),
      });
      const json = await res.json();
      if (json.result) setRubricPrompt(json.result);
    } catch (err: any) {
      alert('Error IA: ' + err.message);
    } finally {
      setGeneratingRubric(false);
    }
  }

  async function gradeWithAI(objectId: string) {
    if (!rubricPrompt.trim()) { alert('Ingresa o genera una rúbrica primero.'); return; }
    const obj = objects.find(o => o.id === objectId);
    if (!obj?.content?.trim()) { alert('Sin contenido para evaluar.'); return; }
    setGradingId(objectId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          task: 'review_production',
          lang: 'es',
          data: { content: obj.content, rubric_prompt: rubricPrompt, word_count: obj.word_count },
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const r = json.result;
      setScores(prev => ({ ...prev, [objectId]: String(r.score ?? r.nota ?? '') }));
      setFeedbacks(prev => ({ ...prev, [objectId]: r.feedback ?? r.retroalimentacion ?? '' }));
    } catch (err: any) {
      alert('Error IA: ' + err.message);
    } finally {
      setGradingId(null);
    }
  }

  const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
  const showProjectColumn = !selectedProjectId;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Todos los proyectos</option>
          {allProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="submitted">Enviados</option>
          <option value="approved">Aprobados</option>
          <option value="needs_revision">A revisar</option>
          <option value="all">Todos</option>
        </select>

        {!loading && (
          <span className="text-xs text-gray-400">
            {objects.length} entrega{objects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Panel IA rúbrica */}
      {selectedProjectId && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Rúbrica de evaluación
            </span>
            <button
              onClick={generateRubric}
              disabled={generatingRubric}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {generatingRubric ? 'Generando...' : 'Generar con IA'}
            </button>
          </div>
          <textarea
            value={rubricPrompt}
            onChange={e => setRubricPrompt(e.target.value)}
            rows={3}
            placeholder="Rúbrica para evaluar objetos del proyecto..."
            className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
        </div>
      ) : objects.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl text-sm">
          No hay entregas con el filtro seleccionado.
        </div>
      ) : (
        <div className="space-y-2">
          {objects.map(obj => {
            const type = typeMap[obj.object_type_id];
            const isExpanded = expanded === obj.id;
            const wc = obj.word_count ?? 0;
            const minOk = !type?.min_words || wc >= type.min_words;
            const missing = (type?.required_words ?? []).filter(
              w => !obj.content?.toLowerCase().includes(w.toLowerCase())
            );
            const projectTitle = projectTitleMap[obj.project_id];

            return (
              <div key={obj.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    const opening = expanded !== obj.id;
                    setExpanded(opening ? obj.id : null);
                    if (opening) {
                      setScores(prev => ({ ...prev, [obj.id]: obj.score?.toString() ?? '' }));
                      setFeedbacks(prev => ({ ...prev, [obj.id]: obj.feedback ?? '' }));
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                >
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  }
                  <div className={`flex-1 grid gap-2 items-center min-w-0 ${showProjectColumn ? 'grid-cols-5' : 'grid-cols-4'}`}>
                    <span className="font-medium text-gray-800 text-sm truncate">
                      {obj.student?.full_name ?? 'Estudiante'}
                    </span>
                    {showProjectColumn && (
                      <span className="text-xs text-teal-600 font-medium truncate">
                        {projectTitle ?? '—'}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 truncate">{type?.name ?? '—'}</span>
                    <span className="text-xs text-gray-400">{wc} palabras</span>
                    <div className="flex items-center gap-2 justify-end">
                      {statusBadge(obj.status)}
                      {obj.score != null && (
                        <span className="text-xs font-medium text-gray-600">{obj.score}/10</span>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                    {type && (
                      <div className="flex flex-wrap gap-2">
                        {(type.min_words ?? 0) > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded ${minOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {wc}/{type.min_words} palabras mín.
                          </span>
                        )}
                        {type.max_words && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                            máx. {type.max_words}
                          </span>
                        )}
                        {(type.required_words ?? []).map(w => (
                          <span key={w} className={`text-xs px-2 py-0.5 rounded ${obj.content?.toLowerCase().includes(w.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {w}
                          </span>
                        ))}
                        {missing.length > 0 && (
                          <span className="text-xs text-red-500">Faltan {missing.length} palabra(s)</span>
                        )}
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                      {obj.content?.trim()
                        ? obj.content
                        : <span className="text-gray-400 italic">Sin contenido.</span>
                      }
                    </div>

                    <div className="space-y-3">
                      <div className="flex gap-3 items-end">
                        <div className="w-36">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Puntuación (0–10)</label>
                          <input
                            type="number" min={0} max={10} step={0.1}
                            value={scores[obj.id] ?? ''}
                            onChange={e => setScores(prev => ({ ...prev, [obj.id]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        {rubricPrompt.trim() && (
                          <button
                            onClick={() => gradeWithAI(obj.id)}
                            disabled={gradingId === obj.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {gradingId === obj.id ? 'Evaluando...' : 'Evaluar con IA'}
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Retroalimentación</label>
                        <textarea
                          rows={3}
                          value={feedbacks[obj.id] ?? ''}
                          onChange={e => setFeedbacks(prev => ({ ...prev, [obj.id]: e.target.value }))}
                          placeholder="Comentarios para el estudiante..."
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => submitReview(obj.id, 'approved')}
                          disabled={submitting === obj.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {submitting === obj.id ? 'Guardando...' : 'Aprobar'}
                        </button>
                        <button
                          onClick={() => submitReview(obj.id, 'needs_revision')}
                          disabled={submitting === obj.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Pedir revisión
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
