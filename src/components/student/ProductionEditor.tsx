import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, AlertCircle, CheckCircle, Save, Send, ShieldAlert, BarChart } from 'lucide-react';
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
  student_id: string;
  lesson_id: string;
  content: string;
  word_count: number;
  status: string;
  score: number | null;
  feedback: string | null;
  attempts: number;
  compliance_score: number;
  integrity_score: number;
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
  
  // Métricas
  const [integrityScore, setIntegrityScore] = useState(100);
  const [complianceScore, setComplianceScore] = useState(0);

  const isSubmitted = production?.status === 'submitted' || production?.status === 'reviewed';

  useEffect(() => {
    loadRules();
    loadProduction();
  }, [lessonId]);

  useEffect(() => {
    validateContent();
  }, [content, rules]);

  // Detector de cambio de pestaña (Anti-Cheat)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitted && !submitting) {
        alert('¡ALERTA ROJA DE INTEGRIDAD!\n\nSe ha detectado un cambio de pestaña (posible consulta externa o uso de IA). Tu puntuación de integridad ha sido penalizada fuertemente.');
        setIntegrityScore(prev => Math.max(0, prev - 10));
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSubmitted, submitting]);

  // Auto-Envío Forzado por Integridad Baja
  useEffect(() => {
    if (integrityScore <= 50 && !isSubmitted && !submitting && rules) {
      alert('⚠️ ATENCIÓN: Tu Integridad ha caído a niveles críticos (<= 50%). El sistema ha cerrado tu ensayo y lo enviará automáticamente al profesor para su investigación. \n\nRecuerda que tienes una única oportunidad de reintento si el profesor permite rehacer.');
      submitProduction(true);
    }
  }, [integrityScore, isSubmitted, rules]);

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
      if (data.integrity_score !== undefined && data.integrity_score !== null) {
        setIntegrityScore(data.integrity_score);
      }
      if (data.compliance_score !== undefined && data.compliance_score !== null) {
        setComplianceScore(data.compliance_score);
      }
    }
  }

  function validateContent() {
    if (!rules) return;

    const errors: string[] = [];
    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const lowerContent = content.toLowerCase();

    let rulesMet = 0;
    let totalRules = 1; // min words siempre cuenta

    // Min words
    if (wordCount < rules.min_words) {
      errors.push(`Mínimo de palabras requerido: ${rules.min_words} (actual: ${wordCount})`);
    } else {
      rulesMet++;
    }

    // Max words
    if (rules.max_words) {
      totalRules++;
      if (wordCount > rules.max_words) {
        errors.push(`Máximo de palabras: ${rules.max_words} (actual: ${wordCount})`);
      } else {
        rulesMet++;
      }
    }

    // Required words
    const missingWords = rules.required_words.filter(word => !lowerContent.includes(word.toLowerCase()));
    if (rules.required_words.length > 0) {
      totalRules += rules.required_words.length;
      const foundCount = rules.required_words.length - missingWords.length;
      rulesMet += foundCount;
      if (missingWords.length > 0) {
        errors.push(`Palabras requeridas faltantes: ${missingWords.join(', ')}`);
      }
    }

    // Prohibited words
    const foundProhibited = rules.prohibited_words.filter(word => lowerContent.includes(word.toLowerCase()));
    if (rules.prohibited_words.length > 0) {
      totalRules += rules.prohibited_words.length;
      const avoidedCount = rules.prohibited_words.length - foundProhibited.length;
      rulesMet += avoidedCount;
      if (foundProhibited.length > 0) {
        errors.push(`Palabras prohibidas encontradas: ${foundProhibited.join(', ')}`);
      }
    }

    setValidationErrors(errors);
    setComplianceScore(Math.round((rulesMet / totalRules) * 100));
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!isSubmitted) {
      alert('¡ALERTA ROJA DE INTEGRIDAD!\n\nPegar texto externo está estrictamente prohibido y fuertemente penalizado. El profesor observará esta infracción.');
      setIntegrityScore(prev => Math.max(0, prev - 15));
    }
  };

  async function saveProduction() {
    setSaving(true);
    try {
      const words = content.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      if (production) {
        await supabase
          .from('productions')
          .update({ content, word_count: wordCount, compliance_score: complianceScore, integrity_score: integrityScore })
          .eq('id', production.id);
      } else {
        const { data } = await supabase
          .from('productions')
          .insert({
            student_id: profile?.id!,
            lesson_id: lessonId,
            content,
            word_count: wordCount,
            status: 'draft',
            compliance_score: complianceScore,
            integrity_score: integrityScore
          })
          .select()
          .single();

        if (data) setProduction(data);
      }
      alert('Borrador guardado exitosamente');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitProduction(forced = false) {
    if (!forced && validationErrors.length > 0) {
      alert('Por favor corrige los errores antes de enviar');
      return;
    }
    if (!forced && !confirm('¿Estás seguro de enviar esta producción? No podrás editarla después (a menos que te quede un reintento).')) {
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
            compliance_score: complianceScore,
            integrity_score: integrityScore,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', production.id);
      } else {
        await supabase.from('productions').insert({
          student_id: profile?.id!,
          lesson_id: lessonId,
          content,
          word_count: wordCount,
          status: 'submitted',
          compliance_score: complianceScore,
          integrity_score: integrityScore,
          submitted_at: new Date().toISOString(),
        });
      }

      if (!forced) alert('Producción enviada exitosamente');
      loadProduction();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function retryProduction() {
    if (!confirm('Esto reiniciará tu ensayo al formato de borrador consumiendo tu último intento (2/2). ¿Proceder?')) return;
    
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
            submitted_at: null,
            integrity_score: 100 // Reset integrity on a fresh attempt
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
  const isValid = validationErrors.length === 0 && wordCount > 0;
  const attempts = production?.attempts || 1;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow z-10 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-3 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver a la lección
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Redacción Final</h1>
              {rules?.instructions && <p className="text-gray-600 mt-1 text-sm">{rules.instructions}</p>}
            </div>
            {isSubmitted && (
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase border border-blue-200 shadow-sm">
                Intento {attempts} de 2
              </span>
            )}
          </div>
        </div>
        
        {/* Barras de Métricas */}
        <div className="bg-gray-800 text-white px-4 py-3 shadow-inner">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <div className="w-full sm:w-1/2">
              <div className="flex justify-between text-xs font-semibold mb-1 tracking-wide uppercase">
                <span className="flex items-center"><BarChart className="w-3 h-3 mr-1"/> Cumplimiento de Reglas</span>
                <span>{complianceScore}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 flex items-center justify-end ${complianceScore === 100 ? 'bg-green-400' : complianceScore > 50 ? 'bg-blue-400' : 'bg-red-400'}`} 
                  style={{ width: `${complianceScore}%` }}
                />
              </div>
            </div>

            <div className="w-full sm:w-1/2">
              <div className="flex justify-between text-xs font-semibold mb-1 tracking-wide uppercase">
                <span className="flex items-center"><ShieldAlert className="w-3 h-3 mr-1 text-red-300"/> Integridad (Anti-Trampa)</span>
                <span className={`${integrityScore <= 50 ? 'text-red-400 font-bold' : 'text-green-300'}`}>{integrityScore}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${integrityScore > 80 ? 'bg-green-400' : integrityScore > 50 ? 'bg-yellow-400' : 'bg-red-500'}`} 
                  style={{ width: `${integrityScore}%` }}
                />
              </div>
            </div>

          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        {production?.status === 'reviewed' && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg text-blue-900">Producción Revisada por el Profesor</h3>
              {attempts < 2 && (
                <button
                  onClick={retryProduction}
                  disabled={submitting}
                  className="bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition px-4 py-1.5 rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  Usar Intento Extra
                </button>
              )}
            </div>
            <p className="text-blue-800 font-medium mb-3">
              Calificación Final: <span className="text-xl font-bold bg-white px-2 py-0.5 rounded border">{production.score}/100</span>
            </p>
            {production.feedback && (
              <div className="bg-white rounded-lg p-4 border shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Comentarios del maestro:</p>
                <p className="text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">{production.feedback}</p>
              </div>
            )}
          </div>
        )}

        {rules && !isSubmitted && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-blue-600" /> Requisitos de Escritura
            </h3>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li>• Mínimo <strong>{rules.min_words}</strong> palabras.</li>
              {rules.max_words && <li>• Máximo <strong>{rules.max_words}</strong> palabras.</li>}
              {rules.required_words.length > 0 && <li>• Debes usar: <strong className="text-green-700">{rules.required_words.join(', ')}</strong>.</li>}
              {rules.prohibited_words.length > 0 && <li>• Prohibido usar: <strong className="text-red-600">{rules.prohibited_words.join(', ')}</strong>.</li>}
            </ul>
          </div>
        )}

        {validationErrors.length > 0 && !isSubmitted && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h4 className="font-bold text-red-800 mb-2 flex items-center text-sm uppercase">Problemas a resolver:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700 font-medium">
              {validationErrors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {isValid && wordCount > 0 && !isSubmitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
            <CheckCircle className="w-6 h-6 text-green-600 mr-3 shrink-0" />
            <p className="text-green-800 font-bold">¡Excelente! El ensayo cumple con todos los requisitos estructurales.</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-6 flex flex-col flex-1">
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-bold text-lg text-gray-800">Hoja de Trabajo</h3>
            <span className={`text-sm font-bold px-2 py-0.5 rounded ${wordCount < (rules?.min_words || 0) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {wordCount} palabras
            </span>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            className="flex-1 w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition resize-none text-gray-700 leading-relaxed min-h-[300px]"
            placeholder="Empieza a redactar tu ensayo aquí. Recuerda que no puedes pegar texto de otros sitios..."
            disabled={isSubmitted || integrityScore <= 50 || submitting}
          />

          {!isSubmitted && (
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <button
                onClick={saveProduction}
                disabled={saving || wordCount === 0 || submitting}
                className="flex-1 bg-gray-100 text-gray-700 border border-gray-300 py-3 rounded-xl hover:bg-gray-200 transition font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Save className="w-5 h-5 mr-2" /> {saving ? 'Guardando...' : 'Guardar Progreso'}
              </button>
              <button
                onClick={() => submitProduction(false)}
                disabled={submitting || !isValid || integrityScore <= 50}
                className="flex-1 bg-blue-600 text-white shadow-md shadow-blue-200 py-3 rounded-xl hover:bg-blue-700 transition font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="w-5 h-5 mr-2" /> {submitting ? 'Enviando...' : 'Entregar Ensayo'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
