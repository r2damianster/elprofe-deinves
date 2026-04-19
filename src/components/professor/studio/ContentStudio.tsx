import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  BookOpen, Library, Plus, Edit2, Trash2, Loader2,
  Eye, AlertCircle, Search
} from 'lucide-react';
import LessonEditor from './LessonEditor';
import ActivityBank from './ActivityBank';
import LessonAssembler from './LessonAssembler';
import { resolveField } from '../../../lib/i18n';

interface Lesson {
  id: string;
  title: any;
  description: any;
  content: any[];
  has_production: boolean;
  production_unlock_percentage: number;
  order_index: number;
  created_by: string | null;
  created_at: string;
}

type StudioView = 'lessons' | 'activities' | 'assign';

export default function ContentStudio() {
  const { profile } = useAuth();

  const [view, setView]             = useState<StudioView>('lessons');
  const [lessons, setLessons]       = useState<Lesson[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterOwn, setFilterOwn]   = useState(true);
  const [editingLesson, setEditing] = useState<Lesson | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .order('order_index', { ascending: true });
    if (data) setLessons(data as Lesson[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadLessons(); }, [loadLessons]);

  function getLessonTags(l: Lesson): string[] {
    return Array.isArray(l.content) ? [] : ((l.content as any)?.tags || []);
  }

  const filtered = lessons.filter(l => {
    if (filterOwn && l.created_by !== profile?.id) return false;
    if (search) {
      const q = search.toLowerCase();
      const titleMatch = resolveField(l.title, 'es').toLowerCase().includes(q);
      const tagMatch = getLessonTags(l).some((t: string) => t.toLowerCase().includes(q));
      if (!titleMatch && !tagMatch) return false;
    }
    return true;
  });

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError('');
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (error) {
      setDeleteError(
        error.message.includes('student_progress')
          ? 'No se puede eliminar: hay estudiantes con progreso en esta lección.'
          : error.message
      );
    } else {
      setLessons(prev => prev.filter(l => l.id !== id));
    }
    setDeletingId(null);
  }

  function handleSaved(lesson: Lesson) {
    setLessons(prev => {
      const idx = prev.findIndex(l => l.id === lesson.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = lesson;
        return updated.sort((a, b) => a.order_index - b.order_index);
      }
      return [lesson, ...prev].sort((a, b) => a.order_index - b.order_index);
    });
    setEditing(undefined);
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {/* Tabs principales */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
        <button
          onClick={() => setView('lessons')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            view === 'lessons' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Mis Lecciones
        </button>
        <button
          onClick={() => setView('activities')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            view === 'activities' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Library className="w-4 h-4" /> Banco de Actividades
        </button>
        <button
          onClick={() => setView('assign')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            view === 'assign' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Asignar Actividades
        </button>
      </div>

      {/* ── Vista: Lecciones ── */}
      {view === 'lessons' && editingLesson === undefined && (
        <div>
          {/* Toolbar */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por título o etiqueta..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={filterOwn} onChange={e => setFilterOwn(e.target.checked)} className="accent-blue-600" />
              Solo las mías
            </label>
            <button
              onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" /> Nueva lección
            </button>
          </div>

          {deleteError && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {deleteError}
            </div>
          )}

          {/* Lista */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando lecciones...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{filterOwn ? 'Aún no has creado lecciones.' : 'No hay lecciones.'}</p>
              <button onClick={() => setEditing(null)} className="mt-3 text-sm text-blue-600 hover:underline">
                Crear la primera lección
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(lesson => {
                const isOwn = lesson.created_by === profile?.id;
                const stepCount = (lesson.content ?? []).length;
                const activityCount = (lesson.content ?? []).filter((s: any) => s.type === 'activity').length;

                return (
                  <div key={lesson.id}
                    className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-200 transition bg-white group"
                  >
                    {/* Orden */}
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {lesson.order_index}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{resolveField(lesson.title, 'es')}</p>
                      {resolveField(lesson.description, 'es') && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">{resolveField(lesson.description, 'es')}</p>
                      )}
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{stepCount} paso{stepCount !== 1 ? 's' : ''}</span>
                        <span>{activityCount} actividad{activityCount !== 1 ? 'es' : ''}</span>
                        {lesson.has_production && <span className="text-purple-600">+ Producción</span>}
                        {!isOwn && <span className="text-amber-500">📖 compartida</span>}
                      </div>
                      {getLessonTags(lesson).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {getLessonTags(lesson).slice(0, 4).map((tag: string) => (
                            <span key={tag} className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded">{tag}</span>
                          ))}
                          {getLessonTags(lesson).length > 4 && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">+{getLessonTags(lesson).length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isOwn && (
                        <>
                          <button
                            onClick={() => setEditing(lesson)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(lesson.id)}
                            disabled={deletingId === lesson.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar"
                          >
                            {deletingId === lesson.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                      {!isOwn && (
                        <span className="p-2 text-gray-300" title="No eres el autor">
                          <Eye className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Vista: Editor de lección ── */}
      {view === 'lessons' && editingLesson !== undefined && (
        <LessonEditor
          lesson={editingLesson as any}
          onSaved={handleSaved as any}
          onCancel={() => setEditing(undefined)}
        />
      )}

      {/* ── Vista: Banco de actividades ── */}
      {view === 'activities' && (
        <div className="min-h-[500px]">
          <ActivityBank />
        </div>
      )}

      {/* ── Vista: Asignador de lecciones ── */}
      {view === 'assign' && (
        <div className="-mx-2 -mt-2">
          <LessonAssembler />
        </div>
      )}
    </div>
  );
}
