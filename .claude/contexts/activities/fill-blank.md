# Actividad: Fill in the Blank (Completar Espacios)

## Descripción
Actividad donde el estudiante completa espacios en blanco dentro de un texto.

## JSONB Específico

```typescript
interface FillBlankContent {
  text: string;               // Texto con ___ (tres guiones bajos) para espacios
  answers: string[];          // Respuestas correctas en orden de aparición
}

// Ejemplo
{
  text: "In the morning we say ___ and at night we say ___.",
  answers: ["good morning", "good night"]
}
```

## Componente: FillBlank.tsx

**Ubicación:** `src/components/student/activities/FillBlank.tsx`

### Props
```typescript
interface Props {
  content: FillBlankContent;
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}
```

### Respuesta enviada
```typescript
{
  answers: string[];          // Respuestas del estudiante
  correct: boolean[];         // Si cada respuesta es correcta
}
```

### Cálculo de puntaje
```typescript
function calculateScore(
  studentAnswers: string[],
  correctAnswers: string[],
  points: number
): number {
  let correctCount = 0;
  
  studentAnswers.forEach((answer, idx) => {
    const correct = correctAnswers[idx]?.toLowerCase().trim();
    const given = answer?.toLowerCase().trim();
    
    // Comparación flexible (acepta variantes menores)
    if (correct === given || correct?.includes(given)) {
      correctCount++;
    }
  });
  
  const percentage = correctCount / correctAnswers.length;
  return Math.round(points * percentage);
}
```

### Renderizado del texto
```typescript
function renderText(text: string, answers: string[]) {
  const parts = text.split('___');
  const result = [];
  
  parts.forEach((part, idx) => {
    result.push(<span key={`text-${idx}`}>{part}</span>);
    
    if (idx < parts.length - 1) {
      result.push(
        <input
          key={`input-${idx}`}
          type="text"
          value={answers[idx] || ''}
          onChange={(e) => handleChange(idx, e.target.value)}
          className="blank-input"
          disabled={disabled}
        />
      );
    }
  });
  
  return result;
}
```

## Validación

### Mínimo requerido
- Al menos 1 espacio en blanco (___)
- Al menos 1 respuesta
- Número de respuestas = número de espacios

### Máximo sugerido
- 5 espacios por texto
- Texto máximo 500 caracteres

## UI/UX

### Vista del Estudiante
```
┌─────────────────────────────────────────────────────────┐
│ Completa los espacios en blanco:                         │
│                                                          │
│  In the morning we say [___________] and at night        │
│  we say [___________].                                   │
│                                                          │
│  Espacios detectados: 2                                  │
│                                                          │
│  [Enviar Respuesta]                                      │
└─────────────────────────────────────────────────────────┘
```

### Feedback visual
```
// Después de enviar:
In the morning we say [good morning ✓] and at night
we say [good night ✓].

// O si hay errores:
In the morning we say [hello ✗] and at night
we say [bye ✗].

// Mostrar correctas:
Correctas: "good morning", "good night"
```

## Editor: ActivityEditor

### Campos del formulario
1. Texto (textarea)
   - Instrucción: "Usa ___ (tres guiones bajos) para espacios"
2. Respuestas (dinámico)
   - Un input por cada ___ detectado
   - Detectar automáticamente al escribir
3. Preview en tiempo real

### Detección de espacios
```typescript
const blankCount = (text.match(/___/g) || []).length;

// Actualizar array de respuestas
useEffect(() => {
  const count = (text.match(/___/g) || []).length;
  setAnswers(prev => {
    const newAnswers = [...prev];
    while (newAnswers.length < count) newAnswers.push('');
    while (newAnswers.length > count) newAnswers.pop();
    return newAnswers;
  });
}, [text]);
```

## Edge Cases

1. **Respuesta vacía**: Contar como incorrecta
2. **Mayúsculas/minúsculas**: Normalizar (toLowerCase)
3. **Espacios extra**: Trim antes de comparar
4. **Tildes**: Opcionalmente ignorar o requerir exacto
5. **Sinónimos**: Configurable aceptar alternativas

## Variantes

### Con opciones
Mostrar lista de palabras para elegir:
```typescript
{
  text: "El ___ rápido ___ salta.",
  answers: ["gato", "mente"],
  options: ["gato", "perro", "mente", "casa"]
}
```

### Cloze completo
Todo el texto es espacios:
```typescript
{
  text: "___ ___ ___ ___.",
  answers: ["El", "gato", "es", "rápido"]
}
```

## Comparación con Short Answer

| Fill Blank | Short Answer |
|------------|--------------|
| Contexto explícito | Pregunta abierta |
| Múltiples espacios | Una respuesta |
| Más guiado | Más libre |
| Reconocimiento | Recuerdo |
