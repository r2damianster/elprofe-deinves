import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from '../../contexts/AuthContext';
import { Plus, ArrowLeft, FolderOpen, Trash2 } from 'lucide-react';
import ProjectObjectTypesEditor from './ProjectObjectTypesEditor';
import ProjectLessonMapper from './ProjectLessonMapper';
import ProjectReviewer from './ProjectReviewer';
import ProjectAssignmentsEditor from './ProjectAssignmentsEditor';

type Project = {
  id: string;
  title: string;
  description: string | null;
  professor_id: string;
  object_logic: 'ordinal' | 'causal' | 'structural';
  is_active: boolean;
  created_at: string;
};

const LOGIC_LABELS = {
  ordinal: 'Ordinal',
  causal: 'Causal',
  structural: 'Estructural',
};
const LOGIC_DESC = {
  ordinal: 'Los objetos siguen un orden secuencial fijo.',
  causal: 'Cada objeto origina o motiva al siguiente.',
  structural: 'Algunos objetos forman parte de otros.',
};

const BLANK_FORM = {
  title: '',
  description: '',
  object_logic: 'ordinal' as Project['object_logic'],
};

type View =
  | { type: 'list' }
  | { type: 'object_types'; project: Project }
  | { type: 'assignments'; project: Project }
  | { type: 'lesson_mapper'; project: Project; courseId: string }
  | { type: 'reviewer'; project: Project };

type Course = { id: string; name: string };

export default function ProjectManager({
  courses = [],
  onBack,
}: {
  courses?: Course[];
  onBack: () => void;
}) {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ type: 'list' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await sb
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setProjects(data ?? []);
    setLoading(false);
  }

  async function createProject() {
    if (!form.title.trim()) { setError('El título es obligatorio.'); return; }
    setSaving(true);
    setError(null);
    const { error } = await sb.from('projects').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      object_logic: form.object_logic,
      professor_id: profile!.id,
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setShowForm(false);
    setForm(BLANK_FORM);
    await load();
    setSaving(false);
  }

  async function toggleActive(id: string, current: boolean) {
    await sb.from('projects').update({ is_active: !current }).eq('id', id);
    await load();
  }

  async function deleteProject(id: string, title: string) {
    if (!confirm(`¿Eliminar el proyecto "${title}"? Esta acción no se puede deshacer.`)) return;
    await sb.from('projects').delete().eq('id', id);
    await load();
  }

  if (view.type === 'object_types') {
    return (
      <ProjectObjectTypesEditor
        project={view.project}
        onBack={() => setView({ type: 'list' })}
      />
    );
  }
  if (view.type === 'assignments') {
    return (
      <ProjectAssignmentsEditor
        project={view.project}
        courses={courses}
        onMapLessons={(courseId) => setView({ type: 'lesson_mapper', project: view.project, courseId })}
        onBack={() => setView({ type: 'list' })}
      />
    );
  }
  if (view.type === 'lesson_mapper') {
    return (
      <ProjectLessonMapper
        project={view.project}
        courseId={view.courseId}
        onBack={() => setView({ type: 'assignments', project: view.project })}
      />
    );
  }
  if (view.type === 'reviewer') {
    return (
      <ProjectReviewer
        projectId={view.project.id}
        onBack={() => setView({ type: 'list' })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-gray-800">Proyectos</h3>
        <button
          onClick={() => { setShowForm(true); setError(null); setForm(BLANK_FORM); }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" /> Nuevo proyecto
        </button>
      </div>

      {/* Error global visible siempre */}
      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-gray-700 text-sm">Nuevo proyecto</h4>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Proyecto integrador del semestre"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Lógica de los objetos</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ordinal', 'causal', 'structural'] as const).map(logic => (
                <label
                  key={logic}
                  className={`cursor-pointer border rounded-xl p-3 flex flex-col gap-1 transition ${
                    form.object_logic === logic
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="logic"
                    value={logic}
                    checked={form.object_logic === logic}
                    onChange={() => setForm(f => ({ ...f, object_logic: logic }))}
                    className="sr-only"
                  />
                  <span className="font-semibold text-sm text-gray-800">{LOGIC_LABELS[logic]}</span>
                  <span className="text-xs text-gray-500">{LOGIC_DESC[logic]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
            <button
              onClick={createProject}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Creando...' : 'Crear proyecto'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Cargando...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No tienes proyectos creados.</p>
          <p className="text-xs mt-1">Crea el primero con el botón de arriba.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-800">{p.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {LOGIC_LABELS[p.object_logic]}
                    </span>
                  </div>
                  {p.description && <p className="text-sm text-gray-500 mt-1">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(p.id, p.is_active)}
                  className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                >
                  {p.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => deleteProject(p.id, p.title)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="Eliminar proyecto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                </div>
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  onClick={() => setView({ type: 'object_types', project: p })}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                >
                  Editar objetos
                </button>
                <button
                  onClick={() => setView({ type: 'assignments', project: p })}
                  className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
                >
                  Asignar a cursos
                </button>
                <button
                  onClick={() => setView({ type: 'reviewer', project: p })}
                  className="px-3 py-1.5 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition"
                >
                  Revisar objetos
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
