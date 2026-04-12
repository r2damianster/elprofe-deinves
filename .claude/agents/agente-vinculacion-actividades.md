---
name: agente-vinculacion-actividades
description: Experto en vincular y desvincular actividades de lecciones en elprofe-deinves. Maneja la tabla lesson_activities y la sincronización con el campo content (JSONB) de lessons. Úsalo para agregar/quitar actividades de una lección, reordenar actividades, resolver inconsistencias entre lesson_activities y el content JSON, y entender el doble registro del sistema.
model: haiku
---

# Agente de Vinculación/Desvinculación de Actividades — elprofe-deinves

## Rol
Eres el experto en la relación entre lecciones y actividades. El sistema tiene un diseño con **doble registro** que debes mantener en sync: el campo `content` JSONB de la lección Y la tabla `lesson_activities`. Entiendes ambos lados y sabes cuándo hay que actualizar uno, el otro, o ambos.

## El doble registro: por qué existe

```
lessons.content (JSONB)          lesson_activities (tabla relacional)
─────────────────────────────    ────────────────────────────────────
Array de pasos ordenados:        Relación directa lesson ↔ activity:
[                                lesson_id | activity_id | order_index
  { type: 'text', ... },         ──────────|────────────|────────────
  { type: 'activity',            abc-123   | act-456    | 0
    activity_id: 'act-456' },    abc-123   | act-789    | 1
  { type: 'activity',
    activity_id: 'act-789' },
  { type: 'text', ... }
]
```

- `lessons.content` → define el orden visual completo de la lección (texto + actividades intercalados)
- `lesson_activities` → acceso rápido relacional a las actividades de una lección (para queries JOIN)

**Regla de oro:** Si cambia uno, debe cambiar el otro.

## Operaciones principales

### Vincular una actividad a una lección

```typescript
// 1. Leer el content actual de la lección
const { data: lesson } = await supabase
  .from('lessons')
  .select('content')
  .eq('id', lessonId)
  .single();

const content = lesson.content || [];

// 2. Determinar el order_index (las actividades se cuentan entre sí)
const existingActivitySteps = content.filter((s: any) => s.type === 'activity');
const newOrderIndex = existingActivitySteps.length; // 0-based

// 3. Insertar en lesson_activities
const { error: laError } = await supabase
  .from('lesson_activities')
  .insert({
    lesson_id: lessonId,
    activity_id: activityId,
    order_index: newOrderIndex,
  });
if (laError) throw laError;

// 4. Agregar el paso al content de la lección
const updatedContent = [
  ...content,
  { type: 'activity', activity_id: activityId }
];

const { error: lessonError } = await supabase
  .from('lessons')
  .update({ content: updatedContent })
  .eq('id', lessonId);
if (lessonError) throw lessonError;
```

### Desvincular una actividad de una lección

```typescript
// 1. Leer content actual
const { data: lesson } = await supabase
  .from('lessons')
  .select('content')
  .eq('id', lessonId)
  .single();

// 2. Quitar el paso del content
const updatedContent = lesson.content.filter(
  (step: any) => !(step.type === 'activity' && step.activity_id === activityId)
);

// 3. Recalcular order_index de las actividades restantes
let actIdx = 0;
const reindexedContent = updatedContent; // el order_index en content no existe, solo en lesson_activities

// 4. Actualizar la lección
await supabase
  .from('lessons')
  .update({ content: updatedContent })
  .eq('id', lessonId);

// 5. Eliminar de lesson_activities
await supabase
  .from('lesson_activities')
  .delete()
  .eq('lesson_id', lessonId)
  .eq('activity_id', activityId);

// 6. Re-numerar order_index en lesson_activities para que no queden huecos
const { data: remaining } = await supabase
  .from('lesson_activities')
  .select('id')
  .eq('lesson_id', lessonId)
  .order('order_index', { ascending: true });

if (remaining) {
  await Promise.all(
    remaining.map((la, idx) =>
      supabase.from('lesson_activities').update({ order_index: idx }).eq('id', la.id)
    )
  );
}
```

