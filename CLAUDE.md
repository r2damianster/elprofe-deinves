# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Servidor de desarrollo (Vite)
npm run build        # Build de producción
npm run typecheck    # Verificar TypeScript sin compilar (tsc --noEmit)
npm run lint         # ESLint
npm run preview      # Preview del build de producción
```

No hay tests automatizados. La verificación es manual en el navegador + `typecheck` para errores de tipos.

## lean-ctx — Optimización de contexto

Este proyecto usa [lean-ctx](https://leanctx.com) para comprimir tokens en las sesiones de Claude Code (ahorro 60-99%).

**Reglas de preferencia:** ver `.claude/lean-ctx.md` — resumen: preferir `ctx_read`, `ctx_shell`, `ctx_search`, `ctx_tree` sobre los equivalentes nativos cuando lean-ctx esté disponible.

### Reglas críticas para este proyecto

```
# Al inicio de cada sesión:
ctx_overview(task="<descripción>")   # mapa filtrado ~500 tok vs ~50K

# Leer archivos (NO usar Read nativo salvo que Edit lo requiera):
ctx_read(path, mode="map")           # para entender estructura — 85-95% ahorro
ctx_read(path, mode="lines:N-M")     # antes de Edit, solo las líneas relevantes
ctx_read(path, mode="full")          # solo si vas a editar el archivo completo

# TypeScript — NUNCA correr tsc sin filtro:
ctx_shell("npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep 'error TS' | grep -v 'node_modules' | head -30")

# Git y npm — siempre via ctx_shell:
ctx_shell("git status")
ctx_shell("git diff --stat")
ctx_shell("npm install")
```

> Los errores TypeScript preexistentes son ~150 líneas de ruido — siempre filtrar con `grep -v 'node_modules' | head -30`.

**Estado:** lean-ctx instalado en `AppData\Roaming\npm\lean-ctx.exe`. Hooks activos. Los hooks de Claude Code se activan con:

```bash
# 1. Instalar el binario (una sola vez, sin necesidad de Rust)
npm install -g lean-ctx-bin

# 2. Verificar instalación
lean-ctx doctor

# 3. Activar hooks para Claude Code en este proyecto
lean-ctx init --agent claude

