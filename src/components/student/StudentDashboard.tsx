import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, CheckCircle, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LessonViewer from './LessonViewer';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  has_production: boolean;
  production_unlock_percentage: number;
}

interface Progress {
  lesson_id: string;
  completion_percentage: number;
  completed_at: string | null;
}

export default function StudentDashboard() {
  const { signOut, profile } = useAuth();
  const [assignedLessons, setAssignedLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignedLessons();
  }, []);

  async function loadAssignedLessons() {
    try {
      const { data: assignments } = await supabase
        .from('lesson_assignments')
        .select('lesson_id, lessons(*)')
        .or(`student_id.eq.${profile?.id},course_id.in.(${await getCourseIds()})`);

      if (assignments) {
        const uniqueLessons = Array.from(
          new Map(
            assignments
              .filter((a: any) => a.lessons)
              .map((a: any) => [a.lessons.id, a.lessons])
          ).values()
        );
        setAssignedLessons(uniqueLessons as Lesson[]);

        await loadProgress(uniqueLessons.map((l: any) => l.id));
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
    } finally {
      setLoading(false);
    }
  }

  async function getCourseIds() {
    const { data } = await supabase
      .from('course_students')
      .select('course_id')
      .eq('student_id', profile?.id);

    return data?.map((c) => c.course_id).join(',') || '';
  }

  async function loadProgress(lessonIds: string[]) {
    const { data } = await supabase
      .from('student_progress')
      .select('*')
      .eq('student_id', profile?.id)
      .in('lesson_id', lessonIds);

    if (data) {
      const progressMap: Record<string, Progress> = {};
      data.forEach((p) => {
        progressMap[p.lesson_id] = p;
      });
      setProgress(progressMap);
    }
  }

  function getProgressPercentage(lessonId: string): number {
    return progress[lessonId]?.completion_percentage || 0;
  }

  function isLessonCompleted(lessonId: string): boolean {
    return progress[lessonId]?.completed_at !== null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando lecciones...</p>
        </div>
      </div>
    );
  }

  if (selectedLesson) {
    return (
      <LessonViewer
        lessonId={selectedLesson}
        onBack={() => {
          setSelectedLesson(null);
          loadAssignedLessons();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Mis Lecciones</h1>
              <p className="text-sm text-gray-600">{profile?.full_name}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {assignedLessons.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No tienes lecciones asignadas
            </h3>
            <p className="text-gray-600">
              Tu profesor te asignará lecciones pronto.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedLessons.map((lesson) => {
              const progressPct = getProgressPercentage(lesson.id);
              const completed = isLessonCompleted(lesson.id);

              return (
                <div
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson.id)}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-lg text-gray-800">{lesson.title}</h3>
                      {completed ? (
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                      ) : progressPct > 0 ? (
                        <div className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                          {progressPct}%
                        </div>
                      ) : null}
                    </div>

                    {lesson.description && (
                      <p className="text-gray-600 text-sm mb-4">{lesson.description}</p>
                    )}

                    {lesson.has_production && (
                      <div className="flex items-center text-sm mb-4">
                        {progressPct >= lesson.production_unlock_percentage ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                            Producción Desbloqueada
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs flex items-center">
                            <Lock className="w-3 h-3 mr-1" />
                            Producción bloqueada ({lesson.production_unlock_percentage}%
                            requerido)
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progreso</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            completed ? 'bg-green-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        ></div>
                      </div>
                    </div>

                    <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold">
                      {completed ? 'Revisar' : progressPct > 0 ? 'Continuar' : 'Comenzar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
