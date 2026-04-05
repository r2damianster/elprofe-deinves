import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Importación de todos los tipos de actividades
import MultipleChoice from './activities/MultipleChoice';
import DragDrop from './activities/DragDrop';
import Essay from './activities/Essay';
import ShortAnswer from './activities/ShortAnswer';
import FillBlank from './activities/FillBlank';
import Ordering from './activities/Ordering';
import Matching from './activities/Matching';
import Listening from './activities/Listening';
import ImageQuestion from './activities/ImageQuestion';
import ErrorSpotting from './activities/ErrorSpotting';
import CategorySorting from './activities/CategorySorting';
import MatrixGrid from './activities/MatrixGrid';
import LongResponse from './activities/LongResponse';
import StructuredEssay from './activities/StructuredEssay';

interface Activity {
  id: string;
  type: string;
  title: string;
  content: any;
  points: number;
  media_url?: string;
  order_index: number;
}

interface ActivityRendererProps {
  activity: Activity;
  isCompleted: boolean;
  onComplete: () => void;
}

export default function ActivityRenderer({
  activity,
  isCompleted,
  onComplete,
}: ActivityRendererProps) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; score: number } | null>(null);

  async function handleSubmit(response: any, score: number) {
    setSubmitting(true);

    try {
      const { error } = await supabase.from('activity_responses').insert({
        activity_id: activity.id,
        student_id: profile?.id,
        response,
        score,
      });

      if (error) throw error;

      setResult({ correct: score >= activity.points * 0.7, score });
      onComplete();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado de la actividad */}
      <div className="border-b pb-4 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{activity.title}</h3>
          <p className="text-sm text-gray-600 mt-1">Puntos: {activity.points}</p>
        </div>
        {isCompleted && (
          <div className="flex items-center bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
            <CheckCircle className="w-3 h-3 mr-1" /> COMPLETADA
          </div>
        )}
      </div>

      {/* Feedback de resultado (local o persistente) */}
      {(result || isCompleted) && (
        <div
          className={`p-4 rounded-lg border-2 ${
            (result?.correct || isCompleted)
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-center">
            {(result?.correct || isCompleted) ? (
              <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
            ) : (
              <XCircle className="w-6 h-6 text-yellow-600 mr-2" />
            )}
            <div>
              <p className="font-semibold">
                {(result?.correct || isCompleted) ? 'Respuesta registrada' : 'Revisar respuesta'}
              </p>
              <p className="text-sm">
                Puntuación: {result ? result.score : activity.points} / {activity.points}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Renderizado de Componentes por Tipo */}
      <div className={isCompleted ? "opacity-75 pointer-events-none" : ""}>
        {activity.type === 'multiple_choice' && (
          <MultipleChoice
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'fill_blank' && (
          <FillBlank
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {(activity.type === 'drag_drop' || activity.type === 'ordering') && (
          <Ordering
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'matching' && (
          <Matching
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {(activity.type === 'essay' || activity.type === 'open_writing') && (
          <Essay
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'short_answer' && (
          <ShortAnswer
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'listening' && (
          <Listening
            content={activity.content}
            mediaUrl={activity.media_url}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'image_question' && (
          <ImageQuestion
            content={activity.content}
            mediaUrl={activity.media_url}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'true_false' && (
          <MultipleChoice
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'error_spotting' && (
          <ErrorSpotting
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'category_sorting' && (
          <CategorySorting
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'matrix_grid' && (
          <MatrixGrid
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'long_response' && (
          <LongResponse
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}

        {activity.type === 'structured_essay' && (
          <StructuredEssay
            content={activity.content}
            onSubmit={handleSubmit}
            disabled={submitting || isCompleted}
            points={activity.points}
          />
        )}
      </div>
    </div>
  );
}