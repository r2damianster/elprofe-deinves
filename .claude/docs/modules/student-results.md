# Módulo: Resultados del Estudiante

## Descripción
Sistema de visualización de resultados y progreso para estudiantes, incluyendo resultados por lección y visión general.

## Componentes

### LessonResults.tsx
Resultados detallados de una lección específica.

**Ubicación:** `src/components/student/LessonResults.tsx`

**Props:**
```typescript
interface Props {
  lessonId: string;
  studentId: string;
}
```

**Información mostrada:**
- Título de la lección
- Porcentaje de completitud
- Lista de actividades completadas
- Puntajes obtenidos
- Producción escrita (si aplica)
- Retroalimentación del profesor

**Secciones:**
1. **Resumen**: Porcentaje total, estado
2. **Actividades**: Tabla con cada actividad y puntaje
3. **Producción**: Texto enviado, estado de revisión, nota

### StudentResults.tsx
Dashboard de resultados generales del estudiante.

**Ubicación:** `src/components/student/StudentResults.tsx`

**Información mostrada:**
```typescript
interface StudentResults {
  // Resumen general
  totalLessons: number;
  completedLessons: number;
  averageScore: number;
  
  // Por curso
  courses: {
    courseId: string;
    courseName: string;
    progress: number;           // % promedio del curso
    lessonsCompleted: number;
    totalLessons: number;
    lastActivity: string;        // Fecha
  }[];
  
  // Historial reciente
  recentActivity: {
    type: 'activity' | 'production' | 'lesson_complete';
    title: string;
    date: string;
    score?: number;
  }[];
}
```

**Features:**
- Gráfico de progreso (futuro)
- Lista de cursos con progreso
- Actividades recientes
- Ranking comparativo (opcional)

## Cálculo de Puntajes

### Por Actividad
```typescript
// Actividades auto-calificables
if (response === correct) score = activity.points;
else score = 0;

// Producciones (revisión manual)
score = production.score ?? null;
```

### Por Lección
```typescript
const completionPercentage = Math.round(
  (completedActivities / totalActivities) * 100
);

const averageScore = activities.length > 0
  ? activities.reduce((sum, a) => sum + (a.score || 0), 0) / activities.length
  : 0;
```

### Por Curso
```typescript
const courseProgress = lessons.reduce((sum, l) => 
  sum + l.completion_percentage, 0
) / lessons.length;
```

## Base de Datos

### Tabla: student_progress

```sql
CREATE TABLE student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id),
  lesson_id uuid REFERENCES lessons(id),
  completion_percentage int DEFAULT 0,
  attempts int DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  UNIQUE(student_id, lesson_id)  -- Un progreso por estudiante-lección
);
```

### Tabla: activity_responses

```sql
CREATE TABLE activity_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activities(id),
  student_id uuid REFERENCES profiles(id),
  response jsonb,                -- Respuesta del estudiante
  score int,                     -- Puntaje obtenido
  submitted_at timestamptz DEFAULT now()
);
```

### Queries principales

```typescript
// Progreso de lección
const { data } = await supabase
  .from('student_progress')
  .select(`
    *,
    lesson:lessons(title, content)
  `)
  .eq('student_id', studentId)
  .eq('lesson_id', lessonId)
  .single();

// Actividades completadas
const { data } = await supabase
  .from('activity_responses')
  .select(`
    *,
    activity:activities(title, points)
  `)
  .eq('student_id', studentId)
  .in('activity_id', activityIds);

// Producción
const { data } = await supabase
  .from('productions')
  .select('*')
  .eq('student_id', studentId)
  .eq('lesson_id', lessonId)
  .single();
```

## Estados de Lección

```
NOT_STARTED (no existe registro en student_progress)
    ↓ (abre lección)
IN_PROGRESS (started_at existe, completed_at null, completion_percentage < 100)
    ↓ (completa todas las actividades)
COMPLETED (completed_at existe, completion_percentage = 100)
    ↓ (opcional: rehacer)
REPEATING (attempts > 1)
```

## UI/UX

### LessonResults Layout
```
┌──────────────────────────────────────┐
│ Resultados: Saludos Básicos          │
│                              [Cerrar]│
├──────────────────────────────────────┤
│                                      │
│  ████████████████████░░  85%          │
│  Completado                          │
│                                      │
├──────────────────────────────────────┤
│ Actividades                          │
│ ┌────────────────────────────────┐  │
│ │ Opción Múltiple 1      10/10  ✓│  │
│ │ Opción Múltiple 2      10/10  ✓│  │
│ │ Completar Espacios      5/10  ~│  │
│ └────────────────────────────────┘  │
├──────────────────────────────────────┤
│ Producción Final                     │
│ ┌────────────────────────────────┐  │
│ │ Estado: Revisado               │  │
│ │ Calificación: 90/100           │  │
│ │ [Ver texto] [Ver feedback]     │  │
│ └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### StudentResults Layout
```
┌──────────────────────────────────────┐
│ Mis Resultados                        │
├──────────────────────────────────────┤
│                                       │
│  📊 Progreso General                 │
│  ┌────────────────────────┐         │
│  │ Cursos: 2 activos      │         │
│  │ Lecciones: 5/12        │         │
│  │ Promedio: 87%          │         │
│  └────────────────────────┘         │
│                                       │
│  📚 Por Curso                        │
│  ┌────────────────────────┐         │
│  │ Inglés Básico A1       │         │
│  │ ████████████░░░░ 75%   │         │
│  │ 3/4 lecciones          │         │
│  └────────────────────────┘         │
│                                       │
│  📅 Actividad Reciente               │
│  • Hoy - Lección completada: ...     │
│  • Ayer - Producción revisada: ...   │
│                                       │
└──────────────────────────────────────┘
```

## Edge Cases

1. **Sin actividades completadas**: Mostrar "Aún no has completado actividades"
2. **Producción sin revisar**: Mostrar "Pendiente de revisión" en amarillo
3. **Lección no iniciada**: Mostrar "No has iniciado esta lección"
4. **Score incompleto**: Alguna actividad sin calificar, mostrar "Calificación pendiente"
5. **Intento múltiple**: Mostrar mejor intento o todos los intentos (configurable)
6. **Datos corruptos**: Validación y mensaje de error controlado

## Gamificación (futuro)

- Badges por logros
- Streak de días consecutivos
- Ranking entre compañeros de curso
- Progreso visual tipo "árbol de conocimiento"

## Exportación

- Exportar resultados a PDF
- Compartir con tutor/padres
- Transcript oficial
