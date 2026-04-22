import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { resolveField } from '../../lib/i18n';
import {
  Trophy, ChevronDown, ChevronRight, CheckCircle, XCircle,
  FileText, Loader2, BarChart2, RefreshCw, Star, BookOpen
} from 'lucide-react';

interface LessonSummary {
  lesson_id: string;
  lesson_title: any;
  completion_percentage: number;
  completed_at: string | null;
  attempts: number;
  // actividades
  activities: ActivitySummary[];
  totalPoints: number;
  totalEarned: number;
  // producción
  production: ProductionSummary | null;
}

interface ActivitySummary {
  id: string;
  title: string;
  points: number;
  score: number | null;
  response_count: number;
}

interface ProductionSummary {
  status: 'draft' | 'submitted' | 'reviewed';
  score: number | null;
  feedback: string | null;
  word_count: number;
  compliance_score: number;
  integrity_score: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  submitted: 'Enviada',
  reviewed:  'Revisada',
};
const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  submitted: 'bg-blue-100 text-blue-700',
  reviewed:  'bg-green-100 text-green-700',
};

export default function StudentResults() {
  const { profile } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [lessons, setLessons]   = useState<LessonSummary[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id) return;
    load();
  }, [profile?.id]);

  async function load() {
    setLoading(true);
    try {
      // 1. Todas las lecciones con progreso del estudiante
      const { data: progressRows } = await supabase
        .from('student_progress')
        .select('lesson_id, completion_percentage, completed_at, attempts')
        .eq('student_id', profile!.id)
        .order('completed_at', { ascending: false });

      if (!progressRows || progressRows.length === 0) {
        setLessons([]);
        setLoading(false);
        return;
      }

      const lessonIds = progressRows.map((p: any) => p.lesson_id);

      // 2. Títulos de las lecciones
      const { data: lessonRows } = await supabase
        .from('lessons')
        .select('id, title')
        .in('id', lessonIds);

      const titleMap: Record<string, any> = {};
      (lessonRows ?? []).forEach((l: any) => { titleMap[l.id] = l.title; });

      // 3. Actividades vinculadas a esas lecciones (lesson_activities + activities)
      const { data: linkedActs } = await supabase
        .from('lesson_activities')
        .select('lesson_id, order_index, activities(id, title, points)')
        .in('lesson_id', lessonIds)
        .order('order_index');

      // Mapa lessonId → actividades
      const actByLesson: Record<string, any[]> = {};
      (linkedActs ?? []).forEach((l: any) => {
        if (!l.activities) return;
        if (!actByLesson[l.lesson_id]) actByLesson[l.lesson_id] = [];
        actByLesson[l.lesson_id].push(l.activities);
      });

      // 4. Todas las respuestas del estudiante para esas actividades
      const allActIds = Object.values(actByLesson).flat().map((a: any) => a.id);
      let responseMap: Record<string, { score: number; count: number }> = {};

      if (allActIds.length > 0) {
        const { data: responses } = await supabase
          .from('activity_responses')
          .select('activity_id, score')
          .eq('student_id', profile!.id)
          .in('activity_id', allActIds);

        (responses ?? []).forEach((r: any) => {
          if (!responseMap[r.activity_id]) {
            responseMap[r.activity_id] = { score: r.score, count: 0 };
          }
          responseMap[r.activity_id].count += 1;
          if (r.score > responseMap[r.activity_id].score) {
            responseMap[r.activity_id].score = r.score;
          }
        });
      }

      // 5. Producciones del estudiante
      const { data: productions } = await (supabase.from('productions') as any)
        .select('lesson_id, status, score, feedback, word_count, compliance_score, integrity_score')
        .eq('student_id', profile!.id)
        .in('lesson_id', lessonIds);

      const prodMap: Record<string, ProductionSummary> = {};
      (productions ?? []).forEach((p: any) => {
        prodMap[p.lesson_id] = {
          status:           p.status,
          score:            p.score,
          feedback:         p.feedback,
          word_count:       p.word_count,
          compliance_score: p.compliance_score,
          integrity_score:  p.integrity_score ?? 100,
        };
      });

      // 6. Construir resúmenes
      const summaries: LessonSummary[] = progressRows.map((p: any) => {
        const activities: ActivitySummary[] = (actByLesson[p.lesson_id] ?? []).map((a: any) => ({
          id:             a.id,
          title:          a.title,
          points:         a.points,
          score:          responseMap[a.id]?.score ?? null,
          response_count: responseMap[a.id]?.count ?? 0,
        }));

        return {
          lesson_id:            p.lesson_id,
          lesson_title:         titleMap[p.lesson_id] ?? 'Lección',
          completion_percentage: p.completion_percentage,
          completed_at:         p.completed_at,
          attempts:             p.attempts ?? 1,
          activities,
          totalPoints:  activities.reduce((s, a) => s + a.points, 0),
          totalEarned:  activities.reduce((s, a) => s + (a.score ?? 0), 0),
          production:   prodMap[p.lesson_id] ?? null,
        };
      });

      setLessons(summaries);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const scoreColor = (pct: number | null) => {
    if (pct === null) return 'text-gray-400';
    if (pct >= 80)    return 'text-green-600';
    if (pct >= 60)    return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando resultados...
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No tienes resultados todavía.</p>
        <p className="text-sm mt-1">Completa al menos una lección para ver tus resultados aquí.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-bold text-gray-800">Mis Resultados</h2>
        </div>
        <span className="text-sm text-gray-400">
          {lessons.length} lección{lessons.length !== 1 ? 'es' : ''} con progreso
        </span>
      </div>

      {lessons.map(lesson => {
        const isOpen = expanded.has(lesson.lesson_id);
        const pct = lesson.totalPoints > 0
          ? Math.round((lesson.totalEarned / lesson.totalPoints) * 100)
          : null;
        const completed = !!lesson.completed_at;

        return (
          <div
            key={lesson.lesson_id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
          >
            {/* Cabecera de la lección */}
            <button
              onClick={() => toggle(lesson.lesson_id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition"
            >
              {/* Estado */}
              <div className="flex-shrink-0">
                {completed ? (
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-500" />
                  </div>
                )}
              </div>

              {/* Título y metadatos */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">
                  {resolveField(lesson.lesson_title, 'es')}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {lesson.attempts} intento{lesson.attempts !== 1 ? 's' : ''}
                  </span>
                  {completed && (
                    <span className="text-green-600 font-medium">Completada</span>
                  )}
                  {!completed && (
                    <span className="text-blue-600">{lesson.completion_percentage}% progreso</span>
                  )}
                  {lesson.production && (
                    <span className="text-purple-600 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {STATUS_LABEL[lesson.production.status]}
                    </span>
                  )}
                </div>
              </div>

              {/* Score resumen */}
              <div className="text-right flex-shrink-0 mr-2">
                {pct !== null && (
                  <p className={`text-lg font-bold ${scoreColor(pct)}`}>{pct}%</p>
                )}
                {lesson.production && (
                  <div className="flex items-center gap-1.5 justify-end mt-0.5">
                    <span className={`text-xs font-medium ${lesson.production.compliance_score >= 80 ? 'text-green-600' : lesson.production.compliance_score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {lesson.production.compliance_score}% cumpl.
                    </span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className={`text-xs font-medium ${lesson.production.integrity_score >= 80 ? 'text-green-600' : lesson.production.integrity_score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {lesson.production.integrity_score}% integr.
                    </span>
                  </div>
                )}
              </div>

              {/* Chevron */}
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              }
            </button>

            {/* Detalle expandido */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">

                {/* Actividades */}
                {lesson.activities.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Actividades
                    </p>
                    <div className="space-y-1.5">
                      {lesson.activities.map(act => {
                        const actPct = act.points > 0 && act.score !== null
                          ? Math.round((act.score / act.points) * 100)
                          : null;

                        return (
                          <div
                            key={act.id}
                            className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-gray-100"
                          >
                            <div className="flex-shrink-0">
                              {act.score === null ? (
                                <XCircle className="w-4 h-4 text-gray-300" />
                              ) : actPct !== null && actPct >= 70 ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">{resolveField(act.title, 'es')}</p>
                              {act.response_count > 0 && (
                                <p className="text-xs text-gray-400">
                                  {act.response_count} respuesta{act.response_count !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {act.score !== null ? (
                                <span className={`text-sm font-semibold ${scoreColor(actPct)}`}>
                                  {act.score}/{act.points}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">sin respuesta</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Producción */}
                {lesson.production && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Producción escrita
                    </p>
                    <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-500" />
                          <span className="text-sm font-medium text-gray-700">Producción escrita</span>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[lesson.production.status]}`}>
                          {STATUS_LABEL[lesson.production.status]}
                        </span>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Cumplimiento</p>
                          <p className={`text-base font-bold ${lesson.production.compliance_score >= 80 ? 'text-green-700' : lesson.production.compliance_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {lesson.production.compliance_score}%
                          </p>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Integridad</p>
                          <p className={`text-base font-bold ${lesson.production.integrity_score >= 80 ? 'text-green-700' : lesson.production.integrity_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {lesson.production.integrity_score}%
                          </p>
                        </div>
                        {lesson.production.score !== null && (
                          <div className="flex-1 bg-green-50 rounded-lg p-2.5 text-center">
                            <p className="text-xs text-gray-400 mb-0.5">Calificación</p>
                            <p className="text-base font-bold text-green-700 flex items-center justify-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-400" />
                              {lesson.production.score}
                            </p>
                          </div>
                        )}
                      </div>

                      {lesson.production.feedback && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-gray-700">
                          <p className="text-xs font-semibold text-blue-600 mb-1">Retroalimentación</p>
                          {lesson.production.feedback}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {lesson.activities.length === 0 && !lesson.production && (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Sin actividades ni producción registradas.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
