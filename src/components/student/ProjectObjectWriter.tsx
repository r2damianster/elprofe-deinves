import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, Send, Lock, AlertCircle, CheckCircle } from 'lucide-react';

type ObjectType = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  edit_policy: 'always' | 'requires_approval' | 'locked_after_submit';
  min_words: number;
  max_words: number | null;
  required_words: string[];
};

type ProjectObject = {
  id: string;
  content: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  word_count: number;
  version: number;
  feedback: string | null;
  score: number | null;
  submitted_at: string | null;
};

type EditRequest = {
  id: string;
  status: 'pending' | 'approved' | 'denied';
  professor_note: string | null;
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  needs_revision: 'bg-amber-100 text-amber-700',
};
const STATUS_LABELS = {
  draft: 'Borrador',
  submitted: 'Enviado',
  approved: 'Aprobado',
  needs_revision: 'Requiere revisión',
};

export default function ProjectObjectWriter({
  objectTypeId,
  projectId,
  onBack,
}: {
  objectTypeId: string;
  projectId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [objectType, setObjectType] = useState<ObjectType | null>(null);
  const [object, setObject] = useState<ProjectObject | null>(null);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => { load(); }, [objectTypeId, projectId]);

  async function load() {
    setLoading(true);
    const [typeRes, objRes] = await Promise.all([
      sb.from('project_object_types').select('*').eq('id', objectTypeId).single(),
      sb.from('project_objects')
        .select('*')
        .eq('object_type_id', objectTypeId)
        .eq('student_id', user!.id)
        .maybeSingle(),
    ]);

    if (typeRes.data) setObjectType(typeRes.data as ObjectType);
    if (objRes.data) {
      setObject(objRes.data as ProjectObject);
      setContent(objRes.data.content ?? '');

      if (objRes.data.status === 'submitted' || objRes.data.status === 'approved') {
        const { data: req } = await sb.from('project_object_edit_requests')
          .select('id, status, professor_note')
          .eq('project_object_id', objRes.data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setEditRequest(req as EditRequest | null);
      }
    }
    setLoading(false);
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const canEdit = useCallback((): boolean => {
    if (!object || !objectType) return true;
    const { status } = object;
    const { edit_policy } = objectType;
    if (status === 'draft' || status === 'needs_revision') return true;
    if (edit_policy === 'always') return true;
    if (edit_policy === 'locked_after_submit') return false;
    if (edit_policy === 'requires_approval') {
      return editRequest?.status === 'approved';
    }
    return false;
  }, [object, objectType, editRequest]);

  async function upsert(newStatus: 'draft' | 'submitted') {
    if (!objectType || !user) return;
    setSaving(true);
    const wc = countWords(content);
    const payload = {
      project_id: projectId,
      object_type_id: objectTypeId,
      student_id: user.id,
      content,
      status: newStatus,
      word_count: wc,
      version: object ? (newStatus === 'submitted' && object.status === 'draft' ? object.version : object.version + 1) : 1,
      submitted_at: newStatus === 'submitted' ? new Date().toISOString() : object?.submitted_at ?? null,
    };

    const { data, error } = await sb.from('project_objects')
      .upsert(payload, { onConflict: 'object_type_id,student_id' })
      .select()
      .single();

    if (error) { showToast(error.message, false); setSaving(false); return; }
    setObject(data as ProjectObject);
    showToast(newStatus === 'submitted' ? 'Objeto enviado correctamente.' : 'Borrador guardado.', true);
    setConfirmSubmit(false);
    setSaving(false);
  }

  async function sendRequest() {
    if (!object || !requestReason.trim()) return;
    setSubmitting(true);
    const { error } = await sb.from('project_object_edit_requests').insert({
      project_object_id: object.id,
      student_id: user!.id,
      reason: requestReason.trim(),
    });
    if (error) { showToast(error.message, false); }
    else { showToast('Solicitud enviada al profesor.'); setShowRequestForm(false); setRequestReason(''); await load(); }
    setSubmitting(false);
  }

  if (loading || !objectType) {
    return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando...</div>;
  }

  const wc = countWords(content);
  const editable = canEdit();
  const missingWords = objectType.required_words.filter(
    w => !content.toLowerCase().includes(w.toLowerCase())
  );
  const isValid = wc >= objectType.min_words && missingWords.length === 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-800 text-sm truncate">{objectType.name}</h2>
          {object && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[object.status]}`}>
              {STATUS_LABELS[object.status]} {object.score !== null ? `· ${object.score}/10` : ''} v{object.version}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
          {/* Feedback del profesor */}
          {object?.feedback && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1">Retroalimentación del profesor</p>
              <p className="text-sm text-amber-800">{object.feedback}</p>
            </div>
          )}

          {/* Estado de solicitud de edición */}
          {editRequest && !editable && (
            <div className={`p-3 rounded-lg border text-sm ${
              editRequest.status === 'pending' ? 'bg-blue-50 border-blue-200 text-blue-800' :
              editRequest.status === 'denied' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              {editRequest.status === 'pending' && 'Solicitud de edición pendiente de aprobación.'}
              {editRequest.status === 'denied' && `Solicitud denegada.${editRequest.professor_note ? ` Nota: ${editRequest.professor_note}` : ''}`}
            </div>
          )}

          {/* Textarea */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={!editable}
            rows={16}
            className={`flex-1 w-full border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !editable ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200' : 'border-gray-300'
            }`}
            placeholder={editable ? (objectType.instructions ?? 'Escribe aquí tu redacción...') : 'Este objeto no se puede editar en este momento.'}
          />

          {/* Contador y palabras requeridas */}
          <div className="flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className={wc < objectType.min_words ? 'text-red-500' : 'text-gray-500'}>
                {wc} palabras {objectType.min_words > 0 ? `/ mín. ${objectType.min_words}` : ''}
                {objectType.max_words ? ` — máx. ${objectType.max_words}` : ''}
              </span>
              {objectType.required_words.length > 0 && (
                <span>
                  Requeridas:{' '}
                  {objectType.required_words.map(w => (
                    <span key={w} className={`mr-1 px-1 rounded ${content.toLowerCase().includes(w.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {w}
                    </span>
                  ))}
                </span>
              )}
            </div>

            {toast && (
              <span className={`flex items-center gap-1 ${toast.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                {toast.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {toast.msg}
              </span>
            )}
          </div>

          {/* Botones */}
          {editable ? (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => upsert('draft')}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Guardar borrador
              </button>
              {confirmSubmit ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">¿Confirmar envío?</span>
                  <button onClick={() => upsert('submitted')} disabled={saving || !isValid}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    Sí, enviar
                  </button>
                  <button onClick={() => setConfirmSubmit(false)} className="text-xs text-gray-500">Cancelar</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmSubmit(true)}
                  disabled={saving || !isValid}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  title={!isValid ? `Faltan palabras requeridas o palabras mínimas (${wc}/${objectType.min_words})` : ''}
                >
                  <Send className="w-4 h-4" /> Enviar
                </button>
              )}
            </div>
          ) : (
            objectType.edit_policy === 'requires_approval' &&
            (!editRequest || editRequest.status === 'denied') && (
              <div>
                {!showRequestForm ? (
                  <button
                    onClick={() => setShowRequestForm(true)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-amber-400 text-amber-700 text-sm rounded-lg hover:bg-amber-50"
                  >
                    <Lock className="w-4 h-4" /> Solicitar permiso de edición
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={requestReason}
                      onChange={e => setRequestReason(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Explica por qué necesitas modificar este objeto..."
                    />
                    <div className="flex gap-2">
                      <button onClick={sendRequest} disabled={submitting || !requestReason.trim()}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50">
                        {submitting ? 'Enviando...' : 'Enviar solicitud'}
                      </button>
                      <button onClick={() => setShowRequestForm(false)} className="text-xs text-gray-500">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Panel lateral con instrucciones */}
        {objectType.instructions && (
          <div className="w-64 flex-shrink-0 border-l border-gray-100 p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Instrucciones</p>
            <p className="text-sm text-gray-600 leading-relaxed">{objectType.instructions}</p>
          </div>
        )}
      </div>
    </div>
  );
}
