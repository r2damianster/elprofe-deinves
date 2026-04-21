# Bug-002: Anidamiento de JSON en Títulos de Actividades (Estructura Híbrida)

**Estado:** CERRADO  
**Fecha implementación:** 2026-04-19 (commit `e55c456`)  
**Fecha cierre:** 2026-04-21 — verificado manualmente en navegador ✅

---

## 1. Diagnóstico y Presunción del Problema
Se ha detectado un comportamiento crítico en el almacenamiento de los títulos dentro de la tabla `activities`. Los datos se están guardando con un "doble empaquetado" JSON (JSON-in-JSON), resultando en valores como:
`{"es": "{\"en\": \"...\", \"es\": \"...\"}"}`.

### Análisis de la Causa Raíz (Asunciones)
Presumo que el error nace de una **desincronía entre la arquitectura del Frontend y el esquema de la Base de Datos**:

1.  **Inconsistencia de Tipos en la Definición:** El archivo `database.types.ts` define `activities.title` como un simple `string` (TEXT), mientras que el componente `ActivityEditor.tsx` está intentando persistir un objeto bilingüe `{ es: string, en: string }`.
2.  **Serialización Automática (Implicit Casting):** Al enviar un objeto a una columna que Supabase/PostgreSQL espera como texto, el driver de JavaScript serializa el objeto automáticamente a string para evitar un error de inserción.
3.  **Fallo en el Ciclo de Carga (Re-hidratación):** El componente `ActivityEditor.tsx` no discrimina correctamente si el dato recuperado es un objeto real o un string serializado. Si recibe el string `'{"es": "Hola"}'`, lo asigna directamente a la variable de estado del idioma español, y al volver a guardar, lo envuelve nuevamente en un objeto.

---

## 2. Puntos Críticos de Revisión Sugeridos

Antes de ejecutar cambios, se recomienda al agente IA validar las siguientes piezas del sistema:

* **`src/lib/database.types.ts`**: Confirmar si el tipo de `activities.title` es efectivamente `string`.
* **`src/components/professor/studio/ActivityEditor.tsx`**: Analizar la inicialización del `useState` para `titleEs` y `titleEn`. Actualmente usa un condicional `typeof activity.title === 'object'` que probablemente falla si el driver devuelve un string.
* **`src/lib/i18n.ts`**: Revisar la función `resolveField`. Es la solución de lectura ya implementada, pero no se está respetando la simetría en la escritura.

---

## 3. Plan de Acción Recomendado

Se sugiere la siguiente ruta de solución, manteniendo flexibilidad para revisiones adicionales:

### Fase A: Alineación de Esquema (Recomendado)
Para un sistema bilingüe escalable, el campo `title` debería ser estructuralmente idéntico al campo `content`.
* **Sugerencia:** Migrar la columna `title` de la tabla `activities` de tipo `TEXT` a `JSONB` en Supabase.

### Fase B: Refactorización del Componente Editor
Implementar una lógica de "hidratación" más robusta en `ActivityEditor.tsx` que normalice el dato independientemente de cómo venga de la base de datos:

```typescript
// Lógica sugerida para el inicio del componente
const getInitialTitles = (title: any) => {
  let parsed = title;
  // Si llega como string pero parece JSON, lo limpiamos primero
  if (typeof title === 'string' && title.startsWith('{')) {
    try { parsed = JSON.parse(title); } catch { parsed = title; }
  }

  if (parsed && typeof parsed === 'object') {
    return { es: parsed.es || '', en: parsed.en || '' };
  }
  // Fallback para registros antiguos que solo tienen texto plano
  return { es: title || '', en: '' };
};



Fase C: Normalización del Guardado
Asegurar que titlePayload en handleSave sea siempre un objeto limpio. Si por razones técnicas la base de datos debe seguir siendo string, se debe aplicar JSON.stringify() de forma explícita una sola vez, pero nunca enviar el objeto directamente.

Fase D: Limpieza de Datos (SQL)
Una vez corregida la lógica, se debe limpiar la base de datos de los strings "contaminados" con este script:

SQL
UPDATE activities
SET title = (title::json->>'es')::text
WHERE title LIKE '{"es":%';
4. Notas de Seguridad
Este reporte asume una arquitectura híbrida. Antes de realizar cambios globales, la IA debe verificar si otros componentes (ej. listas de actividades o selectores) están parseando el título manualmente, para evitar romper la visualización en otras partes de la plataforma.