ALTER TABLE production_rules
  ADD COLUMN IF NOT EXISTS example_text jsonb;
