# Próxima Sesión — Estado de Bugs y Tareas Pendientes

**Actualizado:** 2026-04-21  
**Instrucción:** Empieza aquí. Las tareas están ordenadas por prioridad.

---

## Resumen de estado

| Bug | Descripción | Estado |
|-----|-------------|--------|
| Bug-001 | Validación producción / RLS | ✅ CERRADO (verificado 2026-04-21) |
| Bug-002 | Doble anidamiento JSON en títulos | ✅ CERRADO (verificado 2026-04-21) |
| Bug-003 | Recursión RLS en group_members | ✅ CERRADO (verificado 2026-04-21) |
| Bug-004 | Módulo IA en ProductionEditor (401) | ❌ FALLA — fix pendiente |
| Bug-005 | Instrucciones producción como JSON string | ❌ ABIERTO — fix BD + código pendiente |
| Bug-006 | `<button>` anidado en GroupManager | ⚠️ ABIERTO — warning DOM, no bloquea |

---

## Tarea 1 — Bug-005: Limpiar `instructions` en Supabase (PRIORITARIA)

El campo `production_rules.instructions` está guardado como string TEXT serializado: `'{"es":"...","en":"..."}'` en lugar de JSONB real.

**Ejecutar en Supabase Dashboard → SQL Editor:**

```sql
-- Paso 1: Verificar qué tipo tiene la columna y ver los valores
SELECT id, lesson_id,
  pg_typeof(instructions) AS col_type,
  jsonb_typeof(instructions) AS jsonb_type,
  instructions
FROM production_rules
LIMIT 20;
```

Según el resultado:

**Si `jsonb_typeof` devuelve `'string'`** (la columna es JSONB pero contiene un string):
```sql
UPDATE production_rules
SET instructions = (instructions #>> '{}')::jsonb
WHERE jsonb_typeof(instructions) = 'string';
```

**Si `pg_typeof` devuelve `'text'`** (la columna es TEXT):
```sql
UPDATE production_rules
SET instructions = instructions::jsonb
WHERE instructions IS NOT NULL
  AND instructions LIKE '{%';
```

Después de ejecutar, verificar que el campo ya no muestra JSON crudo en la pestaña "Instrucciones" del editor de producción del estudiante.

---

## Tarea 2 — Bug-004: Configurar secret GROQ_URL en Supabase

La Edge Function `ai-enhance` devuelve **401 Unauthorized**.

1. Ir a: Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Verificar que existe `GROQ_URL` con la clave API de GROQ
3. Si no existe, crearlo con el valor del archivo `.env` local (variable `VITE_GROQ_URL` o similar)
4. Si existe pero falla igual, revisar `supabase/functions/ai-enhance/index.ts` — verificar que lee `Deno.env.get('GROQ_URL')`

---

## Tarea 3 — Bug-006: Corregir `<button>` anidado en GroupManager

Warning: `<button> cannot appear as a descendant of <button>` en `GroupManager.tsx:39`.

Reestructurar el layout para que los botones de acción sean hermanos en lugar de hijos. Ver detalles en `bug-006-button-nesting-groupmanager.md`.

---

## Tarea 4 (código) — Parche defensivo `resolveField` para JSON strings

Aunque se limpie la BD (Tarea 1), conviene que `resolveField` maneje el caso JSON string por si vuelve a ocurrir.

Agregar en `src/lib/i18n.ts`, dentro de `resolveField`, antes del `return raw` final:

```typescript
// Caso: string que es un objeto JSON serializado '{"es":"...","en":"..."}'
if (raw.startsWith('{')) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const primary = parsed[lang];
      const fallback = parsed[lang === 'en' ? 'es' : 'en'];
      return (primary && primary.trim()) ? primary : (fallback ?? raw);
    }
  } catch { /* no es JSON válido */ }
}
```

---

## Fix TypeScript pendiente (cosmético, no bloquea runtime)

Errores en `ProductionEditor.tsx` líneas ~144, 147, 252-256, 369, 372, 392, 394, 412:  
`integrity_events: IntegrityEvent[]` no asignable a `Json | null` con PostgREST 14.5.

**Fix rápido** en `buildPayload()`:
```typescript
integrity_events: integrityEvents as unknown as import('../lib/database.types').Json,
```

---

## Pregunta del usuario — ¿Quién puede escribir en un grupo?

En el sistema actual, la producción escrita es **individual**: cada estudiante escribe la suya propia en `ProductionEditor`. El panel de grupo muestra el contexto (a qué grupo pertenece el estudiante) pero no hay un editor colaborativo compartido. Cada miembro del grupo entrega su propia producción de forma independiente.

Si la intención es que solo un miembro por grupo entregue (o que entreguen juntos), eso requeriría una nueva feature de "producción grupal" (no existe actualmente).
