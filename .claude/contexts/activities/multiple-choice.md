# Actividad: Multiple Choice (Opción Múltiple)

## Descripción
Actividad donde el estudiante selecciona una opción correcta entre varias alternativas.

## JSONB Específico

```typescript
interface MultipleChoiceContent {
  question: string;           // Pregunta a responder
  options: {                  // Array de opciones
    id: string;               // 'a', 'b', 'c', 'd'...
    text: string;             // Texto de la opción
  }[];
  correct_id: string;         // ID de la opción correcta
}

// Ejemplo
{
  question: "¿Cuál es la capital de Francia?",
  options: [
    { id: "a", text: "Londres" },
    { id: "b", text: "París" },
    { id: "c", text: "Madrid" },
    { id: "d", text: "Berlín" }
  ],
  correct_id: "b"
}
```

## Componente: MultipleChoice.tsx

**Ubicación:** `src/components/student/activities/MultipleChoice.tsx`

### Props
```typescript
interface Props {
  content: MultipleChoiceContent;
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}
```

### Respuesta enviada
```typescript
{
  selectedOption: string;    // ID de la opción seleccionada
  correct: boolean;            // Si acertó o no
}
```

### Cálculo de puntaje
```typescript
const correctAnswer = content.correct_id ?? content.correctAnswer ?? content.correct_answer;
const isCorrect = selectedOption === correctAnswer;
const score = isCorrect ? points : 0;
```

## Validación

### Mínimo requerido
- Al menos 2 opciones
- Una opción marcada como correcta
- Pregunta no vacía

### Límites
- Máximo recomendado: 6 opciones
- Sin límite estricto

## UI/UX

### Vista del Estudiante
```
┌─────────────────────────────────────────────┐
│ ¿Cuál es la capital de Francia?             │
│                                              │
│  ○  a. Londres                               │
│  ○  b. París                                 │
│  ○  c. Madrid                                │
│  ○  d. Berlín                                │
│                                              │
│  [Enviar Respuesta]                         │
└─────────────────────────────────────────────┘
```

### Estados
- **Sin seleccionar**: Botón deshabilitado
- **Seleccionada**: Opción resaltada, botón activo
- **Enviado**: 
  - Correcta: Opción verde, mensaje de éxito
  - Incorrecta: Opción roja, mostrar correcta

## Editor: ActivityEditor

### Campos del formulario
1. Pregunta (textarea)
2. Opciones (dinámico, mínimo 2)
3. Seleccionar radio de la correcta
4. Botón "Agregar opción"
5. Botón eliminar (X) en cada opción

### Validaciones del editor
```typescript
function validate(content: any): boolean {
  return (
    content.question?.trim() &&
    Array.isArray(content.options) &&
    content.options.length >= 2 &&
    content.options.some((o: any) => o.id === content.correct_id)
  );
}
```

## Edge Cases

1. **Todas las opciones idénticas**: Permitir, aunque no recomendado
2. **Una sola opción**: Validar mínimo 2 en editor
3. **Ninguna marcada como correcta**: Requerir selección
4. **IDs duplicados**: Normalizar automáticamente
5. **Texto vacío**: Mostrar error al guardar

## Variantes

### True/False
Tipo separado `true_false` pero similar estructura:
```typescript
{
  statement: "El cielo es azul",
  correct: true  // o false
}
```

### Image Question
Mismo JSONB, pero con `media_url` en la actividad:
```typescript
{
  question: "¿Qué ves en la imagen?",
  options: [...],
  correct_id: "a"
}
// activities.media_url = URL de la imagen
```
