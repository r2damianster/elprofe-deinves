-- Agrupaciones: sets de grupos nombrados e independientes por curso
CREATE TABLE IF NOT EXISTS group_sets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE group_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profesores gestionan agrupaciones de sus cursos" ON group_sets FOR ALL TO authenticated
  USING (
    get_user_role() IN ('professor', 'admin') AND (
      get_user_role() = 'admin' OR
      EXISTS (SELECT 1 FROM courses WHERE id = group_sets.course_id AND professor_id = auth.uid())
    )
  );

CREATE POLICY "Estudiantes ven agrupaciones de sus cursos" ON group_sets FOR SELECT TO authenticated
  USING (
    get_user_role() = 'student' AND
    EXISTS (SELECT 1 FROM course_students WHERE course_id = group_sets.course_id AND student_id = auth.uid())
  );

-- Enlazar grupos existentes a agrupaciones
ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_set_id uuid REFERENCES group_sets(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload_schema';
