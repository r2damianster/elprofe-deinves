-- Migration: convert activities.title from TEXT to JSONB (multilingual support)
-- Bug-002: title was stored as TEXT causing double-nested JSON on repeated saves

-- Step 1: Clean double-nested contamination like {"es":"{\"en\":\"...\",\"es\":\"...\"}"}
-- These are records where the 'es' value is itself a JSON string
UPDATE activities
SET title = (title::jsonb->'es')::text::jsonb
WHERE title::jsonb ? 'es'
  AND (title::jsonb->>'es') LIKE '{%';

-- Step 2: Convert TEXT → JSONB
-- Cast title::text explicitly inside USING to avoid the "operator does not exist: jsonb ~~ unknown" error
-- (PostgreSQL evaluates USING with the target type in scope)
ALTER TABLE activities
  ALTER COLUMN title TYPE jsonb
  USING CASE
    WHEN title::text LIKE '{%'
      THEN title::text::jsonb
    ELSE jsonb_build_object('es', title::text, 'en', '')
  END;
