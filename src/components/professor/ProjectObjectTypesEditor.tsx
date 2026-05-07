import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { Plus, Trash2, ChevronUp, ChevronDown, ArrowLeft } from 'lucide-react';

type Project = {
  id: string;
  title: string;
  object_logic: 'ordinal' | 'causal' | 'structural';
};

type ObjectType = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  order_index: number;
  parent_object_type_id: string | null;
  edit_policy: 'always' | 'requires_approval' | 'locked_after_submit';
  min_words: number;
  max_words: number | null;
  required_words: string[];
};

const EDIT_POLICY_LABELS = {
  always: 'Siempre editable',
  requires_approval: 'Requiere autorización del profesor',
  locked_after_submit: 'Bloqueado tras enviar',
};

const BLANK_FORM = {
  name: '',
  description: '',
  instructions: '',
  edit_policy: 'always' as ObjectType['edit_policy'],
  min_words: 0,
  max_words: '' as string | number,
  required_words_raw: '',
  parent_object_type_id: '' as string,
};

export default function ProjectObjectTypesEditor({
  project,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  const [types, setTypes] = useState<ObjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { load(); }, [project.id]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_object_types')
      .select('*')
      .eq('project_id', project.id)
      .order('order_index');
    if (!error) setTypes(data ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setShowForm(true);
    setError(null);
  }

  function openEdit(t: ObjectType) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? '',
      instructions: t.instructions ?? '',
      edit_policy: t.edit_policy,
      min_words: t.min_words,
      max_words: t.max_words ?? '',
      required_words_raw: t.required_words.join(', '),
      parent_object_type_id: t.parent_object_type_id ?? '',
    });
    setShowForm(true);
    setError(null);
  }

  async function save() {
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      project_id: project.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      edit_policy: form.edit_policy,
      min_words: Number(form.min_words) || 0,
      max_words: form.max_words !== '' ? Number(form.max_words) : null,
      required_words: form.required_words_raw
        .split(',')
        .map(w => w.trim())
        .filter(Boolean),
      parent_object_type_id: form.parent_object_type_id || null,
      order_index: editingId
        ? types.find(t => t.id === editingId)?.order_index ?? types.length
        : types.length,
    };

    const { error } = editingId
      ? await sb.from('project_object_types').update(payload).eq('id', editingId)
      : await sb.from('project_object_types').insert(payload);

    if (error) { setError(error.message); setSaving(false); return; }
    setShowForm(false);
    await load();
    setSaving(false);
  }

  async function move(id: string, direction: 'up' | 'down') {
    const idx = types.findIndex(t => t.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= types.length) return;

    const a = types[idx];
    const b = types[swapIdx];
    await Promise.all([
      sb.from('project_object_types').update({ order_index: b.order_index }).eq('id', a.id),
      sb.from('project_object_types').update({ order_index: a.order_index }).eq('id', b.id),
    ]);
    await load();
  }

  async function remove(id: string) {
    await sb.from('project_object_types').delete().eq('id', id);
    setConfirmDelete(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-semibold text-gray-800">Objetos del proyecto</h3>
          <p className="text-sm text-gray-500">{project.title}</p>
        </div>
        <button
          onClick={openNew}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" /> Añadir objeto
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-4 text-center">Cargando...</div>
      ) : types.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed rounded-lg">
          No hay objetos definidos. Añade el primero.
        </div>
      ) : (
        <div className="space-y-2">
          {types.map((t, i) => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(t.id, 'up')} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-20">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => move(t.id, 'down')} disabled={i === types.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-20">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-5">{i + 1}.</span>
                  <span className="font-medium text-gray-800 text-sm">{t.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    t.edit_policy === 'always' ? 'bg-green-100 text-green-700' :
                    t.edit_policy === 'requires_approval' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {EDIT_POLICY_LABELS[t.edit_policy]}
                  </span>
                </div>
                {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  {t.min_words > 0 && <span>Mín. {t.min_words} palabras</span>}
                  {t.max_words && <span>Máx. {t.max_words}</span>}
                  {t.required_words.length > 0 && <span>Palabras clave: {t.required_words.join(', ')}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(t)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">Editar</button>
                {confirmDelete === t.id ? (
                  <>
                    <button onClick={() => remove(t.id)} className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50">Confirmar</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 px-2 py-1">Cancelar</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(t.id)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario inline */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-gray-700 text-sm">
            {editingId ? 'Editar objeto' : 'Nuevo objeto'}
          </h4>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Planteamiento del problema"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Política de edición</label>
              <select
                value={form.edit_policy}
                onChange={e => setForm(f => ({ ...f, edit_policy: e.target.value as ObjectType['edit_policy'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="always">Siempre editable</option>
                <option value="requires_approval">Requiere autorización</option>
                <option value="locked_after_submit">Bloqueado tras enviar</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Breve descripción del objeto"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Instrucciones para el estudiante</label>
            <textarea
              value={form.instructions}
              onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="¿Qué debe hacer el estudiante en este objeto?"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Palabras mínimas</label>
              <input
                type="number" min={0}
                value={form.min_words}
                onChange={e => setForm(f => ({ ...f, min_words: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Palabras máximas</label>
              <input
                type="number" min={0}
                value={form.max_words}
                onChange={e => setForm(f => ({ ...f, max_words: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Sin límite"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Palabras requeridas</label>
              <input
                value={form.required_words_raw}
                onChange={e => setForm(f => ({ ...f, required_words_raw: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ej: hipótesis, variable"
              />
            </div>
          </div>

          {project.object_logic === 'structural' && types.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Objeto padre (para lógica estructural)</label>
              <select
                value={form.parent_object_type_id}
                onChange={e => setForm(f => ({ ...f, parent_object_type_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin padre (nivel raíz)</option>
                {types.filter(t => t.id !== editingId).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
