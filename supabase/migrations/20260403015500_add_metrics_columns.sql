-- Añadir metricas al ensayo final
ALTER TABLE productions ADD COLUMN IF NOT EXISTS compliance_score int DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS integrity_score int DEFAULT 100;

-- Asegurarse de que el cache de Supabase toma los cambios
NOTIFY pgrst, reload_schema;
