# Bug-005: Inconsistencias de Idioma (en/es) en BD y Frontend

**Estado:** IMPLEMENTADO — pendiente verificación manual en navegador  
**Fecha implementación:** 2026-04-20  
**Severidad:** MEDIA (degradación UX, no bloqueante)

---

## Síntoma reportado

En el visor de instrucciones de trabajos de producción (`ProductionEditor.tsx`, pestaña "Instrucciones"), algunos registros muestran literalmente el texto:

```
en/// Write a paragraph about... es/// Escribe un párrafo sobre...
```

Esto ocurre porque el campo `instructions` en la base de datos fue guardado con el **formato legacy de marcadores de idioma** (`en/// ... es/// ...`) en lugar del formato JSONB actual (`{ "es": "...", "en": "..." }`).

---

## Causa raíz

### Capa 1 — Base de datos (fuente del problema)

La plataforma migró al modelo bilingüe estructurado en JSONB en la versión 0.3.0 (2026-04-07), pero los registros anteriores que usaban el formato marcador `en/// ... es/// ...` **no fueron migrados**. Esos valores siguen en BD como `text` o `jsonb` con el marcador crudo.

**Tablas/campos afectados probables:**
| Tabla | Campo | Tipo esperado | Posible valor legacy |
|---|---|---|---|
| `lessons` | `production_rules.instructions` | `{es, en}` | `"en/// ... es/// ..."` |
| `lessons` | `content[].content` | `{es, en}` | `"en/// ... es/// ..."` |
| `activities` | `content.es.*` / `content.en.*` | objeto estructurado | mezcla o marcadores |
| `activities` | `title` | `{es, en}` | string plano o marcador |

### Capa 2 — Frontend (no maneja el tercer formato)

El frontend solo contempla dos casos:

```typescript
typeof rules.instructions === 'object'
  ? (rules.instructions as { es: string; en: string }).es  // caso nuevo
  : rules.instructions                                      // caso string plano
```

El formato `"en/// ... es/// ..."` cae en la rama `string` y se renderiza **completo con los marcadores**, lo que el estudiante ve como ruido.

---

## Alcance del problema

Según el reporte, el problema se detectó en:
- [x] Instrucciones de trabajos de producción (`production_rules.instructions`)
- [ ] Títulos de lecciones (`lessons.title`)
- [ ] Descripciones de lecciones (`lessons.description`)
- [ ] Títulos de actividades (`activities.title`)
- [ ] Contenido de actividades (opciones de respuesta, texto, etc.)

> **Pendiente:** ejecutar queries de diagnóstico en Supabase para cuantificar registros afectados.

---

## Diagnóstico BD (ejecutado 2026-04-20)

Queries ejecutadas sobre `lessons`, `production_rules`, `activities.title`, `activities.content` con `ILIKE '%en///%'` y `ILIKE '%es///%'` + regex tolerante `~* '(en|es)\s*///'`.

**Resultado: 0 registros legacy encontrados.** La migración v0.3.0 ya convirtió todos los datos al formato JSONB, o los datos con marcadores nunca llegaron a producción.

## Fix aplicado (2026-04-20)

### `src/lib/i18n.ts` — `resolveField` extendida (parche defensivo)

`resolveField` ahora maneja tres casos en orden:
1. `{es, en}` — objeto JSONB actual → extrae el idioma pedido con fallback
2. `"en/// ... es/// ..."` — string con marcadores legacy → parsea y extrae la parte correcta
3. `string` plano → devuelve tal cual

Esto cubre cualquier registro legacy que pueda aparecer en el futuro sin cambio de código adicional.

### `src/components/student/ProductionEditor.tsx`

Los dos puntos que construían el `typeof === 'object'` inline ahora usan `resolveField`:
- Línea ~476: instrucciones enviadas a GROQ (`analyzeWithAI`)
- Línea ~658: pestaña "Instrucciones" visible al estudiante

---

## Plan de resolución original (referencia)

### Paso 1 — Diagnóstico en BD (ejecutar en Supabase)

```sql
-- Detectar lessons con instructions legacy en production_rules
SELECT id, title,
  (production_rules->>'instructions') AS instructions_raw
FROM lessons
WHERE production_rules->>'instructions' ILIKE '%en///%'
   OR production_rules->>'instructions' ILIKE '%es///%';

-- Detectar actividades con título en formato marcador
SELECT id, title::text
FROM activities
WHERE title::text ILIKE '%en///%'
   OR title::text ILIKE '%es///%';

-- Detectar contenido de lecciones con marcadores
SELECT id, title, jsonb_array_length(content) AS n_slides
FROM lessons
WHERE content::text ILIKE '%en///%'
   OR content::text ILIKE '%es///%';
```

### Paso 2 — Migración de datos en BD

Para cada registro legacy, convertir `"en/// TEXT_EN es/// TEXT_ES"` al formato `{"es": "TEXT_ES", "en": "TEXT_EN"}`.

Función helper SQL de migración (draft):

```sql
-- Función para parsear el formato legacy
CREATE OR REPLACE FUNCTION parse_legacy_bilingual(raw text)
RETURNS jsonb AS $$
DECLARE
  en_text text;
  es_text text;
BEGIN
  -- Extraer segmento en inglés
  en_text := trim(substring(raw FROM 'en///\s*(.*?)(?:\s*es///|$)'));
  -- Extraer segmento en español
  es_text := trim(substring(raw FROM 'es///\s*(.*)$'));
  RETURN jsonb_build_object('es', coalesce(es_text, ''), 'en', coalesce(en_text, ''));
END;
$$ LANGUAGE plpgsql;
```

### Paso 3 — Parche defensivo en frontend

Mientras los datos no estén migrados, agregar un tercer caso en `resolveField` / `ProductionEditor.tsx`:

```typescript
function resolveInstructions(val: string | { es: string; en: string } | null, lang = 'es'): string {
  if (!val) return '';
  if (typeof val === 'object') return val[lang] ?? val.es ?? '';
  // Caso legacy: "en/// ... es/// ..."
  if (val.includes('es///')) {
    const match = val.match(/es\/\/\/\s*([\s\S]*)$/);
    if (match) return match[1].trim();
  }
  if (val.includes('en///')) {
    const match = val.match(/en\/\/\/\s*([\s\S]*)(?:\s*es\/\/\/|$)/);
    if (match) return match[1].trim();
  }
  return val;
}
```

> Este parche es **temporal** — la solución definitiva es la migración de datos (Paso 2).

---

## Orden de ejecución recomendado

1. Ejecutar queries de diagnóstico (Paso 1) para conocer el alcance real
2. Aplicar parche frontend defensivo (Paso 3) para corregir lo visible inmediatamente
3. Diseñar y ejecutar migración SQL (Paso 2) con el agente `especialista-bd`
4. Verificar que no quedan registros legacy en BD
5. Eliminar el parche defensivo si ya no es necesario

---

## Archivos involucrados

| Archivo | Rol |
|---|---|
| `src/components/student/ProductionEditor.tsx:659-661` | Renderiza instrucciones — necesita parche defensivo |
| `src/components/student/ProductionEditor.tsx:474-478` | Pasa instrucciones a GROQ — mismo parche |
| `src/components/student/LessonViewer.tsx` | Renderiza `title`/`description` de lección — revisar |
| `src/lib/i18n.ts` | Utilidad `resolveField` — centralizar el parche aquí |
| Supabase — tabla `lessons` | Campo `production_rules.instructions` y `content` |
| Supabase — tabla `activities` | Campo `title` y `content` |
