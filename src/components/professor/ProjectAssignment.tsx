import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FlaskConical, Check, Loader2, AlertCircle } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface Course { id: string; name: string; }
interface Project { id: string; title: string; description: string | null; is_active: boolean; }
interface Student { id: string; full_name: string; email: string; }

export default function ProjectAssignment({ courses }: { courses: Course[] }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [assignmentType, setAssignmentType] = useState<'course' | 'student'>('course');
  const [loading, setLoading] = useState(false);
  const [fetchingProjects, setFetchingProjects] = useState(true);

  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    if (selectedCourse) loadStudents(selectedCourse);
    else { setStudents([]); setSelectedStudent(''); }
  }, [selectedCourse]);

  async function loadProjects() {
    setFetchingProjects(true);
    const { data } = await sb
      .from('projects')
      .select('id, title, description, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setProjects(data ?? []);
    setFetchingProjects(false);
  }

  async function loadStudents(courseId: string) {
    const { data } = await supabase
      .from('course_students')
      .select('student_id, profiles(id, full_name, email)')
      .eq('course_id', courseId);
    if (data) {
      setStudents(
        data.map((item: any) => item.profiles).filter(Boolean)
      );
    }
  }

  async function assignProjects(e: React.FormEvent) {
    e.preventDefault();
    if (selectedProjects.length === 0) { alert('Selecciona al menos un proyecto'); return; }

    setLoading(true);
    try {
      const rows = selectedProjects.map((projectId) => ({
        project_id: projectId,
        course_id: selectedCourse,
        student_id: assignmentType === 'student' ? selectedStudent : null,
      }));

      const { error } = await supabase.from('project_assignments').insert(rows);
      if (error) throw error;

      alert('Proyectos asignados exitosamente');
      setSelectedProjects([]);
      setSelectedStudent('');
    } catch (err: any) {
      alert(`Error al asignar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleProject(id: string) {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
        <FlaskConical className="w-6 h-6 mr-2 text-teal-600" />
        Asignar Proyectos
      </h2>

      <form onSubmit={assignProjects} className="space-y-6">
        {/* Toggle curso / estudiante */}
        <div className="flex p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => setAssignmentType('course')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
              assignmentType === 'course'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Asignar a Curso
          </button>
          <button
            type="button"
            onClick={() => setAssignmentType('student')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
              assignmentType === 'student'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Asignar a Estudiante
          </button>
        </div>

        {/* Selectores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curso Destino
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              required
            >
              <option value="">Selecciona un curso</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {assignmentType === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estudiante Específico
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-gray-50"
                required
                disabled={!selectedCourse}
              >
                <option value="">
                  {!selectedCourse ? 'Primero elige un curso' : 'Selecciona un estudiante'}
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Lista de proyectos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3 flex justify-between">
            Seleccionar Proyectos
            <span className="text-teal-600 text-xs font-normal">
              {selectedProjects.length} seleccionados
            </span>
          </label>

          <div className="space-y-2 max-h-[400px] overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
            {fetchingProjects ? (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm">Buscando proyectos...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-sm">No hay proyectos activos.</p>
                <p className="text-xs mt-1">Crea proyectos en Studio → Proyectos.</p>
              </div>
            ) : (
              projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  className={`group p-4 rounded-lg cursor-pointer transition-all border-2 ${
                    selectedProjects.includes(p.id)
                      ? 'bg-white border-teal-500 shadow-md'
                      : 'bg-white border-transparent hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-0.5 transition-colors shrink-0 ${
                        selectedProjects.includes(p.id)
                          ? 'bg-teal-600 border-teal-600'
                          : 'border-gray-300 group-hover:border-gray-400'
                      }`}
                    >
                      {selectedProjects.includes(p.id) && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-sm">{p.title}</h4>
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{p.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={
            loading ||
            selectedProjects.length === 0 ||
            !selectedCourse ||
            (assignmentType === 'student' && !selectedStudent)
          }
          className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            `Asignar ${selectedProjects.length} Proyecto${selectedProjects.length !== 1 ? 's' : ''}`
          )}
        </button>
      </form>
    </div>
  );
}
