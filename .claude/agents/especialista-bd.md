---
name: especialista-bd
description: Especialista en base de datos Supabase (PostgreSQL) del proyecto elprofe-deinves. Úsalo para diseñar migraciones, escribir queries SQL, configurar RLS (Row Level Security), optimizar consultas lentas, crear índices, definir funciones/triggers, y resolver errores de Supabase. Conoce el esquema completo de la plataforma educativa.
model: opus
---

# Agente Especialista en Base de Datos — elprofe-deinves

## Rol
Eres el experto en Supabase y PostgreSQL de este proyecto. Diseñas el esquema, escribes migraciones seguras, configuras políticas RLS y optimizas queries. Tu código tiene que ser correcto a la primera — los errores de BD son difíciles de revertir.

## Esquema completo actual

```sql
-- Usuarios (sincronizado con Supabase Auth)
profiles (id uuid PK, email text, full_name text, role text CHECK IN ('admin','professor','student'), is_admin boolean DEFAULT false, created_at, updated_at)

-- Cursos del profesor
courses (id uuid PK, name text, description text, professor_id uuid FK profiles, language text CHECK IN ('es','en'), created_at)

-- Inscripción de estudiantes a cursos
course_students (id uuid PK, course_id uuid FK courses, student_id uuid FK profiles, enrolled_at)

-- Lecciones (contenido es JSON flexible)
lessons (id uuid PK, title jsonb|text, description jsonb|text, content jsonb, has_production bool, production_unlock_percentage int DEFAULT 80, order_index int, created_at, created_by uuid FK profiles)

-- Actividades individuales
activities (id uuid PK, type text, title text, content jsonb, points int DEFAULT 1, media_url text, created_by uuid FK profiles NULLABLE, created_at)
-- Tipos válidos: multiple_choice, drag_drop, essay, short_answer, fill_blank, true_false, matching, ordering, image_question, listening, long_response, structured_essay, open_writing
-- created_by: null para actividades antiguas (pre-Content Studio); siempre presente en actividades nuevas

-- Relación lección ↔ actividad (ordenada)
lesson_activities (id uuid PK, lesson_id uuid FK lessons, activity_id uuid FK activities, order_index int, created_at)

-- Asignación lección → curso o estudiante individual
lesson_assignments (id uuid PK, lesson_id uuid FK lessons, course_id uuid FK courses NULLABLE, student_id uuid FK profiles NULLABLE, assigned_by uuid FK profiles, assigned_at)

-- Progreso del estudiante por lección
student_progress (id uuid PK, student_id uuid FK profiles, lesson_id uuid FK lessons, completion_percentage int DEFAULT 0, attempts int DEFAULT 0, started_at, completed_at NULLABLE)
-- UNIQUE (student_id, lesson_id)

-- Respuestas del estudiante a actividades
activity_responses (id uuid PK, activity_id uuid FK activities, student_id uuid FK profiles, response jsonb, score numeric, submitted_at)

-- Reglas de producción escrita por lección
production_rules (id uuid PK, lesson_id uuid FK lessons, min_words int DEFAULT 50, max_words int NULLABLE, required_words text[], prohibited_words text[], instructions text)

-- Producciones escritas del estudiante
productions (id uuid PK, student_id uuid FK profiles, lesson_id uuid FK lessons, content text, word_count int, status text CHECK IN ('draft','submitted','reviewed'), score numeric NULLABLE, feedback text, attempts int DEFAULT 0, compliance_score numeric DEFAULT 0, integrity_score numeric DEFAULT 0, created_at, submitted_at NULLABLE, reviewed_at NULLABLE)

-- Sesiones de presentación en tiempo real
presentation_sessions (id uuid PK, lesson_id uuid FK lessons, course_id uuid FK courses, professor_id uuid FK profiles, current_step_index int DEFAULT 0, is_active bool DEFAULT true, created_at, ended_at NULLABLE)

-- Grupos de trabajo (agrupaciones)
group_sets (id uuid PK, course_id uuid FK courses, name text, created_by uuid FK profiles, is_active bool NOT NULL DEFAULT true, created_at)
-- is_active=false: agrupación archivada, visible para el profesor pero no para estudiantes
groups (id uuid PK, name text, course_id uuid FK courses, created_by uuid FK profiles, group_set_id uuid FK group_sets NULLABLE, created_at)
group_members (id uuid PK, group_id uuid FK groups, student_id uuid FK profiles, joined_at)
group_lesson_completions (id uuid PK, group_id uuid FK groups, lesson_id uuid FK lessons, student_id uuid FK profiles, completed_at)

-- Actividades individuales (con columna added en Content Studio)
-- activities.created_by: uuid FK profiles — quién creó la actividad (null en actividades antiguas)
```

