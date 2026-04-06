import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Eye, Monitor, Loader2, Clock } from 'lucide-react';
import LessonViewer from '../student/LessonViewer';
import PresentationController from './PresentationController';

interface AssignedLesson {
  id: string;
  title: string;
  description: string | null;
  assigned_at: string;
}

interface Props {
  courseId: string;
  courseName: string;
  onBack: () => void;
}

export default function ProfessorLessonView({ courseId, courseName, onBack }: Props) {
  const [lessons, setLessons]     = useState<AssignedLesson[]>([]);
  const [loading, setLoading]     = useState(true);
  const [preview, setPreview]     = useState<string | null>(null);       // lessonId en vista previa
  const [presenting, setPresenting] = useState<string | null>(null);    // lessonId en presentación

  useEffect(() => { load(); }, [courseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('lesson_assignments')
      .select('id, assigned_at, lessons(id, title, description)')
      .eq('course_id', courseId)
      .is('student_id', null)
      .order('assigned_at', { ascending: false });

    if (data) {
      setLessons(data.map((r: any) => ({
        id:          r.lessons.id,
        title:       r.lessons.title,
        description: r.lessons.description,
        assigned_at: r.assigned_at,
      })));
    }
    setLoading(false);
  }

  if (preview) {
    return (
      <LessonViewer
        lessonId={preview}
        onBack={() => setPreview(null)}
        previewMode={true}
      />
    );
  }

  if (presenting) {
    return (
      <PresentationController
        lessonId={presenting}
        courseId={courseId}
        onEnd={() => setPresenting(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" /> Lecciones de {courseName}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Vista Previa: navegas la lección sin guardar progreso.
            Presentar: los estudiantes siguen tu avance en tiempo real.
          </p>
        </div>
        <button onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition">
          ← Volver
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando lecciones...
        </div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="font-medium">Este curso no tiene lecciones asignadas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson, idx) => (
            <div key={lesson.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white hover:border-blue-200 transition group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 truncate">{lesson.title}</p>
                  {lesson.description && (
                    <p className="text-sm text-gray-500 truncate">{lesson.description}</p>
                  )}
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    Asignada el {new Date(lesson.assigned_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button
                  onClick={() => setPreview(lesson.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-sm font-medium hover:bg-amber-100 transition">
                  <Eye className="w-4 h-4" /> Vista Previa
                </button>
                <button
                  onClick={() => setPresenting(lesson.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                  <Monitor className="w-4 h-4" /> Presentar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
