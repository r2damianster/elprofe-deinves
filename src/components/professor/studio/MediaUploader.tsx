import { useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Link, Upload, X, Loader2, Image, Music, Video, FileText } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

type MediaType = 'image' | 'audio' | 'video' | 'any';

interface Props {
  value: string;
  onChange: (url: string) => void;
  accept?: MediaType;
  label?: string;
}

const ACCEPT_MAP: Record<MediaType, string> = {
  image: 'image/jpeg,image/png,image/gif,image/webp',
  audio: 'audio/mpeg,audio/wav,audio/ogg',
  video: 'video/mp4,video/webm',
  any:   'image/*,audio/*,video/*,application/pdf',
};

const ICON_MAP: Record<MediaType, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  audio: <Music className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  any:   <FileText className="w-4 h-4" />,
};

export default function MediaUploader({ value, onChange, accept = 'any', label = 'Recurso multimedia' }: Props) {
  const { profile } = useAuth();
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [urlInput, setUrlInput] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function isValidUrl(s: string) {
    try { new URL(s); return true; } catch { return false; }
  }

  function handleUrlCommit() {
    const trimmed = urlInput.trim();
    if (!trimmed) { onChange(''); return; }
    if (!isValidUrl(trimmed)) { setError('URL no válida'); return; }
    setError('');
    onChange(trimmed);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    setError('');

    // Path: {userId}/{timestamp}_{filename}
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/${Date.now()}.${ext}`;

    const { data, error: uploadError } = await supabase.storage
      .from('lesson-media')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('lesson-media')
      .getPublicUrl(data.path);

    onChange(publicUrl);
    setUrlInput(publicUrl);
    setUploading(false);
  }

  const previewType = accept === 'image' || (value && /\.(jpg|jpeg|png|gif|webp)$/i.test(value))
    ? 'image'
    : accept === 'audio' || (value && /\.(mp3|wav|ogg)$/i.test(value))
    ? 'audio'
    : accept === 'video' || (value && /\.(mp4|webm)$/i.test(value))
    ? 'video'
    : null;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        {ICON_MAP[accept]} {label}
      </label>

      {/* Tabs URL / Subir */}
      <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition ${
            mode === 'url' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Link className="w-3.5 h-3.5" /> URL externa
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition ${
            mode === 'upload' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Subir archivo
        </button>
      </div>

      {mode === 'url' ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => { setUrlInput(e.target.value); setError(''); }}
            onBlur={handleUrlCommit}
            onKeyDown={e => e.key === 'Enter' && handleUrlCommit()}
            placeholder="https://..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setUrlInput(''); }}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_MAP[accept]}
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-50"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
            ) : (
              <><Upload className="w-4 h-4" /> Haz clic para seleccionar archivo</>
            )}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Preview */}
      {value && (
        <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
          {previewType === 'image' && (
            <img src={value} alt="preview" className="max-h-40 w-full object-contain p-1" />
          )}
          {previewType === 'audio' && (
            <audio controls className="w-full p-2"><source src={value} /></audio>
          )}
          {previewType === 'video' && (
            <video controls className="w-full max-h-40"><source src={value} /></video>
          )}
          {!previewType && (
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 text-sm text-blue-600 hover:underline">
              <Link className="w-4 h-4" />
              <span className="truncate">{value}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
