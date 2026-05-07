import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from '../../contexts/AuthContext';

type Project = {
  id: string;
  title: string;
  description: string | null;
  object_logic: 'ordinal' | 'causal' | 'structural';
};

type ObjectType = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  order_index: number;
  parent_object_type_id: string | null;
};

type ProjectObject = {
  id: string;
  object_type_id: string;
  content: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  word_count: number;
  score: number | null;
  feedback: string | null;
  version: number;
};

type Slide = {
  objectType: ObjectType;
  object: ProjectObject | null;
  children: Slide[];
  depth: number;
};

type Props = {
  projectId: string;
  studentId?: string; // si el profesor ve el proyecto de un estudiante específico
  onBack: () => void;
};

function buildTree(types: ObjectType[], objects: ProjectObject[], depth = 0, parentId: string | null = null): Slide[] {
  return types
    .filter(t => t.parent_object_type_id === parentId)
    .sort((a, b) => a.order_index - b.order_index)
    .map(t => ({
      objectType: t,
      object: objects.find(o => o.object_type_id === t.id) ?? null,
      children: buildTree(types, objects, depth + 1, t.id),
      depth,
    }));
}

function buildLinear(types: ObjectType[], objects: ProjectObject[]): Slide[] {
  return types
    .sort((a, b) => a.order_index - b.order_index)
    .map(t => ({
      objectType: t,
      object: objects.find(o => o.object_type_id === t.id) ?? null,
      children: [],
      depth: 0,
    }));
}

function statusColor(status: string | null) {
  if (!status) return 'bg-slate-600';
  return {
    draft: 'bg-slate-500',
    submitted: 'bg-blue-600',
    approved: 'bg-emerald-600',
    needs_revision: 'bg-amber-600',
  }[status] ?? 'bg-slate-600';
}

function statusLabel(status: string | null) {
  if (!status) return 'Sin iniciar';
  return {
    draft: 'Borrador',
    submitted: 'Enviado',
    approved: 'Aprobado',
    needs_revision: 'Requiere revisión',
  }[status] ?? status;
}

function SlideCard({ slide, index, isActive, onClick }: {
  slide: Slide;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isActive ? 'bg-indigo-700 text-white' : 'hover:bg-slate-700 text-slate-300'
      }`}
      style={{ paddingLeft: `${(slide.depth + 1) * 12}px` }}
    >
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusColor(slide.object?.status ?? null)}`} />
        <span className="text-sm truncate">{index + 1}. {slide.objectType.name}</span>
      </div>
    </button>
  );
}

function CausalConnector() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex flex-col items-center text-slate-500">
        <div className="w-px h-3 bg-slate-600" />
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v10.586l2.293-2.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 14.586V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  );
}

