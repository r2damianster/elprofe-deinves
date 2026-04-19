# Árbol de Componentes - elprofe-deinves

## Estructura General

```
App.tsx
├── Login.tsx                    # Autenticación unificada
├── AuthContext.tsx              # Contexto de autenticación y roles
│
├── AdminDashboard.tsx           # Dashboard administrador
│   ├── StudentDiagnosticPage.tsx   # Diagnóstico de estudiantes
│   └── AdminDashboard (tabs):
│       ├── CourseManager.tsx
│       ├── GroupManager.tsx
│       └── StudentManager.tsx
│
├── ProfessorDashboard.tsx     # Dashboard profesor
│   ├── CourseManager.tsx      # Gestión de cursos
│   ├── GroupManager.tsx       # Gestión de grupos + agrupaciones (group_sets)
│   ├── StudentManager.tsx     # Gestión de estudiantes
│   ├── LessonAssignment.tsx   # Asignar lecciones
│   ├── ProfessorLessonView.tsx  # Ver lección como profesor
│   ├── ProductionReviewer.tsx   # Revisar producciones
│   ├── PresentationController.tsx  # Controlar presentación realtime
│   │
│   └── ContentStudio/         # Suite de creación de contenido
│       ├── ContentStudio.tsx      # Hub principal
│       ├── ActivityEditor.tsx     # Editor de actividades
│       ├── ActivityBank.tsx       # Banco de actividades
│       ├── LessonEditor.tsx       # Editor de lecciones
│       ├── LessonAssembler.tsx    # Ensamblador de lecciones
│       ├── MediaUploader.tsx      # Subir multimedia
│       └── TagInput.tsx           # Input de etiquetas
│
└── StudentDashboard.tsx         # Dashboard estudiante
    ├── GroupEnrollment.tsx      # Inscribirse a grupos
    ├── LessonViewer.tsx         # Ver lección con pasos
    │   └── ContentRenderer.tsx  # Renderizar contenido
    ├── ActivityRenderer.tsx     # Renderizar actividades
    │   ├── MultipleChoice.tsx
    │   ├── DragDrop.tsx
    │   ├── Matching.tsx
    │   ├── FillBlank.tsx
    │   ├── Ordering.tsx
    │   ├── Essay.tsx
    │   ├── ShortAnswer.tsx
    │   ├── ImageQuestion.tsx
    │   ├── Listening.tsx
    │   ├── LongResponse.tsx
    │   ├── StructuredEssay.tsx
    │   ├── ErrorSpotting.tsx
    │   ├── CategorySorting.tsx
    │   └── MatrixGrid.tsx
    ├── ProductionEditor.tsx     # Editor de producción
    ├── LessonResults.tsx        # Resultados de lección
    ├── StudentResults.tsx       # Resultados generales
    └── PresentationViewer.tsx   # Ver presentación realtime
```

## Componentes Compartidos

### Hooks
- `useAuth()` - Autenticación y perfil del usuario
- `useIntegrity()` - Métricas de integridad para producciones

### Librerías
- `supabase.ts` - Cliente Supabase
- `i18n.ts` - Configuración de internacionalización
- `activityTypes.ts` - Tipos de actividades y utilidades
- `database.types.ts` - Tipos TypeScript de la base de datos

## Flujo de Datos Principal

```
Lección (lessons)
  ↓ content JSONB
Pasos de contenido (steps)
  ↓ activity_id
Actividad (activities)
  ↓ content JSONB
Respuesta del estudiante (activity_responses)

Producción (productions)
  ↓ lesson_id, student_id
Reglas (production_rules)
```
