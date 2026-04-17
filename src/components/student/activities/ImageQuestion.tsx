import { useState } from 'react';

export default function ImageQuestion({ content, mediaUrl, onSubmit, disabled, points }: any) {
  const [selected, setSelected] = useState<any>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm">
        <img 
          src={mediaUrl} 
          alt="Actividad visual" 
          className="w-full h-auto object-cover max-h-80"
        />
      </div>

      <div className="space-y-3">
        <h4 className="font-bold text-gray-800 text-lg">{content.question}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {content.options.map((opt: any, idx: number) => {
            const textLabel = typeof opt === 'object' ? opt.text : opt;
            const optionValue = typeof opt === 'object' ? opt.id : idx;
            return (
              <button
                key={idx}
                disabled={disabled}
                onClick={() => setSelected(optionValue)}
                className={`p-4 text-center border-2 rounded-xl font-medium transition-all ${
                  selected === optionValue ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                {textLabel}
              </button>
            )
          })}
        </div>
      </div>

      <button 
        onClick={() => onSubmit({ selected }, points)}
        disabled={disabled || selected === null}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md disabled:bg-gray-300"
      >
        Finalizar Análisis
      </button>
    </div>
  );
}