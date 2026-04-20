# Próxima Sesión — Verificación Bug-004

**Fecha de creación:** 2026-04-19  
**Estado:** pendiente de prueba manual

---

## Contexto

En la sesión del 2026-04-19 se implementó en `ProductionEditor.tsx`:
- Modo enfoque (toggle en header)
- Módulo de feedback IA (tarea `review_production` en Edge Function `ai-enhance`)

La Edge Function fue desplegada exitosamente. El código frontend compila (los errores TS son pre-existentes, no bloquean). **Aún no se ha probado en el navegador.**

---

## Lista de verificación manual

### A. Levantar el proyecto

```bash
cd "c:\Users\User\Documents\Desarrollo Web\elprofe-deinves"
npm run dev
```

Abrir: `http://localhost:5173` — login como estudiante.

---

### B. Modo Enfoque

**Ruta:** Entrar a una lección → sección de Producción Escrita

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Verificar que el header muestra el botón "Enfoque" (ícono PanelLeftClose) | Visible en la derecha del header |
| 2 | Click en "Enfoque" | Panel izquierdo desaparece; editor ocupa 100% de ancho |
| 3 | El botón cambia a "Panel" (ícono PanelLeftOpen) | Texto e ícono actualizados |
| 4 | Click en "Panel" | Panel izquierdo reaparece; layout vuelve a 40/60 |
| 5 | En modo enfoque, el botón "Analizar con IA" NO debe aparecer | Correcto por `!focusMode` en la condición |

---

### C. Botón "Analizar con IA" y cooldown de 2 horas

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Escribir menos de `min_words` palabras | Botón morado NO aparece |
| 2 | Escribir ≥ `min_words` palabras (sin uso previo) | Botón "Analizar con IA (orientativo)" activo |
| 3 | Click en el botón | Pestaña "IA" activa; spinner "Analizando..." |
| 4 | Esperar respuesta (~3-5 s) | Score badge + resumen + fortalezas + mejoras |
| 5 | Score ≥ 80 → verde; 60-79 → amarillo; < 60 → rojo | Colores correctos |
| 6 | Inmediatamente después del análisis | Botón cambia a "IA disponible en 120 min" y queda deshabilitado |
| 7 | Click en botón deshabilitado | Toast: "Disponible en X min. Solo 1 análisis cada 2 horas." |
| 8 | Recargar la página dentro de las 2 horas | Botón sigue deshabilitado con el tiempo restante (persiste en localStorage) |
| 9 | Pasadas 2 horas | Botón vuelve a estar activo |

**Clave localStorage:** `ai_review_<lessonId>` — valor: timestamp en ms del último uso exitoso.

---

### D. Pestaña IA

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Antes de analizar, click en pestaña "IA" | Muestra "Escribe al menos N palabras y pulsa el botón" |
| 2 | Después de analizar, pestaña "IA" muestra badge con el score | Número en círculo morado en la pestaña |
| 3 | Verificar las secciones: score, summary, strengths, improvements | Todas visibles y correctamente formateadas |
| 4 | Texto de pie: "Feedback orientativo. La calificación oficial la asigna el profesor." | Visible al final |

---

### E. Errores que pueden aparecer

| Error | Causa probable | Fix |
|-------|---------------|-----|
| "GROQ_API_KEY not configured" | Secret `GROQ_URL` no configurado en Supabase | Dashboard → Project Settings → Edge Functions → Secrets → agregar `GROQ_URL` |
| Toast "Error al analizar con IA" | GROQ devolvió JSON malformado (raro) o error de red | Verificar logs: Dashboard → Edge Functions → `ai-enhance` → Logs |
| JSON.parse fail silencioso (result es string) | El modelo no respetó el formato JSON | Ajustar prompt o agregar `response_format: { type: 'json_object' }` en la llamada a GROQ |
| Botón IA no aparece | `wordCount < min_words` o `focusMode === true` | Normal — es por diseño |

---

### F. Fix opcional: errores TypeScript pre-existentes

Si se quiere limpiar los errores TS en `ProductionEditor.tsx` (líneas ~140, 365, 388, 408):

**Opción rápida:** en `buildPayload()`, castear:
```typescript
integrity_events: integrityEvents as unknown as import('../lib/database.types').Json,
```

**Opción completa:** regenerar `database.types.ts` desde Supabase:
```
usar mcp__supabase__generate_typescript_types
```
y reemplazar el contenido de `src/lib/database.types.ts`.

---

### G. Una vez verificado

1. Cerrar este archivo como resuelto (mover a `resolved-bugs.md` o marcarlo CERRADO)
2. Commit de verificación: `test(productions): verificar módulo IA y modo enfoque`
