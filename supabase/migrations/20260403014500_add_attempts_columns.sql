-- Agregar columna attempts a student_progress
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS attempts int DEFAULT 1;

-- Agregar columna attempts a productions
ALTER TABLE productions ADD COLUMN IF NOT EXISTS attempts int DEFAULT 1;

-- Asegurarse de que el cache de Supabase toma los cambios
NOTIFY pgrst, reload_schema;
