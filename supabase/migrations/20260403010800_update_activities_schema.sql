-- 1. Ampliar el ENUM activity_type con los formatos faltantes
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'fill_blank';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'true_false';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'matching';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'ordering';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'image_question';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'listening';

-- 2. Modificar la tabla activities (añadir media_url y quitar dependencia directa de lesson)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS media_url text;

-- Borramos la relación forzada uno-a-uno con lessons
ALTER TABLE activities DROP COLUMN IF EXISTS lesson_id CASCADE;
ALTER TABLE activities DROP COLUMN IF EXISTS order_index CASCADE;

-- 3. Crear la tabla puente (Many-to-Many) lesson_activities
CREATE TABLE IF NOT EXISTS lesson_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lesson_id, activity_id)
);

ALTER TABLE lesson_activities ENABLE ROW LEVEL SECURITY;

-- 4. Limpiar RLS en actividades y añadir las nuevas políticas seguras (sin bucles)
DO $$ 
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('activities', 'lesson_activities')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Todo usuario (incluido estudiante) puede acceder al catálogo de actividades (solo SELECT)
CREATE POLICY "Permitir lectura general activities" ON activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir control a admin en activities" ON activities FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Todo usuario puede ver la relación leccion-actividad
CREATE POLICY "Permitir lectura lesson_activities" ON lesson_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir control a admin lesson_activities" ON lesson_activities FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
