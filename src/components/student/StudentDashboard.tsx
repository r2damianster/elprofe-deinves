import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, CheckCircle, Lock, Users, BarChart2 } from 'lucide-react';
import { resolveField } from '../../lib/i18n';
import { useAuth } from '../../contexts/AuthContext';
import LessonViewer from './LessonViewer';
import GroupEnrollment from './GroupEnrollment';
import PresentationViewer from './PresentationViewer';
import StudentResults from './StudentResults';

interface Lesson {
  id: string;
  title: any; // string | {es: string, en: string}
  description: any;
  has_production: boolean;
  production_unlock_percentage: number;
}

interface Progress {
  lesson_id: string;
  completion_percentage: number;
  completed_at: string | null;
}

interface ActiveSession {
  id: string;
  lesson_id: string;
  current_step_index: number;
  professor_name?: string;
}

export default function StudentDashboard() {
  const { signOut, profile } = useAuth();
  const [assignedLessons, setAssignedLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [lessonLang, setLessonLang] = useState<Record<string, 'es' | 'en'>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'lessons' | 'groups' | 'results'>('lessons');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  useEffect(() => {
    loadAssignedLessons();
  }, []);

  // ── Detectar sesión activa para los cursos del estudiante ──────────────
  useEffect(() => {
    if (!profile?.id) return;
    checkActiveSession();

    // Polling cada 5 segundos como mecanismo principal
    const interval = setInterval(checkActiveSession, 5000);

    // Realtime como mecanismo complementario (requiere migration aplicada)
    const channel = supabase
      .channel('student_presentation_watch')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'presentation_sessions',
      }, () => { checkActiveSession(); })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  async function checkActiveSession() {
    if (!profile?.id) return;
    const courseIds = await getCourseIds();
    if (!courseIds) return;

    const { data } = await supabase
      .from('presentation_sessions')
      .select('id, lesson_id, current_step_index, profiles!professor_id(full_name)')
      .eq('is_active', true)
      .in('course_id', courseIds.split(',').filter(Boolean))
      .maybeSingle();

    if (data) {
      setActiveSession({
        id:                 data.id,
        lesson_id:          data.lesson_id,
        current_step_index: data.current_step_index,
        professor_name:     (data as any).profiles?.full_name,
      });
    } else {
      setActiveSession(null);
    }
  }

  async function loadAssignedLessons() {
    try {
      const { data: assignments } = await supabase
        .from('lesson_assignments')
        .select('lesson_id, course_id, lessons(*), courses(language)')
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

        // Construir mapa lesson_id → idioma del curso
        const langMap: Record<string, 'es' | 'en'> = {};
        assignments.forEach((a: any) => {
          if (a.lessons && a.courses?.language) {
            langMap[a.lessons.id] = a.courses.language;
          }
        });
        setLessonLang(langMap);

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

  // Si hay una sesión activa, mostrar el visor de presentación
  if (activeSession) {
    return (
      <PresentationViewer
        session={activeSession}
        onSessionEnd={() => setActiveSession(null)}
      />
    );
  }

  if (selectedLesson) {
    return (
      <LessonViewer
        lessonId={selectedLesson}
        lang={lessonLang[selectedLesson] ?? 'es'}
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
              <h1 className="text-2xl font-bold text-gray-800">Mi Aula</h1>
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

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-2">
          {[
            { key: 'lessons', label: 'Mis Lecciones', icon: BookOpen },
            { key: 'groups',  label: 'Mis Grupos',    icon: Users },
            { key: 'results', label: 'Mis Resultados', icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key}
              onClick={() => setTab(key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${
                tab === key
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {tab === 'groups' && <GroupEnrollment />}

        {tab === 'results' && <StudentResults />}

        {tab === 'lessons' && (assignedLessons.length === 0 ? (
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
                      <h3 className="font-bold text-lg text-gray-800">{resolveField(lesson.title, lessonLang[lesson.id] ?? 'es')}</h3>
                      {completed ? (
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                      ) : progressPct > 0 ? (
                        <div className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                          {progressPct}%
                        </div>
                      ) : null}
                    </div>

                    {resolveField(lesson.description, lessonLang[lesson.id] ?? 'es') && (
                      <p className="text-gray-600 text-sm mb-4">{resolveField(lesson.description, lessonLang[lesson.id] ?? 'es')}</p>
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
        ))}
      </main>
    </div>
  );
}
