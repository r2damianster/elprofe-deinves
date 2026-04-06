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
- Crear y gestionar cursos con descripción, horario y carrera
- Inscribir estudiantes al curso (búsqueda por nombre/email o SQL bulk)
- Asignar lecciones al curso completo o a grupos específicos

**Lecciones**
- Asignar/desasignar lecciones de un curso
- Cada lección tiene pasos de contenido (texto, slides, video) + actividades evaluativas

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

### Panel del Estudiante

**Lecciones**
- Carrusel de pasos: texto + slides de Google embebidos + actividades
- 11 tipos de actividades (ver abajo)
- Progreso guardado por paso; porcentaje de completación en tiempo real
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
profiles                     (usuarios: admin, professor, student)
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

---

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [`docs/actividades-json.md`](./docs/actividades-json.md) | Referencia técnica de todos los tipos de actividad con ejemplos JSON y SQL |
| [`docs/gemini-gem-prompt.md`](./docs/gemini-gem-prompt.md) | Prompt para la Gem de Google Gemini que genera actividades automáticamente desde materiales de clase |

---

## Crear actividades con IA

La carpeta `docs/` incluye el prompt para configurar una **Gem de Google Gemini** que, dado un Google Slide, PDF o texto, propone actividades pedagógicas y genera el JSON listo para insertar en Supabase. Ver [`docs/gemini-gem-prompt.md`](./docs/gemini-gem-prompt.md).
