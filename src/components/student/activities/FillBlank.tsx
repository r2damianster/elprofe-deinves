import { useState } from 'react';

export default function FillBlank({ content, onSubmit, disabled, points }: any) {
  const [value, setValue] = useState('');

  return (
    <div className="p-4 space-y-4">
      <p className="text-gray-700 italic">"Completa los espacios en blanco basándote en la lección."</p>
      <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
         {/* Aquí irá la lógica de los inputs dinámicos más adelante */}
         <p>{content.text}</p> 
      </div>
      <input 
        type="text" 
        className="w-full p-2 border rounded" 
        placeholder="Escribe tu respuesta aquí..."
        onChange={(e) => setValue(e.target.value)}
      />
      <button 
        onClick={() => onSubmit({ answer: value }, points)}
        disabled={disabled || !value}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
      >
        Enviar respuesta
      </button>
    </div>
  );
}