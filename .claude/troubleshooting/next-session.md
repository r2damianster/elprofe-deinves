# Próxima Sesión — Estado de Bugs y Tareas Pendientes

**Actualizado:** 2026-04-24 (sesión completa)
**Instrucción:** Empieza aquí. Las tareas están ordenadas por prioridad.

---

## Resumen de estado

| Item | Descripción | Estado |
|------|-------------|--------|
| Bug-001 | Validación producción / RLS | ✅ CERRADO |
| Bug-002 | Doble anidamiento JSON en títulos | ✅ CERRADO |
| Bug-003 | Recursión RLS en group_members | ✅ CERRADO |
| Bug-004..009 | Bugs de sesión 2026-04-23 | ✅ TODOS CERRADOS |
| Feature-001 | Calificación batch con IA en Producciones | ✅ IMPLEMENTADO 2026-04-24 |
| Feature-002 | Umbrales configurables de compliance e integridad | ✅ IMPLEMENTADO |
| Feature-003 | Taxonomía Fase A: description, tags, difficulty | ✅ IMPLEMENTADO 2026-04-24 |
| Fix | Editar calificación en producciones ya revisadas | ✅ 2026-04-24 |
| Fix | GroupManager: lecciones filtradas por curso | ✅ 2026-04-24 |
| Fix | Flujo IA ActivityEditor: ES → botón único → todo | ✅ 2026-04-24 |

---

## PRIORIDAD 1 — Feature-001: Calificación batch con IA en ProductionReviewer

**Descripción:** El profesor selecciona producciones enviadas y las califica todas con IA de una sola vez.

**Flujo:**
1. Checkbox en cada fila de la lista
2. Botón "Calificar con IA" (activo cuando hay ≥1 seleccionada)
3. Barra de progreso mientras se procesan en secuencia
4. Cada producción recibe `score` (0-10) y `feedback` de IA → status pasa a `reviewed`

**Archivos:**
- `src/components/professor/ProductionReviewer.tsx` — UI + lógica batch
- Edge Function `ai-enhance` ya tiene la tarea `review_production` (0-10)

---

## PRIORIDAD 2 — Feature: Filtro por curso en ProductionReviewer

**Descripción:** Actualmente el profesor ve TODAS las producciones mezcladas. Necesita filtrar por curso y por lección.

**Flujo:**
1. Selector de curso en la cabecera del revisor
2. Selector de lección (opcional, dentro del curso seleccionado)
3. Opción "Todos los cursos"

**Archivos:**
- `src/components/professor/ProductionReviewer.tsx`
- Hay que agregar JOIN: `lessons → lesson_courses → courses` en la query principal

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

## Tarea 5 — Bug-007: Producción grupal (primero en entregar = entrega del grupo)

**Decisión previa requerida:** elegir entre Opción A (documento compartido) u Opción B (lock al primer envío). Ver detalles en `bug-007-group-production-first-submit.md`.

**Recomendación:** Opción B — más simple, menos invasiva. Solo requiere una tabla nueva `group_production_locks` y lógica de detección en `ProductionEditor.tsx`.

Al decidir la opción, delegar al agente `agente-estudiantes` para el frontend y a `especialista-bd` para la migración.

---

## Tarea 6 — Bug-008: Essay bloqueado al volver del tab de producción

Ver detalles completos en `bug-008-essay-locked-after-production-nav.md`.

**Dos fixes independientes, aplicar los dos:**

**Fix A** — `src/components/student/ActivityRenderer.tsx:131`  
No aplicar `pointer-events-none` a actividades de tipo producción. Cambiar `insert` por `upsert` para permitir re-edición de essay/long_response/structured_essay/open_writing.

**Fix B** — `src/components/student/LessonViewer.tsx:379-383`  
Agregar `.in('activity_id', activityIds)` al query de `activity_responses` para filtrar solo las actividades de la lección actual.

Delegar a `agente-estudiantes` o `agente-frontend`.

---

## Tarea 7 — Bug-009: Producción invisible en lecciones sin actividades

Ver detalles en `bug-009-lesson-no-activities-production-invisible.md`.

**Fix de emergencia ya aplicado en BD** (INSERT manual de `student_progress` para ZAMORA y TIGUA).

**Cuatro fixes de código pendientes (en orden de prioridad):**

1. **Fix A** — `ProductionEditor.tsx`: al hacer submit, upsert en `student_progress` con `completion_percentage = 100`
2. **Fix B** — `LessonViewer.tsx`: mostrar botón "Ver mis resultados" también cuando hay producción enviada, no solo cuando `progress > 0`
3. **Fix C** — `StudentResults.tsx`: consultar `productions` directamente además de `student_progress`, para incluir lecciones sin actividades
4. **Fix D** — `LessonResults.tsx`: mostrar el texto de la producción (`productions.content`) para que el estudiante pueda releer su ensayo

Delegar Fix A + B a `agente-estudiantes`, Fix C + D a `agente-frontend`.

---

## Feature-001 — Calificación batch con IA en Producciones

Ver diseño completo en `.claude/roadmap/feature-001-ai-grading-productions.md`.

**Resumen del flujo:**
1. Profesor filtra producciones por curso/lección
2. IA analiza todos los ensayos y propone rúbrica de evaluación
3. Profesor edita el prompt/rúbrica
4. IA califica cada ensayo (score 0-100 + feedback)
5. Profesor revisa tabla propuesta → confirma → guarda en Supabase
6. Score se guarda en `productions.score/feedback/status` → aparece como "Calificación del profesor" para el estudiante (sin cambios en BD ni en vistas)

**Prerrequisito:** Bug-004 (GROQ_URL secret) debe estar resuelto.

**Tareas:**
- Agregar filtro por curso a `ProductionReviewer.tsx`
- Dos tasks nuevas en Edge Function `ai-enhance`: `suggest_rubric` y `batch_grade`
- UI de revisión batch (tabla editable) en `ProductionReviewer.tsx`

Delegar a `agente-ia` (Edge Function) + `agente-frontend` (UI).

---

## Feature-002 — Umbrales configurables de compliance e integridad

Ver diseño completo en `.claude/roadmap/feature-002-production-thresholds.md`.

**Resumen:** El profesor configura `compliance_threshold` e `integrity_threshold` por lección. Ejemplo: 20 palabras requeridas + 50% threshold → solo 10 obligatorias.

**Tareas:**
- Migración: `ADD COLUMN compliance_threshold int2 DEFAULT 100` y `integrity_threshold int2 DEFAULT 0` en `production_rules`
- `ProductionEditor.tsx`: usar `compliance_threshold` en la validación del submit
- `ProductionEditor.tsx`: mostrar advertencia si `integrity < integrity_threshold`
- Content Studio: agregar sliders en el editor de reglas de producción
- UI estudiante: mostrar `X% / mín. Y%` en el panel de métricas

Delegar migración a `especialista-bd`, UI a `agente-frontend`, validación a `agente-estudiantes`.
