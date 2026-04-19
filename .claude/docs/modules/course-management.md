# Módulo: Gestión de Cursos

## Descripción
Sistema para que profesores creen y gestionen cursos, inscriban estudiantes y asignen lecciones.

## Componentes

### CourseManager.tsx
Gestor principal de cursos.

**Ubicación:** `src/components/professor/CourseManager.tsx`

**Features:**
- Lista de cursos del profesor
- Crear nuevo curso
- Editar curso existente
- Eliminar curso (con confirmación)
- Ver detalles de curso (abre CourseDetails)

**Datos de un curso:**
```typescript
interface Course {
  id: string;
  name: string;
  description: string | null;
  professor_id: string;
  language: 'es' | 'en';      // Idioma principal
  created_at: string;
  
  // Relaciones
  students?: CourseStudent[];
  groups?: Group[];
  lessons?: Lesson[];
}
```

### CourseDetails.tsx
Vista detallada de un curso con tabs.

**Tabs:**
1. **Estudiantes**: Lista de inscritos, agregar/eliminar
2. **Grupos**: Acceso a GroupManager para este curso
3. **Lecciones**: Lecciones asignadas al curso

**Features:**
- Código de inscripción (futuro)
- Estadísticas del curso
- Exportar lista de estudiantes

### LessonAssignment.tsx
Asignador de lecciones a cursos o estudiantes individuales.

**Props:**
```typescript
interface Props {
  lessonId: string;
  onAssigned?: () => void;
}
```

**Modos de asignación:**
1. **A todo el curso**: Todos los estudiantes del curso reciben la lección
2. **A grupos específicos**: Solo estudiantes de ciertos grupos
3. **A estudiantes individuales**: Selección manual

**Flujo:**
1. Seleccionar curso
2. Seleccionar modo de asignación
3. Confirmar
4. Crear registros en `lesson_assignments`

### ProfessorLessonView.tsx
Vista de lección desde perspectiva del profesor.

**Features:**
- Ver contenido como lo vería el estudiante
- Preview de actividades
- Estadísticas de progreso
- Acceso a PresentationController

## Base de Datos

### Tabla: courses

```sql
CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  professor_id uuid REFERENCES profiles(id),
  language text DEFAULT 'es',  -- 'es' | 'en'
  created_at timestamptz DEFAULT now()
);
```

### Tabla: course_students

```sql
CREATE TABLE course_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE(course_id, student_id)  -- Evitar duplicados
);
```

### Tabla: lesson_assignments

```sql
CREATE TABLE lesson_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,      -- Opcional
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,    -- Opcional
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  
  -- Al menos uno debe ser no null
  CONSTRAINT course_or_student CHECK (
    course_id IS NOT NULL OR student_id IS NOT NULL
  )
);
```

## RLS (Row Level Security)

```sql
-- Profesores ven solo sus cursos
CREATE POLICY "Professors view own courses"
ON courses FOR SELECT
USING (professor_id = auth.uid());

-- Profesores modifican solo sus cursos
CREATE POLICY "Professors modify own courses"
ON courses FOR ALL
USING (professor_id = auth.uid());

-- Estudiantes ven cursos donde están inscritos
CREATE POLICY "Students view enrolled courses"
ON courses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM course_students
    WHERE course_students.course_id = courses.id
    AND course_students.student_id = auth.uid()
  )
);
```

## Flujos

### Crear Curso
1. Click "Nuevo Curso"
2. Ingresar nombre y descripción
3. Seleccionar idioma (es/en)
4. Guardar
5. Redirigir a CourseDetails

### Inscribir Estudiante
**Opción A - Manual:**
1. En CourseDetails, tab Estudiantes
2. Click "Agregar Estudiante"
3. Buscar por email o nombre
4. Seleccionar y confirmar

**Opción B - Código (futuro):**
1. Generar código de curso
2. Estudiante ingresa código en "Unirse a curso"
3. Inscripción automática

### Asignar Lección
1. Seleccionar lección
2. Click "Asignar a Curso"
3. Seleccionar curso destino
4. Elegir: todo el curso / grupos / individuales
5. Confirmar

## UI/UX

### Lista de Cursos
```
┌─────────────────────────────────────┐
│ Mis Cursos                    [+]   │
├─────────────────────────────────────┤
│                                     │
│  📚 Inglés Básico A1                 │
│     15 estudiantes · Creado: Mar 15 │
│     [Ver] [Editar] [Eliminar]       │
│                                     │
│  📚 Inglés Intermedio B1             │
│     8 estudiantes · Creado: Mar 20  │
│     [Ver] [Editar] [Eliminar]       │
│                                     │
└─────────────────────────────────────┘
```

### CourseDetails - Tab Estudiantes
- Tabla con: Nombre, Email, Fecha inscripción, Progreso
- Acciones: Eliminar, Ver progreso detallado
- Botón: Agregar estudiantes

### CourseDetails - Tab Grupos
- Lista de agrupaciones
- Acceso directo a GroupManager
- Badge con conteo de grupos

### CourseDetails - Tab Lecciones
- Lista de lecciones asignadas
- Ordenar por fecha de asignación
- Estado de progreso de la clase

## Edge Cases

1. **Curso sin estudiantes**: Mostrar mensaje promocional
2. **Eliminar curso con estudiantes**: Confirmar, opción de reasignar
3. **Estudiante ya inscrito**: Prevenir duplicados (UNIQUE constraint)
4. **Asignar lección ya asignada**: Mostrar warning, opción de reasignar
5. **Profesor sin cursos**: Mostrar tutorial de primer curso
6. **Curso con datos incompletos**: Validar antes de permitir acciones

## Integración con Otros Módulos

### Content Studio
- Lecciones creadas en Content Studio pueden asignarse a cursos
- Actividades están disponibles para todos los profesores

### Group Management
- Cada curso tiene sus propios grupos y agrupaciones
- Agrupación activa afecta vista del estudiante

### Student Dashboard
- Estudiante ve cursos donde está inscrito
- Puede unirse a cursos mediante código o invitación
