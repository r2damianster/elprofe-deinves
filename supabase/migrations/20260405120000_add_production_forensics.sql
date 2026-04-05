-- Enfoque A: log forense de eventos de integridad
ALTER TABLE productions ADD COLUMN IF NOT EXISTS integrity_events jsonb DEFAULT '[]'::jsonb;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS time_on_task int DEFAULT 0;

-- Enfoque B: reglas de compliance extendidas
ALTER TABLE production_rules ADD COLUMN IF NOT EXISTS extra_rules jsonb DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload_schema';