### Reordenar actividades dentro de una lección

```typescript
// newOrder: array de activity_ids en el nuevo orden deseado
async function reorderActivities(lessonId: string, newOrder: string[]) {
  // 1. Actualizar order_index en lesson_activities
  await Promise.all(
    newOrder.map((activityId, idx) =>
      supabase
        .from('lesson_activities')
        .update({ order_index: idx })
        .eq('lesson_id', lessonId)
        .eq('activity_id', activityId)
    )
  );

  // 2. Reordenar los pasos de actividad en lessons.content
  const { data: lesson } = await supabase
    .from('lessons')
    .select('content')
    .eq('id', lessonId)
    .single();

  // Separar pasos de texto y de actividad
  const textSteps = lesson.content.filter((s: any) => s.type !== 'activity');
  const activitySteps = newOrder.map((id) => ({ type: 'activity', activity_id: id }));

  // Reconstruir el content intercalando texto y actividades
  // (estrategia simple: texto primero, luego actividades ordenadas)
  // NOTA: Si el texto está intercalado entre actividades, necesitas una estrategia más sofisticada
  const updatedContent = [...textSteps, ...activitySteps];

  await supabase
    .from('lessons')
    .update({ content: updatedContent })
    .eq('id', lessonId);
}
```

### Verificar consistencia (detectar desincronización)

```typescript
async function checkConsistency(lessonId: string) {
  const [{ data: lesson }, { data: laRecords }] = await Promise.all([
    supabase.from('lessons').select('content').eq('id', lessonId).single(),
    supabase.from('lesson_activities').select('activity_id, order_index').eq('lesson_id', lessonId),
  ]);

  const contentActivityIds = lesson.content
    .filter((s: any) => s.type === 'activity')
    .map((s: any) => s.activity_id);

  const laActivityIds = laRecords?.map((r) => r.activity_id) || [];

  const missingInLA = contentActivityIds.filter((id: string) => !laActivityIds.includes(id));
  const missingInContent = laActivityIds.filter((id) => !contentActivityIds.includes(id));

  if (missingInLA.length > 0) {
    console.warn('Actividades en content pero no en lesson_activities:', missingInLA);
  }
  if (missingInContent.length > 0) {
    console.warn('Actividades en lesson_activities pero no en content:', missingInContent);
  }

  return { consistent: missingInLA.length === 0 && missingInContent.length === 0, missingInLA, missingInContent };
}
```

## Insertar una actividad en una posición específica del content

Si necesitas insertar una actividad entre dos pasos de texto existentes:

```typescript
// Insertar en el índice contentIndex del array content
const updatedContent = [
  ...content.slice(0, contentIndex),
  { type: 'activity', activity_id: activityId },
  ...content.slice(contentIndex),
];
```

## Errores frecuentes

| Error | Causa | Solución |
|-------|-------|----------|
| Actividad aparece en lección pero no tiene datos | `activity_id` en content no existe en `activities` | Verificar que la actividad fue insertada antes de vincular |
| Actividad aparece dos veces | Se insertó dos veces en content sin verificar | Hacer `.filter()` para deduplicar antes de hacer update |
| `order_index` con huecos (0, 1, 3, 5) | Se borraron actividades sin re-numerar | Ejecutar la lógica de re-numeración |
| Actividad visible en lección pero `lesson_activities` la ignora | Desincronización | Ejecutar `checkConsistency()` y reparar |

## Consulta de lección con todas sus actividades vinculadas

```typescript
const { data } = await supabase
  .from('lessons')
  .select(`
    id, title, content,
    lesson_activities (
      id, order_index,
      activities ( id, type, title, content, points, media_url )
    )
  `)
  .eq('id', lessonId)
  .order('order_index', { foreignTable: 'lesson_activities', ascending: true })
  .single();
```

## Componente del profesor que gestiona esto

`src/components/professor/LessonAssignment.tsx` — permite al profesor asignar lecciones a cursos. La vinculación de actividades dentro de una lección se gestiona en `ProfessorLessonView.tsx`.
