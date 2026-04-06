import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronLeft, ChevronRight, X, Monitor, Users, Loader2,
  FileText, BookOpen, Video,
} from 'lucide-react';

interface MediaSlide {
  index: number;       // position in combined steps
  label: string;
  type: 'slides' | 'pdf' | 'video' | 'content';
  url?: string;
  text?: string;
}

interface Props {
  lessonId: string;
  courseId: string;
  onEnd: () => void;
}

export default function PresentationController({ lessonId, courseId, onEnd }: Props) {
  const { profile } = useAuth();
  const [sessionId, setSessionId]       = useState<string | null>(null);
  const [slides, setSlides]             = useState<MediaSlide[]>([]);
  const [current, setCurrent]           = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [ending, setEnding]             = useState(false);

  // ── Cargar lección y extraer slides de media ─────────────────────────────

  useEffect(() => {
    init();
  }, [lessonId]);

  async function init() {
    setLoading(true);

    // Cargar lección
    const { data: lesson } = await supabase
      .from('lessons').select('title, content').eq('id', lessonId).maybeSingle();

    const extracted: MediaSlide[] = [];
    let idx = 0;

    // content puede ser {steps: [...]} o directamente un array [...]
    const raw = lesson?.content;
    const steps: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.steps)
      ? raw.steps
      : [];

    // Convierte URL de Google Slides /edit a /embed
    function toEmbedUrl(url: string): string {
      if (url.includes('docs.google.com/presentation')) {
        return url
          .replace(/\/edit.*$/, '/embed?start=false&loop=false&delayms=3000')
          .replace(/\/pub.*$/, '/embed?start=false&loop=false&delayms=3000');
      }
      return url;
    }

    steps.forEach((step: any) => {
      // Soporta tanto step.url, step.pdf_url como step.media_url
      const rawUrl: string | undefined = step.url || step.media_url || step.pdf_url;

      if (rawUrl) {
        const isSlides = rawUrl.includes('docs.google.com/presentation');
        const isPdf    = rawUrl.includes('.pdf') || rawUrl.includes('supabase.co/storage');
        const isVideo  = rawUrl.includes('youtube') || rawUrl.includes('youtu.be') || rawUrl.includes('vimeo');

        if (isSlides) {
          extracted.push({
            index: idx,
            label: step.title || 'Presentación',
            type:  'slides',
            url:   toEmbedUrl(rawUrl),
            text:  step.text || step.content,
          });
        } else if (isPdf) {
          extracted.push({
            index: idx,
            label: step.title || 'Documento PDF',
            type:  'pdf',
            url:   rawUrl,
          });
        } else if (isVideo) {
          extracted.push({
            index: idx,
            label: step.title || 'Video',
            type:  'video',
            url:   rawUrl,
            text:  step.text || step.content,
          });
        } else {
          extracted.push({
            index: idx,
            label: step.title || 'Contenido',
            type:  'content',
            url:   rawUrl,
            text:  step.text || step.content,
          });
        }
      } else if (step.text || step.content) {
        extracted.push({
          index: idx,
          label: step.title || 'Contenido',
          type:  'content',
          text:  step.text || step.content,
        });
      }
      idx++;
    });

    if (extracted.length === 0) {
      // Si no hay media, mostrar aviso
      extracted.push({ index: 0, label: 'Sin contenido media', type: 'content', text: 'Esta lección no tiene slides, videos ni PDFs para presentar.' });
    }

    setSlides(extracted);

    // Crear sesión en Supabase
    const { data: session, error } = await supabase
      .from('presentation_sessions')
      .insert({
        lesson_id:          lessonId,
        course_id:          courseId,
        professor_id:       profile?.id,
        is_active:          true,
        current_step_index: 0,
      })
      .select().single();

    if (!error && session) setSessionId(session.id);

    // Contar estudiantes inscritos en el curso
    const { count } = await supabase
      .from('course_students')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);
    setStudentCount(count || 0);

    setLoading(false);
  }

  // ── Sincronizar paso actual con Supabase ────────────────────────────────

  const syncStep = useCallback(async (stepIndex: number) => {
    if (!sessionId) return;
    await supabase
      .from('presentation_sessions')
      .update({ current_step_index: stepIndex })
      .eq('id', sessionId);
  }, [sessionId]);

  function goTo(idx: number) {
    const clamped = Math.max(0, Math.min(idx, slides.length - 1));
    setCurrent(clamped);
    syncStep(clamped);
  }

  // ── Teclado ────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(current + 1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goTo(current - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, sessionId, slides.length]);

  // ── Terminar sesión ────────────────────────────────────────────────────

  async function endSession() {
    if (!confirm('¿Terminar la presentación? Los estudiantes volverán a su dashboard.')) return;
    setEnding(true);
    if (sessionId) {
      await supabase.from('presentation_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
    onEnd();
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="text-center text-white">
        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 text-blue-400" />
        <p className="text-lg">Iniciando presentación...</p>
      </div>
    </div>
  );

  const slide = slides[current];

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">

      {/* ── Barra superior ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-4">
          <Monitor className="w-5 h-5 text-blue-400" />
          <span className="text-white font-semibold text-sm">Modo Presentación</span>
          <span className="text-xs text-gray-400 hidden sm:inline">
            {slide.label}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <Users className="w-4 h-4" />
            {studentCount} estudiante{studentCount !== 1 ? 's' : ''} siguiendo
          </span>
          <span className="text-xs text-gray-400">
            {current + 1} / {slides.length}
          </span>
          <button onClick={endSession} disabled={ending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition disabled:opacity-50">
            <X className="w-3.5 h-3.5" /> Terminar
          </button>
        </div>
      </div>

      {/* ── Minimap de slides ── */}
      <div className="flex gap-1.5 px-6 py-2 bg-gray-800 overflow-x-auto shrink-0">
        {slides.map((s, i) => (
          <button key={i} onClick={() => goTo(i)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition ${
              i === current
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}>
            {s.type === 'slides'  && <BookOpen className="w-3 h-3" />}
            {s.type === 'pdf'     && <FileText className="w-3 h-3" />}
            {s.type === 'video'   && <Video className="w-3 h-3" />}
            {s.type === 'content' && <BookOpen className="w-3 h-3" />}
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4 py-4">
        {(slide.type === 'slides' || slide.type === 'video') && slide.url && (
          <div className="w-full max-w-6xl" style={{ aspectRatio: '16/9' }}>
            <iframe
              key={slide.url}
              src={slide.url}
              className="w-full h-full rounded-lg border-0"
              allowFullScreen
              allow="autoplay; encrypted-media"
            />
          </div>
        )}

        {slide.type === 'pdf' && slide.url && (
          <iframe
            key={slide.url}
            src={slide.url}
            className="w-full max-w-4xl h-full rounded-lg border-0"
          />
        )}

        {slide.type === 'content' && (
          <div className="max-w-2xl w-full bg-white rounded-2xl p-10 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{slide.label}</h2>
            {slide.text && <p className="text-gray-700 text-lg leading-relaxed">{slide.text}</p>}
          </div>
        )}
      </div>

      {/* ── Controles inferiores ── */}
      <div className="flex items-center justify-center gap-6 py-4 bg-gray-800 border-t border-gray-700 shrink-0">
        <button onClick={() => goTo(current - 1)} disabled={current === 0}
          className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 disabled:opacity-30 transition text-sm font-medium">
          <ChevronLeft className="w-5 h-5" /> Anterior
        </button>
        <span className="text-gray-400 text-sm min-w-20 text-center">
          {current + 1} de {slides.length}
        </span>
        <button onClick={() => goTo(current + 1)} disabled={current === slides.length - 1}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-30 transition text-sm font-medium">
          Siguiente <ChevronRight className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
}
