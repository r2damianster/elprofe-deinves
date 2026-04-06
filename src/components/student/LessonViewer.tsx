import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, ArrowRight, CheckCircle, Lock, BookOpen, Video, FileText, Layers, Users, Monitor } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ActivityRenderer from './ActivityRenderer';
import ProductionEditor from './ProductionEditor';
import ContentRenderer from './ContentRenderer';

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  content: { steps?: ContentStep[] } | null;
  has_production: boolean;
  production_unlock_percentage: number;
}

interface GroupInfo {
  groupId: string;
  groupName: string;
  // activityId → nombre del compañero que lo completó
  completedBy: Record<string, string>;
}

interface ContentStep {
  type: 'CONTENT' | 'VIDEO' | 'READING_FOCUS';
  text?: string;
  url?: string;
  pdf_url?: string;
  page?: number;
  task?: string;
  title?: string;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  content: any;
  points: number;
  order_index: number;
}

// Un "paso" unificado puede ser un ContentStep o una Activity (marcada con isActivity)
type CombinedStep =
  | (ContentStep & { isActivity?: false })
  | (Activity & { isActivity: true });

interface LessonViewerProps {
  lessonId: string;
  onBack: () => void;
  previewMode?: boolean; // profesor viendo la lección — sin guardar progreso
}

// ─── Íconos por tipo de paso ─────────────────────────────────────────────────

function stepIcon(step: CombinedStep) {
  if (step.isActivity) return <CheckCircle className="w-4 h-4" />;
  switch ((step as ContentStep).type) {
    case 'VIDEO':         return <Video className="w-4 h-4" />;
    case 'READING_FOCUS': return <FileText className="w-4 h-4" />;
    default:              return <BookOpen className="w-4 h-4" />;
  }
}

// ─── Renderizador de tipos de contenido ──────────────────────────────────────

