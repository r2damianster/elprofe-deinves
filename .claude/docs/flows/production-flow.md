# Flujo de Producción Escrita

Las producciones son actividades de escritura libre (`essay`, `long_response`, `structured_essay`) que requieren revisión humana del profesor y validación estricta de reglas de la base de datos.

## 1. Desbloqueo

Una producción se desbloquea cuando el estudiante supera el `production_unlock_percentage` de la lección:
`completion_percentage (student_progress) >= production_unlock_percentage (lessons)`

## 2. Escritura y Validación (Real-time)

El estudiante escribe en el componente correspondiente. **Es obligatorio** realizar un fetch previo a `public.production_rules` usando el `lesson_id`.

- **Validación de Compliance:**
  - El sistema debe comparar `word_count` contra `min_words` y `max_words`.
  - Debe verificar la presencia de `required_words` y la ausencia de `prohibited_words`.
- **Integridad:** Se registran eventos de `useIntegrity` en el array JSONB `integrity_events`.

## 3. Envío (Submit)

**REGLA CRÍTICA:** El botón de envío DEBE estar deshabilitado si `word_count < min_words`. 

Al hacer submit, se crea/actualiza el registro en `productions`:
- `status`: 'submitted' (solo si cumple el mínimo de palabras).
- `compliance_score`: Calculado según el cumplimiento de reglas.
- `word_count`: Guardado para auditoría.

## 4. Revisión y Resultados

El profesor califica en el dashboard. El estado cambia a `reviewed` y se libera el feedback. Si se marca "reintento", el flujo vuelve al paso 2.

> **Nota de Arquitectura:** Las reglas de validación NO están en el JSON de la actividad. Se consultan exclusivamente en la tabla `production_rules` vinculada a la lección.