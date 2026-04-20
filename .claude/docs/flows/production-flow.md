# Flujo de Producción Escrita

Las producciones son actividades de escritura libre (`essay`, `long_response`, `structured_essay`) que requieren revisión humana del profesor y validación estricta de reglas de la base de datos.

## 1. Desbloqueo

Una producción se desbloquea cuando el estudiante supera el `production_unlock_percentage` de la lección:
`completion_percentage (student_progress) >= production_unlock_percentage (lessons)`

## 2. Escritura y Validación (Real-time)

El estudiante escribe en `ProductionEditor.tsx`. El componente carga `production_rules` via fetch autenticado al montar.

**IMPORTANTE:** El fetch usa el estado `rulesLoading` para evitar race conditions. El botón de submit permanece deshabilitado hasta que las reglas carguen completamente.

- **Validación de Compliance:**
  - `word_count >= min_words` (obligatorio para habilitar submit)
  - `word_count <= max_words` (si existe)
  - Presencia de `required_words` (comparación sin puntuación periférica)
  - Ausencia de `prohibited_words`
  - Reglas extra: `min_paragraphs`, `forbidden_first_person`, `required_apa_citations`, `required_sections`
- **Integridad:** Se registran eventos en `integrity_events` con penalizaciones.

## 3. Envío (Submit)

**REGLA CRÍTICA:** El botón de envío DEBE estar deshabilitado si:
- `rulesLoading === true` (reglas aún no cargaron)
- `rules === null` (no hay reglas configuradas — guard adicional en `submitProduction()`)
- `wordCount < rules.min_words`
- `validationErrors.length > 0`

Al hacer submit, se crea/actualiza el registro en `productions`:
- `status`: 'submitted'
- `compliance_score`: calculado en frontend antes del insert
- `word_count`: guardado para auditoría
- `integrity_score` e `integrity_events`: estado actual del monitor de integridad

## 4. Revisión y Resultados

El profesor califica en el dashboard. El estado cambia a `reviewed` y se libera el feedback. Si se marca "reintento", el flujo vuelve al paso 2 (máx. 2 intentos).

## 5. Feedback Orientativo con IA (opcional, antes del envío)

Una vez que el estudiante supera `min_words`, aparece el botón **"Analizar con IA (orientativo)"**. Al pulsarlo:

1. Se llama a `supabase.functions.invoke` → `ai-enhance` con task `review_production`
2. GROQ evalúa coherencia, gramática, vocabulario y cumplimiento de reglas
3. La pestaña "IA" del panel izquierdo muestra:
   - **Score** estimado (0-100, con color verde/amarillo/rojo)
   - **Summary** — resumen en 1 oración
   - **Strengths** — 2 fortalezas
   - **Improvements** — 2-3 sugerencias de mejora
4. El feedback es **orientativo** — no altera la calificación oficial del profesor

El botón IA no aparece en modo enfoque (`focusMode === true`).

## 6. Modo Enfoque

Toggle en el header (`PanelLeftClose / PanelLeftOpen`) que oculta el panel izquierdo y expande el editor a 100% del ancho. El estudiante puede alternar libremente. No afecta la validación ni el envío.

## Notas de Arquitectura

- Las reglas de validación NO están en el JSON de la actividad — se consultan en `production_rules` por `lesson_id`.
- `instructions` en `production_rules` se almacena como JSONB `{"es": "...", "en": "..."}` en la DB, pero el tipo generado lo reporta como `string | null`. El componente lo maneja con `typeof instructions === 'object'`.
- Las migraciones Supabase **no están aplicadas al remote**. Las políticas RLS de `productions` y `production_rules` fueron configuradas manualmente vía dashboard (ver `.claude/contexts/database/rls-policies.md`).
