import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, AlertCircle, CheckCircle, Save, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ProductionRules {
  min_words: number;
  max_words: number | null;
  required_words: string[];
  prohibited_words: string[];
  instructions: string | null;
}

interface Production {
  id: string;
  content: string;
  word_count: number;
  status: string;
  score: number | null;
  feedback: string | null;
}

interface ProductionEditorProps {
  lessonId: string;
  onBack: () => void;
}

export default function ProductionEditor({ lessonId, onBack }: ProductionEditorProps) {
  const { profile } = useAuth();
  const [rules, setRules] = useState<ProductionRules | null>(null);
  const [production, setProduction] = useState<Production | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    loadRules();
    loadProduction();
  }, [lessonId]);

  useEffect(() => {
    validateContent();
  }, [content]);

  async function loadRules() {
    const { data } = await supabase
      .from('production_rules')
      .select('*')
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (data) setRules(data);
  }

  async function loadProduction() {
    const { data } = await supabase
      .from('productions')
      .select('*')
      .eq('student_id', profile?.id)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (data) {
      setProduction(data);
      setContent(data.content);
    }
  }

  function validateContent() {
    if (!rules) return;

    const errors: string[] = [];
    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const lowerContent = content.toLowerCase();

    if (wordCount < rules.min_words) {
      errors.push(`Mínimo de palabras requerido: ${rules.min_words} (actual: ${wordCount})`);
    }

    if (rules.max_words && wordCount > rules.max_words) {
      errors.push(`Máximo de palabras: ${rules.max_words} (actual: ${wordCount})`);
    }

    const missingWords = rules.required_words.filter(
      (word) => !lowerContent.includes(word.toLowerCase())
    );
    if (missingWords.length > 0) {
      errors.push(`Palabras requeridas faltantes: ${missingWords.join(', ')}`);
    }

    const foundProhibited = rules.prohibited_words.filter((word) =>
      lowerContent.includes(word.toLowerCase())
    );
    if (foundProhibited.length > 0) {
      errors.push(`Palabras prohibidas encontradas: ${foundProhibited.join(', ')}`);
    }

    setValidationErrors(errors);
  }

  async function saveProduction() {
    setSaving(true);
    try {
      const words = content.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      if (production) {
        await supabase
          .from('productions')
          .update({ content, word_count: wordCount })
          .eq('id', production.id);
      } else {
        const { data } = await supabase
          .from('productions')
          .insert({
            student_id: profile?.id,
            lesson_id: lessonId,
            content,
            word_count: wordCount,
            status: 'draft',
          })
          .select()
          .single();

        if (data) setProduction(data);
      }

      alert('Guardado exitosamente');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitProduction() {
    if (validationErrors.length > 0) {
      alert('Por favor corrige los errores antes de enviar');
      return;
    }

    if (!confirm('¿Estás seguro de enviar esta producción? No podrás editarla después (a menos que te quede un reintento).')) {
      return;
    }

    setSubmitting(true);
    try {
      const words = content.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      if (production) {
        await supabase
          .from('productions')
          .update({
            content,
            word_count: wordCount,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', production.id);
      } else {
        await supabase.from('productions').insert({
          student_id: profile?.id,
          lesson_id: lessonId,
          content,
          word_count: wordCount,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        });
      }

      alert('Producción enviada exitosamente');
      loadProduction();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function retryProduction() {
    if (!confirm('Esto reiniciará tu ensayo al formato de borrador consumiendo tu último intento. ¿Proceder?')) return;
    
    setSubmitting(true);
    try {
      if (production) {
        await supabase
          .from('productions')
          .update({
            status: 'draft',
            score: null,
            feedback: null,
            reviewed_at: null,
            attempts: (production.attempts || 1) + 1,
            submitted_at: null
          })
          .eq('id', production.id);
        
        loadProduction();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const isSubmitted = production?.status === 'submitted' || production?.status === 'reviewed';
  const isValid = validationErrors.length === 0 && wordCount > 0;
  const attempts = production?.attempts || 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver a la lección
          </button>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Producción</h1>
            {isSubmitted && (
              <span className="text-sm text-gray-500 font-medium">
                Intento {attempts} de 2
              </span>
            )}
          </div>
          {rules?.instructions && (
            <p className="text-gray-600 mt-2">{rules.instructions}</p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {production?.status === 'reviewed' && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg text-blue-900">Producción Revisada</h3>
              {attempts < 2 && (
                <button
                  onClick={retryProduction}
                  disabled={submitting}
                  className="bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition px-4 py-1.5 rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  Rehacer Ensayo
                </button>
              )}
            </div>
            <p className="text-blue-800 mb-2">
              Puntuación: {production.score} / 100
            </p>
            {production.feedback && (
              <div className="bg-white rounded p-4 mt-3">
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  Retroalimentación:
                </p>
                <p className="text-gray-800">{production.feedback}</p>
              </div>
            )}
          </div>
        )}

        {rules && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="font-bold text-lg text-gray-800 mb-4">Requisitos</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>
                Palabras mínimas: <strong>{rules.min_words}</strong>
              </li>
              {rules.max_words && (
                <li>
                  Palabras máximas: <strong>{rules.max_words}</strong>
                </li>
              )}
              {rules.required_words.length > 0 && (
                <li>
                  Palabras obligatorias:{' '}
                  <strong>{rules.required_words.join(', ')}</strong>
                </li>
              )}
              {rules.prohibited_words.length > 0 && (
                <li>
                  Palabras prohibidas:{' '}
                  <strong>{rules.prohibited_words.join(', ')}</strong>
                </li>
              )}
            </ul>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-red-900 mb-2">Errores de Validación</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {isValid && wordCount > 0 && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-green-800 font-semibold">
                Tu producción cumple con todos los requisitos
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-800">Escribe tu producción</h3>
            <span className="text-sm text-gray-600">{wordCount} palabras</span>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
            rows={15}
            placeholder="Comienza a escribir..."
            disabled={isSubmitted}
          />

          {!isSubmitted && (
            <div className="flex space-x-4 mt-6">
              <button
                onClick={saveProduction}
                disabled={saving || wordCount === 0}
                className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Borrador'}
              </button>
              <button
                onClick={submitProduction}
                disabled={submitting || !isValid}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
              >
                <Send className="w-5 h-5 mr-2" />
                {submitting ? 'Enviando...' : 'Enviar Producción'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
