# Plataforma Educativa - Lecciones del Profe Arturito

## Descripción

Plataforma educativa completa con tres roles principales:
- **Administrador**: Gestiona profesores y la plataforma
- **Profesor**: Crea cursos, gestiona estudiantes y asigna lecciones
- **Estudiante**: Completa lecciones con actividades variadas y trabajos de producción

## Características Principales

### Sistema de Roles
- Control de acceso basado en roles (RBAC)
- Cada rol tiene permisos específicos y vistas personalizadas

### Lecciones y Actividades
- Contenido teórico estructurado
- 4 tipos de actividades:
  - Preguntas de opción múltiple
  - Drag & Drop (arrastrar y soltar)
  - Ensayos
  - Respuestas cortas
- Sistema de progreso con porcentajes

### Sistema de Producción
- Se desbloquea al completar el 80% de las actividades
- Validación en tiempo real:
  - Mínimo y máximo de palabras
  - Palabras obligatorias
  - Palabras prohibidas
- Estados: borrador, enviado, revisado
- Retroalimentación del profesor

## Lecciones Iniciales

### 1. Introducción a la Investigación
- Conceptos básicos del método científico
- 3 actividades: opción múltiple, drag & drop, respuesta corta
- Sin producción

### 2. Análisis FODA
- Herramienta de planificación estratégica
- 3 actividades: opción múltiple, drag & drop, ensayo
- Con producción (análisis FODA completo)

## Cómo Empezar

### 1. Crear Usuario Administrador

Para crear tu primer usuario administrador, necesitas registrarte en la aplicación y luego actualizar manualmente el rol en la base de datos:

1. Registra una cuenta en la aplicación
2. Ejecuta este SQL en Supabase para convertirla en administrador:

```sql
-- Reemplaza 'tu-email@ejemplo.com' con tu email
UPDATE profiles
SET role = 'admin'
WHERE email = 'tu-email@ejemplo.com';
```

### 2. Flujo de Trabajo

Como **Administrador**:
1. Inicia sesión con tu cuenta de administrador
2. Ve a "Profesores"
3. Haz clic en "Invitar Profesor"
4. Crea profesores con nombre, email y contraseña

Como **Profesor**:
1. Inicia sesión con las credenciales proporcionadas
2. Crea un curso en "Mis Cursos"
3. Agrega estudiantes al curso (con nombre, email y contraseña)
4. Ve a "Asignar Lecciones"
5. Selecciona el curso y las lecciones que quieres asignar
6. Puedes asignar lecciones a todo el curso o a estudiantes específicos

Como **Estudiante**:
1. Inicia sesión con las credenciales proporcionadas
2. Verás todas las lecciones asignadas
3. Haz clic en una lección para comenzar
4. Completa las actividades en orden
5. Cuando alcances el 80% de progreso, se desbloqueará la producción (si la lección la tiene)
6. Completa la producción siguiendo los requisitos

## Estructura de la Base de Datos

### Tablas Principales
- `profiles`: Usuarios con roles
- `lessons`: Lecciones con contenido teórico
- `courses`: Cursos creados por profesores
- `course_students`: Estudiantes inscritos en cursos
- `activities`: Actividades de las lecciones
- `lesson_assignments`: Asignaciones de lecciones
- `student_progress`: Progreso de estudiantes
- `activity_responses`: Respuestas a actividades
- `production_rules`: Reglas de validación para producciones
- `productions`: Trabajos de producción de estudiantes

## Seguridad

- Row Level Security (RLS) habilitado en todas las tablas
- Políticas específicas para cada rol
- Los estudiantes solo ven sus datos
- Los profesores solo ven sus cursos y estudiantes
- Los administradores tienen acceso completo

## Tecnologías Utilizadas

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Autenticación**: Supabase Auth con email/password
- **Base de Datos**: PostgreSQL con RLS
- **Iconos**: Lucide React

## Notas Importantes

- Los estudiantes deben completar al menos el 80% de las actividades antes de acceder a la producción
- Las actividades se evalúan automáticamente
- Las producciones se validan en tiempo real contra las reglas configuradas
- Una vez enviada, una producción no puede editarse (solo el profesor puede revisarla)
