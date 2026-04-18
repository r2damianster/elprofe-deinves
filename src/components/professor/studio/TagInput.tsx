import { useState, KeyboardEvent } from 'react';
import { X, Tag } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function TagInput({ tags, onChange, placeholder = "Escribe una etiqueta y presiona Enter...", className = "" }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleBlur = () => {
    addTag();
  };

  const addTag = () => {
    const newTag = inputValue.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      onChange([...tags, newTag]);
    }
    setInputValue('');
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className={`flex flex-wrap items-center bg-white border border-gray-200 rounded-xl p-2 gap-2 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent transition ${className}`}>
      <Tag className="w-4 h-4 text-gray-400 ml-1 flex-shrink-0" />
      {tags.map((tag, index) => (
        <span
          key={index}
          className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="hover:text-blue-900 focus:outline-none flex-shrink-0"
          >
            <X className="w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : "Añadir más..."}
        className="flex-1 min-w-[120px] border-none focus:outline-none text-sm text-gray-700 bg-transparent"
      />
    </div>
  );
}
