import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import {
  ArrowLeft, ChevronDown, ChevronUp, Check, RotateCcw,
  Users, Sparkles, Save, Clock,
} from 'lucide-react';

type ObjectType = {
  id: string; name: string; order_index: number;
  min_words: number; description: string | null;
};

type ProjectObject = {
  id: string; object_type_id: string; student_id: string;
  content: string; status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  word_count: number; version: number;
  feedback: string | null; score: number | null;
  submitted_at: string | null;
};

type StudentRow = {
  student_id: string; student_name: string;
  submitted: number; total: number;
};

type BatchResult = { id: string; score: number; feedback: string };

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  needs_revision: 'bg-amber-100 text-amber-700',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', submitted: 'Enviado',
  approved: 'Aprobado', needs_revision: 'Revisar',
};

export default function ProjectReviewer({
  projectId, onBack,
}: { projectId: string; onBack: () => void }) {
  const [projectTitle, setProjectTitle] = useState('');
  const [types, setTypes] = useState<ObjectType[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [objectsByStudent, setObjectsByStudent] = useState<Record<string, ProjectObject[]>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Acordeón por tipo
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Revisión manual por objeto
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // IA
  const [rubricPrompt, setRubricPrompt] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [generatingRubric, setGeneratingRubric] = useState(false);

  // Solicitudes de re-edición
  const [tab, setTab] = useState<'review' | 'requests'>('review');
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [reqNotes, setReqNotes] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);

    const [projRes, typesRes, objsRes, reqsRes] = await Promise.all([
      sb.from('projects').select('title').eq('id', projectId).single(),
      sb.from('project_object_types').select('id,name,order_index,min_words,description')
        .eq('project_id', projectId).order('order_index'),
      sb.from('project_objects')
        .select('*, profiles!student_id(full_name)')
        .in('object_type_id',
          (await sb.from('project_object_types').select('id').eq('project_id', projectId))
            .data?.map((t: any) => t.id) ?? []
        )
        .order('submitted_at'),
      sb.from('project_object_edit_requests')
        .select('*, project_objects(object_type_id, profiles!student_id(full_name))')
        .eq('status', 'pending'),
    ]);

    if (projRes.data) setProjectTitle(projRes.data.title);
    const typeList: ObjectType[] = typesRes.data ?? [];
    setTypes(typeList);

    const rawObjs: any[] = objsRes.data ?? [];
    const byStudent: Record<string, ProjectObject[]> = {};
    const studentMeta: Record<string, { name: string }> = {};

    rawObjs.forEach(o => {
      const sid = o.student_id;
      if (!byStudent[sid]) byStudent[sid] = [];
      byStudent[sid].push(o as ProjectObject);
      studentMeta[sid] = { name: o.profiles?.full_name ?? 'Estudiante' };
    });

    // Solo mostrar estudiantes que tienen al menos un objeto enviado/aprobado/revisión
    const studentRows: StudentRow[] = Object.entries(byStudent)
      .filter(([, objs]) => objs.some(o => o.status !== 'draft'))
      .map(([sid, objs]) => ({
        student_id: sid,
        student_name: studentMeta[sid]?.name ?? 'Estudiante',
        submitted: objs.filter(o => o.status === 'submitted').length,
        total: typeList.length,
      }))
      .sort((a, b) => b.submitted - a.submitted);

    setStudents(studentRows);
    setObjectsByStudent(byStudent);

    // Precargar scores/feedbacks
    const newScores: Record<string, string> = {};
    const newFeedbacks: Record<string, string> = {};
    rawObjs.forEach(o => {
      if (o.score !== null) newScores[o.id] = String(o.score);
      if (o.feedback) newFeedbacks[o.id] = o.feedback;
    });
    setScores(newScores);
    setFeedbacks(newFeedbacks);

    // Solicitudes pendientes
    const typeMap: Record<string, string> = {};
    typeList.forEach(t => { typeMap[t.id] = t.name; });
    setEditRequests(
      ((reqsRes.data ?? []) as any[]).map(r => ({
        ...r,
        student_name: r.project_objects?.profiles?.full_name ?? 'Estudiante',
        object_name: typeMap[r.project_objects?.object_type_id ?? ''] ?? '—',
      }))
    );

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

  async function submitReview(objId: string, newStatus: 'approved' | 'needs_revision') {
    const numScore = parseFloat(scores[objId] ?? '');
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
      alert('La puntuación debe ser un número entre 0 y 10.');
      return;
    }
    setSaving(objId);
    await sb.from('project_objects').update({
      status: newStatus,
      score: numScore,
      feedback: feedbacks[objId]?.trim() || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', objId);
    setSaving(null);
    await load();
  }

  // ── IA ────────────────────────────────────────────────────────────────────

  async function generateRubric() {
    if (!projectTitle) return;
    setGeneratingRubric(true);
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
          task: 'suggest_rubric',
          lang: 'es',
          data: {
            lesson_title: projectTitle,
            instructions: types.map(t => t.name).join(', '),
          },
        }),
      });
      const json = await res.json();
      if (json.result) setRubricPrompt(json.result);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setGeneratingRubric(false);
    }
  }

  async function runBatchGrade() {
    if (!selectedStudentId || !rubricPrompt.trim()) return;
    const submitted = (objectsByStudent[selectedStudentId] ?? [])
      .filter(o => o.status === 'submitted');
    if (submitted.length === 0) { alert('No hay objetos enviados para calificar.'); return; }

    setBatchLoading(true);
    setBatchResults([]);
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
          task: 'batch_grade',
          lang: 'es',
          data: {
            rubric_prompt: rubricPrompt,
            productions: submitted.map(o => ({
              id: o.id,
              content: o.content,
              word_count: o.word_count,
            })),
          },
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const results: BatchResult[] = json.result?.results ?? [];
      if (results.length === 0) throw new Error('La IA no devolvió resultados.');
      setBatchResults(results);
      // Pre-llenar scores y feedbacks
      results.forEach(r => {
        setScores(prev => ({ ...prev, [r.id]: String(r.score) }));
        setFeedbacks(prev => ({ ...prev, [r.id]: r.feedback }));
      });
    } catch (err: any) {
      alert('Error al calificar: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  }

  async function saveBatch() {
    setSavingBatch(true);
    for (const r of batchResults) {
      await sb.from('project_objects').update({
        status: 'approved',
        score: r.score,
        feedback: r.feedback,
        reviewed_at: new Date().toISOString(),
      }).eq('id', r.id);
    }
    setBatchResults([]);
    setSavingBatch(false);
    await load();
  }

  async function resolveRequest(id: string, status: 'approved' | 'denied') {
    await sb.from('project_object_edit_requests').update({
      status,
      professor_note: reqNotes[id] || null,
      resolved_at: new Date().toISOString(),
    }).eq('id', id);
    if (status === 'approved') {
      const req = editRequests.find(r => r.id === id);
      if (req) await sb.from('project_objects').update({ status: 'draft' }).eq('id', req.project_object_id);
    }
    await load();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedObjects = selectedStudentId ? (objectsByStudent[selectedStudentId] ?? []) : [];
  const orderedObjects = types.map(t => ({
    type: t,
    obj: selectedObjects.find(o => o.object_type_id === t.id) ?? null,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-semibold text-gray-800">Revisar proyecto</h3>
          {projectTitle && <p className="text-xs text-gray-500">{projectTitle}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['review', 'requests'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {t === 'review'
              ? `Revisión (${students.length} estudiantes)`
              : `Solicitudes (${editRequests.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Cargando...</div>
      ) : tab === 'requests' ? (
        /* ── Tab solicitudes ── */
        <div className="space-y-3">
          {editRequests.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-xl">No hay solicitudes pendientes.</div>
          ) : editRequests.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm text-gray-800">{r.student_name}</span>
                <span className="text-xs text-gray-400">· {r.object_name}</span>
              </div>
              <p className="text-sm text-gray-600 italic">"{r.reason}"</p>
              <input value={reqNotes[r.id] ?? ''} onChange={e => setReqNotes(n => ({ ...n, [r.id]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
                placeholder="Nota al estudiante (opcional)" />
              <div className="flex gap-2">
                <button onClick={() => resolveRequest(r.id, 'approved')}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700">
                  <Check className="w-3 h-3" /> Autorizar
                </button>
                <button onClick={() => resolveRequest(r.id, 'denied')}
                  className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">
                  Denegar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Tab revisión ── */
        <div className="flex gap-4 items-start">

          {/* Lista de estudiantes */}
          <div className="w-52 flex-shrink-0 space-y-1">
            <p className="text-xs font-medium text-gray-500 px-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Estudiantes
            </p>
            {students.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center border-2 border-dashed rounded-lg">Sin envíos aún.</p>
            ) : students.map(s => (
              <button key={s.student_id} onClick={() => { setSelectedStudentId(s.student_id); setExpandedIds(new Set()); setBatchResults([]); }}
                className={`w-full text-left px-3 py-2 rounded-xl border transition text-sm ${
                  selectedStudentId === s.student_id
                    ? 'border-blue-400 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}>
                <p className="font-medium truncate">{s.student_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.submitted} enviado{s.submitted !== 1 ? 's' : ''} · {s.total} total
                </p>
              </button>
            ))}
          </div>

          {/* Panel principal */}
          {selectedStudentId ? (
            <div className="flex-1 space-y-4">

              {/* Rúbrica + IA */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Calificación con IA
                  </span>
                  <button onClick={generateRubric} disabled={generatingRubric}
                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {generatingRubric ? 'Generando...' : 'Generar rúbrica'}
                  </button>
                </div>
                <textarea
                  value={rubricPrompt}
                  onChange={e => setRubricPrompt(e.target.value)}
                  rows={3}
                  className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  placeholder="Escribe o genera una rúbrica de evaluación..."
                />
                <div className="flex gap-2 flex-wrap">
                  <button onClick={runBatchGrade}
                    disabled={batchLoading || !rubricPrompt.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    <Sparkles className="w-4 h-4" />
                    {batchLoading ? 'Calificando...' : 'Calificar objetos enviados'}
                  </button>
                  {batchResults.length > 0 && (
                    <button onClick={saveBatch} disabled={savingBatch}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                      <Save className="w-4 h-4" />
                      {savingBatch ? 'Guardando...' : `Guardar calificaciones IA (${batchResults.length})`}
                    </button>
                  )}
                </div>
                {batchResults.length > 0 && (
                  <p className="text-xs text-indigo-600">
                    IA calificó {batchResults.length} objeto(s). Revisa y ajusta abajo antes de guardar.
                  </p>
                )}
              </div>

              {/* Acordeón de objetos */}
              <div className="space-y-2">
                {orderedObjects.map(({ type: t, obj }, i) => {
                  const isExpanded = expandedIds.has(t.id);
                  const canReview = obj && obj.status === 'submitted';

                  return (
                    <div key={t.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Cabecera */}
                      <button onClick={() => toggleExpand(t.id)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                          isExpanded ? 'bg-gray-50 border-b border-gray-100' : 'hover:bg-gray-50'
                        }`}>
                        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                          obj?.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          obj?.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                          obj?.status === 'needs_revision' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-800">{t.name}</span>
                            {obj ? (
                              <>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[obj.status]}`}>
                                  {STATUS_LABELS[obj.status]}
                                </span>
                                {obj.score !== null && (
                                  <span className="text-xs text-emerald-600 font-semibold">{obj.score}/10</span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">Sin iniciar</span>
                            )}
                          </div>
                          {obj && (
                            <p className="text-xs text-gray-400 mt-0.5">{obj.word_count} palabras · v{obj.version}</p>
                          )}
                        </div>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                      </button>

                      {/* Contenido expandido */}
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {!obj ? (
                            <p className="text-sm text-gray-400 italic">El estudiante aún no ha iniciado este objeto.</p>
                          ) : (
                            <>
                              {/* Texto del estudiante */}
                              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {obj.content || <span className="text-gray-400 italic">Sin contenido</span>}
                              </div>

                              {/* Formulario de revisión (solo si está enviado) */}
                              {canReview && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Puntuación (0–10)</label>
                                    <input type="number" min={0} max={10} step={0.1}
                                      value={scores[obj.id] ?? ''}
                                      onChange={e => setScores(prev => ({ ...prev, [obj.id]: e.target.value }))}
                                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Retroalimentación</label>
                                    <textarea rows={3}
                                      value={feedbacks[obj.id] ?? ''}
                                      onChange={e => setFeedbacks(prev => ({ ...prev, [obj.id]: e.target.value }))}
                                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder="Comentarios para el estudiante..." />
                                  </div>
                                </div>
                              )}

                              {/* Feedback previo si ya fue revisado */}
                              {!canReview && obj.feedback && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-xs font-semibold text-amber-700 mb-1">Retroalimentación enviada</p>
                                  <p className="text-sm text-amber-800">{obj.feedback}</p>
                                </div>
                              )}

                              {/* Botones */}
                              {canReview && (
                                <div className="flex gap-2">
                                  <button onClick={() => submitReview(obj.id, 'approved')}
                                    disabled={saving === obj.id}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                                    <Check className="w-3.5 h-3.5" /> Aprobar
                                  </button>
                                  <button onClick={() => submitReview(obj.id, 'needs_revision')}
                                    disabled={saving === obj.id}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 disabled:opacity-50">
                                    <RotateCcw className="w-3.5 h-3.5" /> Solicitar revisión
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-16 text-gray-400 text-sm border-2 border-dashed rounded-xl">
              Selecciona un estudiante para revisar su proyecto.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
