-- Añadir campo de idioma a cursos
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS language varchar(5) NOT NULL DEFAULT 'es';

-- Asegurarse de que solo se acepten idiomas válidos
ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_language_check;

ALTER TABLE courses
  ADD CONSTRAINT courses_language_check CHECK (language IN ('es', 'en'));
