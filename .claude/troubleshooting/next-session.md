# Próxima Sesión — Estado de Bugs y Tareas Pendientes

**Actualizado:** 2026-04-30 (sesión 2)
**Instrucción:** Empieza aquí. Las tareas están ordenadas por prioridad.

---

## Resumen de estado

| Item | Descripción | Estado |
|------|-------------|--------|
| Bug-001..003 | RLS, JSON anidado, recursión | ✅ CERRADO |
| Bug-004..009 | Sesión 2026-04-23 | ✅ TODOS CERRADOS |
| Bug-010 | Pantalla en blanco en actividades (drag_drop + Error Boundary) | ✅ CERRADO 2026-04-30 |
| Bug-011 | Integridad demasiado estricta — bloqueos en móvil + paste propio | ✅ CERRADO — commit `74ddc2b` |
| Bug-012 | LessonEditor pantalla en blanco al editar lecciones con actividades | ✅ CERRADO — commit `508a9da` |
| Feature-001 | Calificación batch con IA en Producciones | ✅ IMPLEMENTADO Y EN PRODUCCIÓN |
| Feature-002 | Umbrales configurables compliance e integridad | ✅ IMPLEMENTADO Y EN PRODUCCIÓN |
| Feature-003 Fase A | Taxonomía: description, tags, difficulty en activities | ✅ IMPLEMENTADO Y EN PRODUCCIÓN |
| Feature-004 | Texto de ejemplo configurable en producción | ✅ IMPLEMENTADO Y EN PRODUCCIÓN |
| Feature-005 | Etiquetas bilingüe + IA en lecciones (suggest_tags, tags_en, traducir captions) | ✅ IMPLEMENTADO Y EN PRODUCCIÓN |
| Feature-006 | Preview de actividad en banco al asignar a lección | ✅ IMPLEMENTADO Y EN PRODUCCIÓN |
| RLS fix | Políticas de BD para producciones y production_rules | ✅ SQL aplicado manualmente |
| Edge Function | suggest_tags desplegada en ai-enhance | ✅ DEPLOYADO via CLI |
| Feature-003 Fase B | Filtros por etiqueta/dificultad + vista tarjetas en banco | ⏸ BACKLOG |
| Bug-013 | Actividades recomendadas no funciona en LessonAssembler | 🔴 PENDIENTE — ver abajo |

---

## ✅ ACCIONES MANUALES COMPLETADAS

- SQL aplicado (RLS policies + columna `example_text` en `production_rules`)
- Edge Function `ai-enhance` deployada con task `suggest_tags`
- Proyecto Supabase linkeado al CLI (`ckpmrmhkrbylibecezxn`)

---

## 🔴 Bug-013 — Actividades recomendadas no aparecen en LessonAssembler

**Síntoma:** Al estar en "Asignar Actividades" y seleccionar una lección, el botón "Recomendadas" no muestra ninguna actividad.

**Causa raíz:** `getActivityTags()` en LessonAssembler lee `act.content?.es?.tags` o `act.content?.tags`, pero las etiquetas de actividades se guardan en la columna `activities.tags`, NO dentro del JSONB `content`. La interface `Activity` en LessonAssembler tampoco incluye el campo `tags`.

**Archivo:** `src/components/professor/studio/LessonAssembler.tsx`

**Fix:**
1. Agregar `tags?: string[]` a la `interface Activity`
2. Cambiar `getActivityTags`:
```typescript
const getActivityTags = (act: Activity) => {
  return (act.tags?.length ? act.tags : act.content?.es?.tags || act.content?.tags || []) as string[];
};
```
3. Verificar que `getLessonTags` también funcione con lecciones sin etiquetas (mostrar mensaje "Esta lección no tiene etiquetas — agrega etiquetas para ver recomendaciones")

---

## Feature-003 Fase B (backlog, no urgente)

Filtros por etiqueta y dificultad en el panel de asignación de actividades + toggle vista lista/tarjetas.

---

## Notas de arquitectura

- **Formato content de lecciones:** Hay lecciones antiguas con `content: []` (array puro, `type: "CONTENT"`) y nuevas con `content: {steps, tags, tags_en}`. LessonEditor maneja ambas. LessonViewer maneja ambas. LessonAssembler maneja ambas.
- **Títulos de actividades:** Son JSONB `{es, en}`. Siempre usar `resolveField(a.title, 'es')` para mostrarlos — nunca renderizar el objeto directamente (causaría React error #31).
- **Supabase CLI:** Usar `npx supabase` (v2.98.0). Proyecto linkeado. `npx supabase db query --linked "SQL"` para consultar datos.
