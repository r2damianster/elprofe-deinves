# Migración Supabase → Neon (2026-09)

## Motivo

La cuenta de Supabase que hospedaba este proyecto (`ckpmrmhkrbylibecezxn`, otra cuenta/correo) iba a eliminarse. Se migró la plataforma completa a Neon, bajo la cuenta `arturo.rodriguez30@gmail.com`. El proyecto **ya no depende de Supabase en absoluto** — ni DB, ni Auth, ni Storage, ni Edge Functions.

## Mapeo de arquitectura

| Antes (Supabase) | Ahora (Neon) |
|---|---|
| Postgres + PostgREST | Neon Postgres + **Data API** |
| Supabase Auth | **Managed Better Auth** (`@neondatabase/neon-js`) |
| RLS (`auth.uid()`) | RLS Neon (`auth.user_id()::uuid` — Neon también expone `auth.uid()` nativo, no usado por elegir consistencia con el resto de las políticas) |
| Storage bucket `lesson-media` | **Neon Object Storage**, bucket `lesson-media` (`public_read`) + `lecturas` / `silabos-politicas-institucionales` (`private`, backup de archivos sueltos que no usa el código) |
| Edge Function `ai-enhance` | **Neon Function** `aienhance` |
| Realtime (3 canales `postgres_changes`) | Eliminado — reemplazado por polling (ya existía como fallback en 2 de 3 casos) |

Proyecto Neon: `elprofe-deinves` (id `winter-firefly-14215095`), branch `br-wandering-bread-axffs1fz`, región `aws-us-east-2`.

## Piezas nuevas en el repo

- `src/lib/supabase.ts` — sigue llamándose así (para minimizar el diff en ~20 archivos que importan `{ supabase }`), pero internamente crea un cliente `@neondatabase/neon-js` con el adapter Supabase-compatible.
- `src/lib/aiEnhance.ts` — helper único (`callAiEnhance`) que reemplaza los 2 estilos de invocación distintos que había antes (`supabase.functions.invoke` y `fetch` manual).
- `neon-functions/ai-enhance.ts` — mismo proxy GROQ de siempre, formato `export default { fetch }` en vez de Deno `serve`.
- `neon-functions/media-upload.ts` — reemplaza `supabase.storage.upload()`. Valida rol (admin/professor) contra el Data API usando el propio JWT del caller, y firma una URL de subida S3 a mano (SigV4 con solo `crypto` nativo — **no usa `@aws-sdk/client-s3`**, el SDK completo agrega ~1.5MB al bundle, demasiado para desplegar la función vía MCP sin CLI de Neon).
- `neon.ts` — declara ambas funciones para cuando alguien corra `neon deploy` desde CLI.
- `supabase/migrations/*.sql` — **ya no se aplica a nada**, queda como referencia histórica del schema para reconstrucción.

## Gotchas encontrados (para no repetirlos)

1. **Deploy de Neon Functions sin CLI**: el tool `deploy_function` del MCP de Neon acepta un zip en base64 directo — no hace falta `neon link`/`neon deploy` (que piden OAuth interactivo). Hay que bundlear con esbuild uno mismo (`--bundle --platform=node --target=node24 --format=esm --minify`, con un `--banner:js` que restaura `require`/`__filename`/`__dirname` si el bundle usa algo tipo `pg`), zippear con el entry nombrado exactamente `index.mjs`, y mandar el base64. Si el bundle pesa mucho (ej. con `@aws-sdk/client-s3`, ~1.5MB), el base64 se vuelve impracticable de pasar como parámetro de tool call — mejor evitar SDKs pesados en estas funciones.
2. **`createClient()` del SDK `@neondatabase/neon-js`**: la forma `createClient(baseUrl, { auth: { adapter: SupabaseAuthAdapter() } })` que muestra la guía oficial de Neon resuelve mal el overload de TypeScript (elige el overload de Better Auth "crudo" en vez del compatible con Supabase, porque los tipos de ambos adapters son estructuralmente compatibles). Usar la forma explícita `createClient({ auth: { adapter, url }, dataApi: { url } })` en su lugar — ver `src/lib/supabase.ts`.
3. **Managed Better Auth no migra contraseñas** — ningún usuario viejo de Supabase puede loguearse con su password anterior (hash incompatible). Cada persona necesita re-registrarse. El perfil viejo (fila en `profiles`, con todo su historial de cursos/lecciones/etc.) puede "adoptarse" reasignando manualmente el `id` a la nueva cuenta de auth — ver el patrón de merge de identidad abajo.
4. **Patrón de merge de identidad** (perfil viejo → login nuevo): no se puede hacer `UPDATE profiles SET id = nuevo WHERE id = viejo` directo porque rompe los FKs de las tablas que referencian ese `id`. Orden correcto: (a) liberar el email del perfil viejo con un `UPDATE ... SET email = email+'.tmp'`, (b) `INSERT` un perfil nuevo con el `id` nuevo y el email real, (c) `UPDATE` todas las tablas que referencian `profiles(id)` (`courses.professor_id`, `lessons.created_by`, `activities.created_by`, etc.) de viejo→nuevo, (d) recién ahí `DELETE` el perfil viejo.
5. **El endpoint `/sign-in/email` y `/sign-up/email` de Better Auth devuelven un `token` que es la cookie de sesión opaca, NO un JWT.** El JWT real (el que acepta el Data API) hay que pedirlo aparte a `GET /token` usando esa cookie de sesión.
6. **`neon_auth.user`/`account`/`session`** son las tablas donde vive todo lo de auth — útiles para debug o limpieza manual de cuentas de prueba.
7. **GROQ retiró `llama-3.3-70b-versatile`** (nada que ver con la migración, coincidencia de timing) — se cambió a `openai/gpt-oss-120b` en `neon-functions/ai-enhance.ts`.
8. **Trusted domain**: hubo que agregar `http://localhost:5173` como dominio confiable de Better Auth (`add_auth_trusted_domain`) antes de poder loguear desde el dev server.

## Estado de los datos

Los ~99 perfiles, cursos, lecciones, actividades, grupos, presentaciones y proyectos reales se copiaron de Supabase a Neon vía REST (Supabase `service_role` key + Data API de Neon), preservando los UUIDs originales. Solo el profesor (`arturo.rodriguez@uleam.edu.ec`) tiene login funcional hoy — su perfil viejo se migró de identidad con el patrón del punto 4. El resto de perfiles (estudiantes) quedan con su historial intacto pero **sin cuenta de login** — decisión consciente: no van a re-ingresar, se dejaron de lado a propósito.
