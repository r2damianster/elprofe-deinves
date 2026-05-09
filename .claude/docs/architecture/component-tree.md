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
├── ProfessorDashboard.tsx     # Dashboard profesor — 4 tabs
│   │
│   ├── [Tab: Cursos] CourseManager.tsx      # Gestión de cursos
│   │   └── CourseDetails.tsx               # Detalle de curso + tab Proyectos
│   │       └── CourseProjectsManager.tsx   # Asignar proyectos al curso
│   │
│   ├── [Tab: Asignaciones] Asignaciones.tsx
│   │   ├── LessonAssignment.tsx   # Asignar lecciones a cursos/estudiantes
│   │   └── ProjectAssignment.tsx  # Asignar proyectos (espejo de LessonAssignment)
│   │
│   ├── [Tab: Evaluaciones] Evaluaciones.tsx
│   │   ├── ProductionReviewer.tsx   # Revisar producciones escritas (filtra por lesson_assignments)
│   │   └── ProjectReviewer.tsx      # Revisar proyectos como documento continuo (acordeón por estudiante + calificación IA)
│   │
│   └── [Tab: Studio] StudioPanel.tsx
│       ├── ContentStudio.tsx      # Hub principal
│       ├── ActivityEditor.tsx     # Editor de actividades
│       ├── ActivityBank.tsx       # Banco de actividades
│       ├── LessonEditor.tsx       # Editor de lecciones
│       ├── LessonAssembler.tsx    # Ensamblador de lecciones
│       ├── MediaUploader.tsx      # Subir multimedia
│       ├── TagInput.tsx           # Input de etiquetas
│       └── ProjectManager.tsx            # Crear/editar proyectos
│           ├── ProjectObjectTypesEditor.tsx  # Editar tipos de objeto del proyecto
│           ├── ProjectLessonMapper.tsx       # Mapear tipos de objeto a lecciones
│           └── ProjectAssignmentsEditor.tsx  # Gestionar asignaciones de proyecto
│
│   (Componentes sueltos del profesor)
│   ├── ProfessorLessonView.tsx  # Ver lección como profesor
│   ├── GroupManager.tsx         # Gestión de grupos + agrupaciones (group_sets)
│   ├── StudentManager.tsx       # Gestión de estudiantes
│   └── PresentationController.tsx  # Controlar presentación realtime
│
└── StudentDashboard.tsx         # Dashboard estudiante — vista unificada lecciones + proyectos
    ├── GroupEnrollment.tsx      # Inscribirse a grupos
    │
    ├── [Sección Lecciones]
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
    ├── ProductionEditor.tsx     # Editor de producción escrita
    ├── LessonResults.tsx        # Resultados de lección
    │
    ├── [Sección Proyectos]
    ├── ProjectDashboard.tsx     # Panel principal del proyecto (estudiante)
    │   └── ProjectObjectList.tsx   # Lista de objetos con acordeón
    │       └── ProjectObjectWriter.tsx  # Editor de un objeto del proyecto
    ├── ProjectPresentation.tsx  # Vista del proyecto como documento continuo
    │
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
