-- ============================================================================
-- elprofe-deinves — Migración Supabase → Neon Postgres
-- Archivo 001: schema completo + funciones + RLS + grants
-- ============================================================================
--
-- Fuente: consolidación de los 21 archivos de supabase/migrations/ (orden
-- cronológico), fusionados en su estado FINAL (los ALTER/DROP posteriores ya
-- están aplicados, no se replican). Complementado con src/lib/database.types.ts
-- (tipos generados contra la BD real de Supabase) allí donde las migraciones
-- de git divergen del remoto — ver bloques marcados "CONFLICTO RESUELTO".
--
-- Adaptaciones a Neon:
--   * auth.uid()            → auth.user_id()::uuid   (Neon Data API devuelve text)
--   * auth.users            → NO EXISTE. Neon gestiona usuarios en neon_auth.user
--                             (Managed Better Auth). FK comentada con TODO.
--   * storage.objects/buckets → NO EXISTE. Ver bloque "OBJECT STORAGE" al final.
--   * ALTER PUBLICATION supabase_realtime → omitido (sin Realtime; se usa polling).
--   * NOTIFY pgrst, 'reload_schema' → omitido (no aplica en Neon Data API).
--
-- Requisitos previos: proyecto Neon con Data API provisionado (crea el rol
-- `authenticated` y el schema `auth` con la función auth.user_id()).
--
-- Ejecutar UNA sola vez contra la rama por defecto del proyecto Neon.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Prerrequisitos
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- El rol `authenticated` lo crea Neon al provisionar el Data API.
-- Este guard evita que el script falle si aún no existe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1. Tipos enumerados
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'professor', 'student');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_status') THEN
    CREATE TYPE public.production_status AS ENUM ('draft', 'submitted', 'reviewed');
  END IF;
END $$;

-- CONFLICTO RESUELTO — activity_type
--   Migraciones de git: 10 valores (mig. 20260401191649 + 20260403010800).
--   BD real (database.types.ts): 15 valores; añade category_sorting,
--   error_spotting, matrix_grid, structured_essay, long_response — ninguno
--   tiene migración en git. Se toma la lista de la BD real.
--   'open_writing' se añade además porque src/lib/activityTypes.ts lo declara
--   como tipo de producción, aunque NO aparece en el enum generado.
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE public.activity_type AS ENUM (
      'multiple_choice',
      'drag_drop',
      'essay',
      'short_answer',
      'fill_blank',
      'true_false',
      'matching',
      'ordering',
      'image_question',
      'listening',
      'category_sorting',
      'error_spotting',
      'matrix_grid',
      'structured_essay',
      'long_response',
      'open_writing'
    );
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------------

-- 2.1 profiles ---------------------------------------------------------------
-- TODO (Neon Auth): en Supabase, profiles.id era FK a auth.users(id) ON DELETE
-- CASCADE. En Neon los usuarios viven en el schema `neon_auth` (tabla
-- `neon_auth.user`, gestionada por Managed Better Auth) y NO se debe crear una
-- FK cruzada contra él. El vínculo profiles.id ↔ usuario autenticado se sostiene
-- por convención: profiles.id = auth.user_id()::uuid. El borrado en cascada del
-- perfil al eliminar el usuario debe implementarse en la app (Fase 3).
--   -- id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,   <-- Supabase
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY,
  email      text UNIQUE NOT NULL,
  full_name  text NOT NULL,
  role       public.user_role NOT NULL DEFAULT 'student',
  is_admin   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.2 lessons ----------------------------------------------------------------
-- title/description convertidos a jsonb multilingüe {es, en}
-- (mig. 20260407120000_multilingual_lessons_title).
CREATE TABLE IF NOT EXISTS public.lessons (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                        jsonb NOT NULL,
  description                  jsonb,
  content                      jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_production               boolean NOT NULL DEFAULT false,
  production_unlock_percentage int NOT NULL DEFAULT 80,
  order_index                  int NOT NULL DEFAULT 0,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  created_by                   uuid REFERENCES public.profiles(id)
);

-- 2.3 courses ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  professor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language     varchar(5) NOT NULL DEFAULT 'es',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_language_check CHECK (language IN ('es', 'en'))
);

-- 2.4 course_students --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);

-- 2.5 activities -------------------------------------------------------------
-- Estado final: sin lesson_id ni order_index (eliminados en 20260403010800),
-- con media_url (20260403010800), created_by (20260411100000) y title jsonb
-- (20260419100000).
-- CONFLICTO RESUELTO — columnas tags / description / description_en / difficulty
--   existen en la BD real (database.types.ts) pero NO tienen migración en git.
--   Se incluyen porque ActivityBank/ActivityEditor las usan.
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
CREATE TABLE IF NOT EXISTS public.activities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           public.activity_type NOT NULL,
  title          jsonb NOT NULL,
  content        jsonb NOT NULL DEFAULT '{}'::jsonb,
  points         int NOT NULL DEFAULT 10,
  media_url      text,
  description    text,
  description_en text,
  difficulty     int,
  tags           text[],
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 2.6 lesson_activities ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (lesson_id, activity_id)
);

-- 2.7 lesson_assignments -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id       uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by     uuid NOT NULL REFERENCES public.profiles(id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  available_from  timestamptz DEFAULT NULL,
  available_until timestamptz DEFAULT NULL,
  order_index     integer NOT NULL DEFAULT 0,
  CHECK (course_id IS NOT NULL OR student_id IS NOT NULL)
);

-- 2.8 student_progress -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_progress (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id             uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completion_percentage int NOT NULL DEFAULT 0
    CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  attempts              int DEFAULT 1,
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  UNIQUE (student_id, lesson_id)
);

-- 2.9 activity_responses -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response     jsonb NOT NULL,
  score        int NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- 2.10 production_rules ------------------------------------------------------
