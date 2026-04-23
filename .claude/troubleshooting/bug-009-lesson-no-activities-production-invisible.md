# Bug-009 — Producción invisible en lecciones sin actividades

**Estado:** ✅ RESUELTO — 2026-04-23 (commit 62a7321)  
**Detectado:** 2026-04-22  
**Afectadas:** ZAMORA ROMERO NAYESKA JOELIZ, TIGUA ARAY RICARDO VALENTINO  
**Lección:** "Problemas prácticos vs. problemas de investigación" (`7ddca0da-32bb-4c7b-b199-ce2be6a09857`)  
**Componentes:** `LessonViewer.tsx`, `StudentResults.tsx`, `LessonResults.tsx`

---

## Síntoma

El estudiante entra a una lección que solo tiene pasos de contenido (slides/imagen) y `has_production = true`. Completa y envía la producción. La producción queda guardada en la tabla `productions` con `status: submitted`, pero el estudiante:

- No ve el botón "Ver mis resultados" dentro de la lección
- No ve la lección listada en su vista "Mis Resultados" del dashboard
- No tiene forma de ver el estado ni el texto de lo que envió

El profesor tampoco sabe si hay envíos pendientes a menos que revise directamente en Supabase.

---

## Causa Raíz — tres puntos de fallo encadenados

### Fallo 1 — `calculateProgress()` no corre si no hay actividades

**Archivo:** `src/components/student/LessonViewer.tsx` (~línea 429)

```typescript
async function calculateProgress() {
  const activitySteps = combinedSteps.filter((s) => s.isActivity);
  if (activitySteps.length === 0) return; // ← sale sin crear student_progress
  ...
}
```

Una lección sin actividades nunca crea ni actualiza el registro en `student_progress`.

### Fallo 2 — Botón "Ver mis resultados" requiere `progress > 0`

**Archivo:** `src/components/student/LessonViewer.tsx` (~línea 812)

```tsx
{!previewMode && progress > 0 && (
  <button onClick={() => setShowResults(true)}>Ver mis resultados</button>
)}
```

Con `progress = 0` (ninguna actividad completada), el botón nunca aparece aunque el estudiante haya enviado su producción.

### Fallo 3 — `StudentResults` depende exclusivamente de `student_progress`

**Archivo:** `src/components/student/StudentResults.tsx` (~línea 72)

```typescript
const { data: progressRows } = await supabase
  .from('student_progress')
  .eq('student_id', profile!.id);

if (!progressRows || progressRows.length === 0) {
  setLessons([]);
  return; // ← no hay progreso → no hay lecciones → no se muestran producciones
}
```

Si `student_progress` está vacío, retorna vacío. Las producciones en la tabla `productions` nunca se consultan de forma independiente.

### Fallo 4 (diseño) — Ninguna vista muestra el texto del ensayo

Ni `LessonResults` ni `StudentResults` muestran el campo `productions.content`. El estudiante nunca puede leer lo que escribió.

---

## Fix de Emergencia (BD)

Insertar manualmente el registro de progreso para los estudiantes afectados:

```sql
INSERT INTO student_progress (student_id, lesson_id, completion_percentage, attempts, started_at, completed_at)
VALUES
  ('fb085722-98be-4ee0-9f88-1cbcf0a127a2', '7ddca0da-32bb-4c7b-b199-ce2be6a09857', 100, 1, NOW(), NOW()),
  ('06478995-203c-4283-b809-214ef3aa3f19', '7ddca0da-32bb-4c7b-b199-ce2be6a09857', 100, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;
```

---

## Fix de Código Propuesto

### Fix A — Crear `student_progress` al enviar producción (en `ProductionEditor.tsx`)

Cuando el estudiante hace submit en `ProductionEditor`, si la lección no tiene actividades, crear el registro de progreso:

```typescript
// En submitProduction(), después del insert exitoso a productions:
await supabase
  .from('student_progress')
  .upsert({
    student_id: profile.id,
    lesson_id: lessonId,
    completion_percentage: 100,
    attempts: 1,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }, { onConflict: 'student_id,lesson_id' });
```

### Fix B — Mostrar botón "Ver mis resultados" también cuando hay producción enviada

**Archivo:** `src/components/student/LessonViewer.tsx`

```tsx
// Cambiar la condición del botón:
{!previewMode && (progress > 0 || productionSubmitted) && (
  <button onClick={() => setShowResults(true)}>Ver mis resultados</button>
)}
```

Requiere un estado `productionSubmitted` que se active tras enviar la producción (callback de `ProductionEditor`).

### Fix C — `StudentResults` también consulta producciones directamente

**Archivo:** `src/components/student/StudentResults.tsx`

Agregar una segunda consulta a `productions` para incluir lecciones donde hay producción pero no hay `student_progress`:

```typescript
// Además de progressRows, consultar:
const { data: prodRows } = await supabase
  .from('productions')
  .select('lesson_id, status, score, word_count, compliance_score, feedback, submitted_at')
  .eq('student_id', profile!.id)
  .not('status', 'eq', 'draft');

// Merge con los lessonIds para incluir estas lecciones aunque no tengan student_progress
```

### Fix D — Mostrar texto de la producción en LessonResults

Agregar una sección "Tu texto" en `LessonResults.tsx` que muestre `productions.content` cuando `status !== 'draft'`.

---

## Notas

- El Fix A es el más seguro y cubre el caso de raíz
- Los Fixes B, C y D son mejoras de UX complementarias
- Para lecciones con actividades, el comportamiento actual es correcto — este bug solo afecta lecciones 100% de contenido + producción sin actividades intermedias