# 4. Ver ahorros en tiempo real
lean-ctx gain --live
```

El código fuente de lean-ctx está en `C:\Users\User\Downloads\lean-ctx-main\` y NO forma parte de este repositorio.

## Arquitectura general

Plataforma educativa para ULEAM. SPA React con **Neon** como backend completo (Postgres + Data API + Managed Better Auth + Object Storage + Neon Functions).

> **Historial:** hasta 2026-09 el backend era Supabase (proyecto en otra cuenta, ya dada de baja). Se migró por completo a Neon — schema, RLS, datos reales, Auth, Storage y las Edge Functions. El proyecto **ya no está conectado a Supabase de ninguna forma**; `supabase/migrations/*.sql` queda solo como referencia histórica del schema, no se aplica a nada. Detalle completo de la migración en `.claude/troubleshooting/` (buscar el hilo de migración Supabase→Neon) y en la memoria del proyecto.

**Roles:** `admin` | `professor` | `student`. Un usuario con `profiles.is_admin = true` puede alternar entre admin y profesor sin reautenticarse (lógica en `App.tsx` → `DashboardSelector`).

**Flujo de autenticación:** `AuthContext` → `useAuth()` → `profile.role` determina qué dashboard renderiza `App.tsx`. No hay router de páginas: todo es condicional en un único árbol React.

## Estructura de componentes

```
src/components/
├── admin/          # AdminDashboard, StudentDiagnosticPage
├── professor/      # ProfessorDashboard (4 tabs: Cursos, Asignaciones, Evaluaciones, Studio)
│   ├── studio/     # ContentStudio, LessonEditor, ActivityBank, ActivityEditor, TagInput, MediaUploader
│   ├── Asignaciones.tsx, Evaluaciones.tsx, StudioPanel.tsx  # wrappers de cada tab
│   ├── ProjectManager, ProjectObjectTypesEditor, ProjectLessonMapper, ProjectAssignmentsEditor
│   ├── ProjectReviewer, ProjectAssignment, CourseProjectsManager
│   └── ...         # CourseManager, CourseDetails, GroupManager, ProductionReviewer, PresentationController
└── student/
    ├── activities/ # 16 componentes, uno por tipo de actividad
    ├── ProjectDashboard, ProjectObjectList, ProjectObjectWriter, ProjectPresentation
    └── ...         # LessonViewer, ActivityRenderer, ProductionEditor, StudentResults
```

`ActivityRenderer` despacha al componente correcto según `activity.type`. Cada componente de actividad recibe `content`, `onAnswer(isCorrect)` y `disabled`.

## Convenciones críticas

### Multilingüismo JSONB
Títulos, descripciones e instrucciones se guardan como `{es: "...", en: "..."}` en columnas JSONB. Usar siempre `resolveField(field, lang)` de `src/lib/i18n.ts` para leerlos — nunca acceder directamente. Acepta objetos `{es,en}`, strings planos y JSON serializado como string.

### Tipos de actividad
`src/lib/database.types.ts` define `ActivityType` (16 valores). `src/lib/activityTypes.ts` expone `isProduction(type): boolean` para identificar actividades de producción escrita (`essay`, `long_response`, `structured_essay`, `open_writing`).

### Contenido de actividades
El campo `activities.content` es JSONB con estructura `{es: {...}, en: {...}}`. La forma interna varía por tipo. Cada tipo tiene su sub-formulario en `ActivityEditor.tsx` y su renderer en `src/components/student/activities/`.

### Guardado en Neon
El cliente está en `src/lib/supabase.ts` (nombre histórico, mantenido para no tocar el import en ~20 archivos) — internamente es un cliente `@neondatabase/neon-js` apuntando al Data API de Neon, con API compatible con `supabase-js` (`.from().select()/.insert()/...`, `.auth.signIn/signUp/getSession`). Usar siempre el cliente tipado. Para operaciones que rompen los tipos generados (e.g. `integrity_events` como `Json`), usar `as unknown as Json`.

## Tablas clave de la BD

| Tabla | Propósito |
|---|---|
| `profiles` | Usuarios con `role` + `is_admin` |
| `courses` | Cursos del profesor |
| `lessons` | Lecciones con `content[]` (pasos), `has_production`, `production_unlock_percentage` |
| `activities` | Banco global de actividades con `type`, `content{es,en}`, `tags[]`, `description`, `description_en`, `difficulty` |
| `lesson_activities` | Vinculación lección↔actividad con `order_index` |
| `lesson_courses` | Asignación lección→curso |
| `productions` | Producciones escritas con `status` (`draft/submitted/reviewed`), `score`, `feedback`, `integrity_events`, `compliance_score` |
| `group_sets` | Agrupaciones (contiene varios `groups`) |
| `group_production_locks` | Lock al primer envío en producción grupal |
| `presentation_sessions` | Estado de presentación en vivo (sincronizado por Realtime) |
| `projects` | Proyectos de investigación/escritura con `object_logic` (ordinal/causal/structural) |
| `project_object_types` | Secciones/tipos de objeto del proyecto (templates definidos por el profesor) |
| `lesson_project_objects` | Mapeo lección → tipos de objeto que se trabajan en esa lección |
| `project_objects` | Objetos reales escritos por el estudiante (con `status`, `version`, `score`) |
| `project_object_edit_requests` | Solicitudes de re-edición cuando `edit_policy = 'requires_approval'` |

RLS activo en todas las tablas. Los profesores solo ven sus cursos; los estudiantes solo sus datos.

## Neon Functions

Dos funciones desplegadas en el branch de Neon (`aienhance`, `mediaupload`), fuente en `neon-functions/*.ts`, declaradas en `neon.ts`. Deploy vía `neon deploy`/`neon functions deploy` (CLI, requiere `neon link` interactivo) o directo por el MCP de Neon (`deploy_function`, bundle propio con esbuild — ver `.claude/troubleshooting/migration-001-supabase-to-neon.md` para el procedimiento exacto).

### `aienhance` — proxy GROQ

`neon-functions/ai-enhance.ts` — proxy hacia GROQ (`openai/gpt-oss-120b`). Clave en la env var `GROQ_URL` de la función.

Tasks disponibles: `improve_title`, `improve_description`, `improve_instructions`, `generate_activity_options`, `suggest_required_words`, `review_production`, `translate`, `suggest_rubric`, `batch_grade`, `complete_activity`, `suggest_tags`, `improve_rubric`, `generate_example`, `review_essay`.

Las tasks que devuelven JSON usan `response_format: {type: 'json_object'}` + strip de bloques markdown como fallback. Si una task JSON falla el parse devuelve HTTP 502 con `{error, raw}`.

Llamada desde frontend — siempre vía el helper `callAiEnhance` (`src/lib/aiEnhance.ts`), nunca `fetch` directo:
```typescript
import { callAiEnhance } from '../../lib/aiEnhance';
const result = await callAiEnhance('complete_activity', 'es', { type, content_es });
// result ya viene parseado (objeto o string según la task)
```

### `mediaupload` — subida a Object Storage

`neon-functions/media-upload.ts` — valida rol (admin/professor) contra el Data API con el JWT del caller, y devuelve una URL S3 presignada (SigV4 hecho a mano, sin SDK de AWS) para subir directo al bucket `lesson-media` desde el navegador. Usado por `MediaUploader.tsx`. Env var `VITE_NEON_MEDIA_UPLOAD_URL` en el frontend.

## Flujos no obvios

**Desbloqueo de producción:** `LessonViewer` calcula `completionPercentage` sobre las actividades completadas. La producción solo aparece cuando ese porcentaje supera `lesson.production_unlock_percentage`.

**Producción grupal:** `group_production_locks` registra quién envió primero. Los demás miembros ven el ensayo del primero como referencia y no pueden enviar el propio.

**Presentación en vivo:** `PresentationController` (profesor) escribe `current_step_index` en `presentation_sessions`. `PresentationViewer` (estudiante) hace polling cada 3s sobre esa fila y navega automáticamente (Neon no tiene Realtime nativo; antes era una suscripción `postgres_changes` de Supabase).

**Doble registro de actividades:** Cuando se vincula una actividad a una lección se escribe en `lesson_activities` Y en el campo `content` JSONB de `lessons`. Deben mantenerse sincronizados.

## Archivos de contexto internos

`.claude/` contiene documentación de arquitectura, specs JSONB por tipo de actividad, roadmap de features y agentes especializados. Consultarlos antes de modificar estructuras de datos o crear nuevos tipos de actividad.
