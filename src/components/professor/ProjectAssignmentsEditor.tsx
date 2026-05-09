import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Plus, Trash2, BookOpen, Loader2, FolderOpen } from 'lucide-react';

type Assignment = {
  id: string;
  course_id: string;
  student_id: string | null;
  assigned_at: string | null;
  available_from: string | null;
  available_until: string | null;
  order_index: number;
};

type Course = { id: string; name: string };

export default function ProjectAssignmentsEditor({
  project,
  courses,
  onMapLessons,
  onBack,
}: {
  project: { id: string; title: string };
  courses: Course[];
  onMapLessons: (courseId: string) => void;
  onBack: () => void;
}) {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, [project.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('project_assignments')
      .select('*')
      .eq('project_id', project.id)
      .is('student_id', null)
      .order('assigned_at', { ascending: false });
    setAssignments(data ?? []);
    setLoading(false);
  }

  const assignedCourseIds = new Set(assignments.map(a => a.course_id));
  const available = courses.filter(c => !assignedCourseIds.has(c.id));

  async function assign() {
    if (!selectedCourseId) return;
    setSaving(true);
    setError(null);
    const { error } = await sb.from('project_assignments').insert({
      project_id: project.id,
      course_id: selectedCourseId,
      student_id: null,
      professor_id: profile!.id,
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setAdding(false);
    setSelectedCourseId('');
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    await sb.from('project_assignments').delete().eq('id', id);
    await load();
  }

  const getCourse = (id: string) => courses.find(c => c.id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-semibold text-gray-800">Asignaciones de curso</h3>
          <p className="text-xs text-gray-500">{project.title}</p>
        </div>
        {available.length > 0 && (
          <button
            onClick={() => { setAdding(true); setSelectedCourseId(available[0].id); setError(null); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> Asignar a curso
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {available.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={assign}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Asignando...' : 'Asignar'}
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Este proyecto no está asignado a ningún curso.</p>
          <p className="text-xs mt-1">Usa el botón de arriba para asignarlo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => {
            const course = getCourse(a.course_id);
            return (
              <div key={a.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">{course?.name ?? a.course_id}</p>
                  <p className="text-xs text-gray-400">
                    Todo el curso · {new Date(a.assigned_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => onMapLessons(a.course_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Mapear lecciones
                </button>
                <button
                  onClick={() => remove(a.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="Desasignar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
