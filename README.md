# ElProfe de Inves — Plataforma Educativa Interactiva

Plataforma web para la Universidad Laica Eloy Alfaro de Manabí (ULEAM), diseñada para digitalizar y gamificar la enseñanza de las materias de investigación del profesor Arturo Rodríguez.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS + Lucide React |
| Backend | Supabase (PostgreSQL + PostgREST + Auth) |
| Seguridad | Row Level Security (RLS) por rol |

Roles: `admin`, `professor`, `student`

### Doble rol: profesor + administrador

Un usuario puede tener **rol de profesor y permisos de administrador simultáneamente**. Esto se logra mediante la columna `is_admin` en la tabla `profiles`:

```sql
-- Dar permisos de admin a un profesor existente
UPDATE profiles SET is_admin = true WHERE email = 'tu@email.com';
```

Cuando un usuario con `role = 'professor'` e `is_admin = true` inicia sesión, ve un **selector de vistas** que le permite alternar entre:
- **Vista Administrador**: gestionar profesores, diagnósticos de estudiantes, plataforma completa
- **Vista Profesor**: gestionar sus cursos, estudiantes, lecciones y producciones

Cada dashboard incluye un botón para cambiar de vista sin necesidad de cerrar sesión.

---

## Instalación

```bash
git clone https://github.com/r2damianster/elprofe-deinves.git
cd elprofe-deinves
npm install
```

Crea un archivo `.env` en la raíz:
```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

```bash
npm run dev
```

---

## Funcionalidades

### Panel del Profesor

**Cursos**
- Crear y gestionar cursos con descripción, idioma, horario y carrera
- Inscribir estudiantes al curso (búsqueda por nombre/email o SQL bulk)
- Asignar lecciones al curso completo o a grupos específicos

**Lecciones**
- Asignar/desasignar lecciones de un curso
- Cada lección tiene pasos de contenido (texto, slides, video) + actividades evaluativas
- **Editor Bilingüe Side-by-Side**: Interfaz a doble columna para diseñar contenido y rúbricas simultáneamente en Español e Inglés desde `ContentStudio`.

**Grupos y Agrupaciones**
- Crear agrupaciones nombradas e independientes por curso (una por dinámica/lección)
- Tres modos de creación:
  - **Aleatoria**: define tamaño, genera preview, confirma — distribución uniforme automática
  - **Por afinidad**: crea N grupos vacíos con inscripción abierta; los estudiantes eligen
  - **Manual**: el profesor arma los grupos miembro a miembro
- Mover estudiantes entre grupos con un clic
- Asignar una lección a toda la agrupación de golpe
- Control de inscripción abierta/cerrada y capacidad máxima por grupo

**Producciones escritas**
- Panel de revisión con filtros (pendiente / revisado / todos)
- Log forense de eventos de integridad (pegado, cambio de pestaña, etc.)
- Calificación 0-100 con feedback y opción de reintento

### Panel del Administrador

**Gestión de Profesores**
- Invitar nuevos profesores (crear cuenta con email + contraseña)
- Listar y eliminar profesores

**Diagnóstico de Estudiantes**
- Vista completa del estado de todos los estudiantes
- Detección automática de problemas:
  - Estudiante sin perfil en `profiles`
  - Estudiante sin inscripción en ningún curso
  - Curso sin lecciones asignadas
  - Estudiante sin lecciones asignadas (ni directo ni vía curso)
- Filtros por nombre/email y opción "solo con problemas"
- Resumen con contadores: total, sin problemas, con problemas, cursos con lecciones

### Panel del Estudiante

- **Lecciones:** `{ es: "Título en Español", en: "Title in English" }`
- **Actividades:** El objeto `content` completo ahora viene duplicado `{ es: { ...campos }, en: { ...campos } }`, permitiendo disparidad asimétrica de opciones o consignas entre idiomas si la adaptación pedagógica lo exige.
- **Transición de Producción Independiente:**
  En versiones anteriores, el motor de escritura (ensayos) era un bloque final al final de la lección leyendo de `production_rules`. Ahora, la **Producción Extensa** (Ensayo, Respuesta Larga, Abierta, etc.) es estructural e independientemente inyectable en cualquier parte del flujo como un paso natural dentro del carrusel, autoadministrando internamente el puntaje (compliance score), validando palabras mínimas, máximas, palabras obligatorias y palabras prohibidas según la configuración alojada en el `content` de dicha actividad.
- **Sistema de Categorización Nativo:**
  Para no alterar los esquemas migrados en la base de datos Supabase, toda meta-información y ontología (ej. Etiquetas y Palabras Clave o `tags`) se almacena como Arrays de texto (`string[]`) directamente inyectados en la columna `content` de tipo JSONB en `lessons` y `activities`.
- Producción escrita desbloqueada al superar el porcentaje mínimo configurado

**Grupos (tab "Mis Grupos")**
- Ver grupos abiertos de sus cursos con capacidad disponible
- Auto-inscripción en el grupo de preferencia (un grupo por curso)
- En modo grupal: la actividad completada por cualquier miembro cuenta para todo el grupo
- Badge "Completado por [nombre]" cuando un compañero ya terminó una actividad

---

## Tipos de actividad disponibles

| Tipo | Descripción |
|------|-------------|
| `multiple_choice` | Opción múltiple (también soporta V/F) |
| `matching` | Emparejar columnas |
| `fill_blank` | Completar espacios en blanco |
| `ordering` | Ordenar pasos o secuencias |
| `error_spotting` | Identificar errores en un texto |
| `category_sorting` | Clasificar ítems en categorías |
| `matrix_grid` | Seleccionar combinaciones en tabla |
| `short_answer` | Respuesta corta con palabras clave |
| `long_response` | Respuesta larga con mínimo de caracteres |
| `essay` | Ensayo libre con mínimo de palabras |
| `structured_essay` | Ensayo por secciones con rúbrica |

Las actividades de escritura (`long_response`, `essay`, `structured_essay`) incluyen:
- Barra de **compliance** en tiempo real (progreso hacia el mínimo requerido)
- Barra de **integridad** con detección de: pegado de texto, cambio de pestaña, clic derecho, atajos de teclado, redimensionado de ventana

---

## Estructura de la base de datos

```
courses
  └── course_students        (inscripción de estudiantes)
  └── lesson_assignments     (lecciones asignadas al curso o estudiante)
  └── group_sets             (agrupaciones nombradas)
        └── groups           (grupos dentro de una agrupación)
              └── group_members
              └── group_lesson_assignments
              └── group_progress
              └── group_activity_completions

