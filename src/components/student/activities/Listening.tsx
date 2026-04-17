import { useState } from 'react';
import { Play, Pause } from 'lucide-react';

export default function Listening({ content, mediaUrl, onSubmit, disabled, points }: any) {
  const [selected, setSelected] = useState<any>(null);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100 flex flex-col items-center">
        <p className="text-sm font-bold text-blue-800 mb-4 uppercase tracking-wider">Reproductor de Audio</p>
        <audio controls className="w-full" src={mediaUrl}>
          Tu navegador no soporta el elemento de audio.
        </audio>
      </div>

      <div className="space-y-3">
        <h4 className="font-bold text-gray-800">{content.question}</h4>
        {content.options.map((opt: any, idx: number) => {
          const textLabel = typeof opt === 'object' ? opt.text : opt;
          const optionValue = typeof opt === 'object' ? opt.id : idx;

          return (
            <button
              key={idx}
              disabled={disabled}
              onClick={() => setSelected(optionValue)}
              className={`w-full p-4 text-left border-2 rounded-xl transition-all ${
                selected === optionValue ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <span className="flex gap-3 items-center">
                <span className="font-mono text-gray-400 font-bold w-4">{typeof opt === 'object' ? opt.id : idx+1}.</span>
                <span>{textLabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button 
        onClick={() => onSubmit({ selected }, points)}
        disabled={disabled || selected === null}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg disabled:bg-gray-300"
      >
        Enviar Respuesta
      </button>
    </div>
  );
}