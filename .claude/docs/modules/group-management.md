# Módulo: Gestión de Grupos

## Descripción
Sistema de gestión de grupos de estudiantes con soporte para "agrupaciones" (group_sets), permitiendo múltiples configuraciones de grupos por curso.

## Componente Principal

### GroupManager.tsx
Gestor completo de grupos y agrupaciones para profesores.

**Ubicación:** `src/components/professor/GroupManager.tsx`

**Features:**
- Seleccionar curso
- Crear/editar/eliminar agrupaciones (group_sets)
- Activar/desactivar agrupaciones
- Crear grupos dentro de agrupaciones
- Inscribir/desinscribir estudiantes
- Vista de grupos por agrupación

## Conceptos Clave

### GroupSet (Agrupación)
Conjunto de grupos relacionados. Un curso puede tener múltiples agrupaciones, pero solo una activa.

```typescript
interface GroupSet {
  id: string;
  course_id: string;
  name: string;           // Ej: "Grupos A1", "Equipos de proyecto"
  is_active: boolean;     // Solo una activa por curso
  created_at: string;
}
```

### Group (Grupo)
Un grupo específico dentro de una agrupación.

```typescript
interface Group {
  id: string;
  course_id: string;
  group_set_id: string;   // FK a group_sets
  name: string;           // Ej: "Grupo 1", "Equipo Alpha"
  created_at: string;
}
```

### GroupMembership
Relación estudiante-grupo.

```typescript
interface GroupMembership {
  id: string;
  group_id: string;
  student_id: string;
  joined_at: string;
}
```

## Flujo de Uso

### Crear Agrupación
1. Seleccionar curso
2. Click "Nueva Agrupación"
3. Ingresar nombre
4. Opcional: Activar inmediatamente
5. Guardar

### Crear Grupos
1. Seleccionar agrupación
2. Click "Agregar Grupo"
3. Ingresar nombre del grupo
4. Repetir para múltiples grupos

### Inscribir Estudiantes
1. Seleccionar grupo
2. Click "Agregar Estudiantes"
3. Seleccionar de lista de estudiantes del curso
4. Confirmar

### Activar Agrupación
1. Ver lista de agrupaciones
2. Toggle "Activar" en la deseada
3. Sistema desactiva automáticamente las otras
4. Los estudiantes ven solo la agrupación activa

## Base de Datos

### Tabla: group_sets

```sql
CREATE TABLE group_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### Tabla: groups

```sql
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  group_set_id uuid REFERENCES group_sets(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Tabla: group_memberships

```sql
CREATE TABLE group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, student_id)  -- Un estudiante solo una vez por grupo
);
```

## RLS (Row Level Security)

```sql
-- Profesores pueden ver grupos de sus cursos
CREATE POLICY "Professors can view groups of their courses"
ON groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = groups.course_id
    AND courses.professor_id = auth.uid()
  )
);

-- Profesores pueden modificar grupos de sus cursos
CREATE POLICY "Professors can modify groups of their courses"
ON groups FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = groups.course_id
    AND courses.professor_id = auth.uid()
  )
);
```

## Casos de Uso

### Caso 1: Grupos por Habilidad
- Agrupación: "Niveles de inglés"
- Grupos: "Básico", "Intermedio", "Avanzado"
- Uso: Asignar lecciones diferenciadas

### Caso 2: Equipos de Proyecto
- Agrupación: "Equipos de Proyecto Q1"
- Grupos: "Equipo 1", "Equipo 2", "Equipo 3"
- Uso: Trabajo colaborativo

### Caso 3: Rotación de Agrupaciones
- Profesor crea nueva agrupación cada mes
- Activa la nueva, desactiva la anterior
- Historial preservado

## UI/UX

### Layout de tres paneles
```
┌─────────────────┬─────────────────┬─────────────────┐
│  Agrupaciones   │     Grupos      │   Estudiantes   │
│                 │    (de la       │   (del grupo    │
│  - Grupos A1    │   agrupación    │   seleccionado) │
│  - Equipos Q1   │   seleccionada) │                 │
│  - Proyectos    │                 │  - Juan Pérez   │
│                 │  - Grupo 1      │  - María García │
│  [+ Nueva]      │  - Grupo 2      │  - ...          │
│                 │  - Grupo 3      │                 │
│                 │                 │  [+ Agregar]    │
│                 │  [+ Nuevo]      │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

### Estados visuales
- Agrupación activa: Borde verde, checkmark
- Agrupación inactiva: Opacidad reducida
- Grupo con estudiantes: Badge con contador
- Grupo vacío: Icono de advertencia amarilla

## Edge Cases

1. **Un curso sin agrupaciones**: Mostrar mensaje "Crea tu primera agrupación"
2. **Activar sin grupos**: Warning "La agrupación está vacía"
3. **Eliminar agrupación activa**: Confirmar, activar otra automáticamente o dejar sin agrupación activa
4. **Estudiante en múltiples grupos**: Permitir o restringir según reglas de negocio
5. **Cambio de agrupación activa**: Estudiantes ven inmediatamente el cambio
6. **Curso sin estudiantes**: Mostrar mensaje informativo

## Integración con Otros Módulos

### Presentaciones
- Profesor puede presentar a agrupación específica (futuro)
- Estudiantes filtrados por agrupación activa

### Lecciones
- Asignar lecciones a grupos específicos (futuro)
- Progreso por grupo

### Reportes
- Generar reportes por agrupación
- Comparar rendimiento entre grupos
