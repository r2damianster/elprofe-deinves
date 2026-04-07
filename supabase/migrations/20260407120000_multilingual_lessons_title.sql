-- Migración: convertir lessons.title y lessons.description a formato multilingüe {es, en}

-- Paso 1: title text → jsonb
ALTER TABLE lessons
  ALTER COLUMN title TYPE jsonb
  USING jsonb_build_object('es', title, 'en', '');

-- Paso 2: description text → jsonb
ALTER TABLE lessons
  ALTER COLUMN description TYPE jsonb
  USING jsonb_build_object('es', COALESCE(description::text, ''), 'en', '');

-- Paso 3: lección conocida en inglés → mover contenido a clave 'en'
UPDATE lessons SET
  title       = jsonb_build_object('en', title->>'es',       'es', ''),
  description = jsonb_build_object('en', description->>'es', 'es', '')
WHERE id = '42abcb0d-281a-46f8-bd9f-8eb5401d19e0';
