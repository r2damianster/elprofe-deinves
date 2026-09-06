import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import type { Database } from './database.types';

const neonUrl = import.meta.env.VITE_NEON_URL;

export const supabase = createClient<Database>(neonUrl, {
  auth: { adapter: SupabaseAuthAdapter() },
});
