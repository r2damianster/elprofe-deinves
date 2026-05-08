import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { ArrowLeft, Check, RotateCcw, Users, Sparkles, Clock } from 'lucide-react';

type ObjectType = {
  id: string; name: string; order_index: number; description: string | null;
  min_words: number | null; max_words: number | null; required_words: string[] | null;
};
type ProjectObject = {
  id: string; object_type_id: string; content: string;
  word_count: number; version: number;
};
type Submission = {
  id: string; student_id: string; student_name: string;
  status: 'submitted' | 'reviewed';
  score: number | null; feedback: string | null; submitted_at: string | null;
};
type EditRequest = { id: string; project_object_id: string; reason: string; student_name: string; object_name: string };

export default function ProjectReviewer({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [projectTitle, setProjectTitle] = useState('');
  const [types, setTypes] = useState<ObjectType[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [objectsByStudent, setObjectsByStudent] = useState<Record<string, ProjectObject[]>>({});
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [reqNotes, setReqNotes] = useState<Record<string, string>>({});

  // IA
  const [rubricPrompt, setRubricPrompt] = useState('');
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [gradingAI, setGradingAI] = useState(false);
  const [aiResult, setAiResult] = useState<{ score: number; feedback: string } | null>(null);

  const [tab, setTab] = useState<'review' | 'requests'>('review');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);

    const [projRes, typesRes] = await Promise.all([
      sb.from('projects').select('title').eq('id', projectId).single(),
      sb.from('project_object_types').select('id,name,order_index,description,min_words,max_words,required_words').eq('project_id', projectId).order('order_index'),
    ]);
    if (projRes.data) setProjectTitle(projRes.data.title);
    const typeList: ObjectType[] = typesRes.data ?? [];
    setTypes(typeList);
    const typeIds = typeList.map((t: ObjectType) => t.id);
    const typeMap: Record<string, string> = {};
    typeList.forEach((t: ObjectType) => { typeMap[t.id] = t.name; });

    const [subsRes, objsRes, reqsRes] = await Promise.all([
      sb.from('project_submissions')
        .select('*, profiles!student_id(full_name)')
        .eq('project_id', projectId)
        .in('status', ['submitted', 'reviewed'])
        .order('submitted_at'),
      typeIds.length > 0
        ? sb.from('project_objects').select('id,object_type_id,student_id,content,word_count,version').in('object_type_id', typeIds)
        : Promise.resolve({ data: [] }),
      typeIds.length > 0
        ? sb.from('project_object_edit_requests')
            .select('*, project_objects(object_type_id, profiles!student_id(full_name))')
            .eq('status', 'pending')
        : Promise.resolve({ data: [] }),
    ]);

    const subList: Submission[] = ((subsRes.data ?? []) as any[]).map(s => ({
      id: s.id, student_id: s.student_id,
      student_name: s.profiles?.full_name ?? 'Estudiante',
      status: s.status, score: s.score, feedback: s.feedback,
      submitted_at: s.submitted_at,
    }));
    setSubmissions(subList);

    const byStudent: Record<string, ProjectObject[]> = {};
    ((objsRes.data ?? []) as any[]).forEach(o => {
      if (!byStudent[o.student_id]) byStudent[o.student_id] = [];
      byStudent[o.student_id].push(o as ProjectObject);
    });
    setObjectsByStudent(byStudent);

    setEditRequests(((reqsRes.data ?? []) as any[]).map(r => ({
      id: r.id, project_object_id: r.project_object_id, reason: r.reason,
      student_name: r.project_objects?.profiles?.full_name ?? 'Estudiante',
      object_name: typeMap[r.project_objects?.object_type_id ?? ''] ?? '—',
    })));

    setLoading(false);
  }

  function selectSubmission(sub: Submission) {
    setSelectedId(sub.id);
    setScore(sub.score?.toString() ?? '');
    setFeedback(sub.feedback ?? '');
    setAiResult(null);
  }

  async function submitReview(newStatus: 'reviewed' | 'draft') {
    if (!selectedId) return;
    if (newStatus === 'reviewed') {
      const n = parseFloat(score);
      if (isNaN(n) || n < 0 || n > 10) { alert('Puntuación entre 0 y 10.'); return; }
    }
    setSaving(true);
    await sb.from('project_submissions').update({
      status: newStatus,
      score: newStatus === 'reviewed' ? parseFloat(score) : null,
      feedback: newStatus === 'reviewed' ? (feedback.trim() || null) : null,
      reviewed_at: newStatus === 'reviewed' ? new Date().toISOString() : null,
    }).eq('id', selectedId);
    setSelectedId(null);
    await load();
    setSaving(false);
  }

  // ── IA ─────────────────────────────────────────────────────────────────────

  async function generateRubric() {
    setGeneratingRubric(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ task: 'suggest_rubric', lang: 'es', data: { lesson_title: projectTitle, instructions: types.map(t => t.name).join(', ') } }),
      });
      const json = await res.json();
      if (json.result) setRubricPrompt(json.result);
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setGeneratingRubric(false); }
  }

  async function gradeWithAI() {
    if (!selectedId || !rubricPrompt.trim()) return;
    const sub = submissions.find(s => s.id === selectedId);
    if (!sub) return;
    const objs = objectsByStudent[sub.student_id] ?? [];
    if (objs.length === 0) { alert('No hay contenido para evaluar.'); return; }

    // Construir documento completo
    const fullContent = types
      .map(t => {
        const obj = objs.find(o => o.object_type_id === t.id);
        return `## ${t.name}\n\n${obj?.content?.trim() || '(sin contenido)'}`;
      })
      .join('\n\n---\n\n');

    setGradingAI(true);
    setAiResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          task: 'review_production',
          lang: 'es',
          data: { content: fullContent, rubric_prompt: rubricPrompt, word_count: objs.reduce((s, o) => s + o.word_count, 0) },
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const r = json.result;
      setAiResult({ score: r.score ?? r.nota ?? 0, feedback: r.feedback ?? r.retroalimentacion ?? '' });
      setScore(String(r.score ?? r.nota ?? ''));
      setFeedback(r.feedback ?? r.retroalimentacion ?? '');
    } catch (err: any) { alert('Error IA: ' + err.message); }
    finally { setGradingAI(false); }
  }

  async function resolveRequest(id: string, status: 'approved' | 'denied') {
    await sb.from('project_object_edit_requests').update({
      status, professor_note: reqNotes[id] || null, resolved_at: new Date().toISOString(),
    }).eq('id', id);
    if (status === 'approved') {
      const req = editRequests.find(r => r.id === id);
      if (req) await sb.from('project_objects').update({ status: 'draft' }).eq('id', req.project_object_id);
    }
    await load();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedSub = submissions.find(s => s.id === selectedId) ?? null;
  const selectedObjs = selectedSub ? (objectsByStudent[selectedSub.student_id] ?? []) : [];
  const orderedObjs = types.map(t => ({ type: t, obj: selectedObjs.find(o => o.object_type_id === t.id) ?? null }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></button>
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
            {t === 'review' ? `Proyectos enviados (${submissions.length})` : `Solicitudes (${editRequests.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Cargando...</div>
      ) : tab === 'requests' ? (
        <div className="space-y-3">
          {editRequests.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-xl">Sin solicitudes pendientes.</div>
          ) : editRequests.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm">{r.student_name}</span>
                <span className="text-xs text-gray-400">· {r.object_name}</span>
              </div>
              <p className="text-sm text-gray-600 italic">"{r.reason}"</p>
              <input value={reqNotes[r.id] ?? ''} onChange={e => setReqNotes(n => ({ ...n, [r.id]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
                placeholder="Nota al estudiante (opcional)" />
              <div className="flex gap-2">
                <button onClick={() => resolveRequest(r.id, 'approved')} className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700">
                  <Check className="w-3 h-3" /> Autorizar
                </button>
                <button onClick={() => resolveRequest(r.id, 'denied')} className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">
                  Denegar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          {/* Lista de estudiantes */}
          <div className="w-52 flex-shrink-0 space-y-1">
            <p className="text-xs font-medium text-gray-500 px-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Enviados
            </p>
            {submissions.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center border-2 border-dashed rounded-lg">Sin envíos aún.</p>
            ) : submissions.map(s => (
              <button key={s.id} onClick={() => selectSubmission(s)}
                className={`w-full text-left px-3 py-2 rounded-xl border transition text-sm ${
                  selectedId === s.id ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}>
                <p className="font-medium truncate">{s.student_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.status === 'reviewed' ? `Evaluado · ${s.score ?? '—'}/10` : 'Pendiente'}
                </p>
              </button>
            ))}
          </div>

          {/* Panel de revisión */}
          {selectedSub ? (
            <div className="flex-1 space-y-4">
              {/* Rúbrica + IA */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Evaluación con IA
                  </span>
                  <button onClick={generateRubric} disabled={generatingRubric}
                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {generatingRubric ? 'Generando...' : 'Generar rúbrica'}
                  </button>
                </div>
                <textarea value={rubricPrompt} onChange={e => setRubricPrompt(e.target.value)} rows={3}
                  className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  placeholder="Rúbrica de evaluación del proyecto completo..." />
                <button onClick={gradeWithAI} disabled={gradingAI || !rubricPrompt.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  <Sparkles className="w-4 h-4" /> {gradingAI ? 'Evaluando...' : 'Evaluar proyecto con IA'}
                </button>
                {aiResult && (
                  <div className="bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
                    IA sugirió {aiResult.score}/10. Revisa y ajusta abajo antes de guardar.
                  </div>
                )}
              </div>

              {/* Formulario de evaluación */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-gray-700 text-sm">Evaluación global</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Puntuación (0–10)</label>
                    <input type="number" min={0} max={10} step={0.1} value={score}
                      onChange={e => setScore(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Retroalimentación para el estudiante</label>
                    <textarea rows={4} value={feedback} onChange={e => setFeedback(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Comentarios generales sobre el proyecto..." />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => submitReview('reviewed')} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    <Check className="w-4 h-4" /> Aprobar y enviar evaluación
                  </button>
                  <button onClick={() => submitReview('draft')} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50">
                    <RotateCcw className="w-4 h-4" /> Devolver para revisión
                  </button>
                </div>
              </div>

              {/* Documento completo continuo */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Proyecto completo</span>
                  <span className="text-xs text-gray-400">
                    {orderedObjs.reduce((s, { obj }) => s + (obj?.word_count ?? 0), 0)} palabras totales
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {orderedObjs.map(({ type: t, obj }, i) => {
                    const hasContent = !!obj?.content?.trim();
                    const wc = obj?.word_count ?? 0;
                    const minOk = !t.min_words || wc >= t.min_words;
                    const missing = (t.required_words ?? []).filter(
                      w => !obj?.content?.toLowerCase().includes(w.toLowerCase())
                    );
                    return (
                      <div key={t.id} className="px-6 py-5">
                        {/* Título de sección */}
                        <div className="flex items-baseline gap-3 mb-2">
                          <span className="text-xs font-bold text-indigo-500 w-5 flex-shrink-0">{i + 1}.</span>
                          <h3 className="font-bold text-gray-800 text-base">{t.name}</h3>
                        </div>

                        {/* Requisitos configurados */}
                        <div className="flex items-center gap-3 flex-wrap ml-8 mb-3">
                          {t.min_words != null && t.min_words > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${minOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {wc}/{t.min_words} palabras mín.
                            </span>
                          )}
                          {t.max_words != null && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              máx. {t.max_words}
                            </span>
                          )}
                          {(t.required_words ?? []).map(w => (
                            <span key={w} className={`text-xs px-1.5 py-0.5 rounded ${!obj?.content?.toLowerCase().includes(w.toLowerCase()) ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                              {w}
                            </span>
                          ))}
                          {missing.length > 0 && (
                            <span className="text-xs text-red-500">Faltan {missing.length} palabra(s) requerida(s)</span>
                          )}
                        </div>

                        {/* Contenido */}
                        <div className="ml-8">
                          {hasContent ? (
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{obj!.content}</p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Sin contenido.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
