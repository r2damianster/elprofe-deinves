-- ============================================================
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- Aplica migraciones pendientes y agrega URLs de slides
-- ============================================================

-- 1. MIGRACIONES PENDIENTES
-- ============================================================

-- Tipos de actividad adicionales
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'fill_blank';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'true_false';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'matching';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'ordering';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'image_question';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'listening';

-- Columna media_url en activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS media_url text;

-- Tabla puente lesson_activities
CREATE TABLE IF NOT EXISTS lesson_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lesson_id, activity_id)
);
ALTER TABLE lesson_activities ENABLE ROW LEVEL SECURITY;

-- RLS lesson_activities
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('activities', 'lesson_activities')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

CREATE POLICY "Permitir lectura general activities" ON activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir control a admin en activities" ON activities FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "Permitir lectura lesson_activities" ON lesson_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir control a admin lesson_activities" ON lesson_activities FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Columna attempts
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS attempts int DEFAULT 1;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS attempts int DEFAULT 1;

-- Métricas de producción
ALTER TABLE productions ADD COLUMN IF NOT EXISTS compliance_score int DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS integrity_score int DEFAULT 100;

-- Recargar esquema PostgREST
NOTIFY pgrst, 'reload_schema';


-- 2. AGREGAR URLs DE SLIDES A LA LECCIÓN
-- ============================================================
-- Actualiza los pasos CONTENT de la lección "Socialización Sílabo"
-- para incrustar los Google Slides correspondientes.

DO $$
DECLARE
  lesson_row RECORD;
  steps jsonb;
  updated_steps jsonb;
  step jsonb;
  i int;
BEGIN
  -- Encontrar la lección de Socialización Sílabo
  SELECT id, content INTO lesson_row
  FROM lessons
  WHERE title ILIKE '%Socialización%Sílabo%' OR title ILIKE '%Socializacion%Silabo%'
  LIMIT 1;

  IF lesson_row.id IS NULL THEN
    RAISE NOTICE 'Lección Socialización Sílabo no encontrada';
    RETURN;
  END IF;

  steps := lesson_row.content -> 'steps';
  updated_steps := '[]'::jsonb;

  FOR i IN 0 .. jsonb_array_length(steps) - 1 LOOP
    step := steps -> i;

    -- Paso de Socialización del Sílabo (primer paso o el que tenga ese título)
    IF (step->>'title') ILIKE '%Socialización%Sílabo%' OR (step->>'title') ILIKE '%Silabo%' OR (step->>'title') ILIKE '%Sílabo%' THEN
      step := step || jsonb_build_object('url', 'https://docs.google.com/presentation/d/1e_Sa3tVL5t1cFPNQmjFDSuurQHBSdITH4Nl8dn7S6PA/embed?start=false&loop=false&delayms=3000');
      RAISE NOTICE 'Actualizado paso % con slide Sílabo', i;

    -- Paso de Lineamientos de Evaluación
    ELSIF (step->>'title') ILIKE '%Lineamiento%' OR (step->>'title') ILIKE '%Evaluación%' THEN
      step := step || jsonb_build_object('url', 'https://docs.google.com/presentation/d/1uUSSqPaG5aWtPuAUdj8mFg9d0jx5AS_13v6ge-XK2S4/embed?start=false&loop=false&delayms=3000');
      RAISE NOTICE 'Actualizado paso % con slide Lineamientos', i;
    END IF;

    updated_steps := updated_steps || jsonb_build_array(step);
  END LOOP;

  UPDATE lessons
  SET content = jsonb_set(lesson_row.content, '{steps}', updated_steps)
  WHERE id = lesson_row.id;

  RAISE NOTICE 'Lección % actualizada correctamente', lesson_row.id;
END $$;

-- Verificar resultado
SELECT id, title, jsonb_array_length(content->'steps') as total_steps
FROM lessons
WHERE title ILIKE '%Socialización%' OR title ILIKE '%Lineamiento%';
