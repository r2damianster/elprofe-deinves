# Feature-001 — Calificación asistida por IA en Producciones

**Estado:** 🗺️ DISEÑO — pendiente de implementación  
**Categoría:** Feature nueva  
**Prioridad:** Alta (impacto directo en flujo del profesor)  
**Componentes:** `ProductionReviewer.tsx`, Edge Function `ai-enhance`, tabla `productions`

---

## Objetivo

Permitir al profesor calificar producciones escritas con asistencia de IA:
la IA propone una rúbrica basada en los ensayos reales, el profesor la ajusta,
y la IA asigna score + feedback a cada producción. El resultado se guarda como
calificación oficial visible para el estudiante.

---

## Flujo propuesto

```
1. Profesor abre tab "Producciones" → filtra por curso + lección
2. Botón "Generar rúbrica con IA"
   └─ IA lee TODOS los ensayos del grupo
   └─ Propone prompt/criterio de evaluación basado en patrones que encuentra
   └─ Profesor revisa y edita el prompt (textarea editable)
3. Botón "Calificar con IA"
   └─ IA evalúa cada ensayo con ese prompt
   └─ Propone: score (0-100) + feedback (texto)
   └─ Profesor ve tabla de resultados propuestos (puede editar celda por celda)
4. Botón "Confirmar y guardar"
   └─ Upsert en productions: score, feedback, status = 'reviewed', reviewed_at
   └─ Estudiantes ven "Calificación del profesor" automáticamente
```

---

## Decisiones de diseño

### ¿La calificación IA aparece como "Calificación del profesor"?
**Sí.** El campo `productions.score` ya existe y `LessonResults`/`StudentResults`
lo muestran con ese label. No requiere cambios en BD ni en vistas de estudiante.
La IA actúa como asistente del profesor — la calificación es responsabilidad del
docente que la confirma.

### ¿Se guarda el prompt usado?
Conveniente guardarlo para auditoría. Opciones:
- Campo nuevo `productions.ai_prompt` (text)
- O campo en `production_rules.extra_rules` (jsonb ya existe)
  Recomendación: usar `extra_rules` para no migrar.

### ¿Calificación individual o batch?
Batch: el profesor califica todos de una pasada, revisa la tabla propuesta
y confirma. Más eficiente que ir uno por uno.

### ¿Segmentación por curso?
`ProductionReviewer` actualmente no filtra por curso. Hay que agregar
un selector de curso al inicio del flujo.

---

## Implementación técnica

### Frontend — `ProductionReviewer.tsx`
1. Agregar filtro por curso (dropdown con cursos del profesor)
2. Agregar botón "Generar rúbrica con IA" (visible cuando hay ≥1 producción)
3. Textarea para editar el prompt generado
4. Botón "Calificar con IA" → llama Edge Function con todas las producciones
5. Tabla de resultados propuestos (score editable, feedback editable por fila)
6. Botón "Confirmar y guardar" → batch upsert en Supabase

### Edge Function — `ai-enhance` (task nuevo: `batch_grade`)
```typescript
// Input
{
  task: 'batch_grade',
  rubric_prompt: string,       // prompt del profesor
  productions: Array<{
    id: string,
    content: string,
    word_count: number,
    compliance_score: number
  }>
}

// Output
{
  results: Array<{
    id: string,
    score: number,        // 0-100
    feedback: string      // 1-3 oraciones de retroalimentación
  }>
}
```

### Edge Function — `ai-enhance` (task nuevo: `suggest_rubric`)
```typescript
// Input
{
  task: 'suggest_rubric',
  productions: Array<{ content: string }>,  // todos los ensayos
  lesson_context: string                     // descripción de la lección
}

// Output
{
  rubric_prompt: string  // prompt de evaluación sugerido
}
```

### Base de datos
No requiere migración nueva. Los campos `score`, `feedback`, `status`,
`reviewed_at` ya existen en `productions`.

Opcional (auditoría): agregar `ai_graded: boolean` y `ai_prompt: text`
a `productions` en una migración futura.

---

## Notas
- El proxy GROQ ya existe (`ai-enhance` Edge Function) — reusar
- Bug-004 (GROQ_URL secret) debe estar resuelto antes de implementar esto
- El profesor SIEMPRE confirma antes de guardar — la IA no graba directamente
- Máximo recomendado: 30 producciones por batch (límite de tokens GROQ)
