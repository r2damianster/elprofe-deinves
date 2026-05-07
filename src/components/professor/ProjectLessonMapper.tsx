import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

type Project = { id: string; title: string };

type ObjectType = { id: string; name: string; order_index: number };

type Lesson = { id: string; title: any };

type Mapping = {
  id: string;
  lesson_id: string;
  object_type_id: string;
  is_new_object: boolean;
  order_index: number;
  object_name?: string;
};

function resolveTitle(t: any): string {
  if (!t) return '';
  if (typeof t === 'string') {
    try { const p = JSON.parse(t); return p.es ?? p.en ?? t; } catch { return t; }
  }
  return t.es ?? t.en ?? '';
}

export default function ProjectLessonMapper({
  project,
  courseId,
  onBack,
}: {
  project: Project;
  courseId: string;
  onBack: () => void;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [objectTypes, setObjectTypes] = useState<ObjectType[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newObjectTypeId, setNewObjectTypeId] = useState('');
  const [newIsNew, setNewIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, [project.id, courseId]);

  async function load() {
    setLoading(true);

    const [lessonsRes, typesRes] = await Promise.all([
      sb.from('lesson_courses')
        .select('lesson_id, lessons(id, title)')
        .eq('course_id', courseId),
      sb.from('project_object_types')
        .select('id, name, order_index')
        .eq('project_id', project.id)
        .order('order_index'),
    ]);

    const lessonList = (lessonsRes.data ?? [])
      .map((r: any) => r.lessons)
      .filter(Boolean) as Lesson[];
    setLessons(lessonList);

    const types = (typesRes.data ?? []) as ObjectType[];
    setObjectTypes(types);

    const typeMap: Record<string, string> = {};
    types.forEach(t => { typeMap[t.id] = t.name; });

    const typeIds = types.map(t => t.id);
    const mappingsRes = typeIds.length > 0
      ? await sb.from('lesson_project_objects')
          .select('id, lesson_id, object_type_id, is_new_object, order_index')
          .in('object_type_id', typeIds)
      : { data: [] };

    const maps = ((mappingsRes.data ?? []) as Mapping[]).map((m: Mapping) => ({
      ...m,
      object_name: typeMap[m.object_type_id],
    }));
    setMappings(maps);

    setLoading(false);
  }

  function mappingsForLesson(lessonId: string) {
    return mappings
      .filter(m => m.lesson_id === lessonId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  async function addMapping(lessonId: string) {
    if (!newObjectTypeId) { setError('Selecciona un objeto.'); return; }
    setSaving(true);
    setError(null);

    const existing = mappings.filter(m => m.lesson_id === lessonId);
    const { error } = await sb.from('lesson_project_objects').insert({
      lesson_id: lessonId,
      object_type_id: newObjectTypeId,
      is_new_object: newIsNew,
      order_index: existing.length,
    });

    if (error) { setError(error.message); setSaving(false); return; }
    setAddingTo(null);
    setNewObjectTypeId('');
    setNewIsNew(true);
    await load();
    setSaving(false);
  }

  async function removeMapping(id: string) {
    await sb.from('lesson_project_objects').delete().eq('id', id);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-semibold text-gray-800">Mapeo lección → objetos</h3>
          <p className="text-sm text-gray-500">{project.title}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-4 text-center">Cargando...</div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed rounded-lg">
          No hay lecciones en este curso.
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map(lesson => {
            const lessonMaps = mappingsForLesson(lesson.id);
            const isAdding = addingTo === lesson.id;

            return (
              <div key={lesson.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="font-medium text-gray-800 text-sm">{resolveTitle(lesson.title)}</span>
                  <button
                    onClick={() => { setAddingTo(isAdding ? null : lesson.id); setError(null); setNewObjectTypeId(''); setNewIsNew(true); }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir objeto
                  </button>
                </div>

                <div className="px-4 py-2 space-y-1">
                  {lessonMaps.length === 0 && !isAdding && (
                    <p className="text-xs text-gray-400 py-1">Sin objetos asignados</p>
                  )}
                  {lessonMaps.map(m => (
                    <div key={m.id} className="flex items-center gap-2 py-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${m.is_new_object ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {m.is_new_object ? 'Nuevo' : 'Revisión'}
                      </span>
                      <span className="text-sm text-gray-700 flex-1">{m.object_name}</span>
                      <button onClick={() => removeMapping(m.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {isAdding && (
                    <div className="pt-2 pb-1 space-y-2 border-t border-gray-100 mt-1">
                      {error && <p className="text-xs text-red-500">{error}</p>}
                      <select
                        value={newObjectTypeId}
                        onChange={e => setNewObjectTypeId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar objeto...</option>
                        {objectTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newIsNew}
                          onChange={e => setNewIsNew(e.target.checked)}
                          className="rounded"
                        />
                        Es un objeto nuevo en esta lección
                        <span className="text-xs text-gray-400">(desmarcar si es revisión de uno anterior)</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => addMapping(lesson.id)}
                          disabled={saving}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={() => setAddingTo(null)} className="text-xs text-gray-500">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
