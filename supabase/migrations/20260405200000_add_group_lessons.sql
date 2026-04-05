-- ============================================================
-- LECCIONES GRUPALES - Enfoque D
-- ============================================================

-- 1. Grupos dentro de un curso
CREATE TABLE IF NOT EXISTS groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- 2. Miembros del grupo
CREATE TABLE IF NOT EXISTS group_members (
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_at   timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, student_id)
);
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- 3. Lecciones asignadas en modo grupal
CREATE TABLE IF NOT EXISTS group_lesson_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  lesson_id   uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(group_id, lesson_id)
);
ALTER TABLE group_lesson_assignments ENABLE ROW LEVEL SECURITY;

-- 4. Progreso compartido del grupo por lección
CREATE TABLE IF NOT EXISTS group_progress (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  lesson_id             uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completion_percentage int DEFAULT 0,
  completed_at          timestamptz,
  UNIQUE(group_id, lesson_id)
);
ALTER TABLE group_progress ENABLE ROW LEVEL SECURITY;

-- 5. Actividades completadas a nivel grupal (registra quién lo hizo)
CREATE TABLE IF NOT EXISTS group_activity_completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  activity_id  uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  completed_by uuid NOT NULL REFERENCES profiles(id),
  completed_at timestamptz DEFAULT now(),
  response     jsonb,
  score        int DEFAULT 0,
  UNIQUE(group_id, activity_id)
);
ALTER TABLE group_activity_completions ENABLE ROW LEVEL SECURITY;

-- ── RLS ──────────────────────────────────────────────────────

-- groups
CREATE POLICY "Profesores ven grupos de sus cursos" ON groups FOR SELECT TO authenticated
  USING (
    get_user_role() = 'professor' AND
    EXISTS (SELECT 1 FROM courses WHERE id = groups.course_id AND professor_id = auth.uid())
  );
CREATE POLICY "Estudiantes ven sus grupos" ON groups FOR SELECT TO authenticated
  USING (
    get_user_role() = 'student' AND
    EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND student_id = auth.uid())
  );
CREATE POLICY "Profesores gestionan grupos" ON groups FOR ALL TO authenticated
  USING (
    get_user_role() = 'professor' AND
    EXISTS (SELECT 1 FROM courses WHERE id = groups.course_id AND professor_id = auth.uid())
  );
CREATE POLICY "Admin gestiona todos los grupos" ON groups FOR ALL TO authenticated
  USING (get_user_role() = 'admin');

-- group_members
CREATE POLICY "Miembros ven su grupo" ON group_members FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() OR
    get_user_role() IN ('professor', 'admin')
  );
CREATE POLICY "Profesores y admin gestionan miembros" ON group_members FOR ALL TO authenticated
  USING (get_user_role() IN ('professor', 'admin'));

-- group_lesson_assignments
CREATE POLICY "Ver asignaciones grupales" ON group_lesson_assignments FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Profesores asignan lecciones grupales" ON group_lesson_assignments FOR ALL TO authenticated
  USING (get_user_role() IN ('professor', 'admin'));

-- group_progress
CREATE POLICY "Miembros ven progreso grupal" ON group_progress FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_progress.group_id AND student_id = auth.uid())
    OR get_user_role() IN ('professor', 'admin')
  );
CREATE POLICY "Miembros actualizan progreso grupal" ON group_progress FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_progress.group_id AND student_id = auth.uid())
    OR get_user_role() IN ('professor', 'admin')
  );

-- group_activity_completions
CREATE POLICY "Miembros ven completaciones del grupo" ON group_activity_completions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_activity_completions.group_id AND student_id = auth.uid())
    OR get_user_role() IN ('professor', 'admin')
  );
CREATE POLICY "Miembros registran completaciones" ON group_activity_completions FOR INSERT TO authenticated
  WITH CHECK (
    completed_by = auth.uid() AND
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_activity_completions.group_id AND student_id = auth.uid())
  );

NOTIFY pgrst, 'reload_schema';
