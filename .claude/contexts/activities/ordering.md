# Actividades Interactivas: ordering, error_spotting, category_sorting, matrix_grid

## ordering

El estudiante reordena ítems usando botones ▲▼. El array `items` define el orden correcto; se presenta desordenado.

```typescript
// activities.content (dentro del wrapper bilingüe)
{
  instruction: string;   // Instrucción general
  items: string[];       // Ítems en orden CORRECTO (se barajan al presentar)
}
```

**Respuesta enviada:**
```typescript
{ finalOrder: string[] }  // Array con el orden elegido por el estudiante
```

**Evaluación:** puntaje completo si `finalOrder` coincide exactamente con `items` original.

**Nota:** El componente actual (`Ordering.tsx`) usa `content.items` directamente como array de strings (sin `id`). El spec en `activity-jsonb-spec.md` describe una versión con objetos `{id, text}` — la implementación real usa strings planos.

---

## error_spotting

El estudiante identifica errores en un texto haciendo clic sobre los fragmentos marcados.

```typescript
{
  question: string;      // Consigna / instrucción
  text: string;          // Texto completo con los errores incrustados
  errors: string[];      // Substrings exactos que son los errores
  explanation: string;   // Explicación que se muestra tras enviar
}
```

**Importante:** `errors` son substrings literales de `text`. El componente parte el texto buscando cada error como substring exacto (case-sensitive).

**Evaluación:** proporcional — `(errores_correctos / total_errores) * points`.

---

## category_sorting

El estudiante asigna cada ítem a una categoría.

```typescript
{
  question: string;      // Consigna
  categories: string[];  // Array de nombres de categorías
  items: {
    text: string;        // Texto del ítem a clasificar
    category: number;    // Índice 0-based de la categoría correcta
  }[];
}
```

**Evaluación:** proporcional — `(ítems_correctos / total_ítems) * points`.

---

## matrix_grid

El estudiante selecciona una opción por fila en una tabla de filas × columnas.

```typescript
{
  question: string;        // Consigna
  rows: string[];          // Etiquetas de filas
  columns: string[];       // Etiquetas de columnas
  correct_map: [number, number][];  // Array de pares [índice_fila, índice_col] correctos
}
```

**Evaluación:** proporcional — `(pares_correctos / total_pares) * points`.

**Nota:** Solo admite una selección por fila (radio dentro de cada fila).
