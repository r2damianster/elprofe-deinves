import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Search, Plus, Edit2, Trash2, Loader2, Filter, BookOpen, AlertCircle } from 'lucide-react';
import ActivityEditor from './ActivityEditor';
import type { ActivityType } from '../../../lib/database.types';
import { resolveField } from '../../../lib/i18n';

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  content: any;
  points: number;
  media_url: string | null;
  created_by: string | null;
  created_at: string;
}

interface Props {
  /** Si se pasa, muestra un botón "Agregar a lección" en vez de editar */
  onSelectForLesson?: (activity: Activity) => void;
  /** IDs ya vinculados (para deshabilitar el botón) */
  linkedIds?: Set<string>;
}

const TYPE_LABELS: Record<ActivityType, string> = {
  multiple_choice:  'Opción múltiple',
  true_false:       'V / F',
  fill_blank:       'Completar',
  short_answer:     'Resp. corta',
  matching:         'Relacionar',
  ordering:         'Ordenar',
  drag_drop:        'Arrastrar',
  image_question:   'Imagen',
  listening:        'Escucha',
  essay:            'Ensayo',
  long_response:    'Resp. larga',
  structured_essay: 'Ensayo estr.',
  open_writing:     'Escritura',
};

const TYPE_COLORS: Partial<Record<ActivityType, string>> = {
  multiple_choice:  'bg-blue-100 text-blue-700',
  true_false:       'bg-indigo-100 text-indigo-700',
  fill_blank:       'bg-cyan-100 text-cyan-700',
  short_answer:     'bg-teal-100 text-teal-700',
  matching:         'bg-green-100 text-green-700',
  ordering:         'bg-lime-100 text-lime-700',
  drag_drop:        'bg-yellow-100 text-yellow-700',
  image_question:   'bg-orange-100 text-orange-700',
  listening:        'bg-amber-100 text-amber-700',
  essay:            'bg-rose-100 text-rose-700',
  long_response:    'bg-pink-100 text-pink-700',
  structured_essay: 'bg-fuchsia-100 text-fuchsia-700',
  open_writing:     'bg-purple-100 text-purple-700',
};

export default function ActivityBank({ onSelectForLesson, linkedIds }: Props) {
  const { profile } = useAuth();
  const [activities, setActivities]     = useState<Activity[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterType, setFilterType]     = useState<ActivityType | ''>('');
  const [filterOwn, setFilterOwn]       = useState(false);
  const [editingActivity, setEditing]   = useState<Activity | null | undefined>(undefined);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [deleteError, setDeleteError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setActivities(data as Activity[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = activities.filter(a => {
    if (filterType && a.type !== filterType) return false;
    if (filterOwn && a.created_by !== profile?.id) return false;
    if (search && !resolveField(a.title, 'es').toLowerCase().includes(search.toLowerCase()) &&
        !resolveField(a.title, 'en').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError('');
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) {
      setDeleteError(error.message.includes('foreign') || error.message.includes('responses')
        ? 'No se puede eliminar: hay respuestas de estudiantes asociadas.'
        : error.message);
    } else {
      setActivities(prev => prev.filter(a => a.id !== id));
    }
    setDeletingId(null);
  }

  function handleSaved(saved: Activity): void {
    setActivities(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
    setEditing(undefined);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as ActivityType | '')}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filterOwn}
              onChange={e => setFilterOwn(e.target.checked)}
              className="accent-blue-600"
            />
            Solo mis actividades
          </label>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} actividad{filtered.length !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {deleteError}
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando actividades...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay actividades{search || filterType ? ' con ese filtro' : ''}.</p>
            <button onClick={() => setEditing(null)} className="mt-3 text-sm text-blue-600 hover:underline">Crear la primera</button>
          </div>
        ) : (
          filtered.map(activity => {
            const isLinked = linkedIds?.has(activity.id);
            const isOwn    = activity.created_by === profile?.id;
            const color    = TYPE_COLORS[activity.type] ?? 'bg-gray-100 text-gray-600';

            return (
              <div
                key={activity.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                  isLinked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-blue-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
                      {TYPE_LABELS[activity.type]}
                    </span>
                    <span className="text-xs text-gray-400">{activity.points} pt{activity.points !== 1 ? 's' : ''}</span>
                    {isOwn && <span className="text-xs text-blue-500">✎ mía</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{resolveField(activity.title, 'es')}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {onSelectForLesson ? (
                    <button
                      onClick={() => !isLinked && onSelectForLesson(activity)}
                      disabled={isLinked}
                      className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                        isLinked
                          ? 'bg-green-100 text-green-600 cursor-default'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isLinked ? '✓ Agregada' : '+ Agregar'}
                    </button>
                  ) : (
                    <>
                      {isOwn && (
                        <>
                          <button
                            onClick={() => setEditing(activity)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(activity.id)}
                            disabled={deletingId === activity.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Eliminar"
                          >
                            {deletingId === activity.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal editor */}
      {editingActivity !== undefined && (
        <ActivityEditor
          activity={editingActivity as any}
          onSave={handleSaved as any}
          onCancel={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
