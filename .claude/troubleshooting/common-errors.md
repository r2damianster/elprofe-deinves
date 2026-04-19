# Errores Frecuentes

## 1. RLS bloqueando queries silenciosamente

**Síntoma:** La query devuelve `[]` o `null` sin error, pero los datos existen en la BD.

**Causa:** Row Level Security está bloqueando el acceso. El usuario autenticado no cumple la política del rol para esa tabla.

**Diagnóstico:**
```sql
-- Verificar qué rol tiene el usuario
SELECT get_user_role();

-- Probar la query como service role en Supabase Dashboard (bypasea RLS)
-- Si devuelve datos como service role pero no como anon/authenticated → RLS
```

**Fix:** Revisar la política RLS de la tabla. Recordar que `get_user_role()` devuelve `'admin'` si `is_admin = true`, independientemente del campo `role`.

---

## 2. React error #31 — objeto renderizado donde se esperaba string

**Síntoma:** `Error: Minified React error #31; object with keys {es, en}` (o `{id, text}`)

**Causa:** Un campo bilingüe `{ es: '...', en: '...' }` se está pasando directamente a JSX sin resolverse.

**Fix:**
```typescript
// Mal
<p>{lesson.title}</p>

// Bien
import { resolveField } from '../lib/i18n';
<p>{resolveField(lesson.title, courseLanguage)}</p>

// Para opciones de actividades (array bilingüe vs plano)
typeof option === 'object' ? option.text : option
```

---

## 3. JSONB malformado al insertar actividad

**Síntoma:** Error de Supabase `invalid input syntax for type json` o `null value in column`.

**Causa común:** El campo `content` de `activities` o `lessons` no es JSON válido, o falta el wrapper bilingüe `{ es: {...}, en: {...} }`.

**Estructura requerida para activities:**
```json
{
  "es": { /* campos del tipo de actividad en español */ },
  "en": { /* campos del tipo de actividad en inglés */ },
  "tags": []
}
```

**Estructura requerida para lessons:**
```json
{
  "steps": [...],
  "tags": []
}
```

---

## 4. Supabase Realtime no recibe eventos

**Síntoma:** `PresentationViewer` o `GroupEnrollment` no se actualizan en tiempo real.

**Causas frecuentes:**
- La tabla no tiene `REPLICA IDENTITY FULL` habilitada en Supabase
- El canal de Realtime usa un filtro incorrecto
- La suscripción no se limpia en el `useEffect` return

**Patrón correcto:**
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`tabla:${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tabla', filter: `id=eq.${id}` }, handler)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [id]);
```

---

## 5. Edge Function retorna 500 por GROQ_URL no configurada

**Síntoma:** `ai-enhance` devuelve `{ error: "GROQ_API_KEY not configured in Edge Function secrets" }`

**Fix:**
```bash
npx supabase secrets set GROQ_URL=<tu_api_key>
# O desde el Dashboard: Project Settings → Edge Functions → Secrets
```

---

## 6. `lesson_activities` desincronizada del content JSONB

**Síntoma:** Las actividades no aparecen en el orden correcto o aparecen duplicadas.

**Causa:** El guardado de la lección actualizó `lessons.content` pero no sincronizó `lesson_activities`.

**Fix:** Al guardar una lección, siempre ejecutar ambas operaciones:
```typescript
// 1. Actualizar lessons.content
await supabase.from('lessons').update({ content: newContent }).eq('id', lessonId);

// 2. Reemplazar lesson_activities
const activitySteps = steps.filter(s => s.type === 'activity' && s.activity_id);
await supabase.from('lesson_activities').delete().eq('lesson_id', lessonId);
await supabase.from('lesson_activities').insert(
  activitySteps.map((s, idx) => ({ lesson_id: lessonId, activity_id: s.activity_id, order_index: idx }))
);
```
