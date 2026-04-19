# Módulo: Content Studio

## Descripción
Suite completa para la creación y gestión de contenido educativo. Permite a profesores crear actividades reutilizables y ensamblar lecciones interactivas.

## Componentes

### ContentStudio.tsx
Hub principal del Content Studio. Vista de dos paneles:
- **Izquierda**: Lista de actividades banco
- **Derecha**: Lista de lecciones disponibles

**Features:**
- Toggle entre vista de banco de actividades y lecciones
- Filtros por tipo de actividad
- Búsqueda por título
- Crear nueva actividad / lección
- Acceso a LessonAssembler

### ActivityEditor.tsx
Editor modal para crear/editar actividades bilingües.

**Props:**
```typescript
interface Props {
  activity?: Activity | null;  // null = crear nueva
  onSave: (activity: Activity) => void;
  onCancel: () => void;
}
```

**Tipos soportados (13):**
1. `multiple_choice` - Opción múltiple
2. `true_false` - Verdadero/Falso
3. `fill_blank` - Completar espacios
4. `short_answer` - Respuesta corta
5. `matching` - Relacionar pares
6. `ordering` - Ordenar elementos
7. `drag_drop` - Arrastrar y soltar
8. `image_question` - Pregunta con imagen
9. `listening` - Comprensión auditiva
10. `essay` - Ensayo (producción)
11. `long_response` - Respuesta larga (producción)
12. `structured_essay` - Ensayo estructurado (producción)
13. `open_writing` - Escritura abierta (producción)

**Formato de guardado:**
```typescript
{
  type: ActivityType;
  title: { es: string; en: string };  // Bilingüe
  content: {
    es: { /* contenido específico */ },
    en: { /* contenido específico */ },
    tags: string[]  // Etiquetas compartidas
  };
  points: number;
  media_url: string | null;
  created_by: string;
}
```

**Integración IA:**
- Mejorar título (`improve_title`)
- Generar descripción (`improve_description`)
- Sugerir palabras requeridas (`suggest_required_words`)

### ActivityBank.tsx
Banco de actividades reutilizables. Muestra todas las actividades del sistema con filtros.

**Features:**
- Grid de tarjetas de actividades
- Filtrar por tipo
- Editar actividad
- Eliminar actividad
- Vista previa del contenido

### LessonEditor.tsx
Editor completo para crear lecciones bilingües.

**Estructura de una lección:**
```typescript
interface Lesson {
  id: string;
  title: { es: string; en: string };
  description: { es: string; en: string };
  content: {
    steps: ContentStep[];  // Pasos de contenido
    tags: string[];        // Etiquetas
  };
  has_production: boolean;
  production_unlock_percentage: number;
  order_index: number;
  created_by: string;
}
```

**Tipos de pasos:**
- `text` - Bloque de texto
- `video` - Video embebido
- `slides` - Presentación
- `image` - Imagen
- `audio` - Audio
- `link` - Enlace externo
- `activity` - Actividad vinculada

**Configuración de Producción:**
- Checkbox para activar/desactivar
- % mínimo para desbloquear (0-100)
- Mínimo/máximo de palabras
- Instrucciones bilingües
- Palabras requeridas/prohibidas

### LessonAssembler.tsx
Ensamblador visual para vincular actividades a lecciones.

**Props:**
```typescript
interface Props {
  lessonId: string;
  currentSteps?: ContentStep[];
  onActivitiesLinked: (steps: ContentStep[]) => void;
  onCancel: () => void;
}
```

**Features:**
- Lista de actividades disponibles
- Drag & drop para agregar actividades a la lección
- Preview de cada actividad
- Reordenar actividades
- Guardar sincroniza `lesson_activities` y `lessons.content`

### MediaUploader.tsx
Componente reutilizable para subir multimedia.

**Props:**
```typescript
interface Props {
  value: string;                    // URL actual
  onChange: (url: string) => void;  // Callback
  accept: 'image' | 'video' | 'audio';  // Tipo aceptado
  label: string;                    // Label del campo
}
```

**Features:**
- Soporte para URLs externas (YouTube, Vimeo, Google Slides)
- Input para URL directa
- Validación de formato

### TagInput.tsx
Input especializado para etiquetas.

**Features:**
- Añadir etiquetas con Enter o coma
- Eliminar etiquetas (X)
- Formato sugerido: `[categoría]` o texto libre
- Ejemplo: `[gramática] [básico] [conversación]`

## Flujo de Uso

### Crear una Actividad
1. Abrir Content Studio
2. Click "Nueva Actividad"
3. Seleccionar tipo (ej: multiple_choice)
4. Llenar contenido en ES y/o EN
5. Guardar → Va al ActivityBank

### Crear una Lección
1. Abrir Content Studio
2. Click "Nueva Lección"
3. Llenar metadatos (título, descripción)
4. Agregar pasos de contenido (texto, video, etc.)
5. Configurar producción (opcional)
6. Guardar → Va a la lista de lecciones
7. Usar LessonAssembler para vincular actividades

### Vincular Actividades a Lección
1. Seleccionar lección
2. Click "Agregar Actividades"
3. Seleccionar actividades del banco
4. Reordenar si es necesario
5. Guardar

## Integración con Base de Datos

### Tablas involucradas
- `activities` - Almacena actividades
- `lessons` - Almacena lecciones
- `lesson_activities` - Tabla puente (sincronizada automáticamente)
- `production_rules` - Reglas de producción

### Sincronización
Cuando se guarda en LessonAssembler:
```typescript
// 1. Actualizar content.steps de la lección
// 2. Borrar lesson_activities existentes
// 3. Insertar nuevos lesson_activities con order_index
```

## Edge Cases Manejados

1. **Cambio de tipo en actividad existente**: No permitido, deshabilitado el select
2. **Actividad usada en lecciones**: Alerta al editar
3. **Eliminar actividad vinculada**: Verificar dependencias primero
4. **Lección con estudiantes**: Warning al modificar estructura
5. **Orden inválido**: Reordenar automáticamente al guardar
