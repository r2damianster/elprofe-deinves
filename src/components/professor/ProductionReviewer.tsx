import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { resolveField } from '../../lib/i18n';
import {
  ShieldAlert, BarChart, Clock, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Loader2, Send,
  Sparkles, CheckSquare, Square, X, Save
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface IntegrityEvent {
  type: string;
  at: string;
  penalty: number;
  detail?: string;
}

interface ProductionRow {
  id: string;
  status: string;
  content: string;
  word_count: number;
  score: number | null;
  feedback: string | null;
  compliance_score: number;
  integrity_score: number;
  integrity_events: IntegrityEvent[];
  time_on_task: number;
  attempts: number;
  submitted_at: string | null;
  student: { full_name: string; email: string };
  lesson: { title: string };
}

interface BatchResult {
  id: string;
  score: number;
  feedback: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function integrityColor(score: number) {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 50) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

function complianceColor(score: number) {
  if (score === 100) return 'text-green-600 bg-green-50';
  if (score >= 70) return 'text-blue-600 bg-blue-50';
  return 'text-orange-600 bg-orange-50';
}

function statusBadge(status: string) {
  switch (status) {
    case 'reviewed':  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Revisado</span>;
    case 'submitted': return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Enviado</span>;
    default:          return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Borrador</span>;
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ProductionReviewer() {
  const { profile } = useAuth();
  const [productions, setProductions] = useState<ProductionRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [scores, setScores]           = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState<string | null>(null);
  const [filter, setFilter]           = useState<'all' | 'submitted' | 'reviewed'>('submitted');

  const [courses, setCourses]                 = useState<{ id: string; name: string }[]>([]);
  const [courseLessons, setCourseLessons]     = useState<{ id: string; title: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');

  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [rubricPrompt, setRubricPrompt]       = useState('');
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [batchResults, setBatchResults]       = useState<BatchResult[]>([]);
  const [batchLoading, setBatchLoading]       = useState(false);
  const [saving, setSaving]                   = useState(false);

  useEffect(() => { loadCourses(); }, [profile?.id]);

  useEffect(() => {
    if (selectedCourseId) loadCourseLessons(selectedCourseId);
    else setCourseLessons([]);
    setSelectedLessonId('');
  }, [selectedCourseId]);

  useEffect(() => { loadProductions(); }, [profile?.id, selectedLessonId, selectedCourseId]);

  async function loadCourses() {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name')
        .eq('professor_id', profile.id)
        .order('name');
      if (error) throw error;
      setCourses(data || []);
    } catch (err: any) {
      console.error(err.message);
    }
  }

  async function loadCourseLessons(courseId: string) {
    try {
      const { data, error } = await supabase
        .from('lesson_courses')
        .select('lesson:lessons!lesson_id (id, title)')
        .eq('course_id', courseId);
      if (error) throw error;
      const lessons = (data || [])
        .map((row: any) => row.lesson)
        .filter(Boolean) as { id: string; title: string }[];
      setCourseLessons(lessons);
    } catch (err: any) {
      console.error(err.message);
    }
  }

  const loadProductions = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('productions')
        .select(`
          id, status, content, word_count, score, feedback,
          compliance_score, integrity_score, integrity_events,
          time_on_task, attempts, submitted_at,
          student:profiles!student_id (full_name, email),
          lesson:lessons!lesson_id (title),
          group_lock:group_production_locks!production_id (
            group:groups!group_id (name)
          )
        `)
        .order('submitted_at', { ascending: false });

      if (selectedLessonId) {
        query = query.eq('lesson_id', selectedLessonId);
      } else if (selectedCourseId) {
        const { data: lcData } = await supabase
          .from('lesson_courses')
          .select('lesson_id')
          .eq('course_id', selectedCourseId);
        const lessonIds = (lcData || []).map((r: any) => r.lesson_id);
        if (lessonIds.length > 0) {
          query = query.in('lesson_id', lessonIds);
        } else {
          setProductions([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setProductions((data as any) || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, selectedCourseId, selectedLessonId]);

  async function submitReview(productionId: string) {
    const score    = parseInt(scores[productionId] || '0');
    const feedback = feedbacks[productionId] || '';
    if (isNaN(score) || score < 0 || score > 10) { alert('La nota debe estar entre 0 y 10'); return; }

    setSubmitting(productionId);
    try {
      await supabase.from('productions')
        .update({ status: 'reviewed', score, feedback, reviewed_at: new Date().toISOString() })
        .eq('id', productionId);

      setProductions(prev => prev.map(p =>
        p.id === productionId ? { ...p, status: 'reviewed', score, feedback } : p
      ));
      setExpanded(null);
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(null); }
  }

  async function enableRetry(productionId: string) {
    if (!confirm('¿Habilitar un intento extra para este estudiante?')) return;
    try {
      await supabase.from('productions')
        .update({ status: 'draft', score: null, feedback: null, submitted_at: null, integrity_score: 100, integrity_events: [], time_on_task: 0 })
        .eq('id', productionId);
      loadProductions();
    } catch (err: any) { alert(err.message); }
  }

  const filtered = productions.filter(p => filter === 'all' || p.status === filter);

  const submittedFiltered = filtered.filter(p => p.status === 'submitted');
  const allSubmittedSelected =
    submittedFiltered.length > 0 &&
    submittedFiltered.every(p => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allSubmittedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(submittedFiltered.map(p => p.id)));
    }
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedProductions = productions.filter(p => selectedIds.has(p.id));

  const selectedLessonTitle = selectedLessonId
    ? courseLessons.find(l => l.id === selectedLessonId)?.title
    : selectedProductions[0]
      ? resolveField(selectedProductions[0].lesson?.title, 'es')
      : 'Producción escrita';

  async function generateRubric() {
    if (selectedProductions.length === 0) return;
    setGeneratingRubric(true);
    try {
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const { data: { session } } = await supabase.auth.getSession();

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
            productions: selectedProductions.map(p => ({ content: p.content })),
            lesson_context: selectedLessonTitle || 'Producción escrita'
          }
        })
      });
      const json = await res.json();
      setRubricPrompt(json.result?.rubric_prompt ?? '');
    } catch (err: any) {
      alert('Error al generar rúbrica: ' + err.message);
    } finally {
      setGeneratingRubric(false);
    }
  }

  async function runBatchGrade() {
    if (!rubricPrompt.trim() || selectedProductions.length === 0) return;
    setBatchLoading(true);
    try {
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const { data: { session } } = await supabase.auth.getSession();

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
            productions: selectedProductions.map(p => ({
              id: p.id,
              content: p.content,
              word_count: p.word_count,
              compliance_score: p.compliance_score
            }))
          }
        })
      });
      const json = await res.json();
      setBatchResults(json.result?.results ?? []);
    } catch (err: any) {
      alert('Error al calificar: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  }

  async function saveBatch() {
    setSaving(true);
    try {
      for (const result of batchResults) {
        await supabase.from('productions')
          .update({
            status: 'reviewed',
            score: result.score,
            feedback: result.feedback,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', result.id);
      }
      setBatchResults([]);
      setSelectedIds(new Set());
      setRubricPrompt('');
      await loadProductions();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateBatchResult(id: string, field: 'score' | 'feedback', value: string) {
    setBatchResults(prev => prev.map(r =>
      r.id === id
        ? { ...r, [field]: field === 'score' ? parseFloat(value) || 0 : value }
        : r
    ));
  }

  const showCheckboxes = filter === 'submitted' || filter === 'all';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Filtros de curso y lección */}
      <div className="flex gap-3 flex-wrap items-center bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Curso</label>
          <select
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[180px]"
          >
            <option value="">Todos los cursos</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {selectedCourseId && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Lección</label>
            <select
              value={selectedLessonId}
              onChange={e => setSelectedLessonId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[200px]"
            >
              <option value="">Todas las lecciones</option>
              {courseLessons.map(l => (
                <option key={l.id} value={l.id}>{resolveField(l.title, 'es')}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2 flex-wrap items-center">
        {(['submitted', 'reviewed', 'all'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setSelectedIds(new Set()); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {f === 'submitted' ? 'Pendientes de revisión' : f === 'reviewed' ? 'Revisadas' : 'Todas'}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500 self-center">{filtered.length} producciones</span>
      </div>

      {/* Panel IA batch */}
      {selectedIds.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-purple-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Calificación con IA
              <span className="text-sm font-normal bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                {selectedIds.size} seleccionadas
              </span>
            </h3>
            <button onClick={() => setSelectedIds(new Set())}
              className="text-gray-400 hover:text-gray-600 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {batchResults.length === 0 && (
            <>
              <button
                onClick={generateRubric}
                disabled={generatingRubric}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50"
              >
                {generatingRubric
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando rúbrica...</>
                  : <><Sparkles className="w-4 h-4" /> Generar rúbrica con IA</>
                }
              </button>

              <div className="space-y-1">
                <label className="text-xs font-medium text-purple-700">Criterio de evaluación</label>
                <textarea
                  rows={4}
                  value={rubricPrompt}
                  onChange={e => setRubricPrompt(e.target.value)}
                  placeholder="Escribe o genera con IA los criterios de evaluación para estas producciones..."
                  className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none bg-white"
                />
              </div>

              <button
                onClick={runBatchGrade}
                disabled={!rubricPrompt.trim() || batchLoading}
                className="flex items-center gap-2 px-5 py-2 bg-purple-700 text-white rounded-lg text-sm font-bold hover:bg-purple-800 transition disabled:opacity-40"
              >
                {batchLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Calificando...</>
                  : <><Sparkles className="w-4 h-4" /> Calificar con IA</>
                }
              </button>
            </>
          )}

          {batchResults.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-purple-700">Resultados propuestos — edita antes de confirmar</p>
              <div className="overflow-x-auto rounded-lg border border-purple-200">
                <table className="w-full text-sm">
                  <thead className="bg-purple-100 text-purple-700">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Estudiante</th>
                      <th className="text-left px-3 py-2 font-semibold">Lección</th>
                      <th className="text-left px-3 py-2 font-semibold w-24">Nota (0-10)</th>
                      <th className="text-left px-3 py-2 font-semibold">Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-purple-100">
                    {batchResults.map(result => {
                      const prod = productions.find(p => p.id === result.id);
                      return (
                        <tr key={result.id}>
                          <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                            {prod?.student?.full_name ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[160px] truncate">
                            {prod ? resolveField(prod.lesson?.title, 'es') : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" max="10" step="0.1"
                              value={result.score}
                              onChange={e => updateBatchResult(result.id, 'score', e.target.value)}
                              className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <textarea
                              rows={2}
                              value={result.feedback}
                              onChange={e => updateBatchResult(result.id, 'feedback', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={saveBatch}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : <><Save className="w-4 h-4" /> Confirmar y guardar todo</>
                  }
                </button>
                <button
                  onClick={() => setBatchResults([])}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition"
                >
                  Volver a editar rúbrica
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cabecera "Seleccionar todos" */}
      {showCheckboxes && submittedFiltered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition">
            {allSubmittedSelected
              ? <CheckSquare className="w-4 h-4 text-blue-600" />
              : <Square className="w-4 h-4" />
            }
            Seleccionar todas las pendientes ({submittedFiltered.length})
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mr-3" /> Cargando producciones...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay producciones en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">

              {/* Fila resumen */}
              <button className="w-full text-left p-4 hover:bg-gray-50 transition"
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                <div className="flex flex-wrap items-center gap-3">

                  {/* Checkbox */}
                  {showCheckboxes && p.status === 'submitted' && (
                    <span onClick={e => toggleSelect(p.id, e)} className="shrink-0 cursor-pointer">
                      {selectedIds.has(p.id)
                        ? <CheckSquare className="w-5 h-5 text-blue-600" />
                        : <Square className="w-5 h-5 text-gray-400 hover:text-blue-500 transition" />
                      }
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800 truncate">{p.student?.full_name}</p>
                      {(p as any).group_lock?.group?.name && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                          {(p as any).group_lock.group.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{resolveField(p.lesson?.title, 'es')}</p>
                  </div>

                  {/* Métricas rápidas */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${complianceColor(p.compliance_score)}`}>
                      <BarChart className="w-3 h-3" /> {p.compliance_score}%
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${integrityColor(p.integrity_score)}`}>
                      <ShieldAlert className="w-3 h-3" /> {p.integrity_score}%
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded-lg">
                      <Clock className="w-3 h-3" /> {formatTime(p.time_on_task)}
                    </span>
                    <span className="text-xs text-gray-500">{p.word_count} pal.</span>
                    {statusBadge(p.status)}
                    {p.score !== null && (
                      <span className="font-bold text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">{p.score}/10</span>
                    )}
                  </div>
                  {expanded === p.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
              </button>

              {/* Detalle expandido */}
              {expanded === p.id && (
                <div className="border-t border-gray-100 p-5 space-y-5">

                  {/* Log de integridad */}
                  {p.integrity_events?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                        Registro forense ({p.integrity_events.length} eventos)
                      </h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                        {p.integrity_events.map((ev, i) => (
                          <div key={i} className="flex items-center justify-between text-xs gap-2">
                            <span className="font-medium text-red-700 capitalize">{ev.type.replace(/_/g, ' ')}</span>
                            {ev.detail && <span className="text-gray-500 flex-1 truncate">{ev.detail}</span>}
                            <span className="text-red-600 font-bold shrink-0">-{ev.penalty}</span>
                            <span className="text-gray-400 shrink-0">{new Date(ev.at).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contenido del ensayo */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Contenido del ensayo</h4>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap border">
                      {p.content || <span className="text-gray-400 italic">Sin contenido</span>}
                    </div>
                  </div>

                  {/* Formulario de calificación */}
                  {p.status !== 'reviewed' ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-500" /> Calificar producción
                      </h4>
                      <div className="flex gap-3 items-start">
                        <div className="w-28">
                          <label className="text-xs text-gray-500 mb-1 block">Nota (0-10)</label>
                          <input type="number" min="0" max="10" step="0.1"
                            value={scores[p.id] || ''}
                            onChange={e => setScores({ ...scores, [p.id]: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="0-10" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">Comentarios para el estudiante</label>
                          <textarea rows={3}
                            value={feedbacks[p.id] || ''}
                            onChange={e => setFeedbacks({ ...feedbacks, [p.id]: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            placeholder="Escribe tu retroalimentación aquí..." />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => submitReview(p.id)} disabled={submitting === p.id}
                          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50">
                          <Send className="w-3.5 h-3.5" />
                          {submitting === p.id ? 'Enviando...' : 'Enviar calificación'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-green-800">Calificación enviada: {p.score}/10</p>
                        {p.feedback && <p className="text-xs text-green-700 mt-1">{p.feedback}</p>}
                      </div>
                      {p.attempts < 2 && (
                        <button onClick={() => enableRetry(p.id)}
                          className="text-xs px-3 py-1.5 border border-orange-400 text-orange-600 rounded-lg hover:bg-orange-50 transition font-medium">
                          Habilitar reintento
                        </button>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
