import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, FlaskConical, FolderOpen, Loader2, ChevronRight } from 'lucide-react';
import LessonAssignment from './LessonAssignment';
import ProjectAssignmentsEditor from './ProjectAssignmentsEditor';
import ProjectLessonMapper from './ProjectLessonMapper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type AssignTab = 'lessons' | 'projects';
type ProjectView = 'list' | 'assignments' | 'lesson_mapper';

type Project = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
};

interface Course { id: string; name: string; }

export default function Asignaciones({
  courses,
  initialCourseId,
}: {
  courses: Course[];
  initialCourseId?: string;
}) {
  const [tab, setTab] = useState<AssignTab>('lessons');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectView, setProjectView] = useState<ProjectView>('list');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  useEffect(() => {
    if (tab === 'projects' && projects.length === 0) loadProjects();
  }, [tab]);

  async function loadProjects() {
    setLoadingProjects(true);
    const { data } = await sb
      .from('projects')
      .select('id, title, description, is_active')
      .order('created_at', { ascending: false });
    setProjects(data ?? []);
    setLoadingProjects(false);
  }

  function resetToList() {
    setProjectView('list');
    setSelectedProject(null);
    setSelectedCourseId('');
  }

  const TabBar = ({ active }: { active: AssignTab }) => (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      <button
        onClick={() => { setTab('lessons'); resetToList(); }}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
          active === 'lessons'
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <BookOpen className="w-4 h-4" />
        Lecciones
      </button>
      <button
        onClick={() => { setTab('projects'); resetToList(); }}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
          active === 'projects'
            ? 'bg-white text-teal-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <FlaskConical className="w-4 h-4" />
        Proyectos
      </button>
    </div>
  );

  if (tab === 'projects' && selectedProject) {
    if (projectView === 'lesson_mapper') {
      return (
        <div className="space-y-4">
          <TabBar active="projects" />
          <ProjectLessonMapper
            project={selectedProject}
            courseId={selectedCourseId}
            onBack={() => setProjectView('assignments')}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <TabBar active="projects" />
        <ProjectAssignmentsEditor
          project={selectedProject}
          courses={courses}
          onMapLessons={(courseId) => {
            setSelectedCourseId(courseId);
            setProjectView('lesson_mapper');
          }}
          onBack={resetToList}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TabBar active={tab} />

      {tab === 'lessons' ? (
        <LessonAssignment courses={courses} initialCourseId={initialCourseId} />
      ) : (
        <div>
          {loadingProjects ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay proyectos creados.</p>
              <p className="text-xs mt-1">Crea proyectos en Studio → Proyectos.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-3">
                Selecciona un proyecto para gestionar sus asignaciones a cursos.
              </p>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProject(p);
                    setProjectView('assignments');
                  }}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-sm transition flex items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{p.title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          p.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
