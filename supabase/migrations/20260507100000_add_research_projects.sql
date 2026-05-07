-- ============================================================
-- MODALIDAD: PROYECTO
-- Permite al profesor programar objetos de un proyecto
-- distribuidos en lecciones, con lógica ordinal/causal/estructural
-- ============================================================

-- 1. Proyectos (contenedor general)
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  professor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  object_logic text NOT NULL DEFAULT 'ordinal'
    CHECK (object_logic IN ('ordinal', 'causal', 'structural')),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- 2. Tipos de objeto (template definido por el profesor)
CREATE TABLE IF NOT EXISTS project_object_types (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  description           text,
  instructions          text,
  order_index           integer NOT NULL DEFAULT 0,
  parent_object_type_id uuid REFERENCES project_object_types(id) ON DELETE SET NULL,
  edit_policy           text NOT NULL DEFAULT 'always'
    CHECK (edit_policy IN ('always', 'requires_approval', 'locked_after_submit')),
  min_words             integer DEFAULT 0,
  max_words             integer,
  required_words        text[] DEFAULT '{}',
  created_at            timestamptz DEFAULT now()
);

-- 3. Mapeo lección → objetos que se trabajan en esa lección
CREATE TABLE IF NOT EXISTS lesson_project_objects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  object_type_id  uuid NOT NULL REFERENCES project_object_types(id) ON DELETE CASCADE,
  is_new_object   boolean DEFAULT true,
  order_index     integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(lesson_id, object_type_id)
);

-- 4. Objetos reales escritos por el estudiante
CREATE TABLE IF NOT EXISTS project_objects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  object_type_id  uuid NOT NULL REFERENCES project_object_types(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         text DEFAULT '',
  status          text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'needs_revision')),
  word_count      integer DEFAULT 0,
  version         integer DEFAULT 1,
  feedback        text,
  score           numeric,
  submitted_at    timestamptz,
  reviewed_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(object_type_id, student_id)
);

-- 5. Solicitudes de re-edición (cuando edit_policy = 'requires_approval')
CREATE TABLE IF NOT EXISTS project_object_edit_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_object_id uuid NOT NULL REFERENCES project_objects(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  professor_note    text,
  created_at        timestamptz DEFAULT now(),
  resolved_at       timestamptz
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE projects                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_object_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_project_objects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_objects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_object_edit_requests ENABLE ROW LEVEL SECURITY;

-- PROJECTS
CREATE POLICY "Profesores gestionan sus proyectos"
  ON projects FOR ALL TO authenticated
  USING (professor_id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "Estudiantes ven proyectos de sus cursos"
  ON projects FOR SELECT TO authenticated
  USING (
    get_user_role() = 'student' AND
    is_active = true AND
    EXISTS (
      SELECT 1 FROM course_students
      WHERE course_id = projects.course_id AND student_id = auth.uid()
    )
  );

-- PROJECT_OBJECT_TYPES
CREATE POLICY "Profesores gestionan tipos de objeto"
  ON project_object_types FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_object_types.project_id
        AND (professor_id = auth.uid() OR get_user_role() = 'admin')
    )
  );

CREATE POLICY "Estudiantes ven tipos de objeto de sus proyectos"
  ON project_object_types FOR SELECT TO authenticated
  USING (
    get_user_role() = 'student' AND
    EXISTS (
      SELECT 1 FROM projects p
      JOIN course_students cs ON cs.course_id = p.course_id
      WHERE p.id = project_object_types.project_id
        AND cs.student_id = auth.uid()
        AND p.is_active = true
    )
  );

-- LESSON_PROJECT_OBJECTS
CREATE POLICY "Profesores gestionan mapeo lección-objeto"
  ON lesson_project_objects FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_object_types pot
      JOIN projects p ON p.id = pot.project_id
      WHERE pot.id = lesson_project_objects.object_type_id
        AND (p.professor_id = auth.uid() OR get_user_role() = 'admin')
    )
  );

CREATE POLICY "Estudiantes ven mapeo lección-objeto"
  ON lesson_project_objects FOR SELECT TO authenticated
  USING (
    get_user_role() = 'student' AND
    EXISTS (
      SELECT 1 FROM project_object_types pot
      JOIN projects p ON p.id = pot.project_id
      JOIN course_students cs ON cs.course_id = p.course_id
      WHERE pot.id = lesson_project_objects.object_type_id
        AND cs.student_id = auth.uid()
        AND p.is_active = true
    )
  );

-- PROJECT_OBJECTS
CREATE POLICY "Estudiantes gestionan sus propios objetos"
  ON project_objects FOR ALL TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Profesores ven objetos de sus proyectos"
  ON project_objects FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('professor', 'admin') AND
    EXISTS (
      SELECT 1 FROM project_object_types pot
      JOIN projects p ON p.id = pot.project_id
      WHERE pot.id = project_objects.object_type_id
        AND (p.professor_id = auth.uid() OR get_user_role() = 'admin')
    )
  );

CREATE POLICY "Profesores pueden actualizar objetos (feedback/score)"
  ON project_objects FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('professor', 'admin') AND
    EXISTS (
      SELECT 1 FROM project_object_types pot
      JOIN projects p ON p.id = pot.project_id
      WHERE pot.id = project_objects.object_type_id
        AND (p.professor_id = auth.uid() OR get_user_role() = 'admin')
    )
  );

-- PROJECT_OBJECT_EDIT_REQUESTS
CREATE POLICY "Estudiantes gestionan sus solicitudes"
  ON project_object_edit_requests FOR ALL TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Profesores ven y resuelven solicitudes de sus proyectos"
  ON project_object_edit_requests FOR ALL TO authenticated
  USING (
    get_user_role() IN ('professor', 'admin') AND
    EXISTS (
      SELECT 1 FROM project_objects po
      JOIN project_object_types pot ON pot.id = po.object_type_id
      JOIN projects p ON p.id = pot.project_id
      WHERE po.id = project_object_edit_requests.project_object_id
        AND (p.professor_id = auth.uid() OR get_user_role() = 'admin')
    )
  );

-- ============================================================
-- FUNCIÓN: updated_at automático para project_objects
-- ============================================================
CREATE OR REPLACE FUNCTION update_project_object_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_objects_updated_at
  BEFORE UPDATE ON project_objects
  FOR EACH ROW EXECUTE FUNCTION update_project_object_timestamp();

NOTIFY pgrst, 'reload_schema';
