# Actividades de Producción Escrita: essay, long_response, structured_essay

Las actividades de producción **no tienen corrección automática**. Se guardan en la tabla `productions` y requieren revisión del profesor. Todas incluyen:
- Barra de **compliance** en tiempo real (progreso hacia los requisitos)
- Barra de **integridad** via `useIntegrity` (detecta: paste, cambio de tab, clic derecho, atajos de teclado, resize)

La función `isProduction(type)` en `activityTypes.ts` devuelve `true` para estos tipos.

---

## essay

Ensayo libre con mínimo de palabras.

```typescript
{
  prompt: string;              // Consigna del ensayo
  minWords: number;            // Mínimo de palabras requeridas
  required_words?: string[];   // Palabras que DEBEN aparecer en el texto
  forbidden_words?: string[];  // Palabras que NO pueden aparecer
}
```

**Compliance score** = promedio ponderado de:
- Progreso de palabras: `min(100, (wordCount / minWords) * 100)`
- Palabras requeridas: `(palabras_presentes / total_requeridas) * 100` (si hay)
- Palabras prohibidas: `((prohibidas - usadas) / prohibidas) * 100` (si hay)

---

## long_response

Respuesta larga medida en caracteres (no palabras).

```typescript
{
  question: string;              // Pregunta principal
  min_characters?: number;       // Mínimo de caracteres (default: 0)
  max_characters?: number;       // Máximo de caracteres (default: 3000)
  show_word_count?: boolean;     // Mostrar contador de palabras (default: true)
  required_words?: string[];     // Palabras obligatorias
  forbidden_words?: string[];    // Palabras prohibidas
}
```

**Compliance score** = promedio ponderado de:
- Progreso de caracteres: `min(100, (charCount / min_characters) * 100)`
- Palabras requeridas (si las hay)
- Palabras prohibidas (si las hay)

---

## structured_essay

Ensayo dividido en secciones, cada una con su propio mínimo de palabras.

```typescript
{
  question: string;              // Consigna general
  sections: {
    label: string;               // Nombre de la sección (ej: "Introducción")
    min_words: number;           // Mínimo de palabras para esta sección
    placeholder: string;         // Texto guía dentro del textarea
  }[];
  rubric_criteria?: string[];    // Criterios de evaluación mostrados al estudiante
  required_words?: string[];     // Palabras obligatorias en el texto total
  forbidden_words?: string[];    // Palabras prohibidas en el texto total
}
```

**Compliance score** = promedio ponderado de:
- Progreso total: `(palabras_totales / suma_min_words_secciones) * 100`
- Palabras requeridas sobre el texto combinado de todas las secciones
- Palabras prohibidas sobre el texto combinado

**El label del compliance** muestra `X/N secciones (Progreso: Y%)`.

---

## Flujo de guardado en BD

Todas las producciones se guardan en la tabla `productions`:

| Campo | Descripción |
|-------|-------------|
| `content` | Texto escrito por el estudiante |
| `word_count` | Conteo de palabras |
| `compliance_score` | Score de cumplimiento (0-100) |
| `integrity_score` | Score de integridad (0-100) |
| `integrity_events` | Array JSONB de eventos de integridad detectados |
| `time_on_task` | Tiempo en segundos desde que abrió la actividad |
| `status` | `draft` → `submitted` → `reviewed` |

El profesor ve estas métricas en `ProductionReviewer.tsx` y puede calificar (0-100) + dejar feedback.
