# Registro de Bugs Conocidos

## 1. Crash en Visor de Estudiantes por Contenido Bilingüe (`LessonViewer` / `ActivityEngine`)
**Severidad:** ALTA - Bloqueante

**Descripción:**
Tras la refactorización del Editor del Profesor a un modelo de captura bilingüe (`content: { es: {...}, en: {...} }`), el motor de la vista del estudiante no fue actualizado para resolver o entender esta anidación del idioma al vuelo. Esto provoca dos síntomas críticos documentados:
1. **Slides (Pasos) Vacíos:** El visor `LessonViewer` no encuentra la cadena de texto base y devuelve un *render* vacío o fallido para los pasos multimedia y explicativos.
2. **Error de React in ActivityEngine:** Al llegar a un paso de actividad (ej. *Multiple Choice*), React crashea produciendo el siguiente error de consola:
   `Error: Minified React error #31; object with keys {id, text}`. 
   Esto ocurre porque el motor está esperando un *Array plano* de opciones de la actividad original, y lo que recibe es un *Objeto anidado* con claves `es` y `en`. Al intentar mapear u obligar un render directamente contra el Object, React revienta por error de invariabilidad.

**Archivos afectados que requieren refactorización:**
- `src/components/student/LessonViewer.tsx` (Para el despliegue de los pasos simples)
- `src/components/student/ActivityEngine.tsx` / `ActivityForm...` (Para el despliegue de las opciones e interacción de las actividades multiformato).
