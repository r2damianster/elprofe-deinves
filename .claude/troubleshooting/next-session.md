# Próxima Sesión — Estado de Bugs y Tareas Pendientes

**Actualizado:** 2026-05-01
**Instrucción:** Empieza aquí. Las tareas están ordenadas por prioridad.

---

## Resumen de estado

| Item | Descripción | Estado |
|------|-------------|--------|
| Bug-001..003 | RLS, JSON anidado, recursión | ✅ CERRADO |
| Bug-004..009 | Sesión 2026-04-23 | ✅ TODOS CERRADOS |
| Bug-010 | Pantalla en blanco en actividades (drag_drop + Error Boundary) | ✅ CERRADO |
| Bug-011 | Integridad demasiado estricta — bloqueos en móvil + paste propio | ✅ CERRADO |
| Bug-012 | LessonEditor pantalla en blanco al editar lecciones con actividades | ✅ CERRADO |
| Bug-013 | Actividades recomendadas no funciona en LessonAssembler | ✅ CERRADO — commits `0178d4c` `b9f0baa` |
| Feature-001 | Calificación batch con IA en Producciones | ✅ EN PRODUCCIÓN |
| Feature-002 | Umbrales configurables compliance e integridad | ✅ EN PRODUCCIÓN |
| Feature-003 Fase A | Taxonomía: description, tags, difficulty en activities | ✅ EN PRODUCCIÓN |
| Feature-004 | Texto de ejemplo configurable en producción | ✅ EN PRODUCCIÓN |
| Feature-005 | Etiquetas bilingüe + IA en lecciones | ✅ EN PRODUCCIÓN |
| Feature-006 | Preview de actividad en banco | ✅ EN PRODUCCIÓN |
| Feature-007 | Rúbrica: botones separados Sugerir + Mejorar borrador | ✅ EN PRODUCCIÓN — commit `7770f0e` |
| Bug-014 | Opciones EN en multiple choice con IA son menos que en ES | 🔴 PENDIENTE |
| Bug-015 | Campo Título/Instrucción en ActivityEditor sin botón traducir IA | 🔴 PENDIENTE |
| Feature-008 | Nombre IA de actividad: específico y diferenciador | 🔴 PENDIENTE |
| Feature-009 | Repensar botones IA en ActivityEditor (general + individuales) | 🔴 PENDIENTE — ver diseño abajo |
| Feature-010 | Componentes de producción en actividades essay/writing | 💡 A EVALUAR — ver abajo |
| Feature-011 | Ejemplo IA en producción (botón para el estudiante) | 💡 A EVALUAR |
| Feature-003 Fase B | Filtros etiqueta/dificultad + vista tarjetas en banco | ⏸ BACKLOG |

---

## 🔴 Bug-014 — Opciones EN incompletas en multiple_choice con IA

**Síntoma:** El profesor define 4 opciones en español. Al completar con IA, el contenido EN solo trae 2 o 3 opciones (el modelo no mantiene todas).

**Causa probable:** El prompt de `complete_activity` dice "mantén EXACTAMENTE la misma estructura JSON" pero el modelo falla cuando el array de options tiene muchos elementos — los trunca.

**Archivo:** `supabase/functions/ai-enhance/index.ts` — case `complete_activity`

**Fix sugerido:**
- En el prompt, agregar explícitamente: `"El array 'options' DEBE tener exactamente ${n} elementos, el mismo número que en content_es. NUNCA omitas ninguna opción."`
- O pasar `options.length` en el prompt del usuario: `"content_es tiene ${options.length} opciones — content_en DEBE tener también ${options.length} opciones"`

---

## 🔴 Bug-015 — Sin botón traducir en Título e Instrucción del ActivityEditor

**Síntoma:** En el formulario de ActivityEditor, los campos "Título ES" → "Título EN" y "Instrucción/Pregunta ES" → "Instrucción EN" no tienen botón "→ EN" para traducir con IA, a diferencia de otros campos.

**Archivo:** `src/components/professor/studio/ActivityEditor.tsx`

**Fix:** Agregar botón `→ EN` junto al campo título ES y al campo instrucción/pregunta ES, llamando a `supabase.functions.invoke('ai-enhance', {body: {task: 'translate', lang: 'es', data: {text, from_lang: 'es'}}})`.

---

## 🔴 Feature-008 — Nombre IA de actividad: específico y diferenciador

**Descripción:** Actualmente `improve_title` o el título generado por `complete_activity` da nombres genéricos como "Opción múltiple: Investigación". El professor quiere títulos únicos y diferenciadores, por ejemplo:
- "Vacío de Investigación: La Contradicción"
- "Caso Monkey Selfies: Autoría y IA"
- "Sílabo: Estructura del Tiempo Académico"

