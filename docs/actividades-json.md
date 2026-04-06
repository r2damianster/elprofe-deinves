# Referencia Técnica: Actividades y Lecciones

Guía técnica para crear y poblar lecciones y actividades directamente en la base de datos de Supabase.

---

## Estructura general

```
lessons
  └── lesson_steps       (pasos de contenido: texto, slides, video)
  └── lesson_activities  (vinculación con actividades evaluativas)
        └── activities   (banco central reutilizable de actividades)
```

Una misma actividad puede estar en múltiples lecciones. Una lección puede tener pasos de contenido (slides, texto) intercalados con actividades.

---

## 1. Tabla `lessons`

```sql
INSERT INTO lessons (title, description, has_production, production_unlock_percentage)
VALUES (
  'Título de la lección',
  'Descripción breve',
  false,   -- true si requiere producción escrita final
  80       -- % mínimo en actividades para desbloquear producción
)
RETURNING id;
```

---

## 2. Tabla `lesson_steps` (pasos de contenido)

Cada paso puede ser texto, slide incrustado, video, o combinación.

```sql
INSERT INTO lesson_steps (lesson_id, step_type, title, content, order_index)
VALUES (
  'LESSON_ID',
  'content',
  'Título del paso',
  '{"text": "Texto explicativo...", "url": "URL_EMBED"}'::jsonb,
  1
);
```

**Tipos de paso (`step_type`):** `content`, `video`, `reading_focus`

**URLs de Google Slides:** convierte `/edit` → `/embed?start=false&loop=false&delayms=3000`
- Original: `https://docs.google.com/presentation/d/ID/edit`
- Embed: `https://docs.google.com/presentation/d/ID/embed?start=false&loop=false&delayms=3000`

---

## 3. Tabla `activities` — tipos y estructura JSON

### `multiple_choice` / `true_false`
```json
{
  "question": "¿Cuál es el objetivo de la investigación cualitativa?",
  "options": ["Medir variables", "Comprender fenómenos", "Probar hipótesis", "Generalizar datos"],
  "correctAnswer": 1
}
```
- `correctAnswer`: índice 0-based de la opción correcta
- Para V/F omite `options` (usa los valores por defecto "Verdadero"/"Falso")

---

### `matching`
```json
{
  "pairs": [
    { "left": "Investigación cualitativa", "right": "Datos no numéricos" },
    { "left": "Investigación cuantitativa", "right": "Datos estadísticos" },
    { "left": "Investigación mixta", "right": "Ambos enfoques" }
  ]
}
```

---

### `fill_blank`
```json
{
  "text": "La investigación ____ busca comprender fenómenos, mientras que la ____ busca medirlos."
}
```
- Usa `____` (4 guiones bajos) para marcar cada espacio

---

### `ordering`
```json
{
  "items": [
    "Planteamiento del problema",
    "Revisión de literatura",
    "Diseño metodológico",
    "Recolección de datos",
    "Análisis e interpretación",
    "Conclusiones"
  ]
}
```
- Los ítems se presentan en orden aleatorio al estudiante; el orden correcto es el del array

---

### `error_spotting`
```json
{
  "question": "Identifica los errores metodológicos en el siguiente párrafo:",
  "text": "El investigador aplicó una encuesta a 5 personas y concluyó que todos los estudiantes de la universidad prefieren el método cualitativo. Además, no se especificó el instrumento de validación.",
  "errors": ["5 personas", "todos los estudiantes", "no se especificó el instrumento"],
  "explanation": "Una muestra de 5 personas no es representativa para generalizar. Se deben especificar los instrumentos de validación."
}
```

---

### `category_sorting`
```json
{
  "question": "Clasifica los siguientes elementos según su tipo de investigación:",
  "categories": ["Cualitativa", "Cuantitativa"],
  "items": [
    { "text": "Encuesta con escala Likert", "category": 1 },
    { "text": "Entrevista a profundidad", "category": 0 },
    { "text": "Experimento controlado", "category": 1 },
    { "text": "Grupo focal", "category": 0 }
  ]
}
```
- `category`: índice 0-based del array `categories`

---

### `matrix_grid`
```json
{
  "question": "Relaciona cada enfoque con su característica principal:",
  "rows": ["Cualitativo", "Cuantitativo", "Mixto"],
  "columns": ["Flexible", "Estructurado", "Integrador"],
  "correct_map": [[0, 0], [1, 1], [2, 2]]
}
```
- `correct_map`: lista de pares `[índice_fila, índice_columna]` correctos

