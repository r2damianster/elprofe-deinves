import { FileText, Image as ImageIcon, Layout } from 'lucide-react';

interface ContentStep {
  title?: string;
  type: 'text' | 'image' | 'embed';
  content?: string;
  url?: string;
}

export default function ContentRenderer({ step }: { step: ContentStep }) {
  return (
    <div className="animate-in fade-in duration-500">
      {step.title && (
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Layout className="w-6 h-6 text-blue-600" />
          {step.title}
        </h2>
      )}

      <div className="prose prose-blue max-w-none">
        {/* CASO 1: TEXTO NORMAL */}
        {step.type === 'text' && (
          <div className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
            {step.content}
          </div>
        )}

        {/* CASO 2: IMAGEN */}
        {step.type === 'image' && (
          <div className="rounded-2xl overflow-hidden border-4 border-white shadow-lg">
            <img src={step.url} alt={step.title} className="w-full h-auto" />
          </div>
        )}

        {/* CASO 3: EMBED (Google Slides, Canva, YouTube, PDF) */}
        {step.type === 'embed' && (
          <div className="relative w-full overflow-hidden rounded-xl shadow-xl bg-black aspect-video">
            <iframe
              src={step.url}
              className="absolute top-0 left-0 w-full h-full border-0"
              allowFullScreen
              allow="autoplay; encrypted-media"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}