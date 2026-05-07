import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from '../../contexts/AuthContext';
import { FolderOpen, ChevronRight } from 'lucide-react';
import ProjectObjectList from './ProjectObjectList';

type Project = {
  id: string;
  title: string;
  description: string | null;
  object_logic: 'ordinal' | 'causal' | 'structural';
  course_name?: string;
  total_objects?: number;
  completed_objects?: number;
};

const LOGIC_LABELS = {
  ordinal: 'Secuencial',
  causal: 'Causal',
  structural: 'Estructural',
};
const LOGIC_COLORS = {
  ordinal: 'bg-blue-100 text-blue-700',
  causal: 'bg-purple-100 text-purple-700',
  structural: 'bg-teal-100 text-teal-700',
};

export default function ProjectDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    if (!user?.id) { setLoading(false); return; }

    const { data: courseIds } = await sb.from('course_students')
      .select('course_id')
      .eq('student_id', user.id);

    if (!courseIds || courseIds.length === 0) { setLoading(false); return; }
    const ids = courseIds.map((c: any) => c.course_id);

    const { data: projData } = await sb.from('projects')
      .select('id, title, description, object_logic, course_id, courses(name)')
      .in('course_id', ids)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!projData) { setLoading(false); return; }

    const projectList = await Promise.all(
      projData.map(async (p: any) => {
        const { data: types } = await sb.from('project_object_types')
          .select('id')
          .eq('project_id', p.id);
        const typeIds = (types ?? []).map((t: any) => t.id);

        let completed = 0;
        if (typeIds.length > 0) {
          const { data: objs } = await sb.from('project_objects')
            .select('status')
            .eq('project_id', p.id)
            .eq('student_id', user.id)
            .in('object_type_id', typeIds);
          completed = (objs ?? []).filter((o: any) => o.status === 'submitted' || o.status === 'approved').length;
        }

        return {
          id: p.id,
          title: p.title,
          description: p.description,
          object_logic: p.object_logic,
          course_name: p.courses?.name,
          total_objects: typeIds.length,
          completed_objects: completed,
        } as Project;
      })
    );

    setProjects(projectList);
    setLoading(false);
  }

  if (selectedProjectId) {
    return (
      <ProjectObjectList
        projectId={selectedProjectId}
        onBack={() => { setSelectedProjectId(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Cargando proyectos...</div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <FolderOpen className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm font-medium">No tienes proyectos activos</p>
          <p className="text-xs mt-1">Tu profesor te asignará proyectos próximamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => {
            const pct = p.total_objects ? Math.round(((p.completed_objects ?? 0) / p.total_objects) * 100) : 0;
            const allDone = p.total_objects && p.completed_objects === p.total_objects;

            return (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 group-hover:text-indigo-700 transition truncate">
                      {p.title}
                    </h3>
                    {p.course_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{p.course_name}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition flex-shrink-0 mt-0.5" />
                </div>

                {p.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.description}</p>
                )}

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${LOGIC_COLORS[p.object_logic]}`}>
                    {LOGIC_LABELS[p.object_logic]}
                  </span>
                  {allDone && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      Completado
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{p.completed_objects}/{p.total_objects} objetos</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${allDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