-- CONFLICTO RESUELTO — tipos de columna
--   Migración 20260401191649: required_words/prohibited_words text[], instructions text.
--   BD real (database.types.ts): los tres son jsonb (multilingües {es,en}), y
--   existen además compliance_threshold / integrity_threshold (feature-002),
--   sin migración en git. Se toma la BD real: el frontend lee estos campos con
--   resolveField() (i18n), lo que exige jsonb.
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
CREATE TABLE IF NOT EXISTS public.production_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id             uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  min_words             int NOT NULL DEFAULT 0,
  max_words             int,
  required_words        jsonb DEFAULT '[]'::jsonb,
  prohibited_words      jsonb DEFAULT '[]'::jsonb,
  instructions          jsonb,
  example_text          jsonb,
  extra_rules           jsonb DEFAULT '{}'::jsonb,
  compliance_threshold  numeric,
  integrity_threshold   numeric
);

-- 2.11 productions -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.productions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id        uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content          text NOT NULL DEFAULT '',
  word_count       int NOT NULL DEFAULT 0,
  status           public.production_status NOT NULL DEFAULT 'draft',
  score            numeric,
  feedback         text,
  attempts         int DEFAULT 1,
  compliance_score numeric DEFAULT 0,
  integrity_score  numeric DEFAULT 100,
  integrity_events jsonb DEFAULT '[]'::jsonb,
  time_on_task     int DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  UNIQUE (student_id, lesson_id)
);

-- 2.12 groups ----------------------------------------------------------------
-- group_set_id se añade más abajo (FK circular con group_sets).
CREATE TABLE IF NOT EXISTS public.groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name            text NOT NULL,
  created_by      uuid NOT NULL REFERENCES public.profiles(id),
  enrollment_open boolean DEFAULT false,
  max_members     int,
  created_at      timestamptz DEFAULT now()
);

-- 2.13 group_sets ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_sets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.group_sets.is_active IS
  'Cuando es false la agrupación está archivada: el profesor la ve pero los estudiantes no la usan en modo grupal.';

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS group_set_id uuid REFERENCES public.group_sets(id) ON DELETE SET NULL;

-- 2.14 group_members ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_members (
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at   timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, student_id)
);

-- 2.15 group_lesson_assignments ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_lesson_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE (group_id, lesson_id)
);

-- 2.16 group_progress --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_progress (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  lesson_id             uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completion_percentage int DEFAULT 0,
  completed_at          timestamptz,
  UNIQUE (group_id, lesson_id)
);

-- 2.17 group_activity_completions -------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_activity_completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  activity_id  uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  completed_by uuid NOT NULL REFERENCES public.profiles(id),
  completed_at timestamptz DEFAULT now(),
  response     jsonb,
  score        int DEFAULT 0,
  UNIQUE (group_id, activity_id)
);

-- 2.18 group_production_locks ------------------------------------------------
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
--   Esta tabla NO tiene migración en git. Reconstruida por inferencia de:
--     - src/lib/database.types.ts (columnas y FKs exactas)
--     - .claude/troubleshooting/bug-007-group-production-first-submit.md (DDL propuesto)
--     - src/components/student/ProductionEditor.tsx:463 → upsert con
--       onConflict: 'group_id,lesson_id' ⇒ UNIQUE(group_id, lesson_id)
--     - src/components/professor/ProductionReviewer.tsx:152 → embed
--       group_production_locks!production_id ⇒ FK a productions(id)
CREATE TABLE IF NOT EXISTS public.group_production_locks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  lesson_id     uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  production_id uuid REFERENCES public.productions(id) ON DELETE SET NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, lesson_id)
);

-- 2.19 presentation_sessions -------------------------------------------------
-- NOTA: se omite `ALTER PUBLICATION supabase_realtime ADD TABLE ...`.
-- En Neon no hay Realtime; PresentationViewer pasa a polling (Fase 7 del plan).
CREATE TABLE IF NOT EXISTS public.presentation_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id          uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id          uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  professor_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active          boolean DEFAULT true,
  current_step_index int DEFAULT 0,
  started_at         timestamptz DEFAULT now(),
  ended_at           timestamptz
);

-- 2.20 projects --------------------------------------------------------------
-- CONFLICTO RESUELTO — projects.course_id
--   La migración 20260507100000 crea projects con `course_id uuid NOT NULL`.
--   La BD real (database.types.ts) NO tiene esa columna: el vínculo proyecto↔curso
--   se movió a la tabla project_assignments (creada sin migración, referenciada
--   por 20260509120000 como "tabla existente creada sin migración previa").
--   Se toma la BD real y se reescriben las políticas de estudiante para pasar
--   por project_assignments en vez de projects.course_id.
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
CREATE TABLE IF NOT EXISTS public.projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  professor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  object_logic text NOT NULL DEFAULT 'ordinal'
    CHECK (object_logic IN ('ordinal', 'causal', 'structural')),
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- 2.21 project_assignments ---------------------------------------------------
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
--   Sin CREATE TABLE en git; reconstruida desde database.types.ts + los ALTER
--   de la migración 20260509120000_add_schedule_dates_to_assignments.sql.
CREATE TABLE IF NOT EXISTS public.project_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  course_id       uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  professor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by     uuid REFERENCES public.profiles(id),
  assigned_at     timestamptz DEFAULT now(),
  available_from  timestamptz DEFAULT NULL,
  available_until timestamptz DEFAULT NULL,
  order_index     integer NOT NULL DEFAULT 0
);

-- 2.22 project_object_types --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_object_types (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  description           text,
  instructions          text,
  order_index           integer NOT NULL DEFAULT 0,
  parent_object_type_id uuid REFERENCES public.project_object_types(id) ON DELETE SET NULL,
  edit_policy           text NOT NULL DEFAULT 'always'
    CHECK (edit_policy IN ('always', 'requires_approval', 'locked_after_submit')),
  min_words             integer DEFAULT 0,
  max_words             integer,
  required_words        text[] DEFAULT '{}',
  created_at            timestamptz DEFAULT now()
);

