# Flujo de Producción Escrita

Las producciones son actividades de escritura libre (`essay`, `long_response`, `structured_essay`) que requieren revisión humana del profesor.

## 1. Desbloqueo

Una producción se desbloquea cuando el estudiante supera el `production_unlock_percentage` de la lección:

```
completion_percentage (student_progress) >= production_unlock_percentage (lessons)
```

Hasta ese punto, el botón/paso de producción aparece bloqueado en `LessonViewer`.

## 2. Escritura

El estudiante escribe en el componente correspondiente (`Essay`, `LongResponse`, `StructuredEssay`). Mientras escribe:

- **Barra de compliance** en tiempo real:
  - Progreso hacia el mínimo de palabras/caracteres
  - Palabras obligatorias presentes (`required_words`)
  - Palabras prohibidas evitadas (`forbidden_words`)
- **Barra de integridad** via `useIntegrity`:
  - Detecta: paste, cambio de pestaña, clic derecho, atajos Ctrl+C/V/X/A, resize de ventana
  - Cada evento se registra en `integrity_events` (array JSONB)

## 3. Envío

Al hacer submit, se llama a `onSubmit(response, score)` desde `ActivityRenderer`. Esto crea/actualiza un registro en `productions`:

```
productions.status: 'draft' → 'submitted'
```

Los campos guardados:
- `content` — texto escrito
- `word_count` — conteo de palabras
- `compliance_score` — 0-100
- `integrity_score` — 0-100
- `integrity_events` — array de eventos detectados
- `time_on_task` — segundos desde que abrió la actividad

## 4. Revisión del Profesor

El profesor ve las producciones en `ProductionReviewer.tsx` (tab Producciones del dashboard):

- Filtros: pendiente / revisado / todos
- Ve el texto completo + barras de compliance e integridad
- Ve el log forense de `integrity_events`
- Asigna puntaje 0-100 y feedback textual
- Puede marcar para reintento

Al calificar:
```
productions.status: 'submitted' → 'reviewed'
productions.score = puntaje
productions.feedback = texto
productions.reviewed_at = now()
```

## 5. Resultado visible al estudiante

Tras la revisión, el estudiante ve el puntaje y feedback en `LessonResults` y `StudentResults`.

Si el profesor habilitó reintento: el estudiante puede editar y re-enviar.

## Diagrama simplificado

```
student_progress.completion_percentage >= production_unlock_percentage
        ↓
  [Desbloqueo del paso de producción]
        ↓
  Essay / LongResponse / StructuredEssay
  (compliance + integrity en tiempo real)
        ↓
  onSubmit → productions (status: submitted)
        ↓
  ProductionReviewer → calificación del profesor
        ↓
  productions (status: reviewed, score, feedback)
        ↓
  StudentResults / LessonResults
```
