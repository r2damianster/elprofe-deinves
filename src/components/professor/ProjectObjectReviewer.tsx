import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { callAiEnhance } from '../../lib/aiEnhance';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, CheckCircle, RotateCcw, Loader2, Sparkles, Save
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type ObjectType = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  min_words: number | null;
  max_words: number | null;
  required_words: string[] | null;
};

type ProjectObject = {
  id: string;
  object_type_id: string;
  content: string | null;
  word_count: number | null;
  score: number | null;
  feedback: string | null;
  status: string;
  submitted_at: string | null;
};

type Student = {
  id: string;
  full_name: string;
  object_count: number;
  reviewed_count: number;
};

export default function ProjectObjectReviewer() {
  const { profile } = useAuth();

  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [types, setTypes] = useState<ObjectType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentObjects, setStudentObjects] = useState<ProjectObject[]>([]);

  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Feedback por sección: object_type_id → {feedback, score}
  const [sectionFeedbacks, setSectionFeedbacks] = useState<Record<string, { feedback: string; score: string }>>({});
  const [saving, setSaving] = useState(false);

  // IA
  const [rubricPrompt, setRubricPrompt] = useState('');
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [gradingAI, setGradingAI] = useState(false);
  const [aiResult, setAiResult] = useState<{ score: string; feedback: string } | null>(null);

  // Cargar proyectos del profesor
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('projects')
      .select('id, title')
      .eq('professor_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setProjects((data ?? []) as { id: string; title: string }[]));
  }, [profile?.id]);

  // Al seleccionar proyecto: cargar tipos + lista de estudiantes
  useEffect(() => {
    if (!selectedProjectId) {
      setTypes([]);
      setStudents([]);
      setSelectedStudentId(null);
      setStudentObjects([]);
      return;
    }
    loadProjectData();
  }, [selectedProjectId]);

  async function loadProjectData() {
    setLoadingProject(true);
    setSelectedStudentId(null);
    setStudentObjects([]);

    const [typesRes, objsRes] = await Promise.all([
      supabase
        .from('project_object_types')
        .select('id, name, description, order_index, min_words, max_words, required_words')
        .eq('project_id', selectedProjectId)
        .order('order_index'),
      sb
        .from('project_objects')
        .select('id, object_type_id, student_id, status, score, student:profiles!student_id(full_name)')
        .eq('project_id', selectedProjectId)
        .in('status', ['submitted', 'approved', 'needs_revision']),
    ]);

    setTypes((typesRes.data ?? []) as ObjectType[]);

    // Agrupar objetos por estudiante
    const byStudent: Record<string, { name: string; total: number; reviewed: number }> = {};
    ((objsRes.data ?? []) as any[]).forEach((o: any) => {
      if (!byStudent[o.student_id]) {
        byStudent[o.student_id] = {
          name: o.student?.full_name ?? 'Estudiante',
          total: 0,
          reviewed: 0,
        };
      }
      byStudent[o.student_id].total++;
      if (o.status === 'approved') byStudent[o.student_id].reviewed++;
    });

    setStudents(
      Object.entries(byStudent).map(([id, s]) => ({
        id,
        full_name: s.name,
        object_count: s.total,
        reviewed_count: s.reviewed,
      }))
    );

    setLoadingProject(false);
  }

  // Al seleccionar estudiante: cargar sus objetos
  useEffect(() => {
    if (!selectedStudentId || !selectedProjectId) return;
    loadStudentObjects();
  }, [selectedStudentId, selectedProjectId]);

  async function loadStudentObjects() {
    setLoadingStudent(true);
    const { data } = await sb
      .from('project_objects')
      .select('id, object_type_id, content, word_count, score, feedback, status, submitted_at')
      .eq('project_id', selectedProjectId)
      .eq('student_id', selectedStudentId);

    const objs: ProjectObject[] = data ?? [];
    setStudentObjects(objs);

    // Pre-llenar feedbacks con valores guardados
    const initial: Record<string, { feedback: string; score: string }> = {};
    objs.forEach(o => {
      initial[o.object_type_id] = {
        feedback: o.feedback ?? '',
        score: o.score?.toString() ?? '',
      };
    });
    setSectionFeedbacks(initial);
    setAiResult(null);
    setLoadingStudent(false);
  }

  async function saveAll(newStatus: 'approved' | 'needs_revision') {
    if (!selectedStudentId) return;
    setSaving(true);

    const updates = studentObjects.map(obj => {
      const sf = sectionFeedbacks[obj.object_type_id];
      const scoreNum = parseFloat(sf?.score ?? '');
      return sb.from('project_objects').update({
        status: newStatus,
        feedback: sf?.feedback?.trim() || null,
        score: newStatus === 'approved' && !isNaN(scoreNum) ? scoreNum : null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', obj.id);
    });

    await Promise.all(updates);
    await loadStudentObjects();
    await loadProjectData();
    setSaving(false);
  }

  async function generateRubric() {
    if (!selectedProjectId) return;
    setGeneratingRubric(true);
    try {
      const project = projects.find(p => p.id === selectedProjectId);
      const result = await callAiEnhance<string>('suggest_rubric', 'es', {
        lesson_title: project?.title ?? '',
        instructions: types.map(t => t.name).join(', '),
      });
      if (result) setRubricPrompt(result);
    } catch (err: any) { alert('Error IA: ' + err.message); }
    finally { setGeneratingRubric(false); }
  }

  async function gradeWithAI() {
    if (!rubricPrompt.trim()) { alert('Ingresa o genera una rúbrica primero.'); return; }
    if (!selectedStudentId || studentObjects.length === 0) return;

    // Construir documento completo en orden
    const fullContent = types
      .map(t => {
        const obj = studentObjects.find(o => o.object_type_id === t.id);
        return `## ${t.name}\n\n${obj?.content?.trim() || '(sin contenido)'}`;
      })
      .join('\n\n---\n\n');

    const totalWords = studentObjects.reduce((s, o) => s + (o.word_count ?? 0), 0);

    setGradingAI(true);
    setAiResult(null);
    try {
      const r = await callAiEnhance<any>('review_production', 'es', {
        content: fullContent,
        rubric_prompt: rubricPrompt,
        word_count: totalWords,
      });
      const score = String(r.score ?? r.nota ?? '');
      const feedback = r.feedback ?? r.retroalimentacion ?? '';
      setAiResult({ score, feedback });

      // Pre-llenar el feedback de IA en la primera sección sin feedback
      setSectionFeedbacks(prev => {
        const updated = { ...prev };
        let applied = false;
        types.forEach(t => {
          if (!applied && !updated[t.id]?.feedback?.trim()) {
            updated[t.id] = { feedback, score };
            applied = true;
          }
        });
        // Si todas tienen, poner en la primera
        if (!applied && types.length > 0) {
          updated[types[0].id] = { ...updated[types[0].id], score, feedback };
        }
        return updated;
      });
    } catch (err: any) { alert('Error IA: ' + err.message); }
    finally { setGradingAI(false); }
  }

  const objByType = Object.fromEntries(studentObjects.map(o => [o.object_type_id, o]));
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const project = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="space-y-4">
      {/* Selector de proyecto */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Selecciona un proyecto</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        {selectedProjectId && !loadingProject && (
          <span className="text-xs text-gray-400">
            {students.length} estudiante{students.length !== 1 ? 's' : ''} con entregas
          </span>
        )}
      </div>

      {!selectedProjectId ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl text-sm">
          Selecciona un proyecto para revisar las entregas.
        </div>
      ) : loadingProject ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl text-sm">
          No hay entregas enviadas para este proyecto.
        </div>
      ) : (
        <div className="flex gap-4 items-start">

          {/* Sidebar de estudiantes */}
          <div className="w-52 flex-shrink-0 space-y-1">
            <p className="text-xs font-medium text-gray-500 px-1 flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5" /> Estudiantes
            </p>
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStudentId(s.id)}
                className={`w-full text-left px-3 py-2 rounded-xl border transition text-sm ${
                  selectedStudentId === s.id
                    ? 'border-teal-400 bg-teal-50 text-teal-800'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <p className="font-medium truncate">{s.full_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.reviewed_count}/{s.object_count} secciones revisadas
                </p>
              </button>
            ))}
          </div>

          {/* Panel principal */}
          {selectedStudentId ? (
            <div className="flex-1 space-y-4 min-w-0">

              {/* Panel IA */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Evaluación con IA
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={generateRubric}
                      disabled={generatingRubric}
                      className="text-xs px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {generatingRubric ? 'Generando...' : 'Generar rúbrica'}
                    </button>
                    <button
                      onClick={gradeWithAI}
                      disabled={gradingAI || !rubricPrompt.trim() || studentObjects.length === 0}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {gradingAI ? 'Evaluando...' : 'Evaluar con IA'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={rubricPrompt}
                  onChange={e => setRubricPrompt(e.target.value)}
                  rows={3}
                  placeholder="Rúbrica de evaluación del proyecto..."
                  className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
                {aiResult && (
                  <div className="bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
                    IA sugirió {aiResult.score}/10. Retroalimentación aplicada a la primera sección — ajusta por sección abajo.
                  </div>
                )}
              </div>

              {/* Documento completo */}
              {loadingStudent ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {project?.title}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">— {selectedStudent?.full_name}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {studentObjects.reduce((s, o) => s + (o.word_count ?? 0), 0)} palabras totales
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {types.map((t, i) => {
                      const obj = objByType[t.id];
                      const sf = sectionFeedbacks[t.id] ?? { feedback: '', score: '' };
                      const wc = obj?.word_count ?? 0;
                      const minOk = !t.min_words || wc >= t.min_words;
                      const missing = (t.required_words ?? []).filter(
                        w => !obj?.content?.toLowerCase().includes(w.toLowerCase())
                      );

                      return (
                        <div key={t.id} className="px-6 py-5 space-y-3">
                          {/* Encabezado sección */}
                          <div className="flex items-baseline gap-3">
                            <span className="text-xs font-bold text-teal-500 w-5 flex-shrink-0">{i + 1}.</span>
                            <h3 className="font-bold text-gray-800 text-base">{t.name}</h3>
                          </div>

                          {/* Requisitos */}
                          <div className="flex flex-wrap gap-2 ml-8">
                            {(t.min_words ?? 0) > 0 && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${minOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                {wc}/{t.min_words} palabras mín.
                              </span>
                            )}
                            {t.max_words && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">máx. {t.max_words}</span>
                            )}
                            {(t.required_words ?? []).map(w => (
                              <span key={w} className={`text-xs px-1.5 py-0.5 rounded ${obj?.content?.toLowerCase().includes(w.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                {w}
                              </span>
                            ))}
                            {missing.length > 0 && (
                              <span className="text-xs text-red-500">Faltan {missing.length} palabra(s)</span>
                            )}
                          </div>

                          {/* Contenido del estudiante */}
                          <div className="ml-8">
                            {obj?.content?.trim() ? (
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{obj.content}</p>
                            ) : (
                              <p className="text-sm text-gray-400 italic">Sin contenido en esta sección.</p>
                            )}
                          </div>

                          {/* Retroalimentación por sección */}
                          <div className="ml-8 space-y-2 pt-2 border-t border-gray-100">
                            <div className="flex gap-3 items-start">
                              <div className="w-28 flex-shrink-0">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Nota (0–10)</label>
                                <input
                                  type="number" min={0} max={10} step={0.1}
                                  value={sf.score}
                                  onChange={e => setSectionFeedbacks(prev => ({
                                    ...prev,
                                    [t.id]: { ...prev[t.id], score: e.target.value },
                                  }))}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Retroalimentación de esta sección</label>
                                <textarea
                                  rows={2}
                                  value={sf.feedback}
                                  onChange={e => setSectionFeedbacks(prev => ({
                                    ...prev,
                                    [t.id]: { ...prev[t.id], feedback: e.target.value },
                                  }))}
                                  placeholder="Comentarios para el estudiante sobre esta sección..."
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Botones de acción globales */}
                  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                    <button
                      onClick={() => saveAll('approved')}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {saving ? 'Guardando...' : 'Aprobar y enviar correcciones'}
                    </button>
                    <button
                      onClick={() => saveAll('needs_revision')}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Solicitar revisión
                    </button>
                    <button
                      onClick={() => saveAll('approved')}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 ml-auto"
                    >
                      <Save className="w-4 h-4" />
                      Solo guardar
                    </button>
                  </div>
                </div>
              )}
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
