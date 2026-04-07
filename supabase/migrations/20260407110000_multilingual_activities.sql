-- Migración: convertir activities.content a formato multilingüe {es: {...}, en: {...}}
-- Solo afecta actividades que aún no tienen el formato multilingual

-- Paso 1: todas las actividades → {es: <contenido actual>, en: {}}
UPDATE activities
SET content = jsonb_build_object('es', content, 'en', '{}'::jsonb)
WHERE NOT (content ? 'es' OR content ? 'en');

-- Paso 2: actividades conocidas en inglés → {es: {}, en: <contenido actual>}
-- (el contenido actual ya quedó bajo la clave 'es' en el paso anterior, lo movemos a 'en')
UPDATE activities
SET content = jsonb_build_object('en', content->'es', 'es', '{}'::jsonb)
WHERE id IN (
  '61e45218-0bfa-4a67-8f9e-be19572a61dc',  -- Academic Workload / Carga Horaria
  'f032fac3-942d-4fcc-aea1-f4fd85ac3a70',  -- Grading System / Sistema de Calificación
  'f221abc2-cffd-40fc-a634-28f0d4f5a30e',  -- Learning Units / Unidades
  'f677c051-0870-40e0-836c-6a0b75781dca'   -- Digital Tools / Herramientas Digitales
);
