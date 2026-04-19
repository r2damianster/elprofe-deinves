# Actividad: Drag and Drop (Arrastrar y Soltar)

## Descripción
Actividad donde el estudiante clasifica elementos arrastrándolos a categorías.

## JSONB Específico

```typescript
interface DragDropContent {
  instruction: string;        // Instrucción general
  categories: {               // Categorías destino
    id: string;               // Identificador único
    name: string;             // Nombre visible
    items: string[];          // Elementos que pertenecen aquí
  }[];
}

// Ejemplo
{
  instruction: "Clasifica los animales según su hábitat",
  categories: [
    {
      id: "1",
      name: "Animales Terrestres",
      items: ["León", "Elefante", "Tigre"]
    },
    {
      id: "2",
      name: "Animales Acuáticos",
      items: ["Tiburón", "Delfín", "Ballena"]
    },
    {
      id: "3",
      name: "Animales Aéreos",
      items: ["Águila", "Loro", "Murciélago"]
    }
  ]
}
```

## Componente: DragDrop.tsx

**Ubicación:** `src/components/student/activities/DragDrop.tsx`

### Props
```typescript
interface Props {
  content: DragDropContent;
  onSubmit: (response: any, score: number) => void;
  disabled: boolean;
  points: number;
}
```

### Respuesta enviada
```typescript
{
  categorization: {
    [categoryId: string]: string[];  // Elementos en cada categoría
  };
  correct: boolean;
}
```

### Cálculo de puntaje
```typescript
function calculateScore(
  response: DragDropResponse,
  content: DragDropContent,
  points: number
): number {
  let correctCount = 0;
  let totalItems = 0;
  
  content.categories.forEach(cat => {
    const placedItems = response.categorization[cat.id] || [];
    const correctItems = cat.items;
    
    // Verificar que todos los items correctos estén en esta categoría
    correctItems.forEach(item => {
      if (placedItems.includes(item)) correctCount++;
      totalItems++;
    });
    
    // Penalizar items incorrectos
    placedItems.forEach(item => {
      if (!correctItems.includes(item)) correctCount--;
    });
  });
  
  const percentage = Math.max(0, correctCount / totalItems);
  return Math.round(points * percentage);
}
```

## Validación

### Mínimo requerido
- Al menos 2 categorías
- Al menos 1 elemento por categoría
- Instrucción no vacía

### Máximo sugerido
- 5 categorías
- 15 elementos totales

## UI/UX

### Vista del Estudiante
```
┌─────────────────────────────────────────────────────────┐
│ Clasifica los animales según su hábitat                 │
│                                                          │
│  Elementos:                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │  León  │ │ Tiburón│ │ Águila │ │ Elef.  │          │
│  └────────┘ └────────┘ └────────┘ └────────┘          │
│                                                          │
│  Categorías:                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Terrestres   │  │  Acuáticos   │  │   Aéreos     │   │
│  │              │  │              │  │              │   │
│  │   [Soltar    │  │   [Soltar    │  │   [Soltar    │   │
│  │    aquí]     │  │    aquí]     │  │    aquí]     │   │
│  │              │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                          │
│            [Enviar Respuesta]                          │
└─────────────────────────────────────────────────────────┘
```

### Implementación de Drag and Drop
```typescript
// Usar HTML5 Drag and Drop API o librería como @dnd-kit
<div
  draggable
  onDragStart={(e) => handleDragStart(e, item)}
  onDragEnd={handleDragEnd}
>
  {item}
</div>

<div
  onDragOver={handleDragOver}
  onDrop={(e) => handleDrop(e, categoryId)}
>
  {droppedItems.map(item => ...)}
</div>
```

## Editor: ActivityEditor

### Campos del formulario
1. Instrucción (textarea)
2. Categorías (dinámico)
   - Nombre de categoría
   - Lista de elementos
   - Botón agregar/quitar elemento
3. Botón "Agregar categoría"
4. Botón eliminar categoría

### Preview en editor
- Mostrar cómo quedará la actividad
- Validar que elementos encajan en categorías

## Edge Cases

1. **Todos los elementos en una categoría**: Permitir parcial
2. **Elementos sin categoría**: Advertir antes de enviar
3. **Más elementos que espacio**: Scroll o grid responsivo
4. **Touch devices**: Implementar touch events para móviles
5. **Undo**: Permitir arrastrar de vuelta al pool

## Variantes

### Matching
Tipo separado `matching` donde emparejas elementos:
```typescript
{
  instruction: "Relaciona sinónimos",
  pairs: [
    { id: "1", left: "Rápido", right: "Veloz" },
    { id: "2", left: "Grande", right: "Enorme" }
  ]
}
```

### Category Sorting
```typescript
{
  instruction: "Ordena de menor a mayor",
  items: ["3", "1", "4", "2"],
  correct_order: ["1", "2", "3", "4"]
}
```