---

### `short_answer`
```json
{
  "question": "¿Qué es la triangulación en investigación?",
  "expectedKeywords": ["múltiples", "fuentes", "validez", "métodos", "datos"]
}
```

---

### `long_response`
```json
{
  "question": "Explica la diferencia entre validez interna y validez externa en un diseño experimental.",
  "min_characters": 300,
  "max_characters": 1500,
  "show_word_count": true
}
```

---

### `essay`
```json
{
  "prompt": "Argumenta por qué la selección del método de investigación debe responder al problema planteado y no a la preferencia del investigador.",
  "minWords": 250
}
```

---

### `structured_essay`
```json
{
  "question": "Redacta un ensayo académico sobre la importancia de la ética en la investigación científica.",
  "sections": [
    {
      "label": "Introducción",
      "min_words": 80,
      "placeholder": "Presenta el tema, su relevancia y tu tesis principal..."
    },
    {
      "label": "Desarrollo",
      "min_words": 200,
      "placeholder": "Argumenta con evidencia teórica y ejemplos concretos. Incluye citas APA..."
    },
    {
      "label": "Conclusión",
      "min_words": 60,
      "placeholder": "Sintetiza tus argumentos y plantea una reflexión final..."
    }
  ],
  "rubric_criteria": [
    "Coherencia y cohesión del argumento",
    "Uso correcto de citas APA",
    "Gramática y ortografía",
    "Profundidad del análisis"
  ]
}
```

---

## 4. Vincular actividades a una lección

```sql
INSERT INTO lesson_activities (lesson_id, activity_id, order_index)
VALUES
  ('LESSON_ID', 'ACTIVITY_ID_1', 1),
  ('LESSON_ID', 'ACTIVITY_ID_2', 2),
  ('LESSON_ID', 'ACTIVITY_ID_3', 3);
```

---

## 5. SQL completo de ejemplo

```sql
-- 1. Crear lección
INSERT INTO lessons (title, description, has_production, production_unlock_percentage)
VALUES ('Paradigmas de Investigación', 'Introducción a los enfoques cualitativo, cuantitativo y mixto', true, 80)
RETURNING id;
-- Guarda el id retornado como LESSON_ID

-- 2. Pasos de contenido
INSERT INTO lesson_steps (lesson_id, step_type, title, content, order_index) VALUES
('LESSON_ID', 'content', 'Introducción', '{"text": "En esta lección exploraremos los tres grandes paradigmas...", "url": "https://docs.google.com/presentation/d/ID/embed?start=false&loop=false&delayms=3000"}'::jsonb, 1),
('LESSON_ID', 'content', 'Enfoque Cualitativo', '{"text": "El enfoque cualitativo busca comprender fenómenos..."}'::jsonb, 2);

-- 3. Crear actividad
INSERT INTO activities (title, type, points, content)
VALUES ('Identifica el paradigma', 'category_sorting', 10,
  '{"question": "Clasifica:", "categories": ["Cualitativo", "Cuantitativo"], "items": [{"text": "Entrevista", "category": 0}, {"text": "Encuesta numérica", "category": 1}]}'::jsonb)
RETURNING id;
-- Guarda el id como ACTIVITY_ID

-- 4. Vincular
INSERT INTO lesson_activities (lesson_id, activity_id, order_index)
VALUES ('LESSON_ID', 'ACTIVITY_ID', 1);
```

---

## 6. Grupos y agrupaciones

Los grupos se gestionan desde el panel del profesor en la tab **Grupos** dentro de cada curso. Ver también: [gemini-gem-prompt.md](./gemini-gem-prompt.md) para generar actividades automáticamente con IA.

### Tablas involucradas
| Tabla | Función |
|-------|---------|
| `group_sets` | Agrupación nombrada (ej: "Dinámica Lección 3") |
| `groups` | Grupo individual dentro de una agrupación |
| `group_members` | Estudiantes de cada grupo |
| `group_lesson_assignments` | Lecciones asignadas a un grupo específico |
| `group_progress` | Progreso compartido del grupo en una lección |
| `group_activity_completions` | Registro de quién completó cada actividad grupal |