-- 2.23 lesson_project_objects ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_project_objects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id      uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  object_type_id uuid NOT NULL REFERENCES public.project_object_types(id) ON DELETE CASCADE,
  is_new_object  boolean DEFAULT true,
  order_index    integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (lesson_id, object_type_id)
);

-- 2.24 project_objects -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_objects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  object_type_id uuid NOT NULL REFERENCES public.project_object_types(id) ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content        text DEFAULT '',
  status         text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'needs_revision')),
  word_count     integer DEFAULT 0,
  version        integer DEFAULT 1,
  feedback       text,
  score          numeric,
  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (object_type_id, student_id)
);

-- 2.25 project_object_edit_requests -----------------------------------------
CREATE TABLE IF NOT EXISTS public.project_object_edit_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_object_id uuid NOT NULL REFERENCES public.project_objects(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  professor_note    text,
  created_at        timestamptz DEFAULT now(),
  resolved_at       timestamptz
);

-- 2.26 project_submissions ---------------------------------------------------
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
--   Sin migración en git. Reconstruida desde database.types.ts y del uso en
--   ProjectObjectList.tsx:209 (upsert por project_id + student_id),
--   StudentResults.tsx:186 y StudentDashboard.tsx:202.
--   El upsert del frontend implica UNIQUE(project_id, student_id).
CREATE TABLE IF NOT EXISTS public.project_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'draft',
  score        numeric,
  feedback     text,
  submitted_at timestamptz,
  reviewed_at  timestamptz,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (project_id, student_id)
);


-- ---------------------------------------------------------------------------
-- 3. Funciones
-- ---------------------------------------------------------------------------

-- 3.1 get_user_role() --------------------------------------------------------
-- CONFLICTO RESUELTO — tipo de retorno
--   La migración 20260412120000 la define con RETURNS text.
--   database.types.ts (BD real) la declara RETURNS user_role.
--   Se toma la BD real (enum), que es lo que consume el frontend tipado.
-- ADAPTACIÓN NEON: auth.uid() → auth.user_id()::uuid
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN is_admin = true THEN 'admin'::public.user_role
      ELSE role
    END
  FROM public.profiles
  WHERE id = auth.user_id()::uuid;
$$;

-- 3.2 is_admin() -------------------------------------------------------------
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
--   Sin definición SQL en ningún migration file. Reconstruida por inferencia de
--   src/lib/database.types.ts → `is_admin: { Args: never; Returns: boolean }`
--   y de la semántica de profiles.is_admin + get_user_role().
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin OR role = 'admin'::public.user_role
       FROM public.profiles
      WHERE id = auth.user_id()::uuid),
    false
  );
$$;

-- 3.3 Helpers de grupos (SECURITY DEFINER, evitan recursión de RLS) ----------
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
--   Las tres aparecen en database.types.ts pero no tienen migración en git.
--   Existen porque las políticas de auto-inscripción de 20260405210000 consultan
--   group_members DESDE una política sobre group_members → recursión infinita en
--   Postgres. Estas funciones rompen el ciclo. Ver sección 5 (group_members).
CREATE OR REPLACE FUNCTION public.count_group_members(gid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.group_members WHERE group_id = gid;
$$;

CREATE OR REPLACE FUNCTION public.group_is_open(gid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enrollment_open FROM public.groups WHERE id = gid), false);
$$;

CREATE OR REPLACE FUNCTION public.group_course_id(gid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT course_id FROM public.groups WHERE id = gid;
$$;

-- 3.4 student_can_access_project() ------------------------------------------
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
--   Función NUEVA, no existe en Supabase. Sustituye el patrón
--   `JOIN course_students cs ON cs.course_id = p.course_id` de la migración
--   20260507100000, imposible ahora que projects no tiene course_id
--   (ver CONFLICTO RESUELTO en 2.20). Encapsula la visibilidad del estudiante
--   respetando la ventana available_from / available_until.
CREATE OR REPLACE FUNCTION public.student_can_access_project(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.project_assignments pa
     WHERE pa.project_id = pid
       AND (pa.available_from  IS NULL OR pa.available_from  <= now())
       AND (pa.available_until IS NULL OR pa.available_until >= now())
       AND (
         pa.student_id = auth.user_id()::uuid
         OR EXISTS (
           SELECT 1 FROM public.course_students cs
            WHERE cs.course_id = pa.course_id
              AND cs.student_id = auth.user_id()::uuid
         )
       )
  );
$$;

-- 3.5 Trigger: updated_at automático en project_objects ----------------------
CREATE OR REPLACE FUNCTION public.update_project_object_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_objects_updated_at ON public.project_objects;
CREATE TRIGGER project_objects_updated_at
  BEFORE UPDATE ON public.project_objects
  FOR EACH ROW EXECUTE FUNCTION public.update_project_object_timestamp();


-- ---------------------------------------------------------------------------
-- 4. Índices
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_presentation_sessions_course_active
  ON public.presentation_sessions (course_id, is_active);

CREATE INDEX IF NOT EXISTS idx_activity_responses_student_activity
  ON public.activity_responses (student_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_lesson_assignments_student
  ON public.lesson_assignments (student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_course
  ON public.lesson_assignments (course_id);

CREATE INDEX IF NOT EXISTS idx_lesson_activities_lesson_order
  ON public.lesson_activities (lesson_id, order_index);

CREATE INDEX IF NOT EXISTS idx_course_students_student
  ON public.course_students (student_id);

CREATE INDEX IF NOT EXISTS idx_group_members_student
  ON public.group_members (student_id);

CREATE INDEX IF NOT EXISTS idx_groups_course
  ON public.groups (course_id);
CREATE INDEX IF NOT EXISTS idx_groups_group_set
  ON public.groups (group_set_id);

CREATE INDEX IF NOT EXISTS idx_productions_lesson
  ON public.productions (lesson_id);
CREATE INDEX IF NOT EXISTS idx_productions_status
  ON public.productions (status);

CREATE INDEX IF NOT EXISTS idx_group_production_locks_production
  ON public.group_production_locks (production_id);

CREATE INDEX IF NOT EXISTS idx_project_assignments_course
  ON public.project_assignments (course_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_student
  ON public.project_assignments (student_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_project
  ON public.project_assignments (project_id);

CREATE INDEX IF NOT EXISTS idx_project_objects_student
  ON public.project_objects (student_id);
CREATE INDEX IF NOT EXISTS idx_project_objects_project
  ON public.project_objects (project_id);

CREATE INDEX IF NOT EXISTS idx_activities_created_by
  ON public.activities (created_by);


-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
-- IMPORTANTE (diferencia Supabase → Neon):
--   En Supabase, RLS deshabilitado = tabla abierta a través de PostgREST.
--   En Neon Data API, toda tabla expuesta necesita RLS *habilitado y con al
--   menos una política*; "RLS enabled, no policies" bloquea todo.
--   Por eso las 4 tablas que hoy tienen RLS DESHABILITADO en Supabase
--   (lessons, profiles, student_progress, course_students — confirmado en
--   .claude/contexts/database/rls-policies.md) reciben aquí RLS habilitado +
--   una política permisiva USING(true) WITH CHECK(true), que replica
--   exactamente el comportamiento abierto actual.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_students              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_activities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_assignments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_responses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_rules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_sets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_lesson_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_progress               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_activity_completions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_production_locks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_object_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_project_objects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_objects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_object_edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_submissions          ENABLE ROW LEVEL SECURITY;


-- === 5.1 profiles — ACCESO ABIERTO (replica RLS deshabilitado en Supabase) ===
CREATE POLICY "profiles_open_access"
  ON public.profiles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas históricas de profiles (migraciones 20260401191649 y 20260412120000).
-- Están DESACTIVADAS a propósito: la BD real tiene RLS deshabilitado en esta
-- tabla. Descomentar y borrar "profiles_open_access" cuando se decida endurecer.
--   CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
--     USING (auth.user_id()::uuid = id);
--   CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
--     USING ((SELECT role FROM public.profiles WHERE id = auth.user_id()::uuid) = 'admin');
--   CREATE POLICY "Professors can view student profiles in their courses" ON public.profiles FOR SELECT TO authenticated
--     USING (
--       (SELECT role FROM public.profiles WHERE id = auth.user_id()::uuid) = 'professor'
--       AND role = 'student'
--       AND EXISTS (SELECT 1 FROM public.course_students cs
--                     JOIN public.courses c ON cs.course_id = c.id
--                    WHERE cs.student_id = profiles.id AND c.professor_id = auth.user_id()::uuid)
--     );
--   CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated
--     WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.user_id()::uuid) = 'admin');
--   CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE TO authenticated
--     USING ((SELECT role FROM public.profiles WHERE id = auth.user_id()::uuid) = 'admin');
--   CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
--     USING (auth.user_id()::uuid = id) WITH CHECK (auth.user_id()::uuid = id);
--   CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated
--     USING ((SELECT role FROM public.profiles WHERE id = auth.user_id()::uuid) = 'admin');
--   CREATE POLICY "Admins can update is_admin flag" ON public.profiles FOR UPDATE TO authenticated
--     USING (
--       (SELECT role FROM public.profiles WHERE id = auth.user_id()::uuid) = 'admin'
--       OR (SELECT is_admin FROM public.profiles WHERE id = auth.user_id()::uuid) = true
--     );


-- === 5.2 lessons — ACCESO ABIERTO (replica RLS deshabilitado en Supabase) ====
CREATE POLICY "lessons_open_access"
  ON public.lessons FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas históricas de lessons (estado final tras 20260411100000, que eliminó
-- las de solo-admin). DESACTIVADAS: la BD real tiene RLS deshabilitado aquí.
--   CREATE POLICY "Everyone can view lessons" ON public.lessons FOR SELECT TO authenticated
--     USING (true);
--   CREATE POLICY "Professors can insert own lessons" ON public.lessons FOR INSERT TO authenticated
--     WITH CHECK (
--       public.get_user_role() IN ('admin', 'professor')
--       AND (created_by = auth.user_id()::uuid OR public.get_user_role() = 'admin')
--     );
--   CREATE POLICY "Professors can update own lessons" ON public.lessons FOR UPDATE TO authenticated
--     USING (
--       public.get_user_role() = 'admin'
--       OR (public.get_user_role() = 'professor' AND created_by = auth.user_id()::uuid)
--     );
--   CREATE POLICY "Professors can delete own lessons" ON public.lessons FOR DELETE TO authenticated
--     USING (
--       public.get_user_role() = 'admin'
--       OR (
--         public.get_user_role() = 'professor'
--         AND created_by = auth.user_id()::uuid
--         AND NOT EXISTS (SELECT 1 FROM public.student_progress WHERE lesson_id = lessons.id)
--       )
--     );


-- === 5.3 student_progress — ACCESO ABIERTO ==================================
CREATE POLICY "student_progress_open_access"
  ON public.student_progress FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas históricas (migración 20260401191649). DESACTIVADAS.
--   CREATE POLICY "Students can view own progress" ON public.student_progress FOR SELECT TO authenticated
--     USING (public.get_user_role() = 'student' AND student_id = auth.user_id()::uuid);
--   CREATE POLICY "Students can update own progress" ON public.student_progress FOR UPDATE TO authenticated
--     USING (public.get_user_role() = 'student' AND student_id = auth.user_id()::uuid)
--     WITH CHECK (public.get_user_role() = 'student' AND student_id = auth.user_id()::uuid);
--   CREATE POLICY "Students can insert own progress" ON public.student_progress FOR INSERT TO authenticated
--     WITH CHECK (public.get_user_role() = 'student' AND student_id = auth.user_id()::uuid);
--   CREATE POLICY "Professors can view progress of their students" ON public.student_progress FOR SELECT TO authenticated
--     USING (
--       public.get_user_role() = 'professor'
--       AND EXISTS (SELECT 1 FROM public.course_students cs
--                     JOIN public.courses c ON cs.course_id = c.id
--                    WHERE cs.student_id = student_progress.student_id AND c.professor_id = auth.user_id()::uuid)
--     );
--   CREATE POLICY "Admins can view all progress" ON public.student_progress FOR SELECT TO authenticated
--     USING (public.get_user_role() = 'admin');


-- === 5.4 course_students — ACCESO ABIERTO ===================================
CREATE POLICY "course_students_open_access"
  ON public.course_students FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas históricas (migración 20260401191649). DESACTIVADAS.
--   CREATE POLICY "Professors can manage students in their courses" ON public.course_students FOR ALL TO authenticated
--     USING (
--       public.get_user_role() = 'professor'
--       AND EXISTS (SELECT 1 FROM public.courses
--                    WHERE courses.id = course_students.course_id
--                      AND courses.professor_id = auth.user_id()::uuid)
--     );
--   CREATE POLICY "Students can view their enrollments" ON public.course_students FOR SELECT TO authenticated
--     USING (public.get_user_role() = 'student' AND student_id = auth.user_id()::uuid);
--   CREATE POLICY "Admins can manage all course enrollments" ON public.course_students FOR ALL TO authenticated
--     USING (public.get_user_role() = 'admin');


-- === 5.5 courses ============================================================
-- NOTA: el patrón original `(SELECT role FROM profiles WHERE id = auth.uid())`
-- lee el rol BASE e ignora profiles.is_admin. Se sustituye por
-- public.get_user_role(), que sí contempla el doble rol admin+profesor y evita
-- una subconsulta a profiles dentro de la política.
CREATE POLICY "Professors can view own courses"
  ON public.courses FOR SELECT TO authenticated
  USING (public.get_user_role() = 'professor' AND professor_id = auth.user_id()::uuid);

CREATE POLICY "Admins can view all courses"
  ON public.courses FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Students can view courses they're enrolled in"
  ON public.courses FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.course_students
       WHERE course_id = courses.id AND student_id = auth.user_id()::uuid
    )
  );

CREATE POLICY "Professors can insert own courses"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('professor', 'admin')
    AND professor_id = auth.user_id()::uuid
  );

