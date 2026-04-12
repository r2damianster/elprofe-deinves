-- ============================================================
-- Content Studio: Acceso del profesor para crear contenido
-- ============================================================
-- 1. Agregar created_by a activities (banco por profesor)
-- 2. Dar permisos INSERT/UPDATE/DELETE a profesores en:
--    lessons, activities, lesson_activities, production_rules
-- 3. Crear bucket lesson-media en Storage (manual — ver nota)
-- ============================================================

-- 1. Columna created_by en activities
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Poblar created_by con los datos existentes (quedará null para actividades antiguas — eso es OK)
-- Las nuevas actividades siempre tendrán created_by del profesor que las crea.

-- ============================================================
-- 2. RLS: Profesores gestionan sus propias LECCIONES
-- ============================================================

-- Eliminar restricción de solo-admin en lecciones
DROP POLICY IF EXISTS "Admins can insert lessons" ON lessons;
DROP POLICY IF EXISTS "Admins can update lessons" ON lessons;
DROP POLICY IF EXISTS "Admins can delete lessons" ON lessons;

-- Profesores crean sus propias lecciones
CREATE POLICY "Professors can insert own lessons"
  ON lessons FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('admin', 'professor')
    AND (created_by = auth.uid() OR public.get_user_role() = 'admin')
  );

-- Profesores editan solo sus propias lecciones
CREATE POLICY "Professors can update own lessons"
  ON lessons FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'professor' AND created_by = auth.uid())
  );

-- Profesores eliminan solo sus propias lecciones (solo si no tienen estudiantes con progreso)
CREATE POLICY "Professors can delete own lessons"
  ON lessons FOR DELETE
  TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (
      public.get_user_role() = 'professor'
      AND created_by = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM student_progress WHERE lesson_id = lessons.id
      )
    )
  );

-- ============================================================
-- 3. RLS: Profesores gestionan sus propias ACTIVIDADES
-- ============================================================

DROP POLICY IF EXISTS "Permitir control a admin en activities" ON activities;

-- Admin sigue teniendo control total
CREATE POLICY "Admin full control activities"
  ON activities FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Profesores crean actividades propias
CREATE POLICY "Professors can insert own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() = 'professor'
    AND created_by = auth.uid()
  );

-- Profesores editan sus propias actividades
CREATE POLICY "Professors can update own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND created_by = auth.uid()
  );

-- Profesores eliminan sus propias actividades (solo si no tienen respuestas de estudiantes)
CREATE POLICY "Professors can delete own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM activity_responses WHERE activity_id = activities.id
    )
  );

-- ============================================================
-- 4. RLS: Profesores gestionan LESSON_ACTIVITIES de sus lecciones
-- ============================================================

DROP POLICY IF EXISTS "Permitir control a admin lesson_activities" ON lesson_activities;

CREATE POLICY "Admin full control lesson_activities"
  ON lesson_activities FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Professors manage their lesson_activities"
  ON lesson_activities FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_activities.lesson_id
      AND lessons.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_activities.lesson_id
      AND lessons.created_by = auth.uid()
    )
  );

-- ============================================================
-- 5. RLS: Profesores gestionan PRODUCTION_RULES de sus lecciones
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage production rules" ON production_rules;

CREATE POLICY "Admin full control production_rules"
  ON production_rules FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Professors manage their production_rules"
  ON production_rules FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = production_rules.lesson_id
      AND lessons.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'professor'
    AND EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = production_rules.lesson_id
      AND lessons.created_by = auth.uid()
    )
  );

-- ============================================================
-- NOTA: Supabase Storage — bucket "lesson-media"
-- Crear manualmente en Supabase Dashboard:
--   Storage → New bucket → nombre: "lesson-media" → Public: true
-- O ejecutar esto en el SQL Editor (requiere extensión pg_net o via dashboard):
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-media',
  'lesson-media',
  true,
  52428800, -- 50MB max por archivo
  ARRAY['image/jpeg','image/png','image/gif','image/webp','audio/mpeg','audio/wav','audio/ogg','video/mp4','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS para storage bucket lesson-media
CREATE POLICY "Profesores suben archivos a lesson-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-media'
    AND public.get_user_role() IN ('admin', 'professor')
  );

CREATE POLICY "Lectura pública de lesson-media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lesson-media');

CREATE POLICY "Profesores eliminan sus archivos de lesson-media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-media'
    AND public.get_user_role() IN ('admin', 'professor')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
