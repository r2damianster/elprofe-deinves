# Próxima Sesión — Estado de Bugs y Tareas Pendientes

**Actualizado:** 2026-04-30
**Instrucción:** Empieza aquí. Las tareas están ordenadas por prioridad.

---

## Resumen de estado

| Item | Descripción | Estado |
|------|-------------|--------|
| Bug-001..003 | RLS, JSON anidado, recursión | ✅ CERRADO |
| Bug-004..009 | Sesión 2026-04-23 | ✅ TODOS CERRADOS |
| Bug-010 | Pantalla en blanco en actividades (drag_drop + Error Boundary) | ✅ CERRADO 2026-04-30 |
| Feature-001 | Calificación batch con IA en Producciones | ✅ IMPLEMENTADO |
| Feature-002 | Umbrales configurables compliance e integridad | ✅ IMPLEMENTADO |
| Feature-003 Fase A | Taxonomía: description, tags, difficulty en activities | ✅ IMPLEMENTADO |
| Bug-011 | Integridad demasiado estricta — bloqueos en móvil | 🔴 PENDIENTE |
| Feature-004 | Texto de ejemplo configurable en producción | 🔴 PENDIENTE |
| Feature-005 | Etiquetas bilingües con IA en lecciones y actividades | 🔴 PENDIENTE |
| Feature-006 | Preview de actividad en banco al asignar a lección | 🔴 PENDIENTE |
| Feature-003 Fase B | Filtros por etiqueta/dificultad + vista tarjetas en banco | ⏸ BACKLOG |

---

## PRIORIDAD 1 — Bug-011: Integridad demasiado estricta en móvil

**Problema:** Los estudiantes en celular reciben penalizaciones de integridad por acciones legítimas:
- Hacer scroll natural dentro de la misma pantalla se detecta como salida del campo
- Copiar y pegar del mismo texto del ensayo (auto-corrección) se cuenta como "paste externo"
- En general el umbral está muy bajo — estudiantes honestos terminan bloqueados

**Archivos a revisar:**
- `src/components/student/ProductionEditor.tsx` — lógica de `integrity_events` y `integrityScore`
- Buscar los event listeners de `blur`, `visibilitychange`, `paste`, `copy`

**Fixes sugeridos:**
1. **Scroll interno:** ignorar eventos `blur` cuando el foco se pierde por scroll dentro del mismo componente (usar `relatedTarget` para discriminar)
2. **Copy-paste del mismo texto:** comparar el texto pegado con el contenido actual del textarea; si ya existe en el ensayo → no penalizar
3. **Rango de penalización:** revisar que `penalty` por evento sea proporcional; eventos de scroll no deben tener penalty > 0
4. **Visibilitychange en móvil:** el sistema operativo móvil llama `visibilitychange` al bajar la barra de notificaciones — ignorar eventos de < 2 segundos

---

## PRIORIDAD 2 — Feature-004: Texto de ejemplo en producción

**Descripción:** El profesor puede —opcionalmente— escribir un texto de ejemplo que sirva de modelo para los estudiantes. Si lo configura, los estudiantes lo ven antes de escribir su producción. Si no lo configura, no aparece nada (el flujo actual no cambia).

**Flujo:**
1. En Content Studio → Reglas de Producción: agregar campo "Texto de ejemplo (opcional)" — textarea bilingüe ES/EN, vacío por defecto
2. Se guarda en `production_rules.example_text` (JSONB `{es: "...", en: "..."}`), NULL si no se rellena
3. En `ProductionEditor.tsx` (vista estudiante): **solo si** `example_text` tiene contenido, mostrar panel colapsable "Ver ejemplo del profesor"
4. El panel tiene ícono de ojo, fondo azul claro, colapsable — no interfiere con el área de escritura

**BD:**
```sql
ALTER TABLE production_rules ADD COLUMN IF NOT EXISTS example_text jsonb;
```