CREATE POLICY "Professors can update own courses"
  ON public.courses FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'professor' AND professor_id = auth.user_id()::uuid)
  );

CREATE POLICY "Professors can delete own courses"
  ON public.courses FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'professor' AND professor_id = auth.user_id()::uuid)
  );


-- === 5.6 activities =========================================================
-- Estado final tras 20260403010800 (limpieza total) + 20260411100000
-- (que eliminó "Permitir control a admin en activities").
CREATE POLICY "Permitir lectura general activities"
  ON public.activities FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin full control activities"
  ON public.activities FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Professors can insert own activities"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'professor'
    AND created_by = auth.user_id()::uuid
  );

CREATE POLICY "Professors can update own activities"
  ON public.activities FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND created_by = auth.user_id()::uuid
  );

CREATE POLICY "Professors can delete own activities"
  ON public.activities FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND created_by = auth.user_id()::uuid
    AND NOT EXISTS (
      SELECT 1 FROM public.activity_responses WHERE activity_id = activities.id
    )
  );


-- === 5.7 lesson_activities ==================================================
CREATE POLICY "Permitir lectura lesson_activities"
  ON public.lesson_activities FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin full control lesson_activities"
  ON public.lesson_activities FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Professors manage their lesson_activities"
  ON public.lesson_activities FOR ALL TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM public.lessons
       WHERE lessons.id = lesson_activities.lesson_id
         AND lessons.created_by = auth.user_id()::uuid
    )
  )
  WITH CHECK (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM public.lessons
       WHERE lessons.id = lesson_activities.lesson_id
         AND lessons.created_by = auth.user_id()::uuid
    )
  );


-- === 5.8 lesson_assignments =================================================
CREATE POLICY "Professors can view assignments they created"
  ON public.lesson_assignments FOR SELECT TO authenticated
  USING (public.get_user_role() = 'professor' AND assigned_by = auth.user_id()::uuid);

CREATE POLICY "Students can view their assignments"
  ON public.lesson_assignments FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND (
      student_id = auth.user_id()::uuid
      OR EXISTS (
        SELECT 1 FROM public.course_students
         WHERE course_students.course_id = lesson_assignments.course_id
           AND course_students.student_id = auth.user_id()::uuid
      )
    )
  );

CREATE POLICY "Professors can create assignments"
  ON public.lesson_assignments FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'professor' AND assigned_by = auth.user_id()::uuid);

CREATE POLICY "Professors can delete their assignments"
  ON public.lesson_assignments FOR DELETE TO authenticated
  USING (public.get_user_role() = 'professor' AND assigned_by = auth.user_id()::uuid);

CREATE POLICY "Admins can manage all assignments"
  ON public.lesson_assignments FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');


-- === 5.9 activity_responses =================================================
CREATE POLICY "Students can view own responses"
  ON public.activity_responses FOR SELECT TO authenticated
  USING (public.get_user_role() = 'student' AND student_id = auth.user_id()::uuid);

CREATE POLICY "Students can insert own responses"
  ON public.activity_responses FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'student' AND student_id = auth.user_id()::uuid);

CREATE POLICY "Professors can view responses from their students"
  ON public.activity_responses FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM public.course_students cs
        JOIN public.courses c ON cs.course_id = c.id
       WHERE cs.student_id = activity_responses.student_id
         AND c.professor_id = auth.user_id()::uuid
    )
  );

CREATE POLICY "Admins can view all responses"
  ON public.activity_responses FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');


