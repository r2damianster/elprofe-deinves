import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { ArrowLeft, Check, RotateCcw, Clock } from 'lucide-react';

type ProjectObject = {
  id: string;
  object_type_id: string;
  student_id: string;
  content: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  word_count: number;
  version: number;
  feedback: string | null;
  score: number | null;
  submitted_at: string | null;
  student_name?: string;
  object_name?: string;
};

type EditRequest = {
  id: string;
  project_object_id: string;
  student_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  student_name?: string;
  object_name?: string;
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  needs_revision: 'bg-amber-100 text-amber-700',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', submitted: 'Enviado', approved: 'Aprobado', needs_revision: 'Revisión',
};

export default function ProjectReviewer({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [objects, setObjects] = useState<ProjectObject[]>([]);
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [selected, setSelected] = useState<ProjectObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'submitted' | 'requests'>('submitted');

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);

    const typesRes = await sb.from('project_object_types')
      .select('id, name')
      .eq('project_id', projectId);
    const typeMap: Record<string, string> = {};
    (typesRes.data ?? []).forEach((t: any) => { typeMap[t.id] = t.name; });
    const typeIds = Object.keys(typeMap);

    const [objsRes, reqsRes] = await Promise.all([
      sb.from('project_objects')
        .select('*, profiles!student_id(full_name)')
        .in('object_type_id', typeIds)
        .eq('status', 'submitted')
        .order('submitted_at'),
      sb.from('project_object_edit_requests')
        .select('*, project_objects(object_type_id, profiles!student_id(full_name))')
        .eq('status', 'pending'),
    ]);

    setObjects(
      ((objsRes.data ?? []) as any[]).map(o => ({
        ...o,
        student_name: o.profiles?.full_name ?? 'Estudiante',
        object_name: typeMap[o.object_type_id] ?? '',
      }))
    );

    setRequests(
      ((reqsRes.data ?? []) as any[]).map(r => ({
        ...r,
        student_name: r.project_objects?.profiles?.full_name ?? 'Estudiante',
        object_name: typeMap[r.project_objects?.object_type_id] ?? '',
      }))
    );

    setLoading(false);
  }

  function openReview(obj: ProjectObject) {
    setSelected(obj);
    setScore(obj.score?.toString() ?? '');
    setFeedback(obj.feedback ?? '');
    setError(null);
  }

  async function submitReview(newStatus: 'approved' | 'needs_revision') {
    if (!selected) return;
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
      setError('La puntuación debe ser un número entre 0 y 10.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error } = await sb.from('project_objects')
      .update({
        status: newStatus,
        score: numScore,
        feedback: feedback.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (error) { setError(error.message); setSaving(false); return; }
    setSelected(null);
    await load();
    setSaving(false);
  }

  async function resolveRequest(id: string, status: 'approved' | 'denied', note: string) {
    await sb.from('project_object_edit_requests').update({
      status,
      professor_note: note || null,
      resolved_at: new Date().toISOString(),
    }).eq('id', id);

    if (status === 'approved') {
      const req = requests.find(r => r.id === id);
      if (req) {
        await sb.from('project_objects').update({ status: 'draft' }).eq('id', req.project_object_id);
      }
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-gray-800">Revisión de objetos</h3>
      </div>

      <div className="flex gap-2">
        {(['submitted', 'requests'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t === 'submitted' ? `Enviados (${objects.length})` : `Solicitudes (${requests.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Cargando...</div>
      ) : tab === 'submitted' ? (
        <div className="flex gap-4">
          {/* Lista */}
          <div className="flex-1 space-y-2">
            {objects.length === 0 ? (
              <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">
                No hay objetos pendientes de revisión.
              </div>
            ) : objects.map(obj => (
              <button
                key={obj.id}
                onClick={() => openReview(obj)}
                className={`w-full text-left border rounded-xl px-4 py-3 transition ${selected?.id === obj.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[obj.status]}`}>
                    {STATUS_LABEL[obj.status]}
                  </span>
                  <span className="font-medium text-sm text-gray-800">{obj.object_name}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {obj.student_name} &middot; {obj.word_count} palabras &middot; v{obj.version}
                </div>
              </button>
            ))}
          </div>

          {/* Panel de revisión */}
          {selected && (
            <div className="w-80 flex-shrink-0 bg-white border border-gray-200 rounded-xl p-4 space-y-3 self-start">
              <div>
                <h4 className="font-semibold text-gray-800 text-sm">{selected.object_name}</h4>
                <p className="text-xs text-gray-500">{selected.student_name} &middot; {selected.word_count} palabras</p>
              </div>
              <div className="max-h-48 overflow-y-auto text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {selected.content || <span className="text-gray-400">Sin contenido</span>}
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Puntuación (0–10)</label>
                <input
                  type="number" min={0} max={10} step={0.1}
                  value={score}
                  onChange={e => setScore(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Retroalimentación</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Comentarios para el estudiante..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => submitReview('approved')}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" /> Aprobar
                </button>
                <button
                  onClick={() => submitReview('needs_revision')}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Revisar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Solicitudes de re-edición */
        <RequestList requests={requests} onResolve={resolveRequest} />
      )}
    </div>
  );
}

function RequestList({
  requests,
  onResolve,
}: {
  requests: EditRequest[];
  onResolve: (id: string, status: 'approved' | 'denied', note: string) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (requests.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">
        No hay solicitudes pendientes.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map(r => (
        <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-sm text-gray-800">{r.student_name}</span>
            <span className="text-xs text-gray-400">&middot; {r.object_name}</span>
          </div>
          <p className="text-sm text-gray-600 italic">"{r.reason}"</p>
          <input
            value={notes[r.id] ?? ''}
            onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nota al estudiante (opcional)"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onResolve(r.id, 'approved', notes[r.id] ?? '')}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700"
            >
              <Check className="w-3 h-3" /> Autorizar
            </button>
            <button
              onClick={() => onResolve(r.id, 'denied', notes[r.id] ?? '')}
              className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600"
            >
              Denegar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
