-- ============================================================
-- EDUCATIONAL PLATFORM - Complete Database Schema
-- "Lecciones de Investigación del Profe Arturito"
-- Generated: 2026-04-12
-- ============================================================

-- ============================================================
-- CUSTOM TYPES
-- ============================================================

-- User roles: admin, professor, student
-- activity_type: multiple_choice, drag_drop, essay, short_answer
-- production_status: draft, submitted, reviewed

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns the effective role of the current user
-- If is_admin = true, returns 'admin' regardless of role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT
    CASE
      WHEN is_admin THEN 'admin'
      ELSE role::text
    END
  FROM public.profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- 1. PROFILES - User accounts for all roles
CREATE TABLE public.profiles (
  id uuid NOT NULL,                                    -- FK to auth.users(id)
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',           -- 'admin' | 'professor' | 'student'
  is_admin boolean NOT NULL DEFAULT false,             -- Dual role: allows professor to have admin access
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- 2. COURSES - Course definitions
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  professor_id uuid NOT NULL,                          -- FK to profiles(id)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  language character varying NOT NULL DEFAULT 'es',    -- 'es' | 'en'
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.profiles(id)
);

-- 3. LESSONS - Lesson content
CREATE TABLE public.lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title jsonb NOT NULL,                                -- Multilingual: {"es": "...", "en": "..."}
  description jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_production boolean NOT NULL DEFAULT false,
  production_unlock_percentage integer NOT NULL DEFAULT 80,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,                                     -- FK to profiles(id)
  CONSTRAINT lessons_pkey PRIMARY KEY (id),
  CONSTRAINT lessons_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- 4. ACTIVITIES - Interactive exercises
CREATE TABLE public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type activity_type NOT NULL,                         -- 'multiple_choice' | 'drag_drop' | 'essay' | 'short_answer'
  title text NOT NULL,
  content jsonb NOT NULL,
  points integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  media_url text,
  created_by uuid,                                     -- FK to profiles(id)
  CONSTRAINT activities_pkey PRIMARY KEY (id),
  CONSTRAINT activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- 5. LESSON_ACTIVITIES - Junction table linking lessons to activities
CREATE TABLE public.lesson_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lesson_activities_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_activities_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT lesson_activities_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id)
);

-- ============================================================
-- ENROLLMENT & ASSIGNMENTS
-- ============================================================

-- 6. COURSE_STUDENTS - Student-to-course enrollment
CREATE TABLE public.course_students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,                             -- FK to courses(id)
  student_id uuid NOT NULL,                            -- FK to profiles(id)
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_students_pkey PRIMARY KEY (id),
  CONSTRAINT course_students_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);

-- 7. LESSON_ASSIGNMENTS - Lessons assigned to courses or individual students
CREATE TABLE public.lesson_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL,
  course_id uuid,                                      -- Nullable: can be assigned to specific student instead
  student_id uuid,                                     -- Nullable: can be assigned to entire course instead
  assigned_by uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lesson_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_assignments_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT lesson_assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT lesson_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT lesson_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id)
);

-- ============================================================
-- STUDENT PROGRESS & RESPONSES
-- ============================================================

-- 8. STUDENT_PROGRESS - Individual student progress per lesson
CREATE TABLE public.student_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  completion_percentage integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  attempts integer DEFAULT 1,
  CONSTRAINT student_progress_pkey PRIMARY KEY (id),
  CONSTRAINT student_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT student_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);

-- 9. ACTIVITY_RESPONSES - Student responses to activities
CREATE TABLE public.activity_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  student_id uuid NOT NULL,
  response jsonb NOT NULL,
  score integer NOT NULL DEFAULT 0,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_responses_pkey PRIMARY KEY (id),
  CONSTRAINT activity_responses_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id),
  CONSTRAINT activity_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);

-- ============================================================
-- PRODUCTIONS (Written Essays)
-- ============================================================

-- 10. PRODUCTION_RULES - Rules for each lesson's production
CREATE TABLE public.production_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE,
  min_words integer NOT NULL DEFAULT 100,
  max_words integer,
  required_words text[] NOT NULL DEFAULT '{}',
  prohibited_words text[] NOT NULL DEFAULT '{}',
  instructions text,
  extra_rules jsonb DEFAULT '{}',
  CONSTRAINT production_rules_pkey PRIMARY KEY (id),
  CONSTRAINT production_rules_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);

-- 11. PRODUCTIONS - Student final written essays
CREATE TABLE public.productions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  status production_status NOT NULL DEFAULT 'draft',   -- 'draft' | 'submitted' | 'reviewed'
  score integer,
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  attempts integer DEFAULT 1,
  compliance_score integer DEFAULT 0,
  integrity_score integer DEFAULT 100,
  integrity_events jsonb DEFAULT '[]',
  time_on_task integer DEFAULT 0,
  CONSTRAINT productions_pkey PRIMARY KEY (id),
  CONSTRAINT productions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT productions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);

-- ============================================================
-- GROUPS
-- ============================================================