-- === 5.10 production_rules ==================================================
-- CONFLICTO RESUELTO: la migración 20260401191649 creó
-- "Everyone can view production rules" (SELECT true) y nunca la eliminó, pero
-- rls-policies.md documenta que en la BD real solo existen las 3 de abajo.
-- Se omite la duplicada; "Students can view production rules" cubre lo mismo.
CREATE POLICY "Students can view production rules"
  ON public.production_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin full control production_rules"
  ON public.production_rules FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Professors manage their production_rules"
  ON public.production_rules FOR ALL TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM public.lessons
       WHERE lessons.id = production_rules.lesson_id
         AND lessons.created_by = auth.user_id()::uuid
    )
  )
  WITH CHECK (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM public.lessons
       WHERE lessons.id = production_rules.lesson_id
         AND lessons.created_by = auth.user_id()::uuid
    )
  );


-- === 5.11 productions =======================================================
-- Estado final según .claude/contexts/database/rls-policies.md (BD real):
-- las 6 políticas de la migración 20260401191649 fueron reemplazadas en el
-- dashboard por estas 3, documentadas en 20260419200000_fix_production_rls_policies.
CREATE POLICY "Students manage own productions"
  ON public.productions FOR ALL TO authenticated
  USING (student_id = auth.user_id()::uuid)
  WITH CHECK (student_id = auth.user_id()::uuid);

CREATE POLICY "Professors view productions of their lessons"
  ON public.productions FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('professor', 'admin'));

CREATE POLICY "Professors update productions"
  ON public.productions FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('professor', 'admin'));

-- TODO: VERIFICAR — producción grupal. ProductionEditor muestra al resto del
-- grupo la producción del compañero que entregó primero (lock en
-- group_production_locks). Con las políticas de arriba, un estudiante NO puede
-- leer la producción de otro. Si esa lectura se hace desde el cliente, hace
-- falta añadir una política del tipo:
--   CREATE POLICY "Group peers read locked production" ON public.productions
--     FOR SELECT TO authenticated USING (
--       EXISTS (SELECT 1 FROM public.group_production_locks l
--                 JOIN public.group_members gm ON gm.group_id = l.group_id
--                WHERE l.production_id = productions.id
--                  AND gm.student_id = auth.user_id()::uuid)
--     );
-- Confirmar el comportamiento real antes de habilitarla (Fase 8, checklist).


-- === 5.12 groups ============================================================
CREATE POLICY "Profesores ven grupos de sus cursos"
  ON public.groups FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND EXISTS (SELECT 1 FROM public.courses
                 WHERE id = groups.course_id AND professor_id = auth.user_id()::uuid)
  );

CREATE POLICY "Estudiantes ven sus grupos"
  ON public.groups FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND EXISTS (SELECT 1 FROM public.group_members
                 WHERE group_id = groups.id AND student_id = auth.user_id()::uuid)
  );

CREATE POLICY "Estudiantes ven grupos abiertos de sus cursos"
  ON public.groups FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND enrollment_open = true
    AND EXISTS (SELECT 1 FROM public.course_students
                 WHERE course_id = groups.course_id AND student_id = auth.user_id()::uuid)
  );

CREATE POLICY "Profesores gestionan grupos"
  ON public.groups FOR ALL TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND EXISTS (SELECT 1 FROM public.courses
                 WHERE id = groups.course_id AND professor_id = auth.user_id()::uuid)
  );

CREATE POLICY "Admin gestiona todos los grupos"
  ON public.groups FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');


-- === 5.13 group_sets ========================================================
CREATE POLICY "Profesores gestionan agrupaciones de sus cursos"
  ON public.group_sets FOR ALL TO authenticated
  USING (
    public.get_user_role() IN ('professor', 'admin')
    AND (
      public.get_user_role() = 'admin'
      OR EXISTS (SELECT 1 FROM public.courses
                  WHERE id = group_sets.course_id AND professor_id = auth.user_id()::uuid)
    )
  );

CREATE POLICY "Estudiantes ven agrupaciones de sus cursos"
  ON public.group_sets FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND EXISTS (SELECT 1 FROM public.course_students
                 WHERE course_id = group_sets.course_id AND student_id = auth.user_id()::uuid)
  );


-- === 5.14 group_members =====================================================
-- CONFLICTO RESUELTO — recursión de RLS
--   Las políticas originales de 20260405210000 consultan group_members DESDE
--   una política sobre group_members ("infinite recursion detected in policy").
--   Se reescriben con los helpers SECURITY DEFINER group_is_open(),
--   group_course_id() y count_group_members() — que es, casi con certeza, la
--   razón por la que esas tres funciones existen en la BD real.
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
CREATE POLICY "Miembros ven su grupo"
  ON public.group_members FOR SELECT TO authenticated
  USING (
    student_id = auth.user_id()::uuid
    OR public.get_user_role() IN ('professor', 'admin')
  );

CREATE POLICY "Estudiantes ven miembros de grupos de sus cursos"
  ON public.group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_students cs
       WHERE cs.course_id = public.group_course_id(group_members.group_id)
         AND cs.student_id = auth.user_id()::uuid
    )
    AND (
      public.group_is_open(group_members.group_id)
      OR group_members.student_id = auth.user_id()::uuid
    )
  );

CREATE POLICY "Estudiantes se auto-inscriben en grupos abiertos"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.user_id()::uuid
    AND public.group_is_open(group_members.group_id)
    AND EXISTS (
      SELECT 1 FROM public.course_students cs
       WHERE cs.course_id = public.group_course_id(group_members.group_id)
         AND cs.student_id = auth.user_id()::uuid
    )
    AND (
      (SELECT g.max_members FROM public.groups g WHERE g.id = group_members.group_id) IS NULL
      OR public.count_group_members(group_members.group_id)
         < (SELECT g.max_members FROM public.groups g WHERE g.id = group_members.group_id)
    )
  );

