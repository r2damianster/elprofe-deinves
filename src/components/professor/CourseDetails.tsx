import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Users, BookOpen, Clock, Loader2, Trash2, UsersRound, Monitor, FolderOpen, Pencil, Save, X, UserPlus, ClipboardList, ChevronDown } from 'lucide-react';
import StudentManager from './StudentManager';
import GroupManager from './GroupManager';
import CourseProjectsManager from './CourseProjectsManager';
import ProfessorLessonView from './ProfessorLessonView';
import { resolveField, type Lang } from '../../lib/i18n';

interface AssignedLesson {
  id: string;
  lesson_assignments_id: string;
  title: any;
  description: any;
  assigned_at: string;
  available_from: string | null;
  available_until: string | null;
}

interface CourseDetailsProps {
  courseId: string;
  courseName: string;
  courseLanguage?: Lang;
}

export default function CourseDetails({ courseId, courseName, courseLanguage = 'es' }: CourseDetailsProps) {
  const [assignedLessons, setAssignedLessons] = useState<AssignedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lessons' | 'students' | 'groups' | 'present' | 'projects'>('lessons');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFrom, setEditFrom] = useState('');
  const [editUntil, setEditUntil] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendStudentId, setExtendStudentId] = useState('');
  const [extendFrom, setExtendFrom] = useState('');
  const [extendUntil, setExtendUntil] = useState('');
  const [extendSaving, setExtendSaving] = useState(false);
  const [courseStudents, setCourseStudents] = useState<{id: string; full_name: string}[]>([]);
  const [addingLesson, setAddingLesson] = useState(false);
  const [availableLessons, setAvailableLessons] = useState<{id: string; title: any; description: any}[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [addLessonFrom, setAddLessonFrom] = useState('');
  const [addLessonUntil, setAddLessonUntil] = useState('');
  const [savingNewLesson, setSavingNewLesson] = useState(false);

  useEffect(() => {
    loadAssignedLessons();
  }, [courseId]);

  async function loadAssignedLessons() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lesson_assignments')
        .select(`
          id,
          assigned_at,
          available_from,
          available_until,
          order_index,
          lessons (
            id,
            title,
            description
          )
        `)
        .eq('course_id', courseId)
        .is('student_id', null)
        .order('order_index', { ascending: true })
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Formatear los datos combinados
        const formatted = data.map((item: any) => ({
          lesson_assignments_id: item.id,
          assigned_at: item.assigned_at,
          available_from: item.available_from,
          available_until: item.available_until,
          ...item.lessons,
        }));
        setAssignedLessons(formatted);
      }
    } catch (err: any) {
      console.error('Error al cargar lecciones asignadas:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeLesson(assignmentId: string, lessonTitle: string) {
    if (!confirm(`¿Desasignar "${lessonTitle}" de este curso?`)) return;
    setRemovingId(assignmentId);
    try {
      const { error } = await supabase
        .from('lesson_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
      setAssignedLessons((prev) => prev.filter((l) => l.lesson_assignments_id !== assignmentId));
    } catch (err: any) {
      alert('Error al desasignar: ' + err.message);
    } finally {
      setRemovingId(null);
    }
  }

  async function loadCourseStudents() {
    if (courseStudents.length > 0) return;
    const { data } = await supabase
      .from('course_students')
      .select('student_id, profiles(id, full_name)')
      .eq('course_id', courseId);
    if (data) {
      setCourseStudents(data.map((r: any) => r.profiles).filter(Boolean));
    }
  }

  async function extendAccess(lessonId: string) {
    if (!extendStudentId) return;
    setExtendSaving(true);
    const { error } = await supabase.from('lesson_assignments').insert({
      lesson_id: lessonId,
      course_id: courseId,
      student_id: extendStudentId,
      assigned_by: (await supabase.auth.getUser()).data.user!.id,
      available_from: extendFrom ? new Date(extendFrom).toISOString() : null,
      available_until: extendUntil ? new Date(extendUntil).toISOString() : null,
    });
    if (error) alert('Error: ' + error.message);
    else {
      setExtendingId(null);
      setExtendStudentId('');
      setExtendFrom('');
      setExtendUntil('');
    }
    setExtendSaving(false);
  }

  function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function startEdit(lesson: AssignedLesson) {
    setEditingId(lesson.lesson_assignments_id);
    setEditFrom(toLocalInput(lesson.available_from));
    setEditUntil(toLocalInput(lesson.available_until));
  }

  async function saveDates(assignmentId: string) {
    setSavingId(assignmentId);
    const { error } = await supabase
      .from('lesson_assignments')
      .update({
        available_from: editFrom ? new Date(editFrom).toISOString() : null,
        available_until: editUntil ? new Date(editUntil).toISOString() : null,
      })
      .eq('id', assignmentId);
    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      setAssignedLessons(prev => prev.map(l =>
        l.lesson_assignments_id === assignmentId
          ? {
              ...l,
              available_from: editFrom ? new Date(editFrom).toISOString() : null,
              available_until: editUntil ? new Date(editUntil).toISOString() : null,
            }
          : l
      ));
      setEditingId(null);
    }
    setSavingId(null);
  }

  async function loadAvailableLessons() {
    const { data } = await supabase
      .from('lessons')
      .select('id, title, description')
      .order('order_index', { ascending: true });
    if (data) {
      const assignedIds = new Set(assignedLessons.map(l => l.id));
      const available = data.filter((l: any) => !assignedIds.has(l.id));
      setAvailableLessons(available);
      if (available.length > 0) setSelectedLessonId(available[0].id);
    }
  }

  async function addLessonInline() {
    if (!selectedLessonId) return;
    setSavingNewLesson(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('lesson_assignments').insert({
      lesson_id: selectedLessonId,
      course_id: courseId,
      student_id: null,
      assigned_by: user!.id,
      available_from: addLessonFrom ? new Date(addLessonFrom).toISOString() : null,
      available_until: addLessonUntil ? new Date(addLessonUntil).toISOString() : null,
    });
    if (error) alert('Error: ' + error.message);
    else {
      setAddingLesson(false);
      setSelectedLessonId('');
      setAddLessonFrom('');
      setAddLessonUntil('');
      await loadAssignedLessons();
    }
    setSavingNewLesson(false);
  }

  // Vista principal con tabs
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-6 border-b bg-gray-50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{courseName}</h2>
            <p className="text-sm text-gray-500 mt-1">Gestión del curso</p>
          </div>
          {view === 'lessons' && !addingLesson && (
            <button onClick={() => { setAddingLesson(true); loadAvailableLessons(); }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Asignar Lección
            </button>
          )}
        </div>
        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'lessons',  label: 'Lecciones',   icon: BookOpen },
            { key: 'students', label: 'Estudiantes',  icon: Users },
            { key: 'groups',   label: 'Grupos',       icon: UsersRound },
            { key: 'projects', label: 'Proyectos',    icon: FolderOpen },
            { key: 'present',  label: 'Presentar',    icon: Monitor },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key}
              onClick={() => setView(key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                view === key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido por tab */}
      <div className="p-6 flex-1 overflow-y-auto">

        {/* Tab: Proyectos */}
        {view === 'projects' && <CourseProjectsManager courseId={courseId} />}

        {/* Tab: Estudiantes */}
        {view === 'students' && <StudentManager courseId={courseId} />}

        {/* Tab: Grupos */}
        {view === 'groups' && <GroupManager courseId={courseId} />}

        {/* Tab: Presentar */}
        {view === 'present' && (
          <ProfessorLessonView
            courseId={courseId}
            courseName={courseName}
            courseLanguage={courseLanguage}
            onBack={() => setView('lessons')}
          />
        )}

        {/* Tab: Lecciones */}
        {view === 'lessons' && (<>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
          Lecciones Asignadas al Curso
        </h3>

        {addingLesson && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-blue-700">Nueva lección para este curso</p>
            {availableLessons.length === 0 ? (
              <p className="text-sm text-gray-500">No hay lecciones disponibles sin asignar.</p>
            ) : (
              <select
                value={selectedLessonId}
                onChange={e => setSelectedLessonId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableLessons.map(l => (
                  <option key={l.id} value={l.id}>{resolveField(l.title, courseLanguage)}</option>
                ))}
              </select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Desde <span className="text-gray-400">(opcional)</span></label>
                <input type="datetime-local" value={addLessonFrom} onChange={e => setAddLessonFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hasta <span className="text-gray-400">(opcional)</span></label>
                <input type="datetime-local" value={addLessonUntil} min={addLessonFrom} onChange={e => setAddLessonUntil(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addLessonInline} disabled={savingNewLesson || !selectedLessonId || availableLessons.length === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingNewLesson ? 'Asignando...' : 'Asignar'}
              </button>
              <button onClick={() => setAddingLesson(false)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
            <p>Cargando temario...</p>
          </div>
        ) : assignedLessons.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h4 className="text-gray-800 font-semibold mb-1">Aún no hay lecciones</h4>
            <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
              Este curso no tiene material asignado. Empieza asignando tu primera lección para que los estudiantes puedan estudiar.
            </p>
            <button
              onClick={() => { setAddingLesson(true); loadAvailableLessons(); }}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow"
            >
              Asignar mi primera lección
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedLessons.map((lesson, idx) => (
              <div key={lesson.lesson_assignments_id} className="border border-gray-200 rounded-xl bg-white hover:border-blue-300 transition-colors group">
              <div className="flex items-start p-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm mr-4 mt-0.5 flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800">{resolveField(lesson.title, courseLanguage)}</h4>
                  {resolveField(lesson.description, courseLanguage) && (
                    <p className="text-sm text-gray-600 mt-1">{resolveField(lesson.description, courseLanguage)}</p>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {editingId === lesson.lesson_assignments_id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                            <input type="datetime-local" value={editFrom}
                              onChange={e => setEditFrom(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                            <input type="datetime-local" value={editUntil} min={editFrom}
                              onChange={e => setEditUntil(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveDates(lesson.lesson_assignments_id)}
                            disabled={savingId === lesson.lesson_assignments_id}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {savingId === lesson.lesson_assignments_id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Save className="w-3 h-3" />}
                            Guardar
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                            <X className="w-3 h-3" /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Asignado {new Date(lesson.assigned_at).toLocaleDateString()}
                        </span>
                        {lesson.available_from && (
                          <span className="text-blue-500">Desde {new Date(lesson.available_from).toLocaleString()}</span>
                        )}
                        {lesson.available_until && (
                          <span className="text-orange-500">Hasta {new Date(lesson.available_until).toLocaleString()}</span>
                        )}
                        {!lesson.available_from && !lesson.available_until && (
                          <span className="text-green-500">Siempre disponible</span>
                        )}
                        <button onClick={() => startEdit(lesson)}
                          className="flex items-center gap-1 text-gray-400 hover:text-blue-600 transition opacity-0 group-hover:opacity-100 ml-1">
                          <Pencil className="w-3 h-3" /> Editar fechas
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-3 flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setExtendingId(extendingId === lesson.lesson_assignments_id ? null : lesson.lesson_assignments_id);
                      loadCourseStudents();
                      setExtendStudentId('');
                      setExtendFrom('');
                      setExtendUntil('');
                    }}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                    title="Extender acceso a estudiante"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeLesson(lesson.lesson_assignments_id, resolveField(lesson.title, courseLanguage))}
                    disabled={removingId === lesson.lesson_assignments_id}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                    title="Desasignar lección"
                  >
                    {removingId === lesson.lesson_assignments_id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {extendingId === lesson.lesson_assignments_id && (
                <div className="mx-4 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-blue-700">Extender acceso individual</p>
                  <select
                    value={extendStudentId}
                    onChange={e => setExtendStudentId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Selecciona estudiante…</option>
                    {courseStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Desde</label>
                      <input type="datetime-local" value={extendFrom} onChange={e => setExtendFrom(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                      <input type="datetime-local" value={extendUntil} min={extendFrom} onChange={e => setExtendUntil(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => extendAccess(lesson.id)}
                      disabled={!extendStudentId || extendSaving}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {extendSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                      Extender
                    </button>
                    <button onClick={() => setExtendingId(null)}
                      className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}
