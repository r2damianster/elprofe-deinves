import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Loader2, Plus, BookOpen, AlertCircle, X, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { resolveField } from '../../../lib/i18n';

interface Lesson {
  id: string;
  title: any;
  content: any[];
  has_production: boolean;
  order_index: number;
}

interface Activity {
  id: string;
  title: string;
  type: string;
  topic?: string;
  level?: string;
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
          .select('id, title, type, topic, level')
          .eq('created_by', profile?.id)
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
    
    // Optimistic UI update
    const newStep = { type: 'activity', activity_id: activity.id, _activity_title: activity.title };
    const updatedContent = [...(selectedLesson.content || []), newStep];
    const updatedLesson = { ...selectedLesson, content: updatedContent };
    
    setSelectedLesson(updatedLesson);
    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
    
    await saveContent(updatedLesson);
  };

  const handleRemoveActivityStep = async (stepIndex: number) => {
    if (!selectedLesson) return;
    
    const updatedContent = [...(selectedLesson.content || [])];
    updatedContent.splice(stepIndex, 1);
    
    const updatedLesson = { ...selectedLesson, content: updatedContent };
    
    setSelectedLesson(updatedLesson);
    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
    
    await saveContent(updatedLesson);
  };

  const handleMoveStep = async (stepIndex: number, direction: 'up' | 'down') => {
    if (!selectedLesson) return;
    
    const updatedContent = [...(selectedLesson.content || [])];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= updatedContent.length) return;
    
    [updatedContent[stepIndex], updatedContent[targetIndex]] = [updatedContent[targetIndex], updatedContent[stepIndex]];
    
    const updatedLesson = { ...selectedLesson, content: updatedContent };
    
    setSelectedLesson(updatedLesson);
    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
    
    await saveContent(updatedLesson);
  };

  const saveContent = async (lesson: Lesson) => {
    setSaving(true);
    setSuccessMsg('');
    setError('');
    try {
      const cleanSteps = (lesson.content || []).map((s: any) => {
        const { _activity_title, ...rest } = s;
        return rest;
      });

      const { error: updateErr } = await supabase
        .from('lessons')
        .update({ content: cleanSteps })
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
              const activityCount = (lesson.content || []).filter(s => s.type === 'activity').length;
              
              return (
                <div 
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex items-start gap-3
                    ${isSelected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:border-blue-200'}`}
                >
                  <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-sm font-bold
                    ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {lesson.order_index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                      {resolveField(lesson.title, 'es')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {lesson.content?.length || 0} pasos • {activityCount} actividades
                    </p>
                  </div>
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

                  {!(selectedLesson.content?.length > 0) ? (
                    <div className="text-center py-12 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                      La lección está vacía.<br/>Agrega actividades desde la derecha.
                    </div>
                  ) : (
                    selectedLesson.content.map((step, idx) => {
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
                              {isActivity ? getActivityTitle(step) : (step.caption?.es || step.content?.es || 'Paso multimedia')}
                            </p>
                          </div>
                          
                          <div className="flex flex-col items-center gap-1 border-l border-gray-100 pl-3">
                            <div className="flex gap-1">
                              <button onClick={() => handleMoveStep(idx, 'up')} disabled={idx === 0 || saving} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-30">
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleMoveStep(idx, 'down')} disabled={idx === selectedLesson.content.length - 1 || saving} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-30">
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
              <div className="w-[350px] flex flex-col bg-white">
                <div className="p-3 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wide flex justify-between items-center">
                  <span>Banco de Actividades</span>
                  <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{activities.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {activities.length === 0 ? (
                     <p className="text-sm text-gray-400 text-center py-8">No tienes actividades creadas.</p>
                  ) : (
                    activities.map(act => (
                      <div key={act.id} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition group">
                        <p className="font-medium text-sm text-gray-800 line-clamp-2">{act.title}</p>
                        <div className="flex items-center justify-between mt-2">
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
                    ))
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