CREATE POLICY "Estudiantes pueden salir de grupos abiertos"
  ON public.group_members FOR DELETE TO authenticated
  USING (
    student_id = auth.user_id()::uuid
    AND public.group_is_open(group_members.group_id)
  );

CREATE POLICY "Profesores y admin gestionan miembros"
  ON public.group_members FOR ALL TO authenticated
  USING (public.get_user_role() IN ('professor', 'admin'))
  WITH CHECK (public.get_user_role() IN ('professor', 'admin'));


-- === 5.15 group_lesson_assignments ==========================================
CREATE POLICY "Ver asignaciones grupales"
  ON public.group_lesson_assignments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Profesores asignan lecciones grupales"
  ON public.group_lesson_assignments FOR ALL TO authenticated
  USING (public.get_user_role() IN ('professor', 'admin'));


-- === 5.16 group_progress ====================================================
CREATE POLICY "Miembros ven progreso grupal"
  ON public.group_progress FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.group_members
             WHERE group_id = group_progress.group_id
               AND student_id = auth.user_id()::uuid)
    OR public.get_user_role() IN ('professor', 'admin')
  );

CREATE POLICY "Miembros actualizan progreso grupal"
  ON public.group_progress FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.group_members
             WHERE group_id = group_progress.group_id
               AND student_id = auth.user_id()::uuid)
    OR public.get_user_role() IN ('professor', 'admin')
  );


-- === 5.17 group_activity_completions ========================================
CREATE POLICY "Miembros ven completaciones del grupo"
  ON public.group_activity_completions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.group_members
             WHERE group_id = group_activity_completions.group_id
               AND student_id = auth.user_id()::uuid)
    OR public.get_user_role() IN ('professor', 'admin')
  );

CREATE POLICY "Miembros registran completaciones"
  ON public.group_activity_completions FOR INSERT TO authenticated
  WITH CHECK (
    completed_by = auth.user_id()::uuid
    AND EXISTS (SELECT 1 FROM public.group_members
                 WHERE group_id = group_activity_completions.group_id
                   AND student_id = auth.user_id()::uuid)
  );

-- TODO: VERIFICAR — no hay política UPDATE/DELETE en git para esta tabla; si el
-- frontend reintenta una completación ya registrada, el UPDATE fallaría.


-- === 5.18 group_production_locks ============================================
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
--   No hay ninguna política en git. Reconstruidas por inferencia del uso:
--   ProductionEditor lee el lock del grupo del estudiante y lo crea al entregar;
--   ProductionReviewer (profesor) lo lee embebido desde productions.
CREATE POLICY "Miembros ven el lock de su grupo"
  ON public.group_production_locks FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.group_members
             WHERE group_id = group_production_locks.group_id
               AND student_id = auth.user_id()::uuid)
    OR public.get_user_role() IN ('professor', 'admin')
  );

CREATE POLICY "Miembros crean el lock de su grupo"
  ON public.group_production_locks FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.user_id()::uuid
    AND EXISTS (SELECT 1 FROM public.group_members
                 WHERE group_id = group_production_locks.group_id
                   AND student_id = auth.user_id()::uuid)
  );

CREATE POLICY "Profesores y admin gestionan locks"
  ON public.group_production_locks FOR ALL TO authenticated
  USING (public.get_user_role() IN ('professor', 'admin'))
  WITH CHECK (public.get_user_role() IN ('professor', 'admin'));


-- === 5.19 presentation_sessions =============================================
CREATE POLICY "Profesores gestionan sus sesiones"
  ON public.presentation_sessions FOR ALL TO authenticated
  USING (professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
  WITH CHECK (professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin');

CREATE POLICY "Estudiantes ven sesiones activas de sus cursos"
  ON public.presentation_sessions FOR SELECT TO authenticated
  USING (
    is_active = true
    AND public.get_user_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.course_students
       WHERE course_id = presentation_sessions.course_id
         AND student_id = auth.user_id()::uuid
    )
  );


-- === 5.20 projects ==========================================================
CREATE POLICY "Profesores gestionan sus proyectos"
  ON public.projects FOR ALL TO authenticated
  USING (professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
  WITH CHECK (professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin');

-- Reescrita: projects ya no tiene course_id (ver 2.20). Pasa por project_assignments.
CREATE POLICY "Estudiantes ven proyectos de sus cursos"
  ON public.projects FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND is_active = true
    AND public.student_can_access_project(projects.id)
  );


-- === 5.21 project_assignments ===============================================
CREATE POLICY "Profesores gestionan sus asignaciones de proyecto"
  ON public.project_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
       WHERE p.id = project_assignments.project_id
         AND (p.professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
    )
  );

CREATE POLICY "Estudiantes ven asignaciones de sus cursos"
  ON public.project_assignments FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND (
      student_id = auth.user_id()::uuid
      OR EXISTS (
        SELECT 1 FROM public.course_students cs
         WHERE cs.course_id = project_assignments.course_id
           AND cs.student_id = auth.user_id()::uuid
      )
    )
    AND (available_from  IS NULL OR available_from  <= now())
    AND (available_until IS NULL OR available_until >= now())
  );


-- === 5.22 project_object_types ==============================================
CREATE POLICY "Profesores gestionan tipos de objeto"
  ON public.project_object_types FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
       WHERE id = project_object_types.project_id
         AND (professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
    )
  );

-- Reescrita: sin projects.course_id, la visibilidad pasa por project_assignments.
CREATE POLICY "Estudiantes ven tipos de objeto de sus proyectos"
  ON public.project_object_types FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.projects p
       WHERE p.id = project_object_types.project_id
         AND p.is_active = true
         AND public.student_can_access_project(p.id)
    )
  );


