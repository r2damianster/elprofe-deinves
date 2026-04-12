-- Agrega campo is_active a group_sets para activar/desactivar agrupaciones
ALTER TABLE group_sets
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Comentario descriptivo
COMMENT ON COLUMN group_sets.is_active IS
  'Cuando es false la agrupación está archivada: el profesor la ve pero los estudiantes no la usan en modo grupal.';
