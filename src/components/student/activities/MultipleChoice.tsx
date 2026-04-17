import { useState } from 'react';

interface MultipleChoiceProps {
  content: {
    question: string;
    options?: string[]; // Ahora es opcional para evitar el crash
    correctAnswer?: number;
    correct_answer?: number; // Soporte para ambos formatos de DB
  };
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}

export default function MultipleChoice({
  content,
  onSubmit,
  disabled,
  points,
}: MultipleChoiceProps) {
  const [selectedOption, setSelectedOption] = useState<any>(null);

  // 🟢 DETERMINAR OPCIONES: Si no existen en el JSON, usamos Verdadero/Falso por defecto
  const options = content.options || ["Verdadero", "Falso"];
  
  // 🟢 DETERMINAR RESPUESTA CORRECTA: Buscamos en ambos nombres posibles
  const correctAnswer = content.correct_id ?? content.correctAnswer ?? content.correct_answer;

  function handleSubmit() {
    if (selectedOption === null) {
      alert('Por favor selecciona una opción');
      return;
    }

    const isCorrect = selectedOption === correctAnswer;
    const score = isCorrect ? points : 0;

    onSubmit({ selectedOption, correct: isCorrect }, score);
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{content.question}</p>

      <div className="space-y-2">
        {/* 🟢 Usamos 'options' (la variable segura) en lugar de 'content.options' */}
        {options.map((option: any, index: number) => {
          const textLabel = typeof option === 'object' ? option.text : option;
          const optionValue = typeof option === 'object' ? option.id : index;

          return (
            <label
              key={index}
              className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                selectedOption === optionValue
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="option"
                value={optionValue}
                checked={selectedOption === optionValue}
                onChange={() => !disabled && setSelectedOption(optionValue)}
                className="w-5 h-5 text-blue-600"
                disabled={disabled}
              />
              <span className="ml-3 text-gray-800">{textLabel}</span>
            </label>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || selectedOption === null}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
      >
        {disabled ? 'Respuesta Registrada' : 'Enviar Respuesta'}
      </button>
    </div>
  );
}