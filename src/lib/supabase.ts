import { createClient, SupabaseAuthAdapter, defaultDeriveNeonUrls } from '@neondatabase/neon-js';
import type { Database } from './database.types';

const neonUrl = import.meta.env.VITE_NEON_URL;
const { auth: authUrl, dataApi: dataApiUrl } = defaultDeriveNeonUrls(neonUrl);

// Se usa la forma de config explícita (auth.url + dataApi.url) en vez de
// createClient(baseUrl, options) porque esa segunda forma resuelve mal el
// overload de TypeScript: SupabaseAuthAdapterInstance es estructuralmente
// compatible con BetterAuthVanillaAdapterInstance, así que TS elige el primer
// overload que matchea (el de Better Auth "crudo") en vez del Supabase-compatible.
export const supabase = createClient<Database>({
  auth: { adapter: SupabaseAuthAdapter(), url: authUrl },
  dataApi: { url: dataApiUrl },
});
