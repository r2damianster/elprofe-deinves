import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash2, Loader2, FolderOpen } from 'lucide-react';

type AssignedProject = {
  assignment_id: string;
  project_id: string;
  title: string;
  object_logic: string;
  is_active: boolean;
  available_from: string | null;
  available_until: string | null;
};

type AvailableProject = {
  id: string;
  title: string;
  object_logic: string;
};

export default function CourseProjectsManager({ courseId }: { courseId: string }) {
  const { profile } = useAuth();
  const [assigned, setAssigned] = useState<AssignedProject[]>([]);
  const [available, setAvailable] = useState<AvailableProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, [courseId]);

  async function load() {
    setLoading(true);
    setError(null);

    const [assignmentsRes, projectsRes] = await Promise.all([
      sb
        .from('project_assignments')
        .select('id, project_id, projects(id, title, object_logic, is_active)')
        .eq('course_id', courseId)
        .is('student_id', null),
      sb
        .from('projects')
        .select('id, title, object_logic')
        .eq('professor_id', profile?.id)
        .order('title'),
    ]);

    if (assignmentsRes.error) { setError(assignmentsRes.error.message); setLoading(false); return; }
    if (projectsRes.error)    { setError(projectsRes.error.message);    setLoading(false); return; }

    const assignedList: AssignedProject[] = (assignmentsRes.data ?? []).map((a: any) => ({
      assignment_id: a.id,
      project_id: a.project_id,
      title: a.projects?.title ?? '—',
      object_logic: a.projects?.object_logic ?? '',
      is_active: a.projects?.is_active ?? false,
    }));

    const assignedIds = new Set(assignedList.map(a => a.project_id));
    const availableList: AvailableProject[] = (projectsRes.data ?? []).filter(
      (p: any) => !assignedIds.has(p.id)
    );

    setAssigned(assignedList);
    setAvailable(availableList);
    if (availableList.length > 0) setSelectedId(availableList[0].id);
    setLoading(false);
  }

  async function assign() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    const { error } = await sb.from('project_assignments').insert({
      project_id: selectedId,
      course_id: courseId,
      student_id: null,
      professor_id: profile!.id,
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setAdding(false);
    await load();
    setSaving(false);
  }

  async function unassign(assignmentId: string) {
    await sb.from('project_assignments').delete().eq('id', assignmentId);
    await load();
  }

  const LOGIC_LABELS: Record<string, string> = {
    ordinal: 'Ordinal', causal: 'Causal', structural: 'Estructural',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-purple-600" />
          Proyectos del curso
        </h3>
        {available.length > 0 && (
          <button
            onClick={() => { setAdding(true); setError(null); }}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Añadir proyecto
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {available.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <button
              onClick={assign}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Asignando...' : 'Asignar'}
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && !adding && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      ) : assigned.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <FolderOpen className="w-12 h-12 text-purple-300 mx-auto mb-3" />
          <h4 className="text-gray-700 font-semibold mb-1">Sin proyectos asignados</h4>
          <p className="text-sm text-gray-500 mb-4">
            Asigna un proyecto a este curso para que los estudiantes puedan trabajar en él.
          </p>
          {available.length > 0 && (
            <button
              onClick={() => { setAdding(true); setError(null); }}
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium shadow"
            >
              Añadir mi primer proyecto
            </button>
          )}
          {available.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">Crea un proyecto en la pestaña "Proyectos" primero.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {assigned.map(p => (
            <div key={p.assignment_id} className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl bg-white hover:border-purple-200 transition group">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-gray-800">{p.title}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  {LOGIC_LABELS[p.object_logic] && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {LOGIC_LABELS[p.object_logic]}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => unassign(p.assignment_id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                title="Quitar del curso"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