**Archivos:**
- `src/components/professor/studio/ContentStudio.tsx` o donde se editan production_rules → agregar textarea bilingüe + botón IA traducir
- `src/components/student/ProductionEditor.tsx` → mostrar panel colapsable con el ejemplo

---

## PRIORIDAD 3 — Feature-005: Etiquetas bilingüe + IA en lecciones y actividades

### 5A — Etiquetas de actividades bilingüe (tags[] en activities)
**Problema actual:** `activities.tags` es `text[]` con etiquetas en un solo idioma. No hay versión EN.

**Solución simple (sin migración de BD):** Las etiquetas son términos técnicos/pedagógicos — en general las mismas palabras sirven en ambos idiomas. Lo que falta es:
1. Al generar etiquetas con IA (`complete_activity`), el modelo ya devuelve tags en inglés. Mostrarlas también en español (traducir con IA o dejar bilingüe)
2. En el banco de actividades: buscar tags en ES y EN simultáneamente

**Solución alternativa (con migración):**
```sql
ALTER TABLE activities ADD COLUMN IF NOT EXISTS tags_en text[] DEFAULT '{}';
```
Y agregar `tags_en` al flujo de `complete_activity` en la Edge Function.

### 5B — Etiquetas de lecciones con IA + bilingüe
**Problema actual:** En `LessonEditor.tsx`, las etiquetas de lección no tienen:
- Botón de IA para sugerirlas basadas en el contenido de la lección
- Versión EN de las etiquetas

**Fix:**
1. Agregar botón "Sugerir con IA" junto al campo de tags en LessonEditor
2. Llamar a Edge Function con task `suggest_tags` (nueva task) que analiza título + descripción de la lección y sugiere 3-5 etiquetas
3. Mostrar campo de tags EN separado (o usar el mismo array bilingüe)

### 5C — Traducción IA del título de recurso (video/presentación/PDF)
**Problema actual:** Cuando el profesor agrega un paso de tipo VIDEO o READING_FOCUS a una lección, el título del recurso solo está en un idioma.

**Fix:** Agregar botón "Traducir título con IA" en el editor de pasos de LessonEditor, usando la task `translate` ya existente en `ai-enhance`.

**Archivos:**
- `src/components/professor/studio/LessonEditor.tsx` — agregar tag input bilingüe + botón IA
- `supabase/functions/ai-enhance/index.ts` — agregar task `suggest_tags`

---

## PRIORIDAD 4 — Feature-006: Preview de actividad en banco al asignar

**Problema:** Cuando el profesor asigna actividades a una lección desde el banco, ve el título y las etiquetas pero no puede saber de qué trata la actividad sin abrirla en el editor.

**Solución:** Al hacer click (o hover en desktop) sobre una tarjeta del banco, mostrar un tooltip/popover sutil con:
- La instrucción principal o primera pregunta de la actividad
- Solo texto, sin editar — solo lectura
- Se extrae del `content.es` del tipo de actividad correspondiente

**Lógica de extracción por tipo:**

| Tipo | Campo a mostrar |
|---|---|
| `multiple_choice`, `true_false`, `image_question`, `listening` | `content.es.question` |
| `fill_blank` | `content.es.text` (primeras 80 caracteres) |
| `short_answer` | `content.es.question` |
| `matching` | `content.es.instruction` |
| `ordering`, `drag_drop` | `content.es.instruction` |
| `essay`, `open_writing`, `long_response`, `structured_essay` | `content.es.prompt` |
| `category_sorting`, `matrix_grid`, `error_spotting` | `content.es.question` o `instruction` |

**UI:** Un pequeño popover gris claro que aparece al hacer click en la tarjeta (no en el botón "Agregar"). Máximo 2 líneas de texto. En desktop también puede activarse con hover.

**Archivos:**
- `src/components/professor/studio/ActivityBank.tsx` — agregar lógica de preview y el popover

---

## Feature-003 Fase B (backlog, no urgente)

Filtros por etiqueta y dificultad en el panel de asignación de actividades + toggle vista lista/tarjetas. Ver diseño en `.claude/roadmap/feature-003-activity-taxonomy.md`.
