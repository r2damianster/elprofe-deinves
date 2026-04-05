import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShieldAlert, BarChart, Clock, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Loader2, Send
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface IntegrityEvent {
  type: string;
  at: string;
  penalty: number;
  detail?: string;
}

interface ProductionRow {
  id: string;
  status: string;
  content: string;
  word_count: number;
  score: number | null;
  feedback: string | null;
  compliance_score: number;
  integrity_score: number;
  integrity_events: IntegrityEvent[];
  time_on_task: number;
  attempts: number;
  submitted_at: string | null;
  student: { full_name: string; email: string };
  lesson: { title: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function integrityColor(score: number) {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 50) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

function complianceColor(score: number) {
  if (score === 100) return 'text-green-600 bg-green-50';
  if (score >= 70) return 'text-blue-600 bg-blue-50';
  return 'text-orange-600 bg-orange-50';
}

function statusBadge(status: string) {
  switch (status) {
    case 'reviewed':  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Revisado</span>;
    case 'submitted': return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Enviado</span>;
    default:          return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Borrador</span>;
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ProductionReviewer() {
  const { profile } = useAuth();
  const [productions, setProductions] = useState<ProductionRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [scores, setScores]           = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState<string | null>(null);
  const [filter, setFilter]           = useState<'all' | 'submitted' | 'reviewed'>('submitted');

  useEffect(() => { loadProductions(); }, [profile?.id]);

  async function loadProductions() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Traer producciones de estudiantes en cursos del profesor
      const { data, error } = await supabase
        .from('productions')
        .select(`
          id, status, content, word_count, score, feedback,
          compliance_score, integrity_score, integrity_events,
          time_on_task, attempts, submitted_at,
          student:profiles!student_id (full_name, email),
          lesson:lessons!lesson_id (title)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setProductions((data as any) || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitReview(productionId: string) {
    const score    = parseInt(scores[productionId] || '0');
    const feedback = feedbacks[productionId] || '';
    if (isNaN(score) || score < 0 || score > 100) { alert('La nota debe estar entre 0 y 100'); return; }

    setSubmitting(productionId);
    try {
      await supabase.from('productions')
        .update({ status: 'reviewed', score, feedback, reviewed_at: new Date().toISOString() })
        .eq('id', productionId);

      setProductions(prev => prev.map(p =>
        p.id === productionId ? { ...p, status: 'reviewed', score, feedback } : p
      ));
      setExpanded(null);
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(null); }
  }

  async function enableRetry(productionId: string) {
    if (!confirm('¿Habilitar un intento extra para este estudiante?')) return;
    try {
      await supabase.from('productions')
        .update({ status: 'draft', score: null, feedback: null, submitted_at: null, integrity_score: 100, integrity_events: [], time_on_task: 0 })
        .eq('id', productionId);
      loadProductions();
    } catch (err: any) { alert(err.message); }
  }

  const filtered = productions.filter(p => filter === 'all' || p.status === filter);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['submitted', 'reviewed', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {f === 'submitted' ? 'Pendientes de revisión' : f === 'reviewed' ? 'Revisadas' : 'Todas'}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500 self-center">{filtered.length} producciones</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mr-3" /> Cargando producciones...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay producciones en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">

              {/* Fila resumen */}
              <button className="w-full text-left p-4 hover:bg-gray-50 transition"
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 truncate">{p.student?.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{p.lesson?.title}</p>
                  </div>

                  {/* Métricas rápidas */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${complianceColor(p.compliance_score)}`}>
                      <BarChart className="w-3 h-3" /> {p.compliance_score}%
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${integrityColor(p.integrity_score)}`}>
                      <ShieldAlert className="w-3 h-3" /> {p.integrity_score}%
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded-lg">
                      <Clock className="w-3 h-3" /> {formatTime(p.time_on_task)}
                    </span>
                    <span className="text-xs text-gray-500">{p.word_count} pal.</span>
                    {statusBadge(p.status)}
                    {p.score !== null && (
                      <span className="font-bold text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">{p.score}/100</span>
                    )}
                  </div>
                  {expanded === p.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
              </button>

              {/* Detalle expandido */}
              {expanded === p.id && (
                <div className="border-t border-gray-100 p-5 space-y-5">

                  {/* Log de integridad */}
                  {p.integrity_events?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                        Registro forense ({p.integrity_events.length} eventos)
                      </h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                        {p.integrity_events.map((ev, i) => (
                          <div key={i} className="flex items-center justify-between text-xs gap-2">
                            <span className="font-medium text-red-700 capitalize">{ev.type.replace(/_/g, ' ')}</span>
                            {ev.detail && <span className="text-gray-500 flex-1 truncate">{ev.detail}</span>}
                            <span className="text-red-600 font-bold shrink-0">-{ev.penalty}</span>
                            <span className="text-gray-400 shrink-0">{new Date(ev.at).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contenido del ensayo */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Contenido del ensayo</h4>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap border">
                      {p.content || <span className="text-gray-400 italic">Sin contenido</span>}
                    </div>
                  </div>

                  {/* Formulario de calificación */}
                  {p.status !== 'reviewed' ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-500" /> Calificar producción
                      </h4>
                      <div className="flex gap-3 items-start">
                        <div className="w-28">
                          <label className="text-xs text-gray-500 mb-1 block">Nota (0-100)</label>
                          <input type="number" min="0" max="100"
                            value={scores[p.id] || ''}
                            onChange={e => setScores({ ...scores, [p.id]: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="0-100" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">Comentarios para el estudiante</label>
                          <textarea rows={3}
                            value={feedbacks[p.id] || ''}
                            onChange={e => setFeedbacks({ ...feedbacks, [p.id]: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            placeholder="Escribe tu retroalimentación aquí..." />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => submitReview(p.id)} disabled={submitting === p.id}
                          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50">
                          <Send className="w-3.5 h-3.5" />
                          {submitting === p.id ? 'Enviando...' : 'Enviar calificación'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-green-800">Calificación enviada: {p.score}/100</p>
                        {p.feedback && <p className="text-xs text-green-700 mt-1">{p.feedback}</p>}
                      </div>
                      {p.attempts < 2 && (
                        <button onClick={() => enableRetry(p.id)}
                          className="text-xs px-3 py-1.5 border border-orange-400 text-orange-600 rounded-lg hover:bg-orange-50 transition font-medium">
                          Habilitar reintento
                        </button>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
