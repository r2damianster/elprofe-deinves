# Edge Functions — Índice

Todas las Edge Functions están en `supabase/functions/`. Se despliegan con:

```bash
npx supabase functions deploy <nombre>
```

## Funciones desplegadas

| Función | Ruta | Propósito |
|---------|------|-----------|
| `ai-enhance` | `supabase/functions/ai-enhance/index.ts` | Proxy GROQ para tareas de mejora con IA en el Content Studio |

## Secrets requeridos

| Secret | Usado por | Descripción |
|--------|-----------|-------------|
| `GROQ_URL` | `ai-enhance` | API Key de GROQ (también acepta `GROQ_API_KEY`) |

Configurar secrets:
```bash
npx supabase secrets set GROQ_URL=<api_key>
# o desde Dashboard: Project Settings → Edge Functions → Secrets
```

## Invocar desde el frontend

```typescript
const { data, error } = await supabase.functions.invoke('nombre-funcion', {
  body: { /* payload */ }
});
```

Ver detalles de `ai-enhance` en [groq-proxy.md](./groq-proxy.md).
