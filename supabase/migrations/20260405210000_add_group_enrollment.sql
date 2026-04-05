-- Columnas para auto-inscripción y capacidad máxima
ALTER TABLE groups ADD COLUMN IF NOT EXISTS enrollment_open boolean DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_members int;

-- Estudiantes pueden ver grupos abiertos de sus cursos (para poder unirse)
CREATE POLICY "Estudiantes ven grupos abiertos de sus cursos" ON groups FOR SELECT TO authenticated
  USING (
    get_user_role() = 'student' AND
    enrollment_open = true AND
    EXISTS (SELECT 1 FROM course_students WHERE course_id = groups.course_id AND student_id = auth.uid())
  );

-- Estudiantes pueden ver miembros de grupos abiertos (para saber capacidad)
CREATE POLICY "Estudiantes ven miembros de grupos de sus cursos" ON group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN course_students cs ON cs.course_id = g.course_id AND cs.student_id = auth.uid()
      WHERE g.id = group_members.group_id
      AND (g.enrollment_open = true OR group_members.student_id = auth.uid())
    )
  );

-- Estudiantes pueden auto-inscribirse en grupos abiertos con capacidad disponible
CREATE POLICY "Estudiantes se auto-inscriben en grupos abiertos" ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM groups g
      JOIN course_students cs ON cs.course_id = g.course_id AND cs.student_id = auth.uid()
      WHERE g.id = group_members.group_id
        AND g.enrollment_open = true
        AND (
          g.max_members IS NULL OR
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = group_members.group_id) < g.max_members
        )
    )
  );

-- Estudiantes pueden salir de grupos donde la inscripción está abierta
CREATE POLICY "Estudiantes pueden salir de grupos abiertos" ON group_members FOR DELETE TO authenticated
  USING (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM groups WHERE id = group_members.group_id AND enrollment_open = true)
  );

NOTIFY pgrst, 'reload_schema';
