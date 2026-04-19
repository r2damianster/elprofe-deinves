# Historial de Migraciones

Todas en `supabase/migrations/` — aplicadas en orden de timestamp.

| Archivo | Fecha | Qué agrega / cambia |
|---------|-------|---------------------|
| `20260401191649_create_educational_platform_schema.sql` | 2026-04-01 | Schema base completo: tablas `profiles`, `courses`, `lessons`, `activities`, `lesson_activities`, `course_students`, `lesson_assignments`, `student_progress`, `activity_responses`, `productions`, `production_rules`. ENUMs `user_role`, `activity_type`, `production_status`. |
| `20260403010800_update_activities_schema.sql` | 2026-04-03 | Actualización de tipos de actividad en el ENUM `activity_type` |
| `20260403014500_add_attempts_columns.sql` | 2026-04-03 | Columnas `attempts` en `student_progress` y `productions` |
| `20260403015500_add_metrics_columns.sql` | 2026-04-03 | Columnas de métricas de compliance e integridad en `productions` |
| `20260405120000_add_production_forensics.sql` | 2026-04-05 | `integrity_events` (jsonb[]), `time_on_task` (int4), `extra_rules` (jsonb) en `productions` |
| `20260405200000_add_group_lessons.sql` | 2026-04-05 | Tablas `groups`, `group_members`, `group_progress`, `group_lesson_assignments`, `group_activity_completions` |
| `20260405210000_add_group_enrollment.sql` | 2026-04-05 | Columnas `enrollment_open` y `max_members` en `groups`. RLS para auto-inscripción de estudiantes. |
| `20260405220000_add_group_sets.sql` | 2026-04-05 | Tabla `group_sets` (agrupaciones nombradas por curso). Columna `group_set_id` en `groups`. |
| `20260406100000_add_presentation_sessions.sql` | 2026-04-06 | Tabla `presentation_sessions` para presentaciones en tiempo real (profesor controla, estudiantes siguen) |
| `20260407100000_add_course_language.sql` | 2026-04-07 | Columna `language` (`es`/`en`) en `courses` |
| `20260407110000_multilingual_activities.sql` | 2026-04-07 | Migra `activities.title` y `activities.content` a JSONB bilingüe `{es, en}` |
| `20260407120000_multilingual_lessons_title.sql` | 2026-04-07 | Migra `lessons.title` y `lessons.description` a JSONB bilingüe `{es, en}` |
| `20260411100000_content_studio_professor_access.sql` | 2026-04-11 | Políticas RLS para Content Studio: profesores pueden gestionar su propio contenido (lessons, activities) |
| `20260412100000_add_group_set_active.sql` | 2026-04-12 | Columna `is_active` en `group_sets` para archivar agrupaciones |
| `20260412120000_add_admin_flag_to_profiles.sql` | 2026-04-12 | Columna `is_admin` (boolean) en `profiles`. Función `get_user_role()` que retorna `'admin'` si `is_admin = true`. |

## Convenciones

- Los archivos deben ser idempotentes cuando sea posible (`IF NOT EXISTS`, `IF EXISTS`, `CREATE OR REPLACE`)
- Nunca modificar migraciones ya aplicadas en producción; crear siempre una nueva
- El timestamp del nombre es la única referencia de orden de aplicación