-- === 5.23 lesson_project_objects ============================================
CREATE POLICY "Profesores gestionan mapeo leccion-objeto"
  ON public.lesson_project_objects FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_object_types pot
        JOIN public.projects p ON p.id = pot.project_id
       WHERE pot.id = lesson_project_objects.object_type_id
         AND (p.professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
    )
  );

CREATE POLICY "Estudiantes ven mapeo leccion-objeto"
  ON public.lesson_project_objects FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.project_object_types pot
        JOIN public.projects p ON p.id = pot.project_id
       WHERE pot.id = lesson_project_objects.object_type_id
         AND p.is_active = true
         AND public.student_can_access_project(p.id)
    )
  );


-- === 5.24 project_objects ===================================================
CREATE POLICY "Estudiantes gestionan sus propios objetos"
  ON public.project_objects FOR ALL TO authenticated
  USING (student_id = auth.user_id()::uuid)
  WITH CHECK (student_id = auth.user_id()::uuid);

CREATE POLICY "Profesores ven objetos de sus proyectos"
  ON public.project_objects FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('professor', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.project_object_types pot
        JOIN public.projects p ON p.id = pot.project_id
       WHERE pot.id = project_objects.object_type_id
         AND (p.professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
    )
  );

CREATE POLICY "Profesores pueden actualizar objetos (feedback/score)"
  ON public.project_objects FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('professor', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.project_object_types pot
        JOIN public.projects p ON p.id = pot.project_id
       WHERE pot.id = project_objects.object_type_id
         AND (p.professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
    )
  );


-- === 5.25 project_object_edit_requests ======================================
CREATE POLICY "Estudiantes gestionan sus solicitudes"
  ON public.project_object_edit_requests FOR ALL TO authenticated
  USING (student_id = auth.user_id()::uuid)
  WITH CHECK (student_id = auth.user_id()::uuid);

CREATE POLICY "Profesores ven y resuelven solicitudes de sus proyectos"
  ON public.project_object_edit_requests FOR ALL TO authenticated
  USING (
    public.get_user_role() IN ('professor', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.project_objects po
        JOIN public.project_object_types pot ON pot.id = po.object_type_id
        JOIN public.projects p ON p.id = pot.project_id
       WHERE po.id = project_object_edit_requests.project_object_id
         AND (p.professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
    )
  );


-- === 5.26 project_submissions ===============================================
-- TODO: VERIFICAR contra Supabase real cuando tengamos credenciales (Fase 0 pendiente)
--   Tabla sin migración en git; políticas inferidas por simetría con
--   project_objects (el estudiante gestiona lo suyo, el profesor del proyecto
--   lee y califica).
CREATE POLICY "Estudiantes gestionan su entrega de proyecto"
  ON public.project_submissions FOR ALL TO authenticated
  USING (student_id = auth.user_id()::uuid)
  WITH CHECK (student_id = auth.user_id()::uuid);

CREATE POLICY "Profesores revisan entregas de sus proyectos"
  ON public.project_submissions FOR ALL TO authenticated
  USING (
    public.get_user_role() IN ('professor', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.projects p
       WHERE p.id = project_submissions.project_id
         AND (p.professor_id = auth.user_id()::uuid OR public.get_user_role() = 'admin')
    )
  );


-- ---------------------------------------------------------------------------
-- 6. Object Storage — bucket `lesson-media`
-- ---------------------------------------------------------------------------
-- OMITIDO A PROPÓSITO: en Neon no existe el schema `storage` (Object Storage es
-- S3-compatible, no vive en Postgres), así que estas piezas de la migración
-- 20260411100000_content_studio_professor_access.sql (líneas ~164-200) no se
-- pueden portar:
--   * INSERT INTO storage.buckets (...) VALUES ('lesson-media', ..., public=true,
--     file_size_limit=52428800, allowed_mime_types=[image/*, audio/*, video/mp4, application/pdf])
--   * POLICY "Profesores suben archivos a lesson-media"      → INSERT si rol ∈ (admin, professor)
--   * POLICY "Lectura pública de lesson-media"               → SELECT para todos
--   * POLICY "Profesores eliminan sus archivos de lesson-media"
--       → DELETE si rol ∈ (admin, professor) AND (storage.foldername(name))[1] = auth.uid()::text
--
-- TODO (Fase 5 del plan de migración): reimplementar esas tres restricciones en
-- la capa de aplicación. El bucket Neon `lesson-media` es bucket-level
-- (public_read) y no tiene RLS por objeto. La subida NO debe hacerse directo
-- desde el navegador con una credencial amplia: hay que interponer una Neon
-- Function que
--   1) valide el JWT del caller y compruebe get_user_role() ∈ (admin, professor);
--   2) fuerce el prefijo de ruta `{profile.id}/` (convención actual en
--      MediaUploader.tsx:57-58) para replicar el chequeo de carpeta propia;
--   3) valide mime-type y tamaño (≤ 50 MB) antes de emitir la URL presignada;
--   4) para el borrado, exija que el objeto esté bajo el prefijo del propio
--      profesor (o que el caller sea admin).
-- Sin ese wrapper, cualquier usuario autenticado podría escribir en el bucket.


-- ---------------------------------------------------------------------------
-- 7. GRANTs — requeridos por Neon Data API
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE, INSERT, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, UPDATE, INSERT, DELETE ON TABLES TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Necesario para invocar get_user_role() / is_admin() y para que las políticas
-- que las usan se evalúen bajo el rol `authenticated`.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

COMMIT;

-- ============================================================================
-- FIN — 001_schema_and_rls.sql
--
-- Siguientes pasos (ver C:\Users\User\.claude\plans\zazzy-marinating-kahn.md):
--   Fase 0 : re-verificar los bloques marcados TODO contra la BD real de Supabase.
--   Fase 3 : Managed Better Auth + creación de perfiles (profiles.id = user id).
--   Fase 4 : regenerar src/lib/database.types.ts contra este schema.
--   Fase 5 : Neon Function de subida a `lesson-media` (ver sección 6).
-- ============================================================================
