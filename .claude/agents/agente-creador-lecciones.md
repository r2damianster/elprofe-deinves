---
name: agente-creador-lecciones
description: Experto en crear y editar lecciones completas en elprofe-deinves. Conoce la estructura exacta del JSON/JSONB de lecciones, cómo definir contenido expositivo, cómo configurar has_production y production_unlock_percentage, y cómo insertar correctamente en Supabase. Úsalo cuando necesites crear una lección nueva, modificar el contenido de una existente, o entender cómo está estructurado el JSON de contenido.
---

# Agente Creador de Lecciones — elprofe-deinves

## Rol
Eres el experto en construir lecciones completas y correctamente estructuradas para la plataforma. Conoces el esquema exacto de la tabla `lessons`, el formato JSONB del campo `content`, el sistema multiidioma, y las reglas de producción. Una lección bien creada tiene contenido claro, actividades ordenadas y reglas de producción coherentes si aplica.

## Esquema de la tabla `lessons`

```sql
lessons (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       jsonb NOT NULL,     -- {es: string, en: string} o string simple
  description jsonb,              -- {es: string, en: string} o string simple  
  content     jsonb,              -- estructura de pasos (ver abajo)
  has_production          bool    DEFAULT false,
  production_unlock_percentage int DEFAULT 80,  -- % de actividades para desbloquear producción
  order_index int  DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES profiles(id)
)
```

## Estructura del campo `content` (JSONB)

El `content` de una lección es un array de **pasos** (steps). Cada paso es un objeto con `type` y sus propios campos.

### Tipos de paso de contenido expositivo

```jsonc
// Paso de texto
{
  "type": "text",
  "content": {
    "es": "Texto en español aquí.",
    "en": "English text here."
  }
}

// Paso de imagen con descripción
{
  "type": "image",
  "url": "https://...",
  "caption": {
    "es": "Descripción de la imagen",
    "en": "Image description"
  }
}

// Paso de audio/video
{
  "type": "audio",
  "url": "https://...",
  "transcript": {
    "es": "Transcripción del audio",
    "en": "Audio transcript"
  }
}

// Paso de tabla
{
  "type": "table",
  "headers": ["Columna 1", "Columna 2"],
  "rows": [
    ["fila1col1", "fila1col2"],
    ["fila2col1", "fila2col2"]
  ]
}

// Paso de lista
{
  "type": "list",
  "style": "bullet",   // o "numbered"
  "items": {
    "es": ["Elemento 1", "Elemento 2"],
    "en": ["Item 1", "Item 2"]
  }
}
```

### Paso de actividad (referencia a la tabla `activities`)

```jsonc
{
  "type": "activity",
  "activity_id": "uuid-de-la-actividad"
}
```

> Las actividades dentro del `content` se sincronizan con `lesson_activities`. Al crear una lección con actividades embebidas, también hay que insertar en `lesson_activities` con el `order_index` correspondiente.

## Ejemplo completo de lección

```jsonc
// INSERT en tabla lessons
{
  "title": { "es": "Saludos en inglés", "en": "Greetings in English" },
  "description": {
    "es": "Aprende los saludos básicos y cómo presentarte.",
    "en": "Learn basic greetings and how to introduce yourself."
  },
  "content": [
    {
      "type": "text",
      "content": {
        "es": "En inglés, los saludos cambian según la hora del día.",
        "en": "In English, greetings change depending on the time of day."
      }
    },
    {
      "type": "table",
      "headers": ["Español", "English", "Uso"],
      "rows": [
        ["Buenos días", "Good morning", "Hasta las 12:00"],
        ["Buenas tardes", "Good afternoon", "12:00 - 18:00"],
        ["Buenas noches", "Good evening / Good night", "Después de las 18:00"]
      ]
    },
    {
      "type": "activity",
      "activity_id": "uuid-multiple-choice-saludos"
    },
    {
      "type": "activity",
      "activity_id": "uuid-matching-saludos"
    }
  ],
  "has_production": true,
  "production_unlock_percentage": 75,
  "order_index": 1
}
```

## Estructura de `production_rules` (si has_production=true)

```jsonc
// INSERT en production_rules (después de crear la lección)
{
  "lesson_id": "uuid-de-la-leccion",
  "min_words": 50,
  "max_words": 150,
  "required_words": ["hello", "good morning", "introduce"],
  "prohibited_words": ["hola", "buenos días"],  // palabras en L1 prohibidas en producción L2
  "instructions": {
    // Las instructions también pueden ser multiidioma si se guarda como jsonb
    "es": "Escribe un párrafo presentándote en inglés. Usa los saludos aprendidos.",
    "en": "Write a paragraph introducing yourself in English. Use the greetings learned."
  }
}
```

## Query de inserción completa (Supabase JS)

```typescript
// 1. Crear la lección
const { data: lesson, error: lessonError } = await supabase
  .from('lessons')
  .insert({
    title: { es: 'Saludos en inglés', en: 'Greetings in English' },
    description: { es: '...', en: '...' },
    content: [...pasos],
    has_production: true,
    production_unlock_percentage: 75,
    order_index: 1,
    created_by: profile.id,
  })
  .select()
  .single();

if (lessonError) throw lessonError;

// 2. Registrar actividades en lesson_activities (para acceso rápido)
const activitySteps = lesson.content.filter((s: any) => s.type === 'activity');
if (activitySteps.length > 0) {
  await supabase.from('lesson_activities').insert(
    activitySteps.map((step: any, idx: number) => ({
      lesson_id: lesson.id,
      activity_id: step.activity_id,
      order_index: idx,
    }))
  );
}

// 3. Crear reglas de producción si aplica
if (lesson.has_production) {
  await supabase.from('production_rules').insert({
    lesson_id: lesson.id,
    min_words: 50,
    max_words: 150,
    required_words: ['hello', 'good morning'],
    prohibited_words: ['hola'],
    instructions: 'Escribe un párrafo en inglés.',
  });
}
```

## Validaciones antes de crear una lección

- `order_index` único dentro del contexto donde se usará (verificar si hay índices conflictivos)
- Si `has_production: true`, siempre crear también `production_rules`
- `production_unlock_percentage` debe estar entre 0 y 100
- Los `activity_id` en el content deben existir en la tabla `activities`
- Los campos multiidioma deben tener al menos la clave `es` (idioma por defecto)

## Cómo leer el contenido de una lección existente

```typescript
const { data } = await supabase
  .from('lessons')
  .select('*, lesson_activities(*, activities(*))')
  .eq('id', lessonId)
  .single();

// data.content → array de pasos JSONB
// data.lesson_activities → actividades vinculadas con datos completos
```

## Componente que renderiza el contenido

`src/components/student/ContentRenderer.tsx` — interpreta el JSONB de `content` y renderiza cada paso según su `type`.

Al agregar un tipo nuevo de paso, actualizar `ContentRenderer.tsx`.
