# Flujo: Creación de Lección

## Descripción
Proceso completo desde la creación de actividades hasta la asignación de una lección a estudiantes.

## Actores
- **Profesor**: Crea actividades, lecciones y asigna
- **Sistema**: Sincroniza datos, calcula progreso

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                   CREAR ACTIVIDADES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │ Content      │                                               │
│  │ Studio       │──┐                                            │
│  └──────────────┘  │                                            │
│                    ▼                                            │
│           ┌─────────────────┐                                   │
│           │ ActivityEditor  │                                   │
│           │ - Seleccionar   │                                   │
│           │   tipo            │                                   │
│           │ - Llenar ES/EN    │                                   │
│           │ - Guardar         │                                   │
│           └────────┬──────────┘                                   │
│                    │                                            │
│                    ▼                                            │
│           ┌─────────────────┐                                   │
│           │ activities      │                                   │
│           │ (tabla)         │                                   │
│           └─────────────────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CREAR LECCIÓN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │ Content      │                                               │
│  │ Studio       │──┐                                            │
│  └──────────────┘  │                                            │
│                    ▼                                            │
│           ┌─────────────────┐                                   │
│           │ LessonEditor    │                                   │
│           │ - Metadatos     │                                   │
│           │ - Pasos         │                                   │
│           │ - Producción    │                                   │
│           └────────┬──────────┘                                   │
│                    │                                            │
│                    ▼                                            │
│           ┌─────────────────┐                                   │
│           │ lessons         │                                   │
│           │ (tabla)         │                                   │
│           └─────────────────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              VINCULAR ACTIVIDADES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │ Lesson       │                                               │
│  │ Assembler    │                                               │
│  └──────────────┘                                               │
│        │                                                        │
│        ▼                                                        │
│  ┌─────────────────────┐                                       │
│  │ 1. Cargar lección   │                                       │
│  │ 2. Mostrar banco    │                                       │
│  │ 3. Seleccionar      │                                       │
│  │ 4. Ordenar          │                                       │
│  │ 5. Guardar          │                                       │
│  └──────────┬──────────┘                                       │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                       │
│  │ SINCRONIZACIÓN:     │                                       │
│  │ - lessons.content   │                                       │
│  │ - lesson_activities │                                       │
│  └─────────────────────┘                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ASIGNAR LECCIÓN                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐                                             │
│  │ Lesson         │                                             │
│  │ Assignment     │                                             │
│  └────────────────┘                                             │
│        │                                                        │
│        ▼                                                        │
│  ┌─────────────────────┐                                       │
│  │ 1. Seleccionar      │                                       │
│  │    curso            │                                       │
│  │ 2. Seleccionar      │                                       │
│  │    modo:            │                                       │
│  │    - Todo el curso  │                                       │
│  │    - Grupos         │                                       │
│  │    - Individuales   │                                       │
│  │ 3. Confirmar        │                                       │
│  └──────────┬──────────┘                                       │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                       │
│  │ lesson_assignments  │                                       │
│  │ (tabla)             │                                       │
│  └─────────────────────┘                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Paso 1: Crear Actividades

### ActivityEditor
1. Abrir Content Studio
2. Click "Nueva Actividad"
3. Seleccionar tipo (13 disponibles)
4. Llenar campos:
   - Título ES y/o EN
   - Contenido específico del tipo
   - Puntos
   - Media (si aplica)
   - Tags
5. Guardar → Inserta en `activities`

### Estructura guardada
```typescript
{
  id: uuid,
  type: ActivityType,
  title: { es: string, en: string },
  content: { 
    es: { /* tipo específico */ },
    en: { /* tipo específico */ },
    tags: string[]
  },
  points: number,
  media_url: string | null,
  created_by: uuid,
  created_at: string
}
```

## Paso 2: Crear Lección

### LessonEditor
1. Abrir Content Studio → Lecciones
2. Click "Nueva Lección"
3. Completar:
   - Título ES/EN
   - Descripción ES/EN
   - Orden (order_index)
   - Tags
4. Agregar pasos:
   - text, video, slides, image, audio, link
5. Configurar producción (opcional):
   - Activar checkbox
   - % mínimo para desbloquear
   - Reglas de producción
6. Guardar → Inserta en `lessons`

### Estructura guardada
```typescript
{
  id: uuid,
  title: { es: string, en: string },
  description: { es: string, en: string },
  content: {
    steps: ContentStep[],
    tags: string[]
  },
  has_production: boolean,
  production_unlock_percentage: number,
  order_index: number,
  created_by: uuid,
  created_at: string
}
```

### Tipos de pasos (ContentStep)
```typescript
type StepType = 'text' | 'video' | 'slides' | 'image' | 'audio' | 'link' | 'activity';

interface ContentStep {
  type: StepType;
  // text
  content?: { es: string; en: string };
  // media
  url?: string;
  caption?: { es: string; en: string };
  // activity
  activity_id?: string;
}
```

## Paso 3: Vincular Actividades

### LessonAssembler
1. Seleccionar lección existente
2. Click "Agregar Actividades"
3. Se abre modal con ActivityBank
4. Seleccionar actividades (checkbox)
5. Click "Agregar Seleccionados"
6. Ordenar arrastrando (opcional)
7. Click "Guardar"

### Sincronización
```typescript
// 1. Extraer activity_ids de content.steps
const activitySteps = steps.filter(s => s.type === 'activity');

// 2. Actualizar lessons.content
await supabase
  .from('lessons')
  .update({ content: { steps: cleanSteps, tags } })
  .eq('id', lessonId);

// 3. Sincronizar lesson_activities
await supabase
  .from('lesson_activities')
  .delete()
  .eq('lesson_id', lessonId);

await supabase
  .from('lesson_activities')
  .insert(
    activitySteps.map((s, idx) => ({
      lesson_id: lessonId,
      activity_id: s.activity_id,
      order_index: idx
    }))
  );
```

## Paso 4: Asignar Lección

### LessonAssignment
1. Seleccionar lección a asignar
2. Seleccionar curso destino
3. Elegir modo:
   - **Todo el curso**: Inserta un registro por estudiante
   - **Grupos**: Inserta por estudiantes de grupos seleccionados
   - **Individuales**: Selección manual de estudiantes
4. Confirmar → Inserta en `lesson_assignments`

### Estructura guardada
```typescript
{
  id: uuid,
  lesson_id: uuid,
  course_id: uuid | null,    // Si asignó a curso completo
  student_id: uuid | null,     // Si asignó a individuales
  assigned_by: uuid,
  assigned_at: string
}
```

## Edge Cases

1. **Actividad editada después de vincular**:
   - Cambios se reflejan automáticamente (referencia por ID)
   - Si cambia tipo: Advertencia al guardar

2. **Lección con estudiantes ya progresando**:
   - Warning al modificar estructura
   - Opción de crear copia en lugar de editar

3. **Asignar lección ya asignada**:
   - Mostrar "Ya asignada" con opción de reasignar
   - O ignorar silenciosamente

4. **Desasignar lección**:
   - Borrar de lesson_assignments
   - ¿Borrar progreso existente? (confirmación)

## Verificación Post-Creación

### Checklist
- [ ] Actividad creada con contenido ES/EN
- [ ] Lección creada con metadatos
- [ ] Pasos de lección configurados
- [ ] Actividades vinculadas
- [ ] lesson_activities sincronizado
- [ ] Producción configurada (si aplica)
- [ ] Lección asignada a curso/estudiantes
- [ ] Estudiantes pueden ver la lección
