# Próxima Sesión — Verificación Manual de Bugs 001–005

**Actualizado:** 2026-04-20  
**Instrucción:** Empieza aquí. Lee cada sección, abre el navegador y verifica en orden. Marca ✅ cuando pase o anota qué falló.

---

## Preparación

```bash
cd "c:\Users\User\Documents\Desarrollo Web\elprofe-deinves"
npm run dev
```

Abrir: `http://localhost:5173`  
Tener a mano dos cuentas: una de **estudiante** y una de **profesor/admin**.

---

## Bug-001 — Validación de Producción Escrita

**Fix:** `ProductionEditor.tsx` — `rulesLoading`, `isValid` blindado, guard en submit. RLS en `production_rules` y `productions`.  
**Commit:** `a767279`, `bcfcadb`

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| 1 | Login como estudiante → entrar a una lección con producción escrita | Se carga el editor sin pantalla en blanco |
| 2 | Con menos de `min_words` palabras intentar enviar | Botón "Enviar" deshabilitado o muestra error |
| 3 | Escribir exactamente `min_words` palabras | Botón "Enviar" se activa |
| 4 | Enviar → confirmar | Producción guardada, redirige o muestra confirmación |
| 5 | Recargar la página inmediatamente | El contenido guardado persiste |

---

## Bug-002 — Doble Anidamiento JSON en Títulos de Actividades

**Fix:** `ActivityEditor.tsx` — lógica de re-hidratación normalizada.  
**Commit:** `e55c456`

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| 1 | Login como profesor → Content Studio → abrir una actividad existente | El título se muestra correctamente en los campos ES y EN (no JSON crudo) |
| 2 | Editar el título ES → Guardar → volver a abrir la actividad | El título guardado es texto plano, no `{"es": "{\"es\":..."}` |
| 3 | Desde la vista del estudiante, navegar a una actividad | El título de la actividad aparece como texto normal |
| 4 | Actividades en `ActivityBank` del assembler | Títulos legibles, no JSON crudo |

---

## Bug-003 — Recursión Infinita en RLS de Agrupaciones

**Fix:** función `count_group_members()` con `SECURITY DEFINER`; política INSERT reescrita.  
**Commit:** `f703183`

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| 1 | Login como profesor → ir a Agrupaciones de un curso | Panel carga sin errores de consola |
| 2 | Crear agrupación aleatoria (ej. 4 grupos) | Se crean los 4 grupos sin error `infinite recursion` |
| 3 | Los grupos aparecen en la UI sin recargar | Inmediato, sin Hard Refresh |
| 4 | Login como estudiante → intentar unirse a un grupo | Se une correctamente; no puede unirse a grupos cerrados o llenos |

---

## Bug-004 — Modo Enfoque + Módulo IA en ProductionEditor

**Fix:** toggle Modo Enfoque, feedback GROQ con cooldown 2h.  
**Commits:** `6d90f4b`, `96fae25`, `7b9a585`

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| 1 | En una producción, header muestra botón "Enfoque" (ícono panel) | Visible en esquina derecha del header |
| 2 | Click en "Enfoque" | Panel izquierdo desaparece; editor a 100% ancho |
| 3 | Click en "Panel" | Panel reaparece; layout 40/60 |
| 4 | En modo enfoque, el botón "Analizar con IA" NO aparece | Correcto por diseño |
| 5 | Escribir ≥ `min_words` palabras (fuera de modo enfoque) | Botón morado "Analizar con IA (orientativo)" aparece |
| 6 | Click en el botón | Pestaña "IA" activa con spinner |
| 7 | Respuesta llega (~3-5 s) | Score badge + resumen + fortalezas + mejoras |
| 8 | Inmediatamente después | Botón cambia a "IA disponible en 120 min" — deshabilitado |
| 9 | Recargar la página | Botón sigue deshabilitado con tiempo restante |

**Si falla el paso 6/7:**
- "GROQ_API_KEY not configured" → agregar secret `GROQ_URL` en Supabase Dashboard → Project Settings → Edge Functions → Secrets
- Toast "Error al analizar con IA" → revisar logs: Dashboard → Edge Functions → `ai-enhance` → Logs

---

## Bug-005 — Inconsistencias en/es en Frontend

**Fix:** `resolveField` en `i18n.ts` extendida con manejo del formato legacy `en/// ... es/// ...`. `ProductionEditor.tsx` usa `resolveField` en ambos puntos.  
**BD:** diagnóstico ejecutado el 2026-04-20 — **0 registros legacy** encontrados.  
**Commit:** (este mismo — `docs/fix: bug-005 lang inconsistency`)

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| 1 | En la pestaña "Instrucciones" de cualquier producción | El texto se muestra limpio, sin `en///` ni `es///` |
| 2 | Si alguna instrucción aparece con marcadores | Anota el `lesson_id` y abre issue — hay un registro legacy no detectado |
| 3 | Títulos de lecciones y actividades en la vista del estudiante | Texto limpio, no JSON crudo ni marcadores |

---

## Al terminar la verificación

Por cada bug verificado OK:
1. Cambiar su estado de `IMPLEMENTADO — pendiente verificación manual` a `CERRADO`
2. Agregar la línea: `**Fecha cierre:** YYYY-MM-DD — verificado manualmente en navegador`

Si algún bug falla, anotarlo en su archivo y abrir una nueva sesión con el agente correspondiente.

---

## Fix TypeScript pendiente (no bloquea runtime)

Errores TS en `ProductionEditor.tsx` líneas ~144, 147, 252-256, 369, 372, 392, 394, 412:  
`integrity_events: IntegrityEvent[]` no es asignable a `Json | null` con PostgREST 14.5.

**Fix rápido** (cuando quieras limpiarlo):
```typescript
// En buildPayload(), castear:
integrity_events: integrityEvents as unknown as import('../lib/database.types').Json,
```

**Fix completo:** regenerar `database.types.ts` con `mcp__supabase__generate_typescript_types`.