**Archivo:** `supabase/functions/ai-enhance/index.ts`

**Fix:** Mejorar el prompt de `improve_title` para que:
1. El título tenga estructura: `[Tema Principal]: [Elemento Distintivo]`
2. Sea lo suficientemente específico para distinguirse de otras actividades del mismo tema
3. El prompt del usuario incluya el contenido de la actividad (no solo el título actual)

---

## 🔴 Feature-009 — Rediseño IA en ActivityEditor

**Contexto:** El usuario pide repensar cómo se usa IA en el editor de actividades. Actualmente hay un botón "Completar con IA" que llena todo de una vez.

**Propuesta de diseño (a confirmar con usuario antes de implementar):**

### Botón general — "Completar todo con IA"
- Ya existe: genera título, instrucción, opciones, traducción EN, tags, difficulty y description en un solo clic
- Mejorar: que el modelo sea más específico en el título (ver Feature-008)

### Botones individuales por campo (nuevo):
| Campo | Botón IA |
|-------|----------|
| Título ES | "Mejorar" (improve_title) |
| Título EN | "→ EN" (translate) — **Bug-015** |
| Instrucción/Pregunta ES | "Mejorar" (improve_instructions) |
| Instrucción EN | "→ EN" (translate) — **Bug-015** |
| Opciones (multiple_choice) | "Generar opciones" (generate_activity_options) |
| Tags | "Sugerir" (suggest_tags adaptado a actividad) |
| Description ES | "Generar" (improve_description) |
| Description EN | "→ EN" (translate) |

**Archivos:** `src/components/professor/studio/ActivityEditor.tsx`

---

## 💡 Feature-010 — Componentes de producción en actividades essay/writing

**Descripción:** Las actividades de tipo `essay`, `long_response`, `structured_essay`, `open_writing` se responden dentro del LessonViewer pero no tienen los controles avanzados que tiene la Producción de la lección: palabras requeridas/prohibidas, integridad, compliance, retroalimentación con IA.

**Opciones arquitectónicas:**

### Opción A — Reutilizar production_rules por actividad (recomendada)
- Agregar columna `activity_id` a `production_rules` (actualmente solo tiene `lesson_id`)
- En ActivityEditor: al crear/editar actividades essay, mostrar la misma sección de Reglas de Producción que tiene LessonEditor
- En ActivityRenderer/LessonViewer: al mostrar una actividad essay, cargar sus reglas de producción y renderizar con el mismo `ProductionEditor`

### Opción B — Parámetros inline en el content JSONB de la actividad
- Guardar `min_words`, `required_words`, etc. dentro del `content.es/en` de la actividad
- Más simple pero menos consistente con el modelo de datos actual

**Recomendación:** Opción A — consistente con el modelo actual, reutiliza código existente, permite retroalimentación IA por actividad.

**Complejidad:** Alta — requiere migración de BD + cambios en ActivityEditor + ActivityRenderer + LessonViewer.

---

## 💡 Feature-011 — Ejemplo IA en producción

**Descripción:** En la vista del estudiante (`ProductionEditor`), agregar un botón "Generar ejemplo con IA" que produzca un texto de ejemplo basado en las instrucciones de la tarea. El estudiante lo ve como referencia antes de escribir.

**Diferencia con Feature-004:** Feature-004 es un ejemplo que el PROFESOR escribe manualmente. Este botón lo genera la IA automáticamente en el momento.

**Nueva task en ai-enhance:** `generate_example`
- Input: `{instructions, lesson_title, min_words, required_words}`
- Output: texto de ejemplo de la longitud apropiada

**Dónde mostrarlo:** Solo si `example_text` no está ya configurado por el profesor. Botón "Ver ejemplo generado por IA" → llama al Edge Function → muestra en panel colapsable.

**Complejidad:** Media — nueva task Edge Function + botón en ProductionEditor.

---

## Notas de arquitectura

- **Formato content de lecciones:** Array puro (viejo) o `{steps, tags, tags_en}` (nuevo). Todo el código maneja ambos.
- **Títulos de actividades:** JSONB `{es, en}`. Siempre `resolveField(title, 'es')`.
- **_activity_type en pasos:** Campo en memoria (no persiste en BD), se usa para mostrar el tipo real en LessonAssembler/LessonEditor. Se limpia en saveContent.
- **Supabase CLI:** `npx supabase` v2.98.0, proyecto linkeado (`ckpmrmhkrbylibecezxn`). Query: `npx supabase db query --linked "SQL"`.
- **GROQ key:** en `.env` como `GROQ_URL`. Edge Function `ai-enhance` deployada. Siempre usar `npx supabase functions deploy ai-enhance --project-ref ckpmrmhkrbylibecezxn --no-verify-jwt` para re-deployar.
