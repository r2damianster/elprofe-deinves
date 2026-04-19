-- ============================================================
-- Fix: RLS policies for production_rules and productions
-- Causa: Las migraciones nunca se aplicaron al remote via db push.
-- Las políticas se crearon manualmente en el dashboard de Supabase.
-- Este archivo documenta el estado actual confirmado en producción.
-- ============================================================

-- production_rules: permitir lectura a todos los usuarios autenticados
CREATE POLICY IF NOT EXISTS "Students can view production rules"
  ON production_rules FOR SELECT
  TO authenticated
  USING (true);

-- productions: estudiantes gestionan sus propias producciones
CREATE POLICY IF NOT EXISTS "Students manage own productions"
  ON productions FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- productions: profesores y admins pueden leer todas las producciones
CREATE POLICY IF NOT EXISTS "Professors view productions of their lessons"
  ON productions FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('professor', 'admin')
  );

-- productions: profesores y admins pueden actualizar (score, feedback, status)
CREATE POLICY IF NOT EXISTS "Professors update productions"
  ON productions FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('professor', 'admin')
  );
