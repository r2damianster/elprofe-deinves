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

## Arquitectura general

Plataforma educativa para ULEAM. SPA React con Supabase como backend completo (PostgreSQL + Auth + Realtime + Edge Functions).

**Roles:** `admin` | `professor` | `student`. Un usuario con `profiles.is_admin = true` puede alternar entre admin y profesor sin reautenticarse (lógica en `App.tsx` → `DashboardSelector`).

**Flujo de autenticación:** `AuthContext` → `useAuth()` → `profile.role` determina qué dashboard renderiza `App.tsx`. No hay router de páginas: todo es condicional en un único árbol React.

## Estructura de componentes

```
src/components/
├── admin/          # AdminDashboard, StudentDiagnosticPage
├── professor/
│   ├── studio/     # ContentStudio, LessonEditor, ActivityBank, ActivityEditor, TagInput, MediaUploader
│   └── ...         # CourseManager, GroupManager, ProductionReviewer, PresentationController
└── student/
    ├── activities/ # 14 componentes, uno por tipo de actividad
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

### Guardado en Supabase
El cliente está en `src/lib/supabase.ts`. Usar siempre el cliente tipado. Para operaciones que rompen los tipos generados (e.g. `integrity_events` como `Json`), usar `as unknown as Json`.

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

RLS activo en todas las tablas. Los profesores solo ven sus cursos; los estudiantes solo sus datos.

## Edge Function: ai-enhance

`supabase/functions/ai-enhance/index.ts` — proxy hacia GROQ (llama-3.3-70b-versatile). Clave en el secret `GROQ_URL` del proyecto Supabase. `verify_jwt: false`.

Tasks disponibles: `improve_title`, `improve_description`, `improve_instructions`, `generate_activity_options`, `suggest_required_words`, `review_production`, `translate`, `suggest_rubric`, `batch_grade`, `complete_activity`.

Las tasks que devuelven JSON usan `response_format: {type: 'json_object'}` + strip de bloques markdown como fallback. Si una task JSON falla el parse devuelve HTTP 502 con `{error, raw}`.

Llamada desde frontend:
```typescript
const { data, error } = await supabase.functions.invoke('ai-enhance', {
  body: { task: 'complete_activity', lang: 'es', data: { type, content_es } }
});
// data.result contiene el objeto parseado
```

## Flujos no obvios

**Desbloqueo de producción:** `LessonViewer` calcula `completionPercentage` sobre las actividades completadas. La producción solo aparece cuando ese porcentaje supera `lesson.production_unlock_percentage`.

**Producción grupal:** `group_production_locks` registra quién envió primero. Los demás miembros ven el ensayo del primero como referencia y no pueden enviar el propio.

**Presentación en vivo:** `PresentationController` (profesor) escribe `current_step_index` en `presentation_sessions`. `PresentationViewer` (estudiante) escucha por Supabase Realtime y navega automáticamente.

**Doble registro de actividades:** Cuando se vincula una actividad a una lección se escribe en `lesson_activities` Y en el campo `content` JSONB de `lessons`. Deben mantenerse sincronizados.

## Archivos de contexto internos

`.claude/` contiene documentación de arquitectura, specs JSONB por tipo de actividad, roadmap de features y agentes especializados. Consultarlos antes de modificar estructuras de datos o crear nuevos tipos de actividad.
