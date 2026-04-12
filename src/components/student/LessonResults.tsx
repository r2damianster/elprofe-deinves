import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { resolveField, type Lang } from '../../lib/i18n';
import {
  ArrowLeft, CheckCircle, XCircle, Trophy, RefreshCw,
  FileText, BarChart2, Loader2, Lock, Star
} from 'lucide-react';

interface ActivityResult {
  id: string;
  title: string;
  type: string;
  points: number;        // puntos máximos
  score: number | null;  // puntos obtenidos (null = sin respuesta)
  attempts_count: number; // cuántas veces respondió esta actividad
}

interface ProductionResult {
  status: 'draft' | 'submitted' | 'reviewed';
  score: number | null;
  feedback: string | null;
  word_count: number;
  attempts: number;
  compliance_score: number;
  submitted_at: string | null;
}

interface LessonResultsProps {
  lessonId: string;
  lessonTitle: any;
  lang: Lang;
  attemptsLesson: number; // intentos de la lección completa (student_progress.attempts)
  onBack: () => void;
  onRetry?: () => void;   // undefined si ya agotó los intentos
}

const STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  submitted: 'Enviada',
  reviewed:  'Revisada',
};

const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  reviewed:  'bg-green-100 text-green-700',
};

export default function LessonResults({
  lessonId,
  lessonTitle,
  lang,
  attemptsLesson,
  onBack,
  onRetry,
}: LessonResultsProps) {
  const { profile } = useAuth();
  const [loading, setLoading]             = useState(true);
  const [activities, setActivities]       = useState<ActivityResult[]>([]);
  const [production, setProduction]       = useState<ProductionResult | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    load();
  }, [lessonId, profile?.id]);

  async function load() {
    setLoading(true);
    try {
      // 1. Actividades vinculadas a la lección
      const { data: linked } = await supabase
        .from('lesson_activities')
        .select('order_index, activities(id, title, type, points)')
        .eq('lesson_id', lessonId)
        .order('order_index');

      const acts = (linked ?? []).map((l: any) => l.activities).filter(Boolean);

      if (acts.length > 0) {
        // 2. Respuestas del estudiante para esas actividades
        const actIds = acts.map((a: any) => a.id);
        const { data: responses } = await supabase
          .from('activity_responses')
          .select('activity_id, score')
          .eq('student_id', profile!.id)
          .in('activity_id', actIds);

        // Agrupar por actividad: última score y conteo de respuestas
        const responseMap: Record<string, { score: number; count: number }> = {};
        (responses ?? []).forEach((r: any) => {
          if (!responseMap[r.activity_id]) {
            responseMap[r.activity_id] = { score: r.score, count: 0 };
          }
          responseMap[r.activity_id].count += 1;
          // Tomar la mejor puntuación
          if (r.score > responseMap[r.activity_id].score) {
            responseMap[r.activity_id].score = r.score;
          }
        });

        setActivities(acts.map((a: any) => ({
          id:            a.id,
          title:         a.title,
          type:          a.type,
          points:        a.points,
          score:         responseMap[a.id]?.score ?? null,
          attempts_count: responseMap[a.id]?.count ?? 0,
        })));
      }

      // 3. Producción del estudiante para esta lección
      const { data: prod } = await (supabase.from('productions') as any)
        .select('status, score, feedback, word_count, attempts, compliance_score, submitted_at')
        .eq('student_id', profile!.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (prod) setProduction(prod);

    } finally {
      setLoading(false);
    }
  }

  // Totales
  const totalPoints   = activities.reduce((s, a) => s + a.points, 0);
  const totalEarned   = activities.reduce((s, a) => s + (a.score ?? 0), 0);
  const pct           = totalPoints > 0 ? Math.round((totalEarned / totalPoints) * 100) : null;

  const scoreColor = (pct: number | null) => {
    if (pct === null) return 'text-gray-400';
    if (pct >= 80) return 'text-green-600';
    if (pct >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-500 hover:text-gray-800 mb-3 text-sm transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {resolveField(lessonTitle, lang)}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Resultados de la lección</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="w-4 h-4" />
              <span>
                {attemptsLesson} intento{attemptsLesson !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando resultados...
          </div>
        ) : (
          <>
            {/* Resumen total */}
            {activities.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <h2 className="font-semibold text-gray-800">Resumen de actividades</h2>
                </div>

                <div className="flex items-center gap-6">
                  {/* Score total */}
                  <div className="text-center">
                    <p className={`text-4xl font-bold ${scoreColor(pct)}`}>
                      {pct !== null ? `${pct}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">puntuación</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Puntos obtenidos</span>
                      <span className="font-semibold">{totalEarned} / {totalPoints}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          pct !== null && pct >= 80 ? 'bg-green-500'
                          : pct !== null && pct >= 60 ? 'bg-yellow-500'
                          : 'bg-red-500'
                        }`}
                        style={{ width: `${pct ?? 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      {attemptsLesson} intento{attemptsLesson !== 1 ? 's' : ''} de la lección completa
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Detalle por actividad */}
            {activities.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                  <BarChart2 className="w-5 h-5 text-blue-500" />
                  <h2 className="font-semibold text-gray-800">Actividades</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {activities.map(act => {
                    const actPct = act.points > 0 && act.score !== null
                      ? Math.round((act.score / act.points) * 100)
                      : null;
                    const answered = act.score !== null;

                    return (
                      <div key={act.id} className="flex items-center gap-4 px-6 py-4">
                        {/* Ícono resultado */}
                        <div className="flex-shrink-0">
                          {!answered ? (
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                              <XCircle className="w-4 h-4 text-gray-400" />
                            </div>
                          ) : actPct !== null && actPct >= 70 ? (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                              <XCircle className="w-4 h-4 text-red-500" />
                            </div>
                          )}
                        </div>

                        {/* Título y repeticiones */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{act.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {act.attempts_count > 0
                              ? `Respondida ${act.attempts_count} vez${act.attempts_count !== 1 ? '' : ''}`
                              : 'Sin respuesta'}
                          </p>
                        </div>

                        {/* Puntuación */}
                        <div className="text-right flex-shrink-0">
                          {answered ? (
                            <>
                              <p className={`text-sm font-bold ${scoreColor(actPct)}`}>
                                {act.score} / {act.points}
                              </p>
                              <p className="text-xs text-gray-400">{actPct}%</p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">—</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Producción */}
            {production ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-5 h-5 text-purple-500" />
                  <h2 className="font-semibold text-gray-800">Producción escrita</h2>
                  <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[production.status]}`}>
                    {STATUS_LABEL[production.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Palabras escritas</p>
                    <p className="text-lg font-bold text-gray-800">{production.word_count}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Cumplimiento</p>
                    <p className="text-lg font-bold text-blue-700">{production.compliance_score}%</p>
                  </div>
                  {production.score !== null && (
                    <div className="bg-green-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-green-700 mb-1 font-medium">Calificación del profesor</p>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <p className="text-2xl font-bold text-green-700">{production.score}</p>
                        <span className="text-sm text-green-600">/ 100</span>
                      </div>
                    </div>
                  )}
                </div>

                {production.feedback && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">
                      Retroalimentación del profesor
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{production.feedback}</p>
                  </div>
                )}

                {!production.score && production.status !== 'reviewed' && (
                  <p className="text-xs text-gray-400 text-center mt-3">
                    Esperando revisión del profesor...
                  </p>
                )}
              </div>
            ) : (
              /* Producción no iniciada */
              null
            )}

            {/* Sin actividades ni producción */}
            {activities.length === 0 && !production && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay resultados registrados aún.</p>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 justify-center pb-4">
              <button
                onClick={onBack}
                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Volver a mis lecciones
              </button>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                >
                  <RefreshCw className="w-4 h-4" /> Reintentar lección
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
