# RLS Policies — Estado Actual (2026-04-19)

> Las migraciones Supabase NUNCA se han aplicado al remote via `supabase db push`.
> Todo el schema y las políticas fueron configurados manualmente en el dashboard.
> `supabase list_migrations` devuelve `[]`.

## production_rules

| Política | Comando | Roles | Condición |
|---|---|---|---|
| Admin full control production_rules | ALL | authenticated | `get_user_role() = 'admin'` |
| Professors manage their production_rules | ALL | authenticated | `get_user_role() = 'professor'` AND lección propia |
| Students can view production rules | SELECT | authenticated | `true` |

## productions

| Política | Comando | Roles | Condición |
|---|---|---|---|
| Students manage own productions | ALL | authenticated | `student_id = auth.uid()` |
| Professors view productions of their lessons | SELECT | authenticated | role IN (professor, admin) |
| Professors update productions | UPDATE | authenticated | role IN (professor, admin) |

## Tablas sin RLS o con RLS desactivado

| Tabla | Estado |
|---|---|
| `lessons` | RLS **DESACTIVADO** — acceso público |
| `profiles` | RLS **DESACTIVADO** — acceso público |
| `student_progress` | RLS **DESACTIVADO** |
| `course_students` | RLS desactivado |

## Advertencia
Si en el futuro se activa RLS en `lessons` o `profiles`, puede romper flujos que dependen de lectura sin autenticación. Planificar con cuidado.
