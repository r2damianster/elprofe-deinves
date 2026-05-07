import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import ProjectObjectWriter from './ProjectObjectWriter';
import ProjectPresentation from './ProjectPresentation';

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
  order_index: number;
  parent_object_type_id: string | null;
  min_words: number;
  edit_policy: 'always' | 'requires_approval' | 'locked_after_submit';
};

type ProjectObject = {
  id: string;
  object_type_id: string;
  content: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  word_count: number;
  score: number | null;
  version: number;
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-500',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  needs_revision: 'bg-amber-100 text-amber-700',
};
const STATUS_LABELS = {
  draft: 'Borrador',
  submitted: 'Enviado',
  approved: 'Aprobado',
  needs_revision: 'Revisar',
};

const LOGIC_LABELS = {
  ordinal: 'Secuencial',
  causal: 'Causal',
  structural: 'Estructural',
};

function Arrow() {
  return (
    <div className="flex justify-center py-1 text-gray-300">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

export default function ProjectObjectList({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [types, setTypes] = useState<ObjectType[]>([]);
  const [objects, setObjects] = useState<ProjectObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [writingTypeId, setWritingTypeId] = useState<string | null>(null);
  const [showPresentation, setShowPresentation] = useState(false);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    const [projRes, typesRes, objsRes] = await Promise.all([
      sb.from('projects').select('id,title,description,object_logic').eq('id', projectId).single(),
      sb.from('project_object_types').select('*').eq('project_id', projectId).order('order_index'),
      sb.from('project_objects').select('*').eq('project_id', projectId).eq('student_id', user!.id),
    ]);
    if (projRes.data) setProject(projRes.data as Project);
    setTypes((typesRes.data ?? []) as ObjectType[]);
    setObjects((objsRes.data ?? []) as ProjectObject[]);
    setLoading(false);
  }

  function objectFor(typeId: string): ProjectObject | undefined {
    return objects.find(o => o.object_type_id === typeId);
  }

  if (showPresentation && project) {
    return <ProjectPresentation projectId={projectId} onBack={() => setShowPresentation(false)} />;
  }

  if (writingTypeId) {
    return (
      <ProjectObjectWriter
        objectTypeId={writingTypeId}
        projectId={projectId}
        onBack={() => { setWritingTypeId(null); load(); }}
      />
    );
  }

  if (loading || !project) {
    return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando...</div>;
  }

  const completedCount = types.filter(t => {
    const o = objectFor(t.id);
    return o?.status === 'submitted' || o?.status === 'approved';
  }).length;

  const allDone = completedCount === types.length && types.length > 0;

  // Aplanar árbol para lógica estructural
  function flattenStructural(parentId: string | null = null, depth = 0): Array<{ type: ObjectType; depth: number }> {
    return types
      .filter(t => t.parent_object_type_id === parentId)
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap(t => [{ type: t, depth }, ...flattenStructural(t.id, depth + 1)]);
  }

  const flatTypes = project.object_logic === 'structural'
    ? flattenStructural()
    : types.sort((a, b) => a.order_index - b.order_index).map(t => ({ type: t, depth: 0 }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-800 truncate">{project.title}</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{LOGIC_LABELS[project.object_logic]}</span>
            <span>{completedCount}/{types.length} objetos completados</span>
          </div>
        </div>
        {allDone && (
          <button
            onClick={() => setShowPresentation(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
          >
            Ver proyecto completo
          </button>
        )}
      </div>

      {project.description && (
        <p className="text-sm text-gray-500">{project.description}</p>
      )}

      {/* Barra de progreso */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progreso</span>
          <span>{types.length > 0 ? Math.round((completedCount / types.length) * 100) : 0}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-indigo-500 transition-all"
            style={{ width: types.length > 0 ? `${(completedCount / types.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Lista de objetos */}
      <div className="space-y-1">
        {flatTypes.map(({ type: t, depth }, i) => {
          const obj = objectFor(t.id);
          const isLast = i === flatTypes.length - 1;

          return (
            <div key={t.id}>
              <button
                onClick={() => setWritingTypeId(t.id)}
                className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition group"
                style={{ marginLeft: `${depth * 20}px`, width: `calc(100% - ${depth * 20}px)` }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 text-sm">{t.name}</span>
                      {obj ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[obj.status]}`}>
                          {STATUS_LABELS[obj.status]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin iniciar</span>
                      )}
                      {obj?.score !== null && obj?.score !== undefined && (
                        <span className="text-xs text-emerald-600 font-semibold">{obj.score}/10</span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {obj ? `${obj.word_count} palabras` : `Mín. ${t.min_words} palabras`}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition flex-shrink-0" />
                </div>
              </button>
              {project.object_logic === 'causal' && !isLast && <Arrow />}
            </div>
          );
        })}
      </div>

      {types.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed rounded-xl">
          Este proyecto aún no tiene objetos definidos.
        </div>
      )}
    </div>
  );
}
