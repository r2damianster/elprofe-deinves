# Flujo: Aprendizaje del Estudiante

## Descripción
Recorrido completo de un estudiante desde que inicia una lección hasta que recibe retroalimentación de su producción.

## Actores
- **Estudiante**: Consume contenido, responde, escribe
- **Sistema**: Valida respuestas, calcula progreso, bloquea/desbloquea
- **Profesor**: Revisa producciones, asigna puntajes

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│  1. ACCEDER A LECCIÓN                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dashboard ──▶ Lecciones Asignadas ──▶ Click en Lección        │
│                                                                 │
│  ┌─────────────────────┐                                        │
│  │ Crear registro en   │                                        │
│  │ student_progress    │                                        │
│  │ - started_at        │                                        │
│  │ - completion: 0%    │                                        │
│  └─────────────────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. VER CONTENIDO                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ LessonViewer                                        │        │
│  │ ┌─────────────────────────────────────────────────┐   │        │
│  │ │ Renderiza pasos secuencialmente:              │   │        │
│  │ │                                                 │   │        │
│  │ │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │   │        │
│  │ │ │  Text   │ │  Video  │ │Activity │ │ Image  │ │   │        │
│  │ │ └─────────┘ └─────────┘ └─────────┘ └────────┘ │   │        │
│  │ │                                                 │   │        │
│  │ │ ContentRenderer ──▶ ActivityRenderer            │   │        │
│  └─└─────────────────────────────────────────────────┘───┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. COMPLETAR ACTIVIDADES                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Por cada actividad en la lección:                             │
│                                                                 │
│  ┌─────────────────────┐     ┌─────────────────────┐            │
│  │ ActivityRenderer    │───▶│ Valida respuesta    │            │
│  │                     │     │ - Auto-calificable: │            │
│  │ Muestra componente  │     │   compara con       │            │
│  │ según tipo:         │     │   correct_answer    │            │
│  │ - MultipleChoice    │     │ - Manual: guarda    │            │
│  │ - DragDrop          │     │   sin calificar     │            │
│  │ - Essay, etc        │     └────────┬────────────┘            │
│  └─────────────────────┘                │                         │
│                                         ▼                         │
│                          ┌─────────────────────┐                   │
│                          │ Guarda en:          │                   │
│                          │ activity_responses  │                   │
│                          │ - response          │                   │
│                          │ - score             │                   │
│                          │ - submitted_at      │                   │
│                          └─────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. CALCULAR PROGRESO                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ completion_percentage =                               │      │
│  │   (actividades_completadas / total_actividades) × 100  │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌─────────────────────┐                                        │
│  │ Actualizar:         │                                        │
│  │ student_progress    │                                        │
│  │ - completion_%      │                                        │
│  └─────────────────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. DESBLOQUEAR PRODUCCIÓN                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IF completion_% >= production_unlock_percentage:            │
│                                                                 │
│     ┌─────────────────────────────┐                             │
│     │ Mostrar botón:              │                             │
│     │ "Ir a Producción Final"     │                             │
│     └──────────────┬──────────────┘                             │
│                    │                                            │
│                    ▼                                            │
│     ┌─────────────────────────────┐                             │
│     │ ProductionEditor            │                             │
│     │ - Muestra reglas            │                             │
│     │ - Editor de texto           │                             │
│     │ - Validación tiempo real    │                             │
│     └──────────────┬──────────────┘                             │
│                    │                                            │
│                    ▼                                            │
│     ┌─────────────────────────────┐                             │
│     │ Enviar ──▶ productions      │                             │
│     │ - status: 'submitted'       │                             │
│     │ - content                   │                             │
│     │ - word_count                │                             │
│     │ - compliance_score          │                             │
│     │ - integrity_score           │                             │
│     └─────────────────────────────┘                             │
│                                                                 │
│  ELSE:                                                          │
│     Mostrar: "Completa X% más para desbloquear producción"     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. COMPLETAR LECCIÓN                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IF todas las actividades completadas:                         │
│                                                                 │
│     ┌─────────────────────┐                                     │
│     │ student_progress:   │                                     │
│     │ - completion_%: 100 │                                     │
│     │ - completed_at      │                                     │
│     └─────────────────────┘                                     │
│                                                                 │
│  Mostrar: LessonResults                                        │
│  - Lista de actividades y puntajes                             │
│  - Estado de producción                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. REVISIÓN DEL PROFESOR                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ ProductionReviewer (vista del profesor)                │      │
│  │                                                        │      │
│  │ 1. Ver lista de producciones 'submitted'               │      │
│  │ 2. Abrir producción individual                         │      │
│  │ 3. Leer texto y verificar reglas                       │      │
│  │ 4. Asignar puntaje (0-100)                             │      │
│  │ 5. Escribir feedback                                   │      │
│  │ 6. Guardar                                             │      │
│  │    ──▶ productions.status = 'reviewed'                 │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. VER RESULTADOS                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Estudiante accede a StudentResults o LessonResults:           │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ - Progreso general del curso                            │      │
│  │ - Detalle por lección                                   │      │
│  │ - Puntajes de actividades                               │      │
│  │ - Estado: 'reviewed' ✓                                  │      │
│  │ - Puntaje asignado                                      │      │
│  │ - Retroalimentación del profesor                        │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                 │
│                         [ FIN ]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Estados del Estudiante

