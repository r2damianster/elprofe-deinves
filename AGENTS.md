# Agent Instructions

## Backend: Neon (no Supabase)

El backend de este proyecto es **Neon** (Postgres + Data API + Managed Better Auth + Object Storage + Neon Functions). Hasta 2026-09 era Supabase (otra cuenta, ya eliminada) — la migración fue completa, el proyecto **no tiene ninguna conexión activa a Supabase**. `supabase/migrations/*.sql` queda solo como referencia histórica del schema.

Ver `CLAUDE.md` (arquitectura, tablas, Neon Functions) y `.claude/troubleshooting/migration-001-supabase-to-neon.md` (detalle de la migración, gotchas) antes de tocar auth, storage o las funciones `neon-functions/*.ts`.

<!-- lean-ctx -->
## lean-ctx

Prefer lean-ctx MCP tools over native equivalents for token savings.
Full rules: @LEAN-CTX.md
<!-- /lean-ctx -->