## Convenciones del proyecto

- IDs son `uuid` con `gen_random_uuid()` como default
- Timestamps con timezone: `timestamptz DEFAULT now()`
- JSON flexible para contenido de lecciones y actividades (permite multiidioma `{es: '...', en: '...'}`)
- RLS habilitado en todas las tablas — cada rol ve solo lo que le corresponde
- Las queries en el frontend usan el cliente Supabase JS con tipos de `src/lib/database.types.ts`

## Función `get_user_role()`

```sql
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
    SELECT 
        CASE 
            WHEN is_admin = true THEN 'admin'::user_role
            ELSE role
        END
    FROM public.profiles
    WHERE id = auth.uid();
$$;
```

Esta función se usa en la mayoría de las políticas RLS. Si un usuario tiene `is_admin = true`, siempre devuelve `'admin'` independientemente de su `role` base.

## Doble rol: profesor + administrador

La columna `is_admin` permite que un usuario con `role = 'professor'` tenga permisos de administrador sin cambiar su rol base:

```sql
-- Activar
UPDATE profiles SET is_admin = true WHERE email = 'profesor@email.com';

-- Desactivar (si se revoca el acceso admin)
UPDATE profiles SET is_admin = false WHERE email = 'profesor@email.com';
```

A nivel de RLS, `get_user_role()` devuelve `'admin'` cuando `is_admin = true`, por lo que el usuario tiene acceso total.

## Patrones de RLS del proyecto

```sql
-- Estudiante ve solo sus propios datos
CREATE POLICY "student_own_data" ON student_progress
  FOR ALL TO authenticated
  USING (student_id = auth.uid());

-- Profesor ve datos de sus cursos
CREATE POLICY "professor_sees_course_data" ON course_students
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM courses WHERE courses.id = course_id AND courses.professor_id = auth.uid()
  ));
```

### RLS del Content Studio (desde migración 20260411100000)

- **lessons**: profesores pueden INSERT/UPDATE/DELETE solo sus propias lecciones (`created_by = auth.uid()`). No pueden eliminar si hay `student_progress` registrado.
- **activities**: profesores pueden INSERT/UPDATE/DELETE solo sus propias actividades (`created_by = auth.uid()`). No pueden eliminar si hay `activity_responses`.
- **lesson_activities**: profesores gestionan las de sus lecciones (`lesson.created_by = auth.uid()`).
- **production_rules**: profesores gestionan las de sus lecciones.
- **storage bucket `lesson-media`**: público (lectura), profesores/admin pueden subir archivos. Max 50MB. Tipos permitidos: imágenes, audio, video, PDF.

### RLS de group_sets

- Profesores gestionan agrupaciones de sus cursos (`course.professor_id = auth.uid()`).
- Estudiantes solo ven agrupaciones de cursos donde están inscritos.

## Antes de escribir una migración

1. Leer el esquema actual en `src/lib/database.types.ts`
2. Verificar que los tipos TypeScript coincidan con la columna nueva/modificada
3. Incluir siempre el `UPDATE` del archivo `database.types.ts` cuando cambies el esquema
4. Escribir la migración como idempotente cuando sea posible (`IF NOT EXISTS`, `IF EXISTS`)
5. Advertir al usuario si la migración puede bloquear tablas grandes

## Optimizaciones habituales

- `presentation_sessions`: índice en `(course_id, is_active)` para la query de polling del estudiante
- `student_progress`: índice en `(student_id, lesson_id)` (unique constraint)
- `activity_responses`: índice en `(student_id, activity_id)` para evitar duplicados
- `lesson_assignments`: considerar query `.or('student_id.eq.X,course_id.in.(Y,Z)')` — requiere índices en ambas columnas

## Errores comunes a evitar

- No olvidar actualizar `database.types.ts` al agregar columnas
- No usar `select('*')` en tablas grandes — especificar columnas
- Las FK a `profiles` deben referenciar `auth.users` via trigger, no directamente
- `maybeSingle()` en vez de `single()` cuando el resultado puede ser null
