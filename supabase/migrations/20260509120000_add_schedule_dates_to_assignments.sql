-- ============================================================
-- Agrega ventanas de disponibilidad a las junction tables de recursos
-- Patrón uniforme: available_from / available_until / order_index
-- Aplica a: lesson_assignments, project_assignments
-- Recursos futuros (simulaciones, etc.) deben seguir el mismo patrón.
-- ============================================================

-- lesson_assignments
ALTER TABLE public.lesson_assignments
  ADD COLUMN IF NOT EXISTS available_from  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS available_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS order_index     integer     NOT NULL DEFAULT 0;

-- project_assignments (tabla existente creada sin migración previa)
-- Backfill: registrar la tabla en migrations para trazabilidad
ALTER TABLE public.project_assignments
  ADD COLUMN IF NOT EXISTS available_from  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS available_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS order_index     integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_by     uuid        REFERENCES public.profiles(id);

-- RLS para project_assignments (si no existe, la tabla fue creada sin políticas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_assignments' AND schemaname = 'public'
  ) THEN
    ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

    EXECUTE $policy$
      CREATE POLICY "Profesores gestionan sus asignaciones de proyecto"
      ON public.project_assignments FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = project_assignments.project_id
            AND (p.professor_id = auth.uid() OR get_user_role() = 'admin')
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "Estudiantes ven asignaciones de sus cursos"
      ON public.project_assignments FOR SELECT TO authenticated
      USING (
        get_user_role() = 'student' AND (
          student_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.course_students cs
            WHERE cs.course_id = project_assignments.course_id
              AND cs.student_id = auth.uid()
          )
        ) AND (
          available_from IS NULL OR available_from <= now()
        ) AND (
          available_until IS NULL OR available_until >= now()
        )
      )
    $policy$;
  END IF;
END $$;

NOTIFY pgrst, 'reload_schema';
