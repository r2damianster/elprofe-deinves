import { useState } from 'react';

interface ShortAnswerProps {
  content: {
    question: string;
    expectedKeywords?: string[];
  };
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}

export default function ShortAnswer({
  content,
  onSubmit,
  disabled,
  points,
}: ShortAnswerProps) {
  const [answer, setAnswer] = useState('');

  function handleSubmit() {
    if (answer.trim().length === 0) {
      alert('Por favor escribe una respuesta');
      return;
    }

    let score = points;
    if (content.expectedKeywords && content.expectedKeywords.length > 0) {
      const lowerAnswer = answer.toLowerCase();
      const foundKeywords = content.expectedKeywords.filter((keyword) =>
        lowerAnswer.includes(keyword.toLowerCase())
      );
      score = Math.round((foundKeywords.length / content.expectedKeywords.length) * points);
    }

    onSubmit({ answer }, score);
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{content.question}</p>

      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
        placeholder="Escribe tu respuesta..."
        disabled={disabled}
      />

      <button
        onClick={handleSubmit}
        disabled={disabled || answer.trim().length === 0}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {disabled ? 'Enviando...' : 'Enviar Respuesta'}
      </button>
    </div>
  );
}
