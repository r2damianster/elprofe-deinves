# Módulo: Diagnóstico de Estudiantes

## Descripción
Herramienta del administrador para visualizar el estado y progreso de los estudiantes en el sistema.

## Componente Principal

### StudentDiagnosticPage.tsx
Página completa de diagnóstico accesible desde el AdminDashboard.

**Ubicación:** `src/components/admin/StudentDiagnosticPage.tsx`

**Features:**
- Lista de todos los estudiantes
- Información detallada por estudiante
- Cursos inscritos
- Progreso en lecciones
- Resultados de actividades
- Producciones enviadas

## Información Mostrada

### Por Estudiante

```typescript
interface StudentDiagnostic {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  
  // Cursos
  courses: {
    course_id: string;
    course_name: string;
    professor_name: string;
    enrolled_at: string;
  }[];
  
  // Progreso
  progress: {
    lesson_id: string;
    lesson_title: string;
    completion_percentage: number;
    attempts: number;
    started_at: string;
    completed_at: string | null;
  }[];
  
  // Actividades
  responses: {
    activity_id: string;
    activity_title: string;
    score: number;
    submitted_at: string;
  }[];
  
  // Producciones
  productions: {
    lesson_id: string;
    lesson_title: string;
    status: 'draft' | 'submitted' | 'reviewed';
    score: number | null;
    word_count: number;
    submitted_at: string;
  }[];
}
```

## Vistas Disponibles

### Vista de Lista
Tabla con resumen de todos los estudiantes:
- Nombre
- Email
- Cursos inscritos (contador)
- Lecciones completadas (contador)
- Última actividad

### Vista Detallada
Expansible por estudiante:
- **Información personal**: Nombre, email, fecha de registro
- **Cursos**: Lista de cursos con profesor asignado
- **Progreso**: Barra de progreso por lección
- **Actividades**: Puntajes obtenidos
- **Producciones**: Estado y resultados

## Filtros y Búsqueda

### Filtros disponibles
- Por curso
- Por profesor
- Por rango de progreso (0-25%, 25-50%, etc.)
- Por estado de producción (sin enviar, pendiente, revisada)
- Por fecha de registro

### Búsqueda
- Por nombre del estudiante
- Por email

## Integración con Base de Datos

### Queries principales

```typescript
// Listar estudiantes con resumen
const { data } = await supabase
  .from('profiles')
  .select(`
    id, full_name, email, created_at,
    course_students:course_students(count),
    progress:student_progress(count),
    productions:productions(count)
  `)
  .eq('role', 'student');

// Detalle completo de un estudiante
const { data } = await supabase
  .from('profiles')
  .select(`
    *,
    course_students:courses(*),
    progress:student_progress(*, lessons(*)),
    responses:activity_responses(*, activities(*)),
    productions:productions(*, lessons(*))
  `)
  .eq('id', studentId)
  .single();
```

## Edge Cases Manejados

1. **Estudiante sin cursos**: Mostrar mensaje "No inscrito en ningún curso"
2. **Estudiante sin actividades**: Tabla vacía con mensaje informativo
3. **Datos corruptos**: Validación antes de mostrar, logs de error
4. **Muchos registros**: Paginación de resultados
5. **Estudiante eliminado**: Soft delete, mostrar "Cuenta desactivada"

## Permisos

- **Solo admin**: Esta página es exclusiva de administradores
- **Verificación**: Se verifica `profile.role === 'admin'` o `profile.is_admin`
- **RLS**: Las políticas de Supabase permiten lectura a admins

## UI/UX

### Diseño
- Layout limpio y espacioso
- Colores para estados (verde: completado, amarillo: pendiente, rojo: problema)
- Iconos para acciones rápidas
- Tooltips con información adicional

### Responsive
- Tabla scrollable en móviles
- Cards en lugar de tabla para pantallas pequeñas
- Filtros colapsables

## Exportación (futuro)

- Exportar a CSV/Excel
- Generar reporte PDF
- Enviar por email

## Alertas

El sistema puede mostrar alertas para:
- Estudiantes sin actividad reciente
- Producciones pendientes de revisión
- Intento de trampa detectado
- Bajo rendimiento en actividades
