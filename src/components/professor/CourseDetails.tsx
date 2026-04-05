import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Users, BookOpen, Clock, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import StudentManager from './StudentManager';

interface AssignedLesson {
  id: string;
  lesson_assignments_id: string;
  title: string;
  description: string | null;
  assigned_at: string;
}

interface CourseDetailsProps {
  courseId: string;
  courseName: string;
  onAssignLessons: () => void;
  onClose: () => void;
}

export default function CourseDetails({ courseId, courseName, onAssignLessons, onClose }: CourseDetailsProps) {
  const [assignedLessons, setAssignedLessons] = useState<AssignedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStudentManager, setShowStudentManager] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadAssignedLessons();
  }, [courseId, showStudentManager]);

  async function loadAssignedLessons() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lesson_assignments')
        .select(`
          id,
          assigned_at,
          lessons (
            id,
            title,
            description
          )
        `)
        .eq('course_id', courseId)
        .is('student_id', null) // Tareas asignadas a todo el curso, no a individuos
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Formatear los datos combinados
        const formatted = data.map((item: any) => ({
          lesson_assignments_id: item.id,
          assigned_at: item.assigned_at,
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

  // Vista del Gestor de Estudiantes encapsulada
  if (showStudentManager) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-3">
          <button 
            onClick={() => setShowStudentManager(false)}
            className="p-2 hover:bg-gray-200 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Gestionar Estudiantes</h3>
            <p className="text-xs text-gray-500">Curso: {courseName}</p>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <StudentManager courseId={courseId} />
        </div>
      </div>
    );
  }

  // Vista principal: Detalles del Curso
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Modal */}
      <div className="p-6 border-b bg-gray-50">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{courseName}</h2>
            <p className="text-sm text-gray-500 mt-1">Detalles y temario del curso</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowStudentManager(true)}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium shadow-sm"
            >
              <Users className="w-4 h-4 mr-2" />
              Estudiantes
            </button>
            <button
              onClick={onAssignLessons}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Asignar Lección
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="p-6 flex-1 overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
          Lecciones Asignadas al Curso
        </h3>

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
              onClick={onAssignLessons}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow"
            >
              Asignar mi primera lección
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedLessons.map((lesson, idx) => (
              <div
                key={lesson.lesson_assignments_id}
                className="flex items-start p-4 border border-gray-200 rounded-xl bg-white hover:border-blue-300 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm mr-4 mt-0.5 flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800">{lesson.title}</h4>
                  {lesson.description && (
                    <p className="text-sm text-gray-600 mt-1">{lesson.description}</p>
                  )}
                  <div className="flex items-center text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Asignado el {new Date(lesson.assigned_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => removeLesson(lesson.lesson_assignments_id, lesson.title)}
                  disabled={removingId === lesson.lesson_assignments_id}
                  className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                  title="Desasignar lección"
                >
                  {removingId === lesson.lesson_assignments_id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
