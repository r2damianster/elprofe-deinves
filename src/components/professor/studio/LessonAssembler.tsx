import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Loader2, Plus, BookOpen, AlertCircle, X, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { resolveField } from '../../../lib/i18n';

interface Lesson {
  id: string;
  title: any;
  content: any; // Can be array or object { steps, tags }
  has_production: boolean;
  order_index: number;
}

interface Activity {
  id: string;
  title: any;
  type: string;
  topic?: string;
  level?: string;
  content?: any;
}

export default function LessonAssembler() {
  const { profile } = useAuth();
  
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'recommended'>('all');

  const getLessonSteps = (lesson: Lesson | null) => {
    if (!lesson?.content) return [];
    return Array.isArray(lesson.content) ? lesson.content : (lesson.content.steps || []);
  };
  
  const getLessonTags = (lesson: Lesson | null) => {
    if (!lesson?.content || Array.isArray(lesson.content)) return [];
    return lesson.content.tags || [];
  };
  
  const getActivityTags = (act: Activity) => {
    return (act.content?.es?.tags || act.content?.tags || []) as string[];
  };

  const filteredActivities = activities.filter(act => {
    const actTags = getActivityTags(act);
    const titleMatch = (act.title?.es || act.title?.en || '').toLowerCase().includes(searchQuery.toLowerCase());
    const typeMatch = act.type.toLowerCase().includes(searchQuery.toLowerCase());
    const tagMatch = actTags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSearch = !searchQuery || titleMatch || typeMatch || tagMatch;
    
    if (filterMode === 'recommended' && selectedLesson) {
      const lTags = getLessonTags(selectedLesson);
      const isRecommended = lTags.some(t => actTags.includes(t));
      return matchesSearch && isRecommended;
    }
    
    return matchesSearch;
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      
      try {
        const { data: lessonsData, error: lessonsErr } = await supabase
          .from('lessons')
          .select('id, title, content, has_production, order_index')
          .eq('created_by', profile?.id)
          .order('order_index', { ascending: true });
          
        if (lessonsErr) throw lessonsErr;
        setLessons(lessonsData as Lesson[]);

        const { data: activitiesData, error: activitiesErr } = await supabase
          .from('activities')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (activitiesErr) throw activitiesErr;
        setActivities(activitiesData as Activity[]);
        
      } catch (err: any) {
        setError(err.message || 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    }
    
    if (profile?.id) loadData();
  }, [profile?.id]);

  const handleAddActivity = async (activity: Activity) => {
    if (!selectedLesson) return;
    
    const steps = getLessonSteps(selectedLesson);
    const newStep = { type: 'activity', activity_id: activity.id, _activity_title: activity.title };
    const updatedSteps = [...steps, newStep];
    
    const baseContent = Array.isArray(selectedLesson.content) ? { steps: [], tags: [] } : (selectedLesson.content || { steps: [], tags: [] });
    const updatedLesson = { ...selectedLesson, content: { ...baseContent, steps: updatedSteps } };
    
    setSelectedLesson(updatedLesson);
    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
    
    await saveContent(updatedLesson);
  };

  const handleRemoveActivityStep = async (stepIndex: number) => {
    if (!selectedLesson) return;
    
    const steps = getLessonSteps(selectedLesson);
    const updatedSteps = [...steps];
    updatedSteps.splice(stepIndex, 1);
    
    const baseContent = Array.isArray(selectedLesson.content) ? { steps: [], tags: [] } : (selectedLesson.content || { steps: [], tags: [] });
    const updatedLesson = { ...selectedLesson, content: { ...baseContent, steps: updatedSteps } };
    
    setSelectedLesson(updatedLesson);
    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
    
    await saveContent(updatedLesson);
  };

  const handleMoveStep = async (stepIndex: number, direction: 'up' | 'down') => {
    if (!selectedLesson) return;
    
    const steps = getLessonSteps(selectedLesson);
    const updatedSteps = [...steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= updatedSteps.length) return;
    
    [updatedSteps[stepIndex], updatedSteps[targetIndex]] = [updatedSteps[targetIndex], updatedSteps[stepIndex]];
    
    const baseContent = Array.isArray(selectedLesson.content) ? { steps: [], tags: [] } : (selectedLesson.content || { steps: [], tags: [] });
    const updatedLesson = { ...selectedLesson, content: { ...baseContent, steps: updatedSteps } };
    
    setSelectedLesson(updatedLesson);
    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
    
    await saveContent(updatedLesson);
  };

  const saveContent = async (lesson: Lesson) => {
    setSaving(true);
    setSuccessMsg('');
    setError('');
    try {
      const steps = getLessonSteps(lesson);
      const cleanSteps = steps.map((s: any) => {
        const { _activity_title, ...rest } = s;
        return rest;
      });

      const dbContent = Array.isArray(lesson.content) 
        ? cleanSteps 
        : { ...lesson.content, steps: cleanSteps };

      const { error: updateErr } = await supabase
        .from('lessons')
        .update({ content: dbContent })
        .eq('id', lesson.id);
        
      if (updateErr) throw updateErr;

      const activitySteps = cleanSteps.filter(s => s.type === 'activity' && s.activity_id);
      await supabase.from('lesson_activities').delete().eq('lesson_id', lesson.id);
      
      if (activitySteps.length > 0) {
        await supabase.from('lesson_activities').insert(
          activitySteps.map((s, idx) => ({ 
            lesson_id: lesson.id, 
            activity_id: s.activity_id!, 
            order_index: idx 
          }))
        );
      }
      
      setSuccessMsg('Guardado guardado automáticamente');
      setTimeout(() => setSuccessMsg(''), 3000);
      
    } catch (err: any) {
      setError(err.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const getActivityTitle = (step: any) => {
    if (step._activity_title) return step._activity_title;
    if (step.activity_id) {
      const found = activities.find(a => a.id === step.activity_id);
      if (found) return found.title;
    }
    return 'Actividad desconocida';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-250px)] min-h-[600px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      
      {/* LEFT PANEL: LESSON LIST */}
      <div className="w-1/3 min-w-[300px] border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="font-bold text-gray-800">1. Selecciona una Lección</h3>
          <p className="text-xs text-gray-500 mt-1">Elige la lección a la que deseas asignar actividades.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lessons.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No has creado lecciones aún.</p>
          ) : (
            lessons.map(lesson => {
              const isSelected = selectedLesson?.id === lesson.id;
              const steps = getLessonSteps(lesson);
              const activityCount = steps.filter(s => s.type === 'activity').length;
              const tags = getLessonTags(lesson);
              
              return (
                <div 
                  key={lesson.id}
                  onClick={() => { setSelectedLesson(lesson); setFilterMode('all'); setSearchQuery(''); }}
                  className={`p-3 rounded-lg border cursor-pointer transition flex flex-col gap-2
                    ${isSelected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:border-blue-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-sm font-bold
                      ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {lesson.order_index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                        {resolveField(lesson.title, 'es')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {steps.length} pasos • {activityCount} actividades
                      </p>
                    </div>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 pl-11">
                      {tags.slice(0, 3).map(tag => (
                         <span key={tag} className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded drop-shadow-sm">{tag}</span>
                      ))}
                      {tags.length > 3 && <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">+{tags.length - 3}</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: ASSIGNMENT INTERFACE */}
      <div className="flex-1 flex flex-col bg-white">
        {!selectedLesson ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
            <BookOpen className="w-16 h-16 mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Ninguna lección seleccionada</h3>
            <p className="text-sm max-w-sm">Selecciona una lección del panel izquierdo para ver su contenido y asignarle actividades del banco.</p>
          </div>
        ) : (
          <>
            {/* Header Selected Lesson */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{resolveField(selectedLesson.title, 'es')}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  <span>Paso a paso de la lección</span>
                  {saving && <span className="flex items-center gap-1 text-blue-600 text-xs"><Loader2 className="w-3 h-3 animate-spin"/> Guardando...</span>}
                  {successMsg && <span className="flex items-center gap-1 text-green-600 text-xs"><Check className="w-3 h-3"/> {successMsg}</span>}
                </div>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Middle: Current content in lesson */}
              <div className="flex-1 border-r border-gray-200 flex flex-col bg-gray-50/50">
                <div className="p-3 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Contenido de la Lección
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                       <AlertCircle className="w-4 h-4"/> {error}
                    </div>
                  )}

                  {getLessonSteps(selectedLesson).length === 0 ? (
                    <div className="text-center py-12 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                      La lección está vacía.<br/>Agrega actividades desde la derecha.
                    </div>
                  ) : (
                    getLessonSteps(selectedLesson).map((step, idx) => {
                      const isActivity = step.type === 'activity';
                      
                      return (
                        <div key={`${step.type}-${idx}`} className={`flex items-center p-3 rounded-xl border bg-white shadow-sm
                          ${isActivity ? 'border-blue-200 border-l-4 border-l-blue-500' : 'border-gray-200'}`}>
                          
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                Paso {idx + 1}
                              </span>
                              <span className="text-xs uppercase font-bold text-gray-400">
                                {isActivity ? 'Actividad' : step.type}
                              </span>
                            </div>
                            
                            <p className={`font-medium truncate ${isActivity ? 'text-blue-900' : 'text-gray-700'}`}>
                              {isActivity ? resolveField(getActivityTitle(step), 'es') : (step.caption?.es || step.content?.es || 'Paso multimedia')}
                            </p>
                          </div>
                          
                          <div className="flex flex-col items-center gap-1 border-l border-gray-100 pl-3">
                            <div className="flex gap-1">
                              <button onClick={() => handleMoveStep(idx, 'up')} disabled={idx === 0 || saving} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-30">
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleMoveStep(idx, 'down')} disabled={idx === getLessonSteps(selectedLesson).length - 1 || saving} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-30">
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            {isActivity && (
                              <button 
                                onClick={() => handleRemoveActivityStep(idx)}
                                disabled={saving}
                                className="text-xs text-red-500 hover:underline disabled:opacity-50 mt-1"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {selectedLesson.has_production && (
                    <div className="flex items-center p-3 rounded-xl border border-purple-200 border-l-4 border-l-purple-500 bg-white shadow-sm opacity-80">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Final</span>
                          <span className="text-xs uppercase font-bold text-purple-500">Producción</span>
                        </div>
                        <p className="font-medium text-purple-900">Actividad de Producción Libre</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Activity Bank */}
              <div className="w-[380px] flex flex-col bg-white">
                <div className="p-3 bg-gray-100 border-b border-gray-200 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <span>Banco de Actividades</span>
                    <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{filteredActivities.length}</span>
                  </div>
                  <input
                    type="search"
                    placeholder="Buscar por título, tipo, código o tag..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full text-sm px-3 py-1.5 rounded-md border border-gray-300 focus:outline-none focus:border-blue-400"
                  />
                  <div className="flex bg-gray-200/50 p-1 rounded-lg">
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`flex-1 text-xs py-1 rounded-md font-medium transition ${filterMode === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Todas
                    </button>
                    <button
                      onClick={() => setFilterMode('recommended')}
                      disabled={getLessonTags(selectedLesson).length === 0}
                      className={`flex-1 text-xs py-1 rounded-md font-medium transition disabled:opacity-30 ${filterMode === 'recommended' ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Recomendadas
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {filteredActivities.length === 0 ? (
                     <p className="text-sm text-gray-400 text-center py-8">No hay coincidencias.</p>
                  ) : (
                    filteredActivities.map(act => {
                      const tags = getActivityTags(act);
                      return (
                        <div key={act.id} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition group flex flex-col gap-2">
                          <p className="font-medium text-sm text-gray-800 line-clamp-2">{resolveField(act.title, 'es')}</p>
                          
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {tags.map(tag => (
                                <button
                                  key={tag}
                                  onClick={() => setSearchQuery(tag)}
                                  className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded cursor-pointer transition border border-blue-200"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              {act.type}
                            </span>
                            <button 
                              onClick={() => handleAddActivity(act)}
                              disabled={saving}
                              className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition disabled:opacity-50"
                            >
                              <Plus className="w-3 h-3" /> Añadir
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              
            </div>
          </>
        )}
      </div>

    </div>
  );
}
