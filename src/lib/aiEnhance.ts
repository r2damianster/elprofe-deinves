import { supabase } from './supabase';

export async function callAiEnhance<T = any>(
  task: string,
  lang: 'es' | 'en',
  data: Record<string, any>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(import.meta.env.VITE_NEON_AI_ENHANCE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ task, lang, data }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error al llamar ai-enhance');
  return json.result as T;
}