function ContentStepRenderer({ step }: { step: ContentStep }) {
  switch (step.type) {
    case 'VIDEO':
      return (
        <div className="w-full">
          {step.title && (
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{step.title}</h3>
          )}
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <iframe
              src={step.url}
              className="absolute inset-0 w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );

    case 'READING_FOCUS':
      return (
        <div className="w-full">
          {step.title && (
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{step.title}</h3>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px]">
            <iframe
              src={`${step.pdf_url}#page=${step.page ?? 1}`}
              className="w-full h-full rounded-lg border border-gray-200"
            />
            <div className="p-5 bg-blue-50 rounded-lg border border-blue-100 overflow-auto">
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
                Tarea de lectura
              </p>
              <p className="text-gray-700 leading-relaxed">{step.task}</p>
            </div>
          </div>
        </div>
      );

    case 'CONTENT':
    default:
      return (
        <div className="w-full space-y-4">
          {step.title && (
            <h3 className="text-lg font-semibold text-gray-800">{step.title}</h3>
          )}
          {step.text && (
            <div className="prose max-w-none text-gray-700 leading-relaxed">
              {step.text}
            </div>
          )}
          {step.url && (
            <div className="relative w-full overflow-hidden rounded-xl shadow border border-gray-200" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={step.url}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media"
                loading="lazy"
              />
            </div>
          )}
        </div>
      );
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LessonViewer({ lessonId, onBack, previewMode = false }: LessonViewerProps) {
  const { profile } = useAuth();

  const [lesson, setLesson]                         = useState<Lesson | null>(null);
  const [combinedSteps, setCombinedSteps]           = useState<CombinedStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex]     = useState(0);
  const [completedActivities, setCompletedActivities] = useState<Set<string>>(new Set());
  const [progress, setProgress]                     = useState(0);
  const [showProduction, setShowProduction]         = useState(false);
  const [loading, setLoading]                       = useState(true);

  const [attempts, setAttempts]                     = useState(1);
  const [groupInfo, setGroupInfo]                   = useState<GroupInfo | null>(null);
  const [presentationBlocked, setPresentationBlocked] = useState(false);

  // ── Detectar presentación activa del profesor (bloquea actividades) ───────

  useEffect(() => {
    if (previewMode || !profile?.id) return;

    async function checkPresentation() {
      // Obtener cursos del estudiante
      const { data: cs } = await supabase
        .from('course_students').select('course_id').eq('student_id', profile!.id);
      const ids = (cs || []).map((r: any) => r.course_id);
      if (ids.length === 0) return;

      const { data } = await supabase
        .from('presentation_sessions')
        .select('id')
        .eq('is_active', true)
        .in('course_id', ids)
        .maybeSingle();

      setPresentationBlocked(!!data);
    }

    checkPresentation();
    const interval = setInterval(checkPresentation, 5000);
    return () => clearInterval(interval);
  }, [profile?.id, previewMode]);

  // ── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (previewMode) { loadPreview(); return; }
    if (!profile?.id) return;
    loadAll();
  }, [lessonId, profile?.id]);

  // ── Recalcular progreso cuando cambian actividades completadas ─────────────

  useEffect(() => {
    if (previewMode) return; // no guardar en preview
    if (combinedSteps.length > 0) {
      calculateProgress();
    }
  }, [completedActivities, combinedSteps]);

  // ── Carga en modo previa (profesor) — solo lección + actividades, sin progreso ──

  async function loadPreview() {
    setLoading(true);
    const { data: lessonData } = await supabase.from('lessons').select('*').eq('id', lessonId).maybeSingle();
    if (lessonData) setLesson(lessonData);

    const { data: joinData } = await supabase
      .from('lesson_activities')
      .select('order_index, activities(id, type, title, content, points, media_url)')
      .eq('lesson_id', lessonId)
      .order('order_index');

    const activitiesData = joinData?.map((item: any) => ({ ...item.activities, order_index: item.order_index })) || [];
    const contentSteps: CombinedStep[] = lessonData?.content?.steps ?? [];
    const activitySteps: CombinedStep[] = activitiesData.map((a: Activity) => ({ ...a, isActivity: true as const }));
    setCombinedSteps([...contentSteps, ...activitySteps]);
    setLoading(false);
  }

  async function loadAll() {
    setLoading(true);

    // 1. Cargar lección
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .maybeSingle();

    if (lessonData) setLesson(lessonData);

    // 2. Cargar actividades desde la tabla PUENTE (lesson_activities)
    const { data: joinData } = await supabase
      .from('lesson_activities')
      .select(`
        order_index,
        activities (
          id,
          type,
          title,
          content,
          points,
          media_url
        )
      `)
      .eq('lesson_id', lessonId)
      .order('order_index');

    const activitiesData = joinData?.map((item: any) => ({
      ...item.activities,
      order_index: item.order_index
    })) || [];

    // 3. Detectar si la lección es grupal para este estudiante
    const { data: groupAssignment } = await supabase
      .from('group_lesson_assignments')
      .select(`
        group_id,
        groups!group_id (name)
      `)
      .eq('lesson_id', lessonId)
      .in('group_id',
        // subquery: grupos donde el estudiante es miembro
        (await supabase
          .from('group_members')
          .select('group_id')
          .eq('student_id', profile?.id)
        ).data?.map((r: any) => r.group_id) ?? []
      )
      .maybeSingle();

    if (groupAssignment) {
      // Modo grupal: cargar completaciones del grupo
      const { data: groupCompletions } = await supabase
        .from('group_activity_completions')
        .select('activity_id, completed_by, profiles!completed_by(full_name)')
        .eq('group_id', groupAssignment.group_id);

      const completedByMap: Record<string, string> = {};
      const completedIds = new Set<string>();
      (groupCompletions || []).forEach((c: any) => {
        completedIds.add(c.activity_id);
        completedByMap[c.activity_id] = c.profiles.full_name;
      });
      setCompletedActivities(completedIds);
      setGroupInfo({
        groupId:     groupAssignment.group_id,
        groupName:   (groupAssignment as any).groups.name,
        completedBy: completedByMap,
      });

      // Progreso grupal
      const { data: gProgress } = await supabase
        .from('group_progress')
        .select('completion_percentage')
        .eq('group_id', groupAssignment.group_id)
        .eq('lesson_id', lessonId)
        .maybeSingle();
      if (gProgress) setProgress(gProgress.completion_percentage);

    } else {
      // Modo individual normal
      const { data: responses } = await supabase
        .from('activity_responses')
        .select('activity_id')
        .eq('student_id', profile?.id);
      if (responses) setCompletedActivities(new Set(responses.map((r) => r.activity_id)));

      const { data: progressData } = await supabase
        .from('student_progress')
        .select('completion_percentage, attempts')
        .eq('student_id', profile?.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();
      if (progressData) {
        setProgress(progressData.completion_percentage);
        if (progressData.attempts) setAttempts(progressData.attempts);
      }
    }

    // 5. Construir la lista unificada de pasos
    const contentSteps: CombinedStep[] = lessonData?.content?.steps ?? [];
    const activitySteps: CombinedStep[] = (activitiesData ?? []).map((a: Activity) => ({
      ...a,
      isActivity: true as const,
    }));

    setCombinedSteps([...contentSteps, ...activitySteps]);
    setLoading(false);
  }

  // ── Persistencia de progreso ───────────────────────────────────────────────

  async function calculateProgress() {
    if (!profile?.id) return;
    const activitySteps = combinedSteps.filter((s) => s.isActivity) as (Activity & { isActivity: true })[];
    if (activitySteps.length === 0) return;

    const completed  = activitySteps.filter((a) => completedActivities.has(a.id)).length;
    const percentage = Math.round((completed / activitySteps.length) * 100);
    setProgress(percentage);

    if (groupInfo) {
      // ── Modo grupal: actualizar group_progress ──
      const { data: existing } = await supabase
        .from('group_progress')
        .select('id')
        .eq('group_id', groupInfo.groupId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      const payload = {
        completion_percentage: percentage,
        completed_at: percentage === 100 ? new Date().toISOString() : null,
      };
      if (existing) {
        await supabase.from('group_progress').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('group_progress').insert({
          group_id: groupInfo.groupId, lesson_id: lessonId, ...payload,
        });
      }
    } else {
      // ── Modo individual: actualizar student_progress ──
      const { data: existing } = await supabase
        .from('student_progress')
        .select('id, attempts')
        .eq('student_id', profile?.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      const payload = {
        completion_percentage: percentage,
        completed_at: percentage === 100 ? new Date().toISOString() : null,
        attempts: existing?.attempts || attempts,
      };
      if (existing) {
        await supabase.from('student_progress').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('student_progress').insert({
          student_id: profile?.id, lesson_id: lessonId, ...payload,
        });
      }
    }
  }

  // ── Reintentar Lección ─────────────────────────────────────────────────────

  async function handleRetryLesson() {
    if (!confirm('¿Estás seguro de reintentar la lección? Se borrarán tus notas de todas las actividades. Esta acción no se puede deshacer.')) {
      return;
    }
    
    setLoading(true);
    try {
      // 1. Identificar actividades de esta lección
      const activitySteps = combinedSteps.filter((s) => s.isActivity) as Activity[];
      const activityIds = activitySteps.map(a => a.id);

      if (activityIds.length > 0) {
        // 2. Eliminar respuestas anteriores de estas actividades
        await supabase
          .from('activity_responses')
          .delete()
          .eq('student_id', profile?.id)
          .in('activity_id', activityIds);
      }

      // 3. Aumentar intentos y resetear progreso
      const newAttempts = attempts + 1;
      await supabase
        .from('student_progress')
        .update({ 
          completion_percentage: 0, 
          attempts: newAttempts,
          completed_at: null 
        })
        .eq('student_id', profile?.id)
        .eq('lesson_id', lessonId);

      // 4. Actualizar estado local
      setAttempts(newAttempts);
      setProgress(0);
      setCompletedActivities(new Set());
      setCurrentStepIndex(0);
      
    } catch (err: any) {
      alert('Error al reintentar la lección: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Navegación entre pasos ─────────────────────────────────────────────────

  function navigate(direction: 'next' | 'prev') {
    setCurrentStepIndex((prev) => {
      if (direction === 'next' && prev < combinedSteps.length - 1) return prev + 1;
      if (direction === 'prev' && prev > 0) return prev - 1;
      return prev;
    });
  }

  // Cuando una actividad se completa, la marcamos y avanzamos automáticamente
  async function handleActivityComplete(activityId: string, response?: any, score?: number) {
    if (previewMode) {
      // En vista previa solo marcar localmente, no guardar nada
      setCompletedActivities(prev => new Set([...prev, activityId]));
      setTimeout(() => setCurrentStepIndex(i => Math.min(i + 1, combinedSteps.length - 1)), 600);
      return;
    }
    if (groupInfo) {
      // Guardar en group_activity_completions
      await supabase.from('group_activity_completions').upsert({
        group_id:     groupInfo.groupId,
        activity_id:  activityId,
        completed_by: profile?.id,
        response:     response ?? null,
        score:        score ?? 0,
      }, { onConflict: 'group_id,activity_id' });

      // Actualizar el mapa de "completado por"
      setGroupInfo(prev => prev ? {
        ...prev,
        completedBy: { ...prev.completedBy, [activityId]: profile?.full_name ?? 'Tú' },
      } : prev);
    }

    setCompletedActivities((prev) => new Set([...prev, activityId]));
    if (currentStepIndex < combinedSteps.length - 1) {
      setTimeout(() => navigate('next'), 600);
    }
  }

  // ── Derivados ──────────────────────────────────────────────────────────────

  const currentStep     = combinedSteps[currentStepIndex];
  const isFirstStep     = currentStepIndex === 0;
  const isLastStep      = currentStepIndex === combinedSteps.length - 1;
  const canAccessProduction =
    lesson?.has_production && progress >= (lesson?.production_unlock_percentage ?? 80);

  // ── Pantallas de carga / producción ───────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (showProduction && canAccessProduction) {
    return <ProductionEditor lessonId={lessonId} onBack={() => setShowProduction(false)} />;
  }

  // ── Render principal ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-500 hover:text-gray-800 mb-3 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a lecciones
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{lesson?.title}</h1>
              {lesson?.description && (
                <p className="text-sm text-gray-500 mt-0.5">{lesson.description}</p>
              )}
              {previewMode && (
                <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                  <Layers className="w-3 h-3" /> Vista Previa — el progreso no se guarda
                </span>
              )}
              {presentationBlocked && (
                <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  <Monitor className="w-3 h-3" /> Clase en directo — actividades bloqueadas
                </span>
              )}
              {groupInfo && (
                <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                  <Users className="w-3 h-3" /> Grupo: {groupInfo.groupName}
                </span>
              )}
            </div>
            <span className="text-sm font-semibold text-blue-600 whitespace-nowrap mt-1">
              {progress}% completado
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Contenido principal ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Indicador de pasos (breadcrumb visual) */}
        {combinedSteps.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {combinedSteps.map((step, index) => {
              const isCompleted = step.isActivity && completedActivities.has((step as Activity).id);
              const isCurrent   = index === currentStepIndex;

              return (
                <button
                  key={index}
                  onClick={() => setCurrentStepIndex(index)}
                  title={
                    isCompleted && groupInfo?.completedBy[(step as Activity).id]
                      ? `Completado por ${groupInfo.completedBy[(step as Activity).id]}`
                      : (step.title ?? `Paso ${index + 1}`)
                  }
                  className={`
                    flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                    text-xs font-semibold transition-all border-2
                    ${isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-110'
                      : 'bg-white border-gray-300 text-gray-500 hover:border-blue-400'}
                  `}
                >
                  {isCompleted ? <CheckCircle className="w-4 h-4" /> : stepIcon(step)}
                </button>
              );
            })}
          </div>
        )}

        {/* Tarjeta del paso actual */}
        {currentStep && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 flex-1">

            {/* Etiqueta del tipo de paso */}
            <div className="flex items-center gap-2 mb-5">
              <span className={`
                inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide
                ${currentStep.isActivity
                  ? 'bg-purple-100 text-purple-700'
                  : (currentStep as ContentStep).type === 'VIDEO'
                  ? 'bg-red-100 text-red-700'
                  : (currentStep as ContentStep).type === 'READING_FOCUS'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'}
              `}>
                {stepIcon(currentStep)}
                {currentStep.isActivity
                  ? 'Actividad'
                  : (currentStep as ContentStep).type === 'VIDEO'
                  ? 'Video'
                  : (currentStep as ContentStep).type === 'READING_FOCUS'
                  ? 'Lectura guiada'
                  : 'Contenido'}
              </span>
              <span className="text-xs text-gray-400">
                Paso {currentStepIndex + 1} de {combinedSteps.length}
              </span>
            </div>

            {/* Banner grupal: quién completó este paso */}
            {currentStep.isActivity &&
              groupInfo?.completedBy[(currentStep as Activity).id] &&
              groupInfo.completedBy[(currentStep as Activity).id] !== profile?.full_name && (
              <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
                <Users className="w-4 h-4 text-purple-500 shrink-0" />
                Completado por <strong>{groupInfo.completedBy[(currentStep as Activity).id]}</strong> — ya cuenta para tu grupo.
              </div>
            )}

            {/* Bloqueo por presentación activa */}
            {presentationBlocked && currentStep.isActivity ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 bg-blue-50 border-2 border-blue-200 rounded-xl text-center">
                <Monitor className="w-12 h-12 text-blue-500 mb-4" />
                <h3 className="text-lg font-bold text-blue-800 mb-2">Clase en directo</h3>
                <p className="text-blue-600 text-sm max-w-sm">
                  Tu profesor está presentando. Las actividades estarán disponibles cuando termine la presentación.
                </p>
              </div>
            ) : currentStep.isActivity ? (
              <ActivityRenderer
                activity={currentStep as Activity}
                isCompleted={completedActivities.has((currentStep as Activity).id)}
                onComplete={() => handleActivityComplete((currentStep as Activity).id)}
              />
            ) : (
              <ContentStepRenderer step={currentStep as ContentStep} />
            )}
          </div>
        )}

        {/* ── Navegación Anterior / Siguiente ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('prev')}
            disabled={isFirstStep || presentationBlocked}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300
              text-gray-700 font-medium text-sm transition hover:bg-gray-100
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>

          {/* Botón de Producción y Reintentos: aparece solo en el último paso */}
          {isLastStep && (
            <div className="flex flex-col items-center gap-3">
              {/* Intentos y Reintentar */}
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 font-medium mb-1">
                  Intento {attempts} de 3
                </span>
                {attempts < 3 && (
                  <button
                    onClick={handleRetryLesson}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700 text-sm font-semibold underline decoration-red-200 hover:decoration-red-400 transition"
                  >
                    Reintentar Lección
                  </button>
                )}
              </div>

              {/* Botón de Producción */}
              {lesson?.has_production && (
                canAccessProduction ? (
                  <button
                    onClick={() => setShowProduction(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600
                      text-white font-semibold text-sm hover:bg-green-700 transition shadow"
                  >
                    <Layers className="w-4 h-4" />
                    Ir a Producción
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-100
                    text-gray-500 text-sm border border-gray-200"
                  >
                    <Lock className="w-4 h-4" />
                    Necesitas {lesson.production_unlock_percentage}% para desbloquear
                  </div>
                )
              )}
            </div>
          )}

          <button
            onClick={() => navigate('next')}
            disabled={isLastStep || presentationBlocked}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600
              text-white font-medium text-sm transition hover:bg-blue-700
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}