# Especificación JSONB de Actividades

## Estructura General

Las actividades se almacenan en `activities.content` como JSONB con el siguiente formato:

```typescript
{
  es: { /* contenido español */ },
  en: { /* contenido inglés */ },
  tags: string[]  // etiquetas compartidas
}
```

## Tipos de Actividad y sus JSONB

### multiple_choice
Opción múltiple con 2+ opciones.

```typescript
{
  question: string;           // Pregunta a mostrar
  options: {                  // Array de opciones
    id: string;               // 'a', 'b', 'c', 'd'...
    text: string;             // Texto de la opción
  }[];
  correct_id: string;         // ID de la opción correcta
}
```

### true_false
Verdadero o falso.

```typescript
{
  statement: string;          // Enunciado a evaluar
  correct: boolean;           // true = Verdadero, false = Falso
}
```

### fill_blank
Completar espacios en blanco.

```typescript
{
  text: string;               // Texto con ___ (tres guiones bajos) para espacios
  answers: string[];          // Respuestas en orden de aparición
}
```

### short_answer
Respuesta corta con variantes aceptadas.

```typescript
{
  question: string;           // Pregunta
  accepted_answers: string[]; // Variantes de respuesta válidas
  hint: string;               // Pista opcional para el estudiante
}
```

### matching
Relacionar pares.

```typescript
{
  instruction: string;        // Instrucción general
  pairs: {
    id: string;               // Identificador único
    left: string;             // Elemento columna A
    right: string;            // Elemento columna B
  }[];
}
```

### ordering
Ordenar elementos.

```typescript
{
  instruction: string;        // Instrucción general
  items: {
    id: string;               // Identificador único
    text: string;               // Texto del elemento
  }[];
  correct_order: string[];    // Array de IDs en orden correcto
}
```

### drag_drop
Arrastrar y soltar en categorías.

```typescript
{
  instruction: string;        // Instrucción general
  categories: {
    id: string;               // Identificador único
    name: string;             // Nombre de la categoría
    items: string[];          // Elementos que pertenecen a esta categoría
  }[];
}
```

### listening
Comprensión auditiva.

```typescript
{
  question: string;           // Pregunta sobre el audio
  options: {
    id: string;
    text: string;
  }[];
  correct_id: string;         // ID de la opción correcta
  transcript: string;         // Transcripción del audio (accesibilidad)
}
```

### image_question
Pregunta con imagen.

```typescript
{
  question: string;           // Pregunta sobre la imagen
  options: {
    id: string;
    text: string;
  }[];
  correct_id: string;         // ID de la opción correcta
}
// Nota: La imagen se guarda en activities.media_url
```

### essay
Ensayo/producción escrita libre.

```typescript
{
  prompt: string;             // Consigna del ensayo
  min_words: number;          // Mínimo de palabras
  max_words: number;          // Máximo de palabras
  required_words?: string[]; // Palabras obligatorias
  forbidden_words?: string[]; // Palabras prohibidas
}
```

### long_response
Respuesta larga con preguntas guía.

```typescript
{
  prompt: string;             // Consigna principal
  guiding_questions: string[]; // Preguntas para guiar
  min_words: number;          // Mínimo de palabras
  required_words?: string[]; // Palabras obligatorias
  forbidden_words?: string[]; // Palabras prohibidas
}
```

### structured_essay
Ensayo con secciones estructuradas.

```typescript
{
  prompt: string;             // Consigna general
  sections: {
    id: string;               // 'intro', 'body', 'conclusion'
    title: string;            // Título de la sección
    min_words: number;        // Mínimo de palabras para esta sección
  }[];
  required_words?: string[]; // Palabras obligatorias
  forbidden_words?: string[]; // Palabras prohibidas
}
```

### open_writing
Escritura abierta sin restricciones.

```typescript
{
  prompt: string;             // Consigna
  min_words: number;          // Mínimo sugerido
  max_words: number;          // Máximo sugerido
}
```

## Tipos de Producción

Las actividades marcadas como producción (essay, long_response, structured_essay, open_writing) tienen comportamiento especial:
- No tienen "respuesta correcta" automática
- Requieren revisión del profesor
- Se guardan en la tabla `productions`
- Tienen reglas de validación en `production_rules`

## Validación de JSONB

### Reglas generales
1. `question` o `prompt` es requerido (según el tipo)
2. `options` debe tener al menos 2 elementos (para tipos con opciones)
3. `correct_id` debe existir en `options`
4. `pairs` debe tener al menos 2 pares (matching)
5. `answers.length` debe coincidir con el número de `___` en el texto (fill_blank)

### Ejemplo de validación en código

```typescript
function validateMultipleChoice(content: any): boolean {
  return (
    content.question &&
    Array.isArray(content.options) &&
    content.options.length >= 2 &&
    content.options.some((o: any) => o.id === content.correct_id)
  );
}
```
