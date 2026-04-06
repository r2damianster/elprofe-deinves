-- Sesiones de presentación en vivo (profesor controla, estudiantes siguen)
CREATE TABLE IF NOT EXISTS presentation_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id         uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  professor_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active         boolean DEFAULT true,
  current_step_index int DEFAULT 0,
  started_at        timestamptz DEFAULT now(),
  ended_at          timestamptz
);
ALTER TABLE presentation_sessions ENABLE ROW LEVEL SECURITY;

-- El profesor gestiona sus propias sesiones
CREATE POLICY "Profesores gestionan sus sesiones" ON presentation_sessions FOR ALL TO authenticated
  USING (professor_id = auth.uid() OR get_user_role() = 'admin');

-- Los estudiantes ven sesiones activas de sus cursos
CREATE POLICY "Estudiantes ven sesiones activas de sus cursos" ON presentation_sessions FOR SELECT TO authenticated
  USING (
    is_active = true AND
    get_user_role() = 'student' AND
    EXISTS (
      SELECT 1 FROM course_students
      WHERE course_id = presentation_sessions.course_id
        AND student_id = auth.uid()
    )
  );

-- Habilitar Realtime para esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE presentation_sessions;

NOTIFY pgrst, 'reload_schema';
