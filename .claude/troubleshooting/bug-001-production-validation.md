# Bug-001: Omisión de Validación en Reglas de Producción

**Estado:** CERRADO  
**Fecha cierre:** 2026-04-19

## Descripción
El sistema permitía enviar producciones (ensayos) con 1 sola palabra, ignorando el campo `min_words` de `public.production_rules`.

## Causa Raíz Identificada

### Bug A — Race condition en `ProductionEditor.tsx` (código)
`validateContent()` retorna temprano si `rules === null`. Si el fetch de `production_rules` no había terminado al montar el componente, `validationErrors` quedaba vacío y `isValid` era `true` con cualquier `wordCount > 0`.

### Bug B — Políticas RLS faltantes (base de datos)
Las migraciones nunca se aplicaron al remote via `supabase db push`. La tabla `production_rules` carecía de la política SELECT para estudiantes, y `productions` no tenía ninguna política. Resultado: todos los fetches de estudiantes devolvían `data: null, error: null` silenciosamente.

## Correcciones Aplicadas

### Frontend — `src/components/student/ProductionEditor.tsx`
1. **`rulesLoading` state**: nuevo estado inicializado en `true`, marcado `false` tras `loadRules()`.
2. **`isValid` blindado**: `!rulesLoading && rules !== null && validationErrors.length === 0 && wordCount >= rules.min_words`
3. **Guard en `submitProduction()`**: si `!rules` retorna con alerta antes de cualquier submit.
4. **`required_words` normalización**: eliminación de puntuación periférica antes de comparar (`Context.` → `Context`).
5. **Interfaz `Production` alineada**: campos nullable (`attempts | null`, `integrity_score | null`, etc.) para coincidir con schema real.
6. **`database.types.ts` actualizado**: tipos regenerados desde Supabase incluyendo `productions` completa y `__InternalSupabase.PostgrestVersion: "14.5"`.

### Base de Datos — Políticas RLS creadas manualmente en dashboard
(Documentadas en `supabase/migrations/20260419200000_fix_production_rls_policies.sql`)

| Tabla | Política | Comando | Condición |
|---|---|---|---|
| `production_rules` | Students can view production rules | SELECT | `true` (any authenticated) |
| `productions` | Students manage own productions | ALL | `student_id = auth.uid()` |
| `productions` | Professors view productions of their lessons | SELECT | role IN (professor, admin) |
| `productions` | Professors update productions | UPDATE | role IN (professor, admin) |

## Diagnóstico — Proceso de Debugging

1. `console.log` en `loadRules()` → confirmó `data: null, error: null` con `session_uid` válido.
2. REST API con anon key → `[]` vacío (confirmó que la política SELECT no existía).
3. Dashboard Supabase → confirmó solo 2 políticas FOR ALL (admin/profesor) sin SELECT para estudiantes.
4. `supabase list_migrations` → `[]` vacío (migraciones nunca pusheadas al remote).

## Lección Aprendida
**Las migraciones locales NO se aplican automáticamente al proyecto remoto de Supabase.** Siempre usar `supabase db push` o aplicar manualmente en el SQL Editor del dashboard después de crear una migración.
