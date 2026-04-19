# Especificación JSONB de Lecciones

## Estructura General

Las lecciones se almacenan en `lessons.content` con el siguiente formato:

```typescript
{
  steps: ContentStep[];  // Array de pasos secuenciales
  tags: string[];        // Etiquetas de la lección
}
```

## Tipos de Paso (StepType)

Cada paso tiene un campo `type` que determina su estructura:

### text
Bloque de texto enriquecido bilingüe.

```typescript
{
  type: 'text';
  content: {
    es: string;  // Versión español
    en: string;  // Versión inglés
  };
}
```

### video
Video embebido.

```typescript
{
  type: 'video';
  url: string;           // URL del video (YouTube, Vimeo, MP4)
  caption: {
    es: string;          // Pie de video español
    en: string;          // Pie de video inglés
  };
}
```

### slides
Presentación embebida.

```typescript
{
  type: 'slides';
  url: string;           // URL de Google Slides o PowerPoint Online
  caption: {
    es: string;          // Título español
    en: string;          // Título inglés
  };
}
```

### image
Imagen con descripción.

```typescript
{
  type: 'image';
  url: string;           // URL de la imagen
  caption: {
    es: string;          // Descripción español
    en: string;          // Descripción inglés
  };
}
```

### audio
Archivo de audio.

```typescript
{
  type: 'audio';
  url: string;           // URL del archivo de audio
  caption: {
    es: string;          // Descripción español
    en: string;          // Descripción inglés
  };
}
```

### link
Enlace externo.

```typescript
{
  type: 'link';
  url: string;           // URL del recurso
  caption: {
    es: string;          // Texto del enlace español
    en: string;          // Texto del enlace inglés
  };
}
```

### activity
Actividad interactiva vinculada.

```typescript
{
  type: 'activity';
  activity_id: string;   // UUID de la actividad en tabla activities
}
```

## Ejemplo Completo de Lección

```json
{
  "steps": [
    {
      "type": "text",
      "content": {
        "es": "En esta lección aprenderemos sobre saludos básicos...",
        "en": "In this lesson we will learn about basic greetings..."
      }
    },
    {
      "type": "video",
      "url": "https://www.youtube.com/embed/abc123",
      "caption": {
        "es": "Mira este video sobre saludos informales",
        "en": "Watch this video about informal greetings"
      }
    },
    {
      "type": "activity",
      "activity_id": "550e8400-e29b-41d4-a716-446655440000"
    },
    {
      "type": "image",
      "url": "https://cdn.example.com/greetings-chart.png",
      "caption": {
        "es": "Tabla de saludos según la formalidad",
        "en": "Greetings chart by formality"
      }
    },
    {
      "type": "activity",
      "activity_id": "550e8400-e29b-41d4-a716-446655440001"
    }
  ],
  "tags": ["saludos", "básico", "vocabulario"]
}
```

## Metadatos de la Lección

Además del JSONB `content`, la tabla `lessons` tiene campos importantes:

```typescript
{
  id: string;                           // UUID
  title: { es: string; en: string };    // Título bilingüe
  description: { es: string; en: string };  // Descripción bilingüe
  has_production: boolean;            // ¿Tiene producción final?
  production_unlock_percentage: number;  // % mínimo para desbloquear producción
  order_index: number;                // Orden en el curso
  created_by: string;                 // UUID del creador
  created_at: string;                 // ISO timestamp
}
```

## Reglas de Producción

Cuando `has_production = true`, existe una tabla `production_rules` vinculada:

```typescript
{
  lesson_id: string;              // UUID de la lección
  min_words: number;              // Mínimo de palabras requeridas
  max_words: number | null;       // Máximo de palabras (null = sin límite)
  required_words: string[];       // Palabras que deben aparecer
  prohibited_words: string[];    // Palabras que no pueden aparecer
  instructions: {
    es: string;                   // Instrucciones en español
    en: string;                   // Instrucciones en inglés
  };
  extra_rules?: any;            // Reglas adicionales flexibles
}
```

## Sincronización con lesson_activities

Los pasos de tipo `activity` en el JSONB deben estar sincronizados con la tabla `lesson_activities`:

- **Fuente de verdad**: El campo `content.steps` del JSONB
- **Tabla puente**: `lesson_activities` permite queries eficientes y foreign keys

### Proceso de guardado

1. Extraer todos los pasos con `type: 'activity'` del JSONB
2. Borrar registros existentes en `lesson_activities` para esta lección
3. Insertar nuevos registros con el `order_index` correspondiente

```typescript
const activitySteps = steps.filter(s => s.type === 'activity' && s.activity_id);
await supabase.from('lesson_activities').delete().eq('lesson_id', lessonId);
await supabase.from('lesson_activities').insert(
  activitySteps.map((s, idx) => ({
    lesson_id: lessonId,
    activity_id: s.activity_id,
    order_index: idx
  }))
);
```

## Flujo del Estudiante

1. Carga `lesson.content.steps`
2. Renderiza pasos secuencialmente
3. Cuando encuentra `type: 'activity'`:
   - Carga la actividad desde `activities` table
   - Renderiza el componente correspondiente
   - Guarda respuesta en `activity_responses`
4. Calcula `completion_percentage` basado en actividades completadas
5. Si `completion_percentage >= production_unlock_percentage`, permite acceder a la producción
