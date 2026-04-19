# Bugs Resueltos

## BUG-001: Crash en Visor de Estudiantes por Contenido Bilingüe

**Componentes:** `LessonViewer.tsx`, `ActivityRenderer` (MultipleChoice, Listening, etc.)
**Severidad original:** ALTA - Bloqueante
**Estado:** RESUELTO

### Síntomas

Tras la refactorización del editor del profesor al modelo bilingüe (`content: { es: {...}, en: {...} }`), el motor del estudiante no resolvía la anidación de idioma:

1. **Slides vacíos:** `LessonViewer` no encontraba la cadena de texto base y devolvía render vacío.
2. **React error #31:** Al llegar a una actividad (ej. Multiple Choice), React crasheaba con `Error: Minified React error #31; object with keys {id, text}` porque el motor esperaba un array plano de opciones pero recibía un objeto `{es: [...], en: [...]}`.

### Resolución aplicada

- Se insertaron actividades correctamente en la lista unificada mediante inserción indexada en el render de `LessonViewer.tsx`.
- En todas las actividades multiformato afectadas se integró un renderizador semántico seguro:
  ```typescript
  typeof option === 'object' ? option.text : option
  ```
  Esto evita el colapso al procesar arrays de texto plano versus arrays estructurados del modelo bilingüe.