export default function ProjectPresentation({ projectId, studentId, onBack }: Props) {
  const { user } = useAuth();
  const targetStudentId = studentId ?? user?.id ?? '';

  const [project, setProject] = useState<Project | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    load();
  }, [projectId, targetStudentId]);

  async function load() {
    setLoading(true);
    setError(null);

    const [projRes, typesRes, objsRes] = await Promise.all([
      sb.from('projects').select('id,title,description,object_logic').eq('id', projectId).single(),
      sb.from('project_object_types').select('*').eq('project_id', projectId).order('order_index'),
      sb.from('project_objects').select('*').eq('project_id', projectId).eq('student_id', targetStudentId),
    ]);

    if (projRes.error) { setError('No se pudo cargar el proyecto.'); setLoading(false); return; }
    if (typesRes.error) { setError('No se pudieron cargar los objetos del proyecto.'); setLoading(false); return; }

    const proj = projRes.data as Project;
    const types = (typesRes.data ?? []) as ObjectType[];
    const objs = (objsRes.data ?? []) as ProjectObject[];

    setProject(proj);

    if (proj.object_logic === 'structural') {
      setSlides(flattenTree(buildTree(types, objs)));
    } else {
      setSlides(buildLinear(types, objs));
    }

    setLoading(false);
  }

  function flattenTree(tree: Slide[]): Slide[] {
    return tree.flatMap(s => [s, ...flattenTree(s.children)]);
  }

  const current = slides[currentIndex];

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">Cargando presentación...</div>
  );
  if (error) return (
    <div className="p-6 text-red-400">{error}</div>
  );
  if (!project || slides.length === 0) return (
    <div className="p-6 text-slate-400">No hay objetos en este proyecto.</div>
  );

  const completedCount = slides.filter(s => s.object?.status === 'approved' || s.object?.status === 'submitted').length;

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-slate-900' : 'flex flex-col h-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-white font-semibold text-sm">{project.title}</h2>
            <p className="text-slate-400 text-xs">
              {completedCount}/{slides.length} objetos completados &middot;{' '}
              <span className="capitalize">{project.object_logic}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">{currentIndex + 1} / {slides.length}</span>
          <button
            onClick={() => setFullscreen(f => !f)}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {fullscreen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — índice de diapositivas */}
        <div className="w-52 bg-slate-800 border-r border-slate-700 overflow-y-auto flex-shrink-0 py-2">
          {project.object_logic === 'causal' ? (
            slides.map((slide, i) => (
              <div key={slide.objectType.id}>
                <SlideCard slide={slide} index={i} isActive={i === currentIndex} onClick={() => setCurrentIndex(i)} />
                {i < slides.length - 1 && <CausalConnector />}
              </div>
            ))
          ) : (
            slides.map((slide, i) => (
              <SlideCard key={slide.objectType.id} slide={slide} index={i} isActive={i === currentIndex} onClick={() => setCurrentIndex(i)} />
            ))
          )}
        </div>

        {/* Área principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {current && (
            <>
              {/* Cabecera del objeto */}
              <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {current.objectType.parent_object_type_id && (
                      <span className="text-xs text-slate-500">
                        {slides.find(s => s.objectType.id === current.objectType.parent_object_type_id)?.objectType.name}
                        {' ▸ '}
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-white">{current.objectType.name}</h3>
                  </div>
                  {current.objectType.description && (
                    <p className="text-slate-400 text-sm">{current.objectType.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {current.object && (
                    <>
                      <span className={`px-2 py-0.5 text-xs rounded-full text-white ${statusColor(current.object.status)}`}>
                        {statusLabel(current.object.status)}
                      </span>
                      {current.object.score !== null && (
                        <span className="text-sm font-semibold text-emerald-400">{current.object.score}/10</span>
                      )}
                      <span className="text-xs text-slate-500">{current.object.word_count} palabras</span>
                    </>
                  )}
                </div>
              </div>

              {/* Contenido */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {current.object?.content ? (
                  <div className="max-w-3xl mx-auto">
                    <div className="prose prose-invert prose-sm max-w-none">
                      {current.object.content.split('\n').filter(Boolean).map((para, i) => (
                        <p key={i} className="text-slate-200 leading-relaxed mb-4">{para}</p>
                      ))}
                    </div>

                    {current.object.feedback && (
                      <div className="mt-6 p-4 bg-amber-900/30 border border-amber-700 rounded-lg">
                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Retroalimentación del profesor</p>
                        <p className="text-amber-100 text-sm">{current.object.feedback}</p>
                      </div>
                    )}

                    <div className="mt-4 text-xs text-slate-600">
                      Versión {current.object.version} &middot; {current.object.word_count} palabras
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto flex flex-col items-center justify-center h-48 text-slate-500">
                    <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">Este objeto aún no ha sido redactado</p>
                    {current.objectType.instructions && (
                      <p className="text-xs text-slate-600 mt-2 text-center max-w-sm">{current.objectType.instructions}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Navegación */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700 bg-slate-800/50">
                <button
                  onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Anterior
                </button>

                <div className="flex gap-1">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === currentIndex ? 'bg-indigo-400' : 'bg-slate-600 hover:bg-slate-500'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setCurrentIndex(i => Math.min(slides.length - 1, i + 1))}
                  disabled={currentIndex === slides.length - 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
