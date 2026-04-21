# Bug-004: Sobrecarga Visual y Módulo IA en ProductionEditor

**Estado:** FALLA — error 401 en Edge Function `ai-enhance`  
**Verificación:** 2026-04-21 — modo enfoque OK ✅ / módulo IA falla ❌  
**Fecha implementación:** 2026-04-19  
**Sesión:** Bug-004 (continuación de Bug-001)

---

## Diagnóstico original

El `ProductionEditor.tsx` presentaba "sobrecarga visual": instrucciones, estado, integridad y el textarea compartían pantalla sin jerarquía clara, dificultando la escritura del estudiante.

---

## Soluciones implementadas

### 1. Doble panel + sistema de pestañas (ya estaba hecho)
- Panel izquierdo 40% (informativo) / derecho 60% (editor)
- Pestañas: Instrucciones · Estado · Integridad
- Auto-guardado silencioso cada 30 s

### 2. Modo Enfoque (nuevo — sesión 2026-04-19)

Toggle en el header (`PanelLeftClose / PanelLeftOpen`) que oculta el panel izquierdo y expande el editor a ancho completo. Ideal para estudiantes que ya leyeron las instrucciones.

**Componente:** `src/components/student/ProductionEditor.tsx`  
**Estado:** `focusMode: boolean` — toggle en header  
**Comportamiento:** `aside` pasa a `hidden`; `section` pasa a `w-full`

### 3. Módulo de Feedback IA — GROQ (nuevo — sesión 2026-04-19)

**Edge Function extendida:** se agregó la tarea `review_production` a `ai-enhance`.  
**Desplegada:** sí (versión activa en Supabase, 2026-04-19)

#### Flujo
1. Estudiante escribe ≥ `min_words` palabras
2. Aparece el botón morado "Analizar con IA (orientativo)"
3. Botón llama a `analyzeWithAI()` → fetch a `ai-enhance` con task `review_production`
4. Pestaña "IA" se activa con spinner
5. GROQ devuelve JSON: `{ score, summary, strengths[], improvements[] }`
6. Feedback se muestra con score badge (verde/amarillo/rojo), fortalezas y sugerencias
7. El estudiante puede seguir editando o entregar — el feedback es **orientativo**

#### Prompt a GROQ
- Sistema: evalúa coherencia, gramática, vocabulario, cumplimiento de reglas
- Devuelve JSON puro (sin markdown), parseado automáticamente
- `max_tokens: 400`, `temperature: 0.4`

#### Cambios en ProductionEditor.tsx
| Elemento | Descripción |
|---|---|
| Imports | `Sparkles, PanelLeftClose, PanelLeftOpen, ThumbsUp, Lightbulb` |
| `activeTab` | extendido a `'ia'` |
| `focusMode` state | boolean, toggle en header |
| `aiFeedback` state | `{ score, summary, strengths[], improvements[] } \| null` |
| `aiLoading` / `aiError` | estados de carga y error |
| `aiCooldownMin` state | minutos restantes de cooldown (null = disponible) |
| `AI_COOLDOWN_MS` | constante 2 h = 7 200 000 ms |
| `aiStorageKey` | `ai_review_<lessonId>` — clave localStorage por lección |
| `getAiCooldownRemaining()` | lee localStorage y calcula ms restantes |
| `analyzeWithAI()` | verifica cooldown antes de llamar; guarda timestamp al éxito |
| `useEffect` cooldown | refresca `aiCooldownMin` cada 60 s |
| Pestaña IA | 4ª pestaña con badge de score cuando hay resultado |
| Botón IA | aparece cuando `wordCount >= min_words` y `!focusMode`; deshabilitado con texto "IA disponible en X min" durante cooldown |

#### Límite de uso IA (cooldown)
- **1 uso cada 2 horas** por lección, almacenado en `localStorage`
- Clave: `ai_review_<lessonId>` → valor: timestamp ms del último uso exitoso
- Persiste al recargar la página
- Durante el cooldown: botón deshabilitado + tooltip + toast si intentan forzarlo

---

## Errores de TypeScript pre-existentes (NO causados por Bug-004)

Las operaciones `.update()` / `.insert()` en la tabla `productions` dan error TS porque `integrity_events: IntegrityEvent[]` no es asignable a `Json | null` con `PostgrestVersion: '14.5'`.

**Causa:** incompatibilidad entre el tipo custom `IntegrityEvent[]` y el tipo `Json` generado por Supabase con PostgREST 14.5.  
**Impacto:** solo TypeScript (no bloquea runtime; Vite transpila igual).  
**Fix pendiente:** regenerar tipos desde Supabase (`mcp__supabase__generate_typescript_types`) o castear `integrity_events as unknown as Json` en `buildPayload()`.

---

---

## Resultado verificación 2026-04-21

| Funcionalidad | Estado |
|---|---|
| Modo Enfoque (toggle panel) | ✅ Funciona correctamente |
| Botón "Analizar con IA" aparece al superar min_words | No verificado (bloqueado por 401) |
| Feedback IA (score, fortalezas, mejoras) | ❌ Error 401 en Edge Function |
| Cooldown 2h en localStorage | No verificado |

### Error exacto
```
POST ckpmrmhkrbylibecezxn.supabase.co/functions/v1/ai-enhance  → 401 Unauthorized
```

### Causa probable
El secret `GROQ_URL` no está configurado en el proyecto Supabase remoto, o el token de la sesión no se está enviando correctamente en el header `Authorization`.

### Fix requerido (próxima sesión)
1. Ir a Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Verificar que existe `GROQ_URL` con la clave válida de GROQ
3. Si no existe, agregarlo con el valor de `VITE_GROQ_URL` del `.env` local (o de la clave guardada)
4. Re-desplegar la Edge Function si es necesario: `mcp__supabase__deploy_edge_function` con nombre `ai-enhance`
5. Verificar también que la Edge Function valida el JWT correctamente (revisar código de `ai-enhance/index.ts`)
