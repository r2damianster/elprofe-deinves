import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Monitor, Loader2, BookOpen, FileText, Video } from 'lucide-react';

interface MediaSlide {
  label: string;
  type: 'slides' | 'pdf' | 'video' | 'content';
  url?: string;
  text?: string;
}

interface Session {
  id: string;
  lesson_id: string;
  current_step_index: number;
  professor_name?: string;
}

interface Props {
  session: Session;
  onSessionEnd: () => void;
}

export default function PresentationViewer({ session, onSessionEnd }: Props) {
  const [slides, setSlides]   = useState<MediaSlide[]>([]);
  const [current, setCurrent] = useState(session.current_step_index);
  const [loading, setLoading] = useState(true);

  // ── Cargar slides de la lección ─────────────────────────────────────────

  useEffect(() => {
    async function loadSlides() {
      const { data: lesson } = await supabase
        .from('lessons').select('content').eq('id', session.lesson_id).maybeSingle();

      const extracted: MediaSlide[] = [];
      const steps: any[] = lesson?.content?.steps ?? [];

      steps.forEach((step: any) => {
        if (step.url) {
          const isSlides = step.url.includes('docs.google.com/presentation');
          const isVideo  = step.url.includes('youtube') || step.url.includes('youtu.be') || step.url.includes('vimeo');
          extracted.push({
            label: step.title || (isSlides ? 'Presentación' : 'Video'),
            type:  isSlides ? 'slides' : isVideo ? 'video' : 'content',
            url:   step.url,
            text:  step.text,
          });
        } else if (step.pdf_url) {
          extracted.push({ label: step.title || 'PDF', type: 'pdf', url: step.pdf_url });
        } else if (step.text) {
          extracted.push({ label: step.title || 'Contenido', type: 'content', text: step.text });
        }
      });

      if (extracted.length === 0) {
        extracted.push({ label: 'Presentación', type: 'content', text: 'El profesor está presentando.' });
      }

      setSlides(extracted);
      setLoading(false);
    }
    loadSlides();
  }, [session.lesson_id]);

  // ── Realtime: seguir el paso del profesor ───────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`presentation_${session.id}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'presentation_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (!updated.is_active) {
            // Profesor terminó la sesión
            onSessionEnd();
            return;
          }
          setCurrent(updated.current_step_index);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
    </div>
  );

  const slide = slides[Math.min(current, slides.length - 1)];

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">

      {/* Barra superior */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-bold uppercase tracking-widest">EN VIVO</span>
          </div>
          <Monitor className="w-4 h-4 text-blue-400" />
          <span className="text-white text-sm font-semibold">
            {session.professor_name ? `Clase con ${session.professor_name}` : 'Clase en directo'}
          </span>
        </div>
        <span className="text-gray-400 text-xs">
          {current + 1} / {slides.length}
        </span>
      </div>

      {/* Minimap (solo visual, no interactivo) */}
      <div className="flex gap-1.5 px-6 py-2 bg-gray-800 overflow-x-auto shrink-0">
        {slides.map((s, i) => (
          <div key={i}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${
              i === current ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'
            }`}>
            {s.type === 'slides'  && <BookOpen className="w-3 h-3" />}
            {s.type === 'pdf'     && <FileText className="w-3 h-3" />}
            {s.type === 'video'   && <Video className="w-3 h-3" />}
            {s.type === 'content' && <BookOpen className="w-3 h-3" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4 py-4">
        {(slide.type === 'slides' || slide.type === 'video') && slide.url && (
          <div className="w-full max-w-6xl" style={{ aspectRatio: '16/9' }}>
            <iframe
              key={slide.url}
              src={slide.url}
              className="w-full h-full rounded-lg border-0 pointer-events-none"
              allowFullScreen
            />
          </div>
        )}

        {slide.type === 'pdf' && slide.url && (
          <iframe
            key={slide.url}
            src={slide.url}
            className="w-full max-w-4xl h-full rounded-lg border-0 pointer-events-none"
          />
        )}

        {slide.type === 'content' && (
          <div className="max-w-2xl w-full bg-white rounded-2xl p-10 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{slide.label}</h2>
            {slide.text && <p className="text-gray-700 text-lg leading-relaxed">{slide.text}</p>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-3 bg-gray-800 border-t border-gray-700 text-center shrink-0">
        <p className="text-gray-500 text-xs">
          Siguiendo la presentación del profesor · Las actividades estarán disponibles cuando termine
        </p>
      </div>

    </div>
  );
}
