# Rol: Estudiante

## Descripción
Usuario que consume contenido educativo, completa actividades, escribe producciones y visualiza sus resultados.

## Dashboard
**Componente:** `StudentDashboard.tsx`

**Secciones:**
- Cursos inscritos
- Lecciones asignadas (pendientes)
- Progreso general
- Acceso a presentaciones

## Permisos

### Lectura
- Ver sus cursos inscritos
- Ver lecciones asignadas a él
- Ver contenido de lecciones
- Ver sus resultados y progreso
- Ver retroalimentación de producciones

### Escritura
- Responder actividades (guardar respuestas)
- Escribir y enviar producciones
- Unirse a presentaciones (con código)
- Completar lecciones

### No puede
- Ver cursos no inscritos
- Ver lecciones no asignadas
- Ver respuestas de otros estudiantes
- Editar actividades o lecciones
- Crear contenido

## Rutas Accesibles

```typescript
/student                      // Dashboard
/student/courses              // Mis cursos
/student/lessons/:id          // Ver lección
/student/results              // Mis resultados
/student/production/:id       // Escribir producción
/student/present/:code        // Ver presentación
/student/join                 // Unirse a curso/presentación
```

## Flujos Principales

### Ver y Completar Lección
1. Dashboard muestra lecciones asignadas
2. Click en lección
3. LessonViewer carga pasos secuencialmente
4. Para cada actividad:
   - Renderiza ActivityRenderer con tipo correcto
   - Estudiante responde
   - Se guarda en activity_responses
5. Al completar todas las actividades:
   - Se calcula completion_percentage
   - Se desbloquea producción (si aplica)

### Escribir Producción
1. Acceder cuando `completion_percentage >= unlock_percentage`
2. Leer instrucciones y reglas
3. Escribir en ProductionEditor
4. Validación en tiempo real:
   - Conteo de palabras
   - Palabras requeridas/prohibidas
5. Click "Enviar a Revisión"
6. Estado cambia a `submitted`
7. Esperar revisión del profesor

### Unirse a Presentación
1. Click "Unirse a Presentación"
2. Ingresar código de 6 dígitos
3. PresentationViewer se conecta vía Realtime
4. Sincroniza con paso actual del profesor
5. Ver contenido en tiempo real

### Ver Resultados
1. Ir a StudentResults
2. Ver progreso por curso
3. Click en lección para detalle
4. LessonResults muestra:
   - Actividades completadas y puntajes
   - Estado de producción
   - Retroalimentación del profesor

## Estados de Lección

```
ASIGNADA → INICIADA → EN_PROGRESO → COMPLETADA
                          ↓
                    PRODUCCIÓN_ENVIADA → REVISADA
```

### ASIGNADA
- Lección aparece en dashboard
- No iniciada aún

### INICIADA
- Abrió LessonViewer
- Registro creado en student_progress
- started_at guardado

### EN_PROGRESO
- Completando actividades
- completion_percentage > 0 y < 100

### COMPLETADA
- Todas las actividades respondidas
- completion_percentage = 100
- completed_at guardado

### PRODUCCIÓN_ENVIADA
- Envió producción
- status = 'submitted'

### REVISADA
- Profesor revisó
- status = 'reviewed'
- Ver score y feedback

## UI Considerations

- Progreso visual claro (barras, porcentajes)
- Acceso rápido a lecciones pendientes
- Notificación cuando producción está revisada
- Diseño motivador (badges, logros)
- Modo presentación simple (solo ver, no interactuar)

## Gamificación

### Posibles features:
- Streak de días consecutivos
- Badges por completar lecciones
- Ranking con compañeros de curso
- Niveles de dificultad desbloqueables

## Edge Cases

1. **Lección sin actividades**: Mostrar mensaje informativo
2. **Producción no desbloqueada**: Mostrar requisitos faltantes
3. **Código de presentación inválido**: Error claro
4. **Perder conexión en presentación**: Reconectar automáticamente
5. **Intentar rehacer actividad**: Solo permitir si configurado
6. **Tiempo expirado**: Guardar progreso actual
