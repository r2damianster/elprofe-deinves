# Rol: Administrador

## Descripción
Usuario con acceso total al sistema. Puede gestionar profesores, cursos, ver diagnósticos y acceder a funcionalidades de administración.

## Dashboard
**Componente:** `AdminDashboard.tsx`

**Tabs disponibles:**
1. **Cursos**: Todos los cursos del sistema
2. **Grupos**: Gestión de grupos y agrupaciones
3. **Estudiantes**: Lista y diagnóstico de estudiantes

## Permisos

### Lectura
- Ver todos los cursos
- Ver todos los grupos
- Ver todos los estudiantes y su progreso
- Ver todas las actividades y lecciones
- Acceder a diagnósticos completos

### Escritura
- Crear/editar/eliminar cursos (cualquiera)
- Gestionar estudiantes
- Acceder a StudentDiagnosticPage
- Ver métricas de integridad de producciones

### No puede
- Crear actividades (solo profesores)
- Revisar producciones (solo profesores dueños del curso)
- Controlar presentaciones (solo profesores)

## Rutas Accesibles

```typescript
// Dashboard principal
/admin

// Diagnóstico de estudiantes
/admin/diagnostics

// Detalle de curso (solo view)
/courses/:id (view mode)

// Detalle de estudiante
/students/:id
```

## Detección de Rol

```typescript
// En AuthContext
const isAdmin = profile.role === 'admin' || profile.is_admin === true;

// RLS en Supabase
CREATE POLICY "Admins can view all"
ON courses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.is_admin = true)
  )
);
```

## Flujos Principales

### Ver Diagnóstico de Estudiante
1. Entrar a AdminDashboard
2. Tab "Estudiantes"
3. Click "Ver Diagnóstico" en estudiante
4. Sistema muestra StudentDiagnosticPage

### Gestionar Curso Existente
1. Tab "Cursos"
2. Seleccionar curso
3. Ver detalles, editar o eliminar
4. Acceder a estudiantes inscritos

### Doble Rol (Admin + Profesor)
Si el usuario tiene ambos roles:
- Ver opción "Cambiar a vista de Profesor"
- Dashboard cambia a ProfessorDashboard
- Puede crear actividades y lecciones
- Puede revisar producciones de sus cursos

## UI Considerations

- Distinguir claramente cuando está actuando como admin vs profesor
- Mostrar badges indicando el rol actual
- Acceso a diagnósticos destacado
- Filtros avanzados en listados
