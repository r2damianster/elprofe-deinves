# Rol: Profesor

## Descripción
Usuario que crea contenido educativo, gestiona cursos, grupos y estudiantes, revisa producciones y controla presentaciones.

## Dashboard
**Componente:** `ProfessorDashboard.tsx`

**Módulos disponibles:**
- Content Studio (creación de contenido)
- Gestión de Cursos
- Gestión de Grupos
- Gestión de Estudiantes
- Asignación de Lecciones
- Revisión de Producciones
- Presentaciones

## Permisos

### Content Studio (creación)
- Crear/editar/eliminar actividades propias
- Crear/editar/eliminar lecciones propias
- Usar LessonAssembler para vincular actividades

### Gestión de Cursos
- Crear cursos propios
- Editar/eliminar SOLO sus cursos
- Ver estudiantes inscritos en sus cursos
- Inscribir/desinscribir estudiantes de sus cursos

### Gestión de Grupos
- Crear agrupaciones (group_sets) en sus cursos
- Activar/desactivar agrupaciones
- Crear grupos dentro de agrupaciones
- Asignar estudiantes a grupos

### Asignación de Lecciones
- Asignar lecciones a sus cursos completos
- Asignar a grupos específicos
- Asignar a estudiantes individuales

### Revisión de Producciones
- Ver producciones de estudiantes de sus cursos
- Asignar puntajes (0-100)
- Escribir retroalimentación
- Ver métricas de integridad

### Presentaciones
- Iniciar sesiones de presentación
- Controlar pasos de la lección
- Ver código de 6 dígitos
- Ver estudiantes conectados

## Rutas Accesibles

```typescript
/professor                    // Dashboard
/professor/courses            // Gestión de cursos
/professor/groups             // Gestión de grupos
/professor/students           // Gestión de estudiantes
/professor/assignments        // Asignar lecciones
/professor/review             // Revisar producciones
/professor/present            // Iniciar presentación
/professor/studio             // Content Studio
```

## Flujos Principales

### Crear Curso Completo
1. Ir a CourseManager
2. Crear nuevo curso
3. Crear agrupación de grupos
4. Crear grupos
5. Inscribir estudiantes
6. Crear actividades en Content Studio
7. Crear lecciones con actividades
8. Asignar lecciones al curso

### Revisar Producciones
1. Ir a ProductionReviewer
2. Seleccionar curso y lección
3. Ver lista de producciones `submitted`
4. Abrir producción individual
5. Leer texto y verificar reglas
6. Asignar puntaje y feedback
7. Guardar (estado → `reviewed`)

### Iniciar Presentación
1. Ir a PresentationController
2. Seleccionar lección
3. Click "Iniciar Presentación"
4. Compartir código de 6 dígitos
5. Navegar entre pasos
6. Cerrar sesión al terminar

## Restricciones

- No puede ver cursos de otros profesores
- No puede editar actividades de otros profesores
- No puede revisar producciones de cursos ajenos
- No puede ver diagnósticos completos (solo admin)

## Doble Rol (Profesor + Admin)

Si tiene `is_admin = true`:
- Puede cambiar a vista de Admin
- En vista Admin: ver todos los cursos
- En vista Profesor: ver solo sus cursos
- Puede crear contenido en ambas vistas

## UI Considerations

- Toggle claro para cambiar entre roles (si tiene ambos)
- Content Studio accesible desde dashboard
- Acceso rápido a presentaciones
- Notificaciones de producciones pendientes
