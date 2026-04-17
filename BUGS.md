# Registro de Bugs Conocidos

## ~~1. Crash en Visor de Estudiantes por Contenido Bilingüe (`LessonViewer` / `ActivityEngine`)~~ -> [✓ RESUELTO]
**Severidad:** ALTA - Bloqueante

**Descripción:**
Tras la refactorización del Editor del Profesor a un modelo de captura bilingüe (`content: { es: {...}, en: {...} }`), el motor de la vista del estudiante no fue actualizado para resolver o entender esta anidación del idioma al vuelo. Esto provoca dos síntomas críticos documentados:
1. **Slides (Pasos) Vacíos:** El visor `LessonViewer` no encuentra la cadena de texto base y devuelve un *render* vacío o fallido para los pasos multimedia y explicativos.
2. **Error de React in ActivityEngine:** Al llegar a un paso de actividad (ej. *Multiple Choice*), React crashea produciendo el siguiente error de consola:
   `Error: Minified React error #31; object with keys {id, text}`. 
   Esto ocurre porque el motor está esperando un *Array plano* de opciones de la actividad original, y lo que recibe es un *Objeto anidado* con claves `es` y `en`. Al intentar mapear u obligar un render directamente contra el Object, React revienta por error de invariabilidad.

**Resolución:**
- Se enlazaron las actividades correctamente en la lista unificada mediante la inserción indexada dentro del render (`LessonViewer.tsx`), erradicando las slides muertas.
- Se ha integrado en todas las actividades multiformato afectadas (`MultipleChoice`, `Listening`, etc.) un renderizador semántico seguro: `typeof option === 'object' ? option.text : option` evitando cualquier colapso al procesar arrays de texto versus arrays estructurados dictados por el modelo bilingüe y previniendo el Crash #31.
