# Actividad: Matching (Relacionar)

## Descripción
Actividad donde el estudiante empareja elementos de dos columnas.

## JSONB Específico

```typescript
interface MatchingContent {
  instruction: string;        // Instrucción general
  pairs: {                    // Pares correctos
    id: string;               // Identificador del par
    left: string;             // Elemento columna A
    right: string;            // Elemento columna B
  }[];
}

// Ejemplo
{
  instruction: "Relaciona cada país con su capital",
  pairs: [
    { id: "1", left: "Francia", right: "París" },
    { id: "2", left: "España", right: "Madrid" },
    { id: "3", left: "Italia", right: "Roma" },
    { id: "4", left: "Alemania", right: "Berlín" }
  ]
}
```

## Componente: Matching.tsx

**Ubicación:** `src/components/student/activities/Matching.tsx`

### Props
```typescript
interface Props {
  content: MatchingContent;
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}
```

### Respuesta enviada
```typescript
{
  matches: {
    [pairId: string]: {        // ID del elemento de la izquierda
      selected: string;         // ID del elemento de la derecha seleccionado
      correct: boolean;
    }
  };
  score: number;
}
```

### Cálculo de puntaje
```typescript
function calculateScore(
  matches: Record<string, { selected: string; correct: boolean }>,
  content: MatchingContent,
  points: number
): number {
  const correctCount = Object.values(matches).filter(m => m.correct).length;
  const total = content.pairs.length;
  const percentage = correctCount / total;
  
  return Math.round(points * percentage);
}

// Verificar si es correcto
function isMatchCorrect(
  pairId: string,
  selectedRightId: string,
  content: MatchingContent
): boolean {
  const correctPair = content.pairs.find(p => p.id === pairId);
  const selectedPair = content.pairs.find(p => p.id === selectedRightId);
  return correctPair?.right === selectedPair?.right;
}
```

## Validación

### Mínimo requerido
- Al menos 2 pares
- Cada par tiene left y right no vacíos
- IDs únicos

### Máximo sugerido
- 8 pares (16 elementos)
- Más elementos = más complejo para el estudiante

## UI/UX

### Vista del Estudiante
```
┌─────────────────────────────────────────────────────────┐
│ Relaciona cada país con su capital                       │
│                                                          │
│  ┌────────────┐           ┌────────────┐                │
│  │  Francia   │  ──────▶  │  París     │ ◀─── Seleccionar │
│  └────────────┘           └────────────┘                │
│                                                          │
│  ┌────────────┐           ┌────────────┐                │
│  │  España    │  ──────▶  │  Madrid    │ ◀─── Seleccionar │
│  └────────────┘           └────────────┘                │
│                                                          │
│  ┌────────────┐           ┌────────────┐                │
│  │  Italia    │  ──────▶  │  Roma      │ ◀─── Seleccionar │
│  └────────────┘           └────────────┘                │
│                                                          │
│  ┌────────────┐           ┌────────────┐                │
│  │  Alemania  │  ──────▶  │  Berlín    │ ◀─── Seleccionar │
│  └────────────┘           └────────────┘                │
│                                                          │
│            [Enviar Respuesta]                           │
└─────────────────────────────────────────────────────────┘
```

### Implementación
```typescript
// Estado de selección
const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
const [selectedRight, setSelectedRight] = useState<string | null>(null);
const [matches, setMatches] = useState<Record<string, string>>({});

// Cuando selecciona ambos
useEffect(() => {
  if (selectedLeft && selectedRight) {
    setMatches(prev => ({
      ...prev,
      [selectedLeft]: selectedRight
    }));
    setSelectedLeft(null);
    setSelectedRight(null);
  }
}, [selectedLeft, selectedRight]);

// Barajar elementos de la derecha para evitar orden obvio
const shuffledRight = useMemo(() => {
  return [...content.pairs].sort(() => Math.random() - 0.5);
}, [content.pairs]);
```

## Editor: ActivityEditor

### Campos del formulario
1. Instrucción (textarea)
2. Tabla de pares:
   - Columna izquierda (input)
   - Columna derecha (input)
   - Botón eliminar fila
3. Botón "Agregar par"

### Preview
- Mostrar cómo se verá (con barajado)
- Validar que todos los campos estén llenos

## Edge Cases

1. **Elementos duplicados**: Permitir, pero puede confundir
2. **Una columna vacía**: Requerir ambos campos
3. **Seleccionar dos de la misma columna**: Cancelar selección anterior
4. **Desmarcar par**: Click en par ya emparejado para deshacer
5. **Respuesta incompleta**: Permitir parcial, calcular sobre completados

## Comparación con DragDrop

| Matching | DragDrop |
|----------|----------|
| Emparejar 1:1 | Clasificar muchos:muchos |
| Dos columnas | Categorías + pool |
| Sin arrastrar (click) | Arrastrar y soltar |
| Más simple | Más interactivo |
