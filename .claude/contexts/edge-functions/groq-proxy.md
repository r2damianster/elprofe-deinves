# Edge Function: ai-enhance

Proxy hacia la API de GROQ (modelo `llama-3.3-70b-versatile`). Ejecuta tareas de mejora con IA para el Content Studio del profesor.

**Endpoint:** `supabase/functions/ai-enhance/index.ts`
**Desplegado como:** `ai-enhance`

## Configuración

Requiere el secret `GROQ_URL` (o `GROQ_API_KEY`) en los secrets de Supabase Edge Functions.

```
supabase secrets set GROQ_URL=<tu_api_key_de_groq>
```

## Request

```typescript
POST /functions/v1/ai-enhance
Authorization: Bearer <supabase_anon_key>
Content-Type: application/json

{
  task: EnhanceTask;
  lang: 'es' | 'en';
  data: Record<string, any>;
}
```

## Tareas disponibles (`EnhanceTask`)

| Task | Entrada en `data` | Salida en `result` |
|------|-------------------|--------------------|
| `improve_title` | `{ title, context? }` | string — título mejorado |
| `improve_description` | `{ title, content? }` | string — descripción mejorada |
| `improve_instructions` | `{ instructions, lessonTitle? }` | string — instrucciones mejoradas |
| `generate_activity_options` | `{ question, correct? }` | `{ options: [{id, text}], correct_id }` |
| `suggest_required_words` | `{ lessonTitle, level? }` | `{ required_words: string[] }` |

## Response

```typescript
// Éxito
{ result: string | object }

// Error
{ error: string }   // HTTP 500
```

Las tareas `generate_activity_options` y `suggest_required_words` devuelven `result` como objeto JSON parseado. El resto devuelve `result` como string plano.

## Ejemplo de uso desde el frontend

```typescript
const { data, error } = await supabase.functions.invoke('ai-enhance', {
  body: {
    task: 'improve_title',
    lang: 'es',
    data: { title: 'Saludos en inglés', context: 'lección introductoria' }
  }
});
// data.result → "Expresiones de Saludo en Inglés: Formal e Informal"
```

## Notas

- Modelo: `llama-3.3-70b-versatile` (GROQ, temperatura 0.4, max 400 tokens)
- CORS habilitado para todos los orígenes (`*`)
- Se accede desde `LessonEditor.tsx` en el Content Studio para sugerencias inline
