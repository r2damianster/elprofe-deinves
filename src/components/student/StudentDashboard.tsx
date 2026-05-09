import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, CheckCircle, Lock, Users, BarChart2, ChevronRight, Clock, Star } from 'lucide-react';
import { resolveField } from '../../lib/i18n';
import { useAuth } from '../../contexts/AuthContext';
import LessonViewer from './LessonViewer';
import GroupEnrollment from './GroupEnrollment';
import PresentationViewer from './PresentationViewer';
import StudentResults from './StudentResults';
import ProjectObjectList from './ProjectObjectList';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface Lesson {
  id: string;
  title: any;
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

interface ProjectSummary {
  id: string;
  title: string;
  description: string | null;
  object_logic: 'ordinal' | 'causal' | 'structural';
  total_objects: number;
  completed_objects: number;
  submission: {
    status: 'draft' | 'submitted' | 'reviewed';
    score: number | null;
    feedback: string | null;
  } | null;
}

type UnifiedItem =
  | { kind: 'lesson'; lesson: Lesson }
  | { kind: 'project'; project: ProjectSummary };

export default function StudentDashboard() {
  const { signOut, profile } = useAuth();
  const [assignedLessons, setAssignedLessons] = useState<Lesson[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [lessonLang, setLessonLang] = useState<Record<string, 'es' | 'en'>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'lessons' | 'groups' | 'results'>('lessons');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    checkActiveSession();

    const interval = setInterval(checkActiveSession, 5000);

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

    const { data } = await sb
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

  async function getCourseIds(): Promise<string> {
    const { data } = await supabase
      .from('course_students')
      .select('course_id')
      .eq('student_id', profile?.id ?? '');
    return data?.map((c) => c.course_id).join(',') || '';
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadAssignedLessons(), loadProjects()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignedLessons() {
    try {
      const courseIds = await getCourseIds();
      const now = new Date().toISOString();
      const { data: assignments } = await supabase
        .from('lesson_assignments')
        .select('lesson_id, course_id, lessons(*), courses(language)')
        .or(`student_id.eq.${profile?.id},course_id.in.(${courseIds})`)
        .or(`available_from.is.null,available_from.lte.${now}`);

      if (assignments) {
        const uniqueLessons = Array.from(
          new Map(
            assignments
              .filter((a: any) => a.lessons)
              .map((a: any) => [a.lessons.id, a.lessons])
          ).values()
        );
        setAssignedLessons(uniqueLessons as Lesson[]);

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
    }
  }

  async function loadProjects() {
    try {
      const courseIds = await getCourseIds();
      const now = new Date().toISOString();
      const { data: assignmentData } = await sb
        .from('project_assignments')
        .select('project_id, projects(id, title, description, object_logic, is_active)')
        .in('course_id', courseIds.split(',').filter(Boolean))
        .is('student_id', null)
        .or(`available_from.is.null,available_from.lte.${now}`);

      const projData = (assignmentData ?? [])
        .map((a: any) => a.projects)
        .filter((p: any) => p && p.is_active);

      if (!projData || projData.length === 0) {
        setProjects([]);
        return;
      }

      const projectList = await Promise.all(
        projData.map(async (p: any) => {
          const [typesRes, subRes] = await Promise.all([
            sb.from('project_object_types').select('id').eq('project_id', p.id),
            sb.from('project_submissions')
              .select('status, score, feedback')
              .eq('project_id', p.id)
              .eq('student_id', profile?.id)
              .maybeSingle(),
          ]);

          const typeIds = (typesRes.data ?? []).map((t: any) => t.id);
          let completed = 0;

          if (typeIds.length > 0) {
            const { data: objs } = await sb
              .from('project_objects')
              .select('status')
              .eq('project_id', p.id)
              .eq('student_id', profile?.id)
              .in('object_type_id', typeIds);
            completed = (objs ?? []).filter(
              (o: any) => o.status === 'submitted' || o.status === 'approved'
            ).length;
          }

          return {
            id: p.id,
            title: p.title,
            description: p.description,
            object_logic: p.object_logic,
            total_objects: typeIds.length,
            completed_objects: completed,
            submission: subRes.data ?? null,
          } as ProjectSummary;
        })
      );

      setProjects(projectList);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  async function loadProgress(lessonIds: string[]) {
    const { data } = await supabase
      .from('student_progress')
      .select('*')
      .eq('student_id', profile?.id ?? '')
      .in('lesson_id', lessonIds);

    if (data) {
      const progressMap: Record<string, Progress> = {};
      data.forEach((p) => { progressMap[p.lesson_id] = p; });
      setProgress(progressMap);
    }
  }

  // Priority: reviewed project (0) → submitted project (2) → in-progress (3)
  //           → lesson not started (4) → project not started (5) → completed (6)
  const sortedItems = useMemo((): UnifiedItem[] => {
    function priority(item: UnifiedItem): number {
      if (item.kind === 'project') {
        const s = item.project.submission;
        if (s?.status === 'reviewed')           return 0;
        if (s?.status === 'submitted')          return 2;
        if (item.project.completed_objects > 0) return 3;
        return 5;
      } else {
        const p = progress[item.lesson.id];
        if (p?.completed_at)                         return 6;
        if ((p?.completion_percentage ?? 0) > 0)     return 3;
        return 4;
      }
    }

    const items: UnifiedItem[] = [
      ...assignedLessons.map(lesson => ({ kind: 'lesson' as const, lesson })),
      ...projects.map(project => ({ kind: 'project' as const, project })),
    ];
    return items.sort((a, b) => priority(a) - priority(b));
  }, [assignedLessons, projects, progress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (activeSession) {
    return (
      <PresentationViewer
        session={activeSession}
        onSessionEnd={() => setActiveSession(null)}
      />
    );
  }

  if (selectedProject) {
    return (
      <ProjectObjectList
        projectId={selectedProject}
        onBack={() => { setSelectedProject(null); loadAll(); }}
      />
    );
  }

  if (selectedLesson) {
    return (
      <LessonViewer
        lessonId={selectedLesson}
        lang={lessonLang[selectedLesson] ?? 'es'}
        onBack={() => { setSelectedLesson(null); loadAll(); }}
      />
    );
  }

  const reviewedCount = projects.filter(p => p.submission?.status === 'reviewed').length;

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

        {/* Tabs — 3 tabs, "Mis Proyectos" merged into "Mi Aprendizaje" */}
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-2">
          {[
            { key: 'lessons', label: 'Mi Aprendizaje', icon: BookOpen },
            { key: 'groups',  label: 'Mis Grupos',     icon: Users },
            { key: 'results', label: 'Mis Resultados', icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as 'lessons' | 'groups' | 'results')}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${
                tab === key
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
              {key === 'lessons' && reviewedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {reviewedCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {tab === 'groups' && <GroupEnrollment />}
        {tab === 'results' && <StudentResults />}

        {tab === 'lessons' && (
          sortedItems.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No tienes actividades asignadas
              </h3>
              <p className="text-gray-600">
                Tu profesor te asignará lecciones y proyectos próximamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map(item =>
                item.kind === 'lesson'
                  ? <LessonCard
                      key={`lesson-${item.lesson.id}`}
                      lesson={item.lesson}
                      progress={progress[item.lesson.id] ?? null}
                      lang={lessonLang[item.lesson.id] ?? 'es'}
                      onClick={() => setSelectedLesson(item.lesson.id)}
                    />
                  : <ProjectCard
                      key={`project-${item.project.id}`}
                      project={item.project}
                      onClick={() => setSelectedProject(item.project.id)}
                    />
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}

// ─── Lesson card ──────────────────────────────────────────────────────────────
function LessonCard({
  lesson, progress, lang, onClick,
}: {
  lesson: Lesson;
  progress: Progress | null;
  lang: 'es' | 'en';
  onClick: () => void;
}) {
  const pct       = progress?.completion_percentage ?? 0;
  const completed = !!progress?.completed_at;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group overflow-hidden"
    >
      <div
        className={`h-0.5 ${completed ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-transparent'}`}
        style={{ width: `${pct}%` }}
      />
      <div className="px-5 py-4 flex items-center gap-4">
        <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md bg-sky-100 text-sky-700">
          Lección
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate group-hover:text-blue-700 transition-colors">
            {resolveField(lesson.title, lang)}
          </p>
          {resolveField(lesson.description, lang) && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {resolveField(lesson.description, lang)}
            </p>
          )}
          {pct > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 max-w-[120px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{pct}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {completed ? (
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
              <CheckCircle className="w-3.5 h-3.5" /> Completada
            </span>
          ) : pct > 0 ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              En curso
            </span>
          ) : lesson.has_production ? (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Lock className="w-3 h-3" /> Con producción
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              Sin empezar
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({
  project, onClick,
}: {
  project: ProjectSummary;
  onClick: () => void;
}) {
  const sub        = project.submission;
  const isReviewed = sub?.status === 'reviewed';
  const isSubmitted = sub?.status === 'submitted';
  const pct = project.total_objects > 0
    ? Math.round((project.completed_objects / project.total_objects) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border transition-all cursor-pointer group overflow-hidden ${
        isReviewed
          ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-500 hover:shadow-md'
          : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
      }`}
    >
      {isReviewed && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-1.5 flex items-center gap-2">
          <Star className="w-3.5 h-3.5 fill-current" />
          Tu profesor evaluó este proyecto — tienes retroalimentación disponible
        </div>
      )}

      <div className="px-5 py-4 flex items-center gap-4">
        <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-700">
          Proyecto
        </span>

        <div className="flex-1 min-w-0">
          <p className={`font-semibold truncate transition-colors ${
            isReviewed
              ? 'text-emerald-900 group-hover:text-emerald-700'
              : 'text-gray-800 group-hover:text-indigo-700'
          }`}>
            {project.title}
          </p>

          {isReviewed ? (
            <div className="mt-1 space-y-0.5">
              {sub?.score !== null && sub?.score !== undefined && (
                <p className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                  {sub.score}/10
                </p>
              )}
              {sub?.feedback && (
                <p className="text-sm text-emerald-700 truncate">{sub.feedback}</p>
              )}
            </div>
          ) : (
            <>
              {project.description && (
                <p className="text-sm text-gray-500 mt-0.5 truncate">{project.description}</p>
              )}
              {project.total_objects > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 max-w-[120px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {project.completed_objects}/{project.total_objects} objetos
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isReviewed ? (
            <span className="text-sm font-semibold text-emerald-700 flex items-center gap-1 whitespace-nowrap">
              Ver retroalimentación
              <ChevronRight className="w-4 h-4" />
            </span>
          ) : isSubmitted ? (
            <>
              <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                <Clock className="w-3.5 h-3.5" /> Enviado
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </>
          ) : pct > 0 ? (
            <>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                En curso
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
            </>
          ) : (
            <>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                Sin empezar
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