lessons
  └── lesson_steps           (pasos: texto, slides, video)
  └── lesson_activities      (vinculación con actividades)
        └── activities       (banco central reutilizable)

productions                  (ensayos finales)
  └── production_rules       (reglas de compliance por lección)

student_progress             (progreso individual por lección)
profiles                     (usuarios: admin, professor, student, is_admin boolean)
```

### Migraciones aplicadas (en orden)

| Archivo | Contenido |
|---------|-----------|
| `20260401191649_create_educational_platform_schema.sql` | Schema base completo |
| `20260403010800_update_activities_schema.sql` | Actualización de tipos de actividad |
| `20260403014500_add_attempts_columns.sql` | Columnas de intentos |
| `20260403015500_add_metrics_columns.sql` | Columnas de métricas |
| `20260405120000_add_production_forensics.sql` | `integrity_events`, `time_on_task`, `extra_rules` |
| `20260405200000_add_group_lessons.sql` | Tablas de grupos y progreso grupal |
| `20260405210000_add_group_enrollment.sql` | `enrollment_open`, `max_members`, RLS auto-inscripción |
| `20260405220000_add_group_sets.sql` | Tabla `group_sets`, columna `group_set_id` en `groups` |
| `20260406100000_add_presentation_sessions.sql` | Sesiones de presentación en tiempo real |
| `20260407100000_add_course_language.sql` | Idioma en cursos (`language`) |
| `20260411100000_content_studio_professor_access.sql` | Content Studio: acceso de profesores a contenido |
| `20260412120000_add_admin_flag_to_profiles.sql` | Doble rol: `is_admin` en profiles + función `get_user_role()` |

---

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [`.claude/docs/architecture/activity-jsonb-spec.md`](./.claude/docs/architecture/activity-jsonb-spec.md) | Especificación JSONB de todos los tipos de actividad (formato bilingüe actual) |
| [`.claude/docs/architecture/lesson-jsonb-spec.md`](./.claude/docs/architecture/lesson-jsonb-spec.md) | Especificación JSONB de lecciones y sincronización con lesson_activities |
| [`.claude/contexts/database/schema.sql`](./.claude/contexts/database/schema.sql) | Esquema SQL completo con 18 tablas y 9 consultas de diagnóstico |
| [`.claude/docs/architecture/conventions.md`](./.claude/docs/architecture/conventions.md) | Convenciones de código, estilos, TypeScript y comandos |