-- 12. GROUP_SETS - Named groupings per course
CREATE TABLE public.group_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT group_sets_pkey PRIMARY KEY (id),
  CONSTRAINT group_sets_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT group_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- 13. GROUPS - Student groups within courses
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  enrollment_open boolean DEFAULT false,
  max_members integer,
  group_set_id uuid,
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT groups_group_set_id_fkey FOREIGN KEY (group_set_id) REFERENCES public.group_sets(id)
);

-- 14. GROUP_MEMBERS - Students in groups
CREATE TABLE public.group_members (
  group_id uuid NOT NULL,
  student_id uuid NOT NULL,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (group_id, student_id),
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);

-- 15. GROUP_PROGRESS - Shared group progress per lesson
CREATE TABLE public.group_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  completion_percentage integer DEFAULT 0,
  completed_at timestamp with time zone,
  CONSTRAINT group_progress_pkey PRIMARY KEY (id),
  CONSTRAINT group_progress_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);

-- 16. GROUP_LESSON_ASSIGNMENTS - Lessons assigned to groups
CREATE TABLE public.group_lesson_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_lesson_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT group_lesson_assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_lesson_assignments_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT group_lesson_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id)
);

-- 17. GROUP_ACTIVITY_COMPLETIONS - Group-level activity completions
CREATE TABLE public.group_activity_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  completed_by uuid NOT NULL,
  completed_at timestamp with time zone DEFAULT now(),
  response jsonb,
  score integer DEFAULT 0,
  CONSTRAINT group_activity_completions_pkey PRIMARY KEY (id),
  CONSTRAINT group_activity_completions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_activity_completions_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id),
  CONSTRAINT group_activity_completions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id)
);

-- ============================================================
-- PRESENTATIONS
-- ============================================================

-- 18. PRESENTATION_SESSIONS - Live presentation sessions (professor controls, students follow)
CREATE TABLE public.presentation_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL,
  course_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  is_active boolean DEFAULT true,
  current_step_index integer DEFAULT 0,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  CONSTRAINT presentation_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT presentation_sessions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT presentation_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT presentation_sessions_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.profiles(id)
);

-- ============================================================
-- DIAGNOSTIC QUERIES
-- ============================================================

-- All students with their course enrollments
SELECT
  p.id AS student_id,
  p.email,
  p.full_name,
  p.role,
  p.is_admin,
  p.created_at,
  c.name AS course_name,
  cs.enrolled_at
FROM profiles p
LEFT JOIN course_students cs ON p.id = cs.student_id
LEFT JOIN courses c ON cs.course_id = c.id
WHERE p.role = 'student'
ORDER BY p.created_at DESC;

-- Students without course enrollments
SELECT
  p.id,
  p.email,
  p.full_name,
  p.created_at
FROM profiles p
WHERE p.role = 'student'
  AND p.id NOT IN (SELECT student_id FROM course_students)
ORDER BY p.created_at DESC;

-- Lessons assigned to each course
SELECT
  la.id AS assignment_id,
  l.title->>'es' AS lesson_title_es,
  c.name AS course_name,
  la.assigned_at
FROM lesson_assignments la
JOIN lessons l ON la.lesson_id = l.id
JOIN courses c ON la.course_id = c.id
ORDER BY la.assigned_at DESC;

-- Students with no lesson assignments (via course or direct)
SELECT
  p.id,
  p.email,
  p.full_name
FROM profiles p
WHERE p.role = 'student'
  AND p.id NOT IN (
    SELECT cs.student_id
    FROM course_students cs
    JOIN lesson_assignments la ON la.course_id = cs.course_id
  )
  AND p.id NOT IN (
    SELECT la.student_id
    FROM lesson_assignments la
    WHERE la.student_id IS NOT NULL
  )
ORDER BY p.created_at DESC;

-- Production rules per lesson
SELECT
  l.title->>'es' AS lesson_title,
  pr.min_words,
  pr.max_words,
  pr.required_words,
  pr.prohibited_words,
  pr.instructions
FROM production_rules pr
JOIN lessons l ON pr.lesson_id = l.id
ORDER BY l.order_index;

-- Group summary per course
SELECT
  c.name AS course_name,
  gs.name AS group_set_name,
  g.name AS group_name,
  COUNT(gm.student_id) AS member_count,
  g.max_members,
  g.enrollment_open
FROM groups g
JOIN courses c ON g.course_id = c.id
LEFT JOIN group_sets gs ON g.group_set_id = gs.id
LEFT JOIN group_members gm ON g.id = gm.group_id
GROUP BY c.name, gs.name, g.name, g.max_members, g.enrollment_open
ORDER BY c.name, g.name;

-- Active presentation sessions
SELECT
  ps.id,
  l.title->>'es' AS lesson_title,
  c.name AS course_name,
  p.full_name AS professor_name,
  ps.is_active,
  ps.current_step_index,
  ps.started_at
FROM presentation_sessions ps
JOIN lessons l ON ps.lesson_id = l.id
JOIN courses c ON ps.course_id = c.id
JOIN profiles p ON ps.professor_id = p.id
WHERE ps.is_active = true
ORDER BY ps.started_at DESC;
