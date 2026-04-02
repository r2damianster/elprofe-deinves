/*
  # Educational Platform Schema - Lecciones de Investigación del Profe Arturito

  ## Overview
  Complete database schema for an educational platform with role-based access control,
  lessons, courses, activities, and production assignments.

  ## New Tables

  ### 1. `profiles`
  - `id` (uuid, FK to auth.users)
  - `email` (text)
  - `full_name` (text)
  - `role` (enum: admin, professor, student)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `lessons`
  - `id` (uuid, PK)
  - `title` (text)
  - `description` (text)
  - `content` (jsonb) - Lesson content and theory
  - `has_production` (boolean)
  - `production_unlock_percentage` (int) - Default 80
  - `order_index` (int)
  - `created_at` (timestamptz)
  - `created_by` (uuid, FK to profiles)

  ### 3. `courses`
  - `id` (uuid, PK)
  - `name` (text)
  - `description` (text)
  - `professor_id` (uuid, FK to profiles)
  - `created_at` (timestamptz)

  ### 4. `course_students`
  - `id` (uuid, PK)
  - `course_id` (uuid, FK to courses)
  - `student_id` (uuid, FK to profiles)
  - `enrolled_at` (timestamptz)

  ### 5. `activities`
  - `id` (uuid, PK)
  - `lesson_id` (uuid, FK to lessons)
  - `type` (enum: multiple_choice, drag_drop, essay, short_answer)
  - `title` (text)
  - `content` (jsonb) - Activity data based on type
  - `points` (int)
  - `order_index` (int)
  - `created_at` (timestamptz)

  ### 6. `lesson_assignments`
  - `id` (uuid, PK)
  - `lesson_id` (uuid, FK to lessons)
  - `course_id` (uuid, FK to courses, nullable)
  - `student_id` (uuid, FK to profiles, nullable)
  - `assigned_by` (uuid, FK to profiles)
  - `assigned_at` (timestamptz)

  ### 7. `student_progress`
  - `id` (uuid, PK)
  - `student_id` (uuid, FK to profiles)
  - `lesson_id` (uuid, FK to lessons)
  - `completion_percentage` (int) - 0-100
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz, nullable)

  ### 8. `activity_responses`
  - `id` (uuid, PK)
  - `activity_id` (uuid, FK to activities)
  - `student_id` (uuid, FK to profiles)
  - `response` (jsonb)
  - `score` (int)
  - `submitted_at` (timestamptz)

  ### 9. `production_rules`
  - `id` (uuid, PK)
  - `lesson_id` (uuid, FK to lessons)
  - `min_words` (int)
  - `max_words` (int, nullable)
  - `required_words` (text[])
  - `prohibited_words` (text[])
  - `instructions` (text)

  ### 10. `productions`
  - `id` (uuid, PK)
  - `student_id` (uuid, FK to profiles)
  - `lesson_id` (uuid, FK to lessons)
  - `content` (text)
  - `word_count` (int)
  - `status` (enum: draft, submitted, reviewed)
  - `score` (int, nullable)
  - `feedback` (text, nullable)
  - `created_at` (timestamptz)
  - `submitted_at` (timestamptz, nullable)
  - `reviewed_at` (timestamptz, nullable)

  ## Security
  - Enable RLS on all tables
  - Admins can manage everything
  - Professors can manage their own courses and see their students
  - Students can only see their assigned content and their own data
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'professor', 'student');
CREATE TYPE activity_type AS ENUM ('multiple_choice', 'drag_drop', 'essay', 'short_answer');
CREATE TYPE production_status AS ENUM ('draft', 'submitted', 'reviewed');

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  content jsonb DEFAULT '{}'::jsonb,
  has_production boolean DEFAULT false,
  production_unlock_percentage int DEFAULT 80,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  professor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Course students table
CREATE TABLE IF NOT EXISTS course_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE(course_id, student_id)
);

ALTER TABLE course_students ENABLE ROW LEVEL SECURITY;

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  points int DEFAULT 10,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Lesson assignments table
CREATE TABLE IF NOT EXISTS lesson_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  CHECK (course_id IS NOT NULL OR student_id IS NOT NULL)
);

ALTER TABLE lesson_assignments ENABLE ROW LEVEL SECURITY;

-- Student progress table
CREATE TABLE IF NOT EXISTS student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completion_percentage int DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(student_id, lesson_id)
);

ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

-- Activity responses table
CREATE TABLE IF NOT EXISTS activity_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response jsonb NOT NULL,
  score int DEFAULT 0,
  submitted_at timestamptz DEFAULT now()
);

ALTER TABLE activity_responses ENABLE ROW LEVEL SECURITY;

-- Production rules table
CREATE TABLE IF NOT EXISTS production_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE UNIQUE,
  min_words int DEFAULT 0,
  max_words int,
  required_words text[] DEFAULT ARRAY[]::text[],
  prohibited_words text[] DEFAULT ARRAY[]::text[],
  instructions text
);

ALTER TABLE production_rules ENABLE ROW LEVEL SECURITY;

-- Productions table
CREATE TABLE IF NOT EXISTS productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content text DEFAULT '',
  word_count int DEFAULT 0,
  status production_status DEFAULT 'draft',
  score int,
  feedback text,
  created_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  UNIQUE(student_id, lesson_id)
);

ALTER TABLE productions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Professors can view student profiles in their courses"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    role = 'student' AND
    EXISTS (
      SELECT 1 FROM course_students cs
      JOIN courses c ON cs.course_id = c.id
      WHERE cs.student_id = profiles.id AND c.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for lessons
CREATE POLICY "Everyone can view lessons"
  ON lessons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert lessons"
  ON lessons FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update lessons"
  ON lessons FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete lessons"
  ON lessons FOR DELETE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for courses
CREATE POLICY "Professors can view own courses"
  ON courses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    professor_id = auth.uid()
  );

CREATE POLICY "Admins can view all courses"
  ON courses FOR SELECT
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Students can view courses they're enrolled in"
  ON courses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    EXISTS (
      SELECT 1 FROM course_students
      WHERE course_id = courses.id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Professors can insert own courses"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    professor_id = auth.uid()
  );

CREATE POLICY "Professors can update own courses"
  ON courses FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    professor_id = auth.uid()
  );

CREATE POLICY "Professors can delete own courses"
  ON courses FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    professor_id = auth.uid()
  );

-- RLS Policies for course_students
CREATE POLICY "Professors can manage students in their courses"
  ON course_students FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_students.course_id AND courses.professor_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their enrollments"
  ON course_students FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Admins can manage all course enrollments"
  ON course_students FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for activities
CREATE POLICY "Everyone can view activities"
  ON activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage activities"
  ON activities FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for lesson_assignments
CREATE POLICY "Professors can view assignments they created"
  ON lesson_assignments FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    assigned_by = auth.uid()
  );

CREATE POLICY "Students can view their assignments"
  ON lesson_assignments FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    (
      student_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM course_students
        WHERE course_students.course_id = lesson_assignments.course_id
        AND course_students.student_id = auth.uid()
      )
    )
  );

CREATE POLICY "Professors can create assignments"
  ON lesson_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    assigned_by = auth.uid()
  );

CREATE POLICY "Professors can delete their assignments"
  ON lesson_assignments FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    assigned_by = auth.uid()
  );

CREATE POLICY "Admins can manage all assignments"
  ON lesson_assignments FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for student_progress
CREATE POLICY "Students can view own progress"
  ON student_progress FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Students can update own progress"
  ON student_progress FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Students can insert own progress"
  ON student_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Professors can view progress of their students"
  ON student_progress FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    EXISTS (
      SELECT 1 FROM course_students cs
      JOIN courses c ON cs.course_id = c.id
      WHERE cs.student_id = student_progress.student_id AND c.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all progress"
  ON student_progress FOR SELECT
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for activity_responses
CREATE POLICY "Students can view own responses"
  ON activity_responses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Students can insert own responses"
  ON activity_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Professors can view responses from their students"
  ON activity_responses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    EXISTS (
      SELECT 1 FROM course_students cs
      JOIN courses c ON cs.course_id = c.id
      WHERE cs.student_id = activity_responses.student_id AND c.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all responses"
  ON activity_responses FOR SELECT
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for production_rules
CREATE POLICY "Everyone can view production rules"
  ON production_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage production rules"
  ON production_rules FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS Policies for productions
CREATE POLICY "Students can view own productions"
  ON productions FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Students can insert own productions"
  ON productions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Students can update own productions"
  ON productions FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'student' AND
    student_id = auth.uid()
  );

CREATE POLICY "Professors can view productions from their students"
  ON productions FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    EXISTS (
      SELECT 1 FROM course_students cs
      JOIN courses c ON cs.course_id = c.id
      WHERE cs.student_id = productions.student_id AND c.professor_id = auth.uid()
    )
  );

CREATE POLICY "Professors can review productions"
  ON productions FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'professor' AND
    EXISTS (
      SELECT 1 FROM course_students cs
      JOIN courses c ON cs.course_id = c.id
      WHERE cs.student_id = productions.student_id AND c.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all productions"
  ON productions FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');