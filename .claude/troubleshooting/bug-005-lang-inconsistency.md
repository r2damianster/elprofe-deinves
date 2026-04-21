# Bug-005: Instrucciones de Producción Almacenadas como JSON Serializado (String)

**Estado:** ABIERTO — fix BD pendiente (limpieza SQL en Supabase)  
**Fecha apertura:** 2026-04-20  
**Fecha actualización:** 2026-04-21 — confirmado en navegador  
**Severidad:** ALTA visualmente — el estudiante ve el JSON crudo completo como texto

---

## Síntoma confirmado (2026-04-21)

El estudiante ve en la pestaña "Instrucciones" de la producción escrita:

```
{"es":"Redacta una propuesta de diagnóstico educativo breve...","en":"Write a brief educational diagnostic proposal..."}
```

El objeto JSON completo se muestra como texto plano en lugar de mostrar solo el texto del idioma correcto.

---

## Diagnóstico realizado

### Hipótesis original (DESCARTADA)
Se asumió que el campo tenía marcadores `en/// ... es/// ...`. El diagnóstico de BD del 2026-04-20 confirmó **0 registros con ese formato**.

### Causa raíz real (CONFIRMADA)
El campo `production_rules.instructions` está guardado como **string TEXT que contiene JSON serializado**, no como JSONB.

Valor en BD (tipo TEXT):
```
'{"es":"Redacta...","en":"Write..."}'
```

Valor esperado (tipo JSONB):
```json
{"es": "Redacta...", "en": "Write..."}
```

Cuando Supabase devuelve un campo TEXT, JavaScript lo recibe como `string`. La función `resolveField` no lo reconoce como objeto, lo trata como string plano y lo muestra íntegro.

### Por qué ocurre
Al guardar desde `LessonEditor.tsx`, el campo `instructions` del objeto `ProductionRules` es `{ es: string; en: string }`. Si la columna `production_rules.instructions` en BD es de tipo `TEXT` (no `JSONB`), el driver de Supabase serializa el objeto a string automáticamente con `JSON.stringify`.

---

## Fix — dos pasos

### Paso 1 — Parche defensivo en `resolveField` (frontend)

Agregar detección de JSON string antes del fallback:

```typescript
// En src/lib/i18n.ts, dentro de resolveField, antes del return raw:
if (raw.startsWith('{') || raw.startsWith('[')) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const primary = parsed[lang];
      const fallback = parsed[lang === 'en' ? 'es' : 'en'];
      return (primary && primary.trim()) ? primary : (fallback ?? raw);
    }
  } catch { /* no es JSON válido, devolver raw */ }
}
```

**Estado:** PENDIENTE de aplicar en código.

### Paso 2 — Limpieza SQL en Supabase (fix definitivo)

El usuario prefiere limpiar desde Supabase directamente. SQL a ejecutar:

```sql
-- Ver registros afectados antes de corregir
SELECT id, lesson_id, instructions
FROM production_rules
WHERE jsonb_typeof(instructions::jsonb) IS NOT NULL
   OR (instructions IS NOT NULL
       AND instructions::text LIKE '{"es":%'
       AND jsonb_typeof(instructions) IS NULL);

-- Alternativa: ver todos y revisar tipo
SELECT id, lesson_id,
  pg_typeof(instructions) AS col_type,
  instructions
FROM production_rules
LIMIT 20;
```

Si `instructions` es de tipo `TEXT`:
```sql
-- Convertir el string serializado a JSONB real
UPDATE production_rules
SET instructions = instructions::jsonb
WHERE instructions IS NOT NULL
  AND instructions::text LIKE '{%';
```

Si la columna es de tipo `JSONB` pero el valor ya llegó como string dentro del JSONB:
```sql
-- El valor es jsonb con tipo 'string' (no 'object')
UPDATE production_rules
SET instructions = (instructions #>> '{}')::jsonb
WHERE jsonb_typeof(instructions) = 'string';
```

**Estado:** PENDIENTE — ejecutar desde Supabase Dashboard → SQL Editor.

---

## Parche `resolveField` aplicado (2026-04-20, sesión anterior)

Se agregó manejo de formato legacy `en/// ... es/// ...`. No cubre el caso de JSON string — eso es el Paso 1 pendiente.

---

## Archivos involucrados

| Archivo | Acción |
|---|---|
| `src/lib/i18n.ts` | Agregar JSON.parse defensivo en `resolveField` |
| Supabase — tabla `production_rules` | Ejecutar UPDATE para convertir a JSONB real |
