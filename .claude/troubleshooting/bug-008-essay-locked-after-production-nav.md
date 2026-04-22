# Bug-008 — Actividad de escritura bloqueada al volver del tab de producción

**Estado:** 🆕 ABIERTO — diagnóstico completo, fix pendiente  
**Detectado:** 2026-04-22  
**Reportado por:** Estudiante (caso real)  
**Componentes:** `ActivityRenderer.tsx`, `LessonViewer.tsx`

---

## Síntoma

El estudiante entra a la lección, escribe en una actividad tipo `essay` / `long_response` / `structured_essay`, va al tab de producción final ("Ir a Producción") y al volver al ejercicio ya no puede escribir — el área de texto está completamente bloqueada.

---

## Causa Raíz (dos problemas independientes)

### Problema A — `pointer-events-none` permanente en actividades de escritura

**Archivo:** `src/components/student/ActivityRenderer.tsx:131`

```tsx
<div className={isCompleted ? "opacity-75 pointer-events-none" : ""}>
```

Cuando el estudiante envía el essay, `isCompleted` pasa a `true` y el wrapper aplica `pointer-events-none` a todo el componente. Este comportamiento es correcto para actividades auto-calificables (múltiple opción, fill_blank, etc.), pero **no para actividades de escritura** donde el estudiante debería poder revisar y reescribir.

**Flujo típico que activa el bug:**
1. Estudiante escribe y envía `essay` → actividad bloqueada (`isCompleted = true`)
2. El progreso sube al umbral → aparece "Ir a Producción"
3. Estudiante va a producción y vuelve
4. Encuentra el essay bloqueado → atribuye el bloqueo a la navegación

El bloqueo ocurrió en el paso 1, no en el paso 3. La producción solo lo hace visible.

### Problema B — Query de respuestas sin filtrar por lección

**Archivo:** `src/components/student/LessonViewer.tsx:379-383`

```typescript
const { data: responses } = await supabase
  .from('activity_responses')
  .select('activity_id')
  .eq('student_id', profile?.id);  // ← sin filtrar por lesson_id
```

Carga **todas** las respuestas del estudiante en **todas** las lecciones. Si la misma `activity_id` está vinculada a más de una lección, o si quedan respuestas de un intento anterior sin limpiar, la actividad aparece bloqueada desde el inicio.

---

## Fix Propuesto

### Fix A — Diferenciar tipos de producción en ActivityRenderer

En `ActivityRenderer.tsx`, para los tipos de producción (`essay`, `long_response`, `structured_essay`, `open_writing`):
- NO aplicar `pointer-events-none`
- Cambiar `insert` por `upsert` en `handleSubmit` para permitir re-edición
- Mostrar el badge "Completado" sin bloquear el campo

```tsx
// ActivityRenderer.tsx — importar isProduction
import { isProduction } from '../../lib/activityTypes';

// Línea 131 — solo bloquear si NO es tipo producción
<div className={isCompleted && !isProduction(activity.type) ? "opacity-75 pointer-events-none" : ""}>
```

Y en `handleSubmit`:
```typescript
// Cambiar insert por upsert para production types
const op = isProduction(activity.type)
  ? supabase.from('activity_responses').upsert(
      { activity_id: activity.id, student_id: profile?.id, response, score },
      { onConflict: 'activity_id,student_id' }
    )
  : supabase.from('activity_responses').insert(
      { activity_id: activity.id, student_id: profile?.id, response, score }
    );
const { error } = await op;
```

### Fix B — Filtrar respuestas por actividades de la lección actual

En `LessonViewer.tsx`, usar los `activityIds` ya cargados para filtrar:

```typescript
// Después de cargar activitiesData
const activityIds = activitiesData.map((a: any) => a.id);

const { data: responses } = await supabase
  .from('activity_responses')
  .select('activity_id')
  .eq('student_id', profile?.id)
  .in('activity_id', activityIds);   // ← agregar este filtro
```

---

## Notas adicionales

- `useIntegrity` NO es el causante: los eventos de integridad no setean `disabled`
- La navegación entre tabs (producción ↔ ejercicio) no dispara `loadAll()` — el state de `completedActivities` persiste correctamente durante la sesión
- El Fix B también corrige el caso de retorno tras reintentar lección si los deletes de `handleRetryLesson` fallan silenciosamente
