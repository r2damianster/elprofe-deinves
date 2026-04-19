# Esquema de Base de Datos Supabase

## Tablas Principales

### profiles
Perfiles de usuarios unificados (admin/professor/student)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK, vinculado a auth.users |
| email | text | Correo único |
| full_name | text | Nombre completo |
| role | enum | 'admin' | 'professor' | 'student' |
| is_admin | boolean | Flag adicional para rol admin |
| created_at | timestamptz | Fecha de creación |
| updated_at | timestamptz | Última actualización |

### courses
Cursos creados por profesores

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| name | text | Nombre del curso |
| description | text | Descripción opcional |
| professor_id | uuid | FK → profiles |
| language | text | Idioma del curso (es/en) |
| created_at | timestamptz | Fecha de creación |

### course_students
Relación muchos-a-muchos: cursos ↔ estudiantes

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| course_id | uuid | FK → courses |
| student_id | uuid | FK → profiles |
| enrolled_at | timestamptz | Fecha de inscripción |

### groups
Grupos dentro de un curso

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| course_id | uuid | FK → courses |
| group_set_id | uuid | FK → group_sets (agrupación) |
| name | text | Nombre del grupo |
| created_at | timestamptz | Fecha de creación |

### group_sets
Conjuntos de grupos (agrupaciones)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| course_id | uuid | FK → courses |
| name | text | Nombre de la agrupación |
| is_active | boolean | Activa/inactiva |
| created_at | timestamptz | Fecha de creación |

### lessons
Lecciones bilingües con contenido en JSONB

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| title | jsonb | { es: string, en: string } |
| description | jsonb | { es: string, en: string } |
| content | jsonb | Array de pasos (ver spec) |
| has_production | boolean | ¿Tiene producción final? |
| production_unlock_percentage | int2 | % mínimo para desbloquear |
| order_index | int4 | Orden en el curso |
| created_by | uuid | FK → profiles |
| created_at | timestamptz | Fecha de creación |

### activities
Actividades reutilizables en JSONB

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| type | activity_type | Tipo de actividad (13 tipos) |
| title | jsonb | Título/instrucción bilingüe |
| content | jsonb | Contenido específico por tipo |
| points | int4 | Puntos al completar |
| media_url | text | URL de imagen/audio opcional |
| created_by | uuid | FK → profiles |
| created_at | timestamptz | Fecha de creación |

### lesson_activities
Tabla puente: lecciones ↔ actividades

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| lesson_id | uuid | FK → lessons |
| activity_id | uuid | FK → activities |
| order_index | int4 | Orden dentro de la lección |
| created_at | timestamptz | Fecha de creación |

### lesson_assignments
Asignaciones de lecciones

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| lesson_id | uuid | FK → lessons |
| course_id | uuid | FK → courses (o null) |
| student_id | uuid | FK → profiles (o null) |
| assigned_by | uuid | FK → profiles |
| assigned_at | timestamptz | Fecha de asignación |

### student_progress
Progreso del estudiante en lecciones

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| student_id | uuid | FK → profiles |
| lesson_id | uuid | FK → lessons |
| completion_percentage | int4 | % completado (0-100) |
| attempts | int4 | Número de intentos |
| started_at | timestamptz | Inicio de la lección |
| completed_at | timestamptz | Finalización (o null) |

### activity_responses
Respuestas a actividades

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| activity_id | uuid | FK → activities |
| student_id | uuid | FK → profiles |
| response | jsonb | Respuesta del estudiante |
| score | int4 | Puntaje obtenido |
| submitted_at | timestamptz | Fecha de envío |

### productions
Producciones escritas de los estudiantes

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| student_id | uuid | FK → profiles |
| lesson_id | uuid | FK → lessons |
| content | text | Texto escrito |
| word_count | int4 | Conteo de palabras |
| status | production_status | 'draft' | 'submitted' | 'reviewed' |
| score | int4 | Puntaje del profesor |
| feedback | text | Retroalimentación |
| attempts | int4 | Número de intentos |
| compliance_score | int4 | Cumplimiento de reglas (0-100) |
| integrity_score | int4 | Score de integridad (0-100) |
| integrity_events | jsonb[] | Eventos de integridad |
| time_on_task | int4 | Tiempo en segundos |
| created_at | timestamptz | Creación |
| submitted_at | timestamptz | Envío |
| reviewed_at | timestamptz | Revisión |

### production_rules
Reglas para producciones de una lección

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| lesson_id | uuid | FK → lessons (único) |
| min_words | int4 | Mínimo de palabras requeridas |
| max_words | int4 | Máximo de palabras (o null) |
| required_words | text[] | Palabras requeridas |
| prohibited_words | text[] | Palabras prohibidas |
| instructions | jsonb | { es: string, en: string } |
| extra_rules | jsonb | Reglas adicionales flexibles |

### presentation_sessions
Sesiones de presentación en tiempo real

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| professor_id | uuid | FK → profiles |
| lesson_id | uuid | FK → lessons |
| code | text | Código de 6 dígitos |
| status | enum | 'active' | 'closed' |
| current_step | int4 | Índice del paso actual |
| created_at | timestamptz | Creación |
| closed_at | timestamptz | Cierre |

## Tipos ENUM

```sql
CREATE TYPE user_role AS ENUM ('admin', 'professor', 'student');
CREATE TYPE activity_type AS ENUM (
  'multiple_choice', 'drag_drop', 'essay', 'short_answer',
  'fill_blank', 'true_false', 'matching', 'ordering',
  'image_question', 'listening', 'long_response',
  'structured_essay', 'open_writing'
);
CREATE TYPE production_status AS ENUM ('draft', 'submitted', 'reviewed');
```

## Relaciones Clave

```
profiles 1:N courses (professor)
profiles 1:N course_students (student)
profiles 1:N lessons (created_by)
profiles 1:N activities (created_by)

courses 1:N course_students
courses 1:N group_sets
courses 1:N groups
courses 1:N lesson_assignments

group_sets 1:N groups

lessons 1:N lesson_activities
lessons 1:N lesson_assignments
lessons 1:N student_progress
lessons 1:1 production_rules
lessons 1:N productions

activities 1:N lesson_activities
activities 1:N activity_responses

profiles 1:N student_progress (student)
profiles 1:N productions (student)
profiles 1:N activity_responses (student)
```