### En Lección
```typescript
enum LessonState {
  NOT_STARTED = 'not_started',      // Sin registro en student_progress
  IN_PROGRESS = 'in_progress',        // started_at existe, completion < 100
  READY_FOR_PRODUCTION = 'ready',    // completion >= unlock_percentage
  COMPLETED = 'completed',            // completion = 100, completed_at existe
  PRODUCTION_SUBMITTED = 'submitted', // Envió producción
  PRODUCTION_REVIEWED = 'reviewed'   // Profesor revisó
}
```

### Cálculo de Progreso
```typescript
function calculateProgress(
  lessonId: string,
  studentId: string
): Promise<number> {
  // 1. Obtener actividades de la lección
  const activities = await getLessonActivities(lessonId);
  
  // 2. Obtener respuestas del estudiante
  const responses = await getStudentResponses(studentId, activityIds);
  
  // 3. Calcular porcentaje
  const completed = responses.length;
  const total = activities.length;
  const percentage = Math.round((completed / total) * 100);
  
  // 4. Actualizar student_progress
  await updateProgress(studentId, lessonId, percentage);
  
  return percentage;
}
```

## Validación de Actividades

### Tipos Auto-Calificables
```typescript
const AUTO_GRADED = [
  'multiple_choice',
  'true_false',
  'fill_blank',
  'short_answer',
  'matching',
  'ordering',
  'drag_drop',
  'listening',
  'image_question'
];

function validateResponse(
  activity: Activity,
  response: any
): { correct: boolean; score: number } {
  const content = activity.content[lang];
  
  switch (activity.type) {
    case 'multiple_choice':
      const correct = response.selected === content.correct_id;
      return { correct, score: correct ? activity.points : 0 };
    
    case 'fill_blank':
      const allCorrect = content.answers.every(
        (ans, idx) => response.answers[idx]?.toLowerCase() === ans.toLowerCase()
      );
      return { correct: allCorrect, score: allCorrect ? activity.points : 0 };
    
    // ... otros tipos
  }
}
```

### Tipos Manuales (Producciones)
```typescript
const MANUAL_GRADED = [
  'essay',
  'long_response',
  'structured_essay',
  'open_writing'
];

// Guardan sin score, esperan revisión del profesor
await supabase
  .from('productions')
  .insert({
    student_id,
    lesson_id,
    content: text,
    status: 'submitted',
    word_count,
    compliance_score,
    integrity_score
  });
```

## Edge Cases

1. **Abandonar lección a mitad**:
   - Progreso guardado automáticamente
   - Al regresar, continúa donde quedó

2. **Recargar página durante actividad**:
   - Respuesta ya guardada → muestra como completada
   - Sincronizar estado desde activity_responses

3. **Intentar rehacer actividad**:
   - Configurable: permitir o bloquear
   - Si permitido: actualizar registro existente

4. **Producción no cumple reglas**:
   - Advertencia antes de enviar
   - Opción de "Enviar de todos modos"
   - compliance_score refleja incumplimiento

5. **Profesor tarda en revisar**:
   - Estado queda en 'submitted'
   - Estudiante ve "Pendiente de revisión"
   - Notificación cuando se revise (futuro)

## Métricas Trackeadas

### Por Lección
- Tiempo total en lección
- Tiempo por actividad
- Intentos por actividad
- Puntuación promedio

### Por Producción (useIntegrity)
- time_on_task: segundos
- integrity_score: 0-100
- integrity_events: array de eventos
  - paste: pegar texto
  - blur/focus: cambio de ventana
  - idle: tiempo inactivo
  - typing_burst: velocidad de escritura
