import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ClipboardList, Check, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveField } from '../../lib/i18n';

interface Course {
  id: string;
  name: string;
}

interface Lesson {
  id: string;
  title: any;
  description: any;
  has_production: boolean;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface LessonAssignmentProps {
  courses: Course[];
  initialCourseId?: string;
}

export default function LessonAssignment({ courses, initialCourseId }: LessonAssignmentProps) {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>(initialCourseId || '');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignmentType, setAssignmentType] = useState<'course' | 'student'>('course');
  const [loading, setLoading] = useState(false);
  const [fetchingLessons, setFetchingLessons] = useState(true);

  useEffect(() => {
    loadLessons();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      loadStudents(selectedCourse);
    } else {
      setStudents([]);
      setSelectedStudent('');
    }
  }, [selectedCourse]);

  async function loadLessons() {
    try {
      setFetchingLessons(true);
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      if (data) setLessons(data);
    } catch (err: any) {
      console.error('Error al cargar lecciones:', err.message);
    } finally {
      setFetchingLessons(false);
    }
  }

  async function loadStudents(courseId: string) {
    try {
      const { data, error } = await supabase
        .from('course_students')
        .select('student_id, profiles(id, full_name, email)')
        .eq('course_id', courseId);

      if (error) throw error;

      if (data) {
        const studentsList = data
          .map((item: any) => item.profiles)
          .filter((s: any) => s !== null);
        setStudents(studentsList);
      }
    } catch (err: any) {
      console.error('Error al cargar estudiantes:', err.message);
    }
  }

  async function assignLessons(e: React.FormEvent) {
    e.preventDefault();
    if (selectedLessons.length === 0) {
      alert('Selecciona al menos una lección');
      return;
    }

    setLoading(true);

    try {
      const assignments = selectedLessons.map((lessonId) => ({
        lesson_id: lessonId,
        course_id: assignmentType === 'course' ? selectedCourse : null,
        student_id: assignmentType === 'student' ? selectedStudent : null,
        assigned_by: profile?.id,
      }));

      const { error } = await supabase.from('lesson_assignments').insert(assignments);

      if (error) throw error;

      alert('Lecciones asignadas exitosamente');
      setSelectedLessons([]);
      setSelectedStudent('');
    } catch (err: any) {
      alert(`Error al asignar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleLesson(lessonId: string) {
    setSelectedLessons((prev) =>
      prev.includes(lessonId) ? prev.filter((id) => id !== lessonId) : [...prev, lessonId]
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
        <ClipboardList className="w-6 h-6 mr-2 text-blue-600" />
        Asignar Lecciones
      </h2>

      <form onSubmit={assignLessons} className="space-y-6">
        <div className="flex p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => setAssignmentType('course')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
              assignmentType === 'course'
                ? 'bg-white text-blue-600 shadow-sm'
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
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Asignar a Estudiante
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curso Destino
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              <option value="">Selecciona un curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                required
                disabled={!selectedCourse}
              >
                <option value="">
                  {!selectedCourse ? 'Primero elige un curso' : 'Selecciona un estudiante'}
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3 flex justify-between">
            Seleccionar Contenido
            <span className="text-blue-600 text-xs font-normal">
              {selectedLessons.length} seleccionadas
            </span>
          </label>

          <div className="space-y-2 max-h-[400px] overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
            {fetchingLessons ? (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm">Buscando lecciones...</p>
              </div>
            ) : lessons.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-sm">No hay lecciones creadas en la base de datos.</p>
              </div>
            ) : (
              lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  onClick={() => toggleLesson(lesson.id)}
                  className={`group p-4 rounded-lg cursor-pointer transition-all border-2 ${
                    selectedLessons.includes(lesson.id)
                      ? 'bg-white border-blue-500 shadow-md'
                      : 'bg-white border-transparent hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-0.5 transition-colors ${
                        selectedLessons.includes(lesson.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 group-hover:border-gray-400'
                      }`}
                    >
                      {selectedLessons.includes(lesson.id) && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-sm">{resolveField(lesson.title, 'es')}</h4>
                      {resolveField(lesson.description, 'es') && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{resolveField(lesson.description, 'es')}</p>
                      )}
                      {lesson.has_production && (
                        <span className="inline-flex items-center mt-2 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                          Requiere entrega de producción
                        </span>
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
            selectedLessons.length === 0 || 
            !selectedCourse || 
            (assignmentType === 'student' && !selectedStudent)
          }
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            `Asignar ${selectedLessons.length} Lección(es)`
          )}
        </button>
      </form>
    </div>
  );
}