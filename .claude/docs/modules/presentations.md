# Módulo: Presentaciones Realtime

## Descripción
Sistema de presentación en tiempo real para lecciones. Permite al profesor controlar una presentación y que los estudiantes la sigan en sincronía.

## Componentes

### PresentationController.tsx
Panel de control para el profesor. Muestra la lección paso a paso con controles de navegación.

**Estados:**
```typescript
type PresentationState = {
  sessionId: string | null;
  code: string | null;           // Código de 6 dígitos
  lesson: Lesson | null;
  currentStep: number;            // Índice del paso actual
  isActive: boolean;             // Sesión activa/cerrada
  studentCount: number;          // Estudiantes conectados
};
```

**Flujo del profesor:**
1. Seleccionar lección a presentar
2. Click "Iniciar Presentación"
3. Sistema genera código de 6 dígitos
4. Mostrar código a estudiantes
5. Navegar entre pasos (anterior/siguiente)
6. Cerrar sesión cuando termina

**Features:**
- Vista de los pasos de la lección
- Controles de navegación (← →)
- Mostrar/ocultar código de sesión
- Contador de estudiantes conectados
- Cierre de sesión con confirmación

### PresentationViewer.tsx
Vista del estudiante para seguir la presentación.

**Flujo del estudiante:**
1. Click "Unirse a Presentación"
2. Ingresar código de 6 dígitos
3. Ver el paso actual sincronizado con el profesor
4. El profesor avanza → estudiante ve el siguiente paso

**Props:**
```typescript
interface Props {
  lesson: Lesson;
  currentStep: number;  // Sincronizado en tiempo real
  isConnected: boolean;
}
```

**Features:**
- Indicador de conexión
- Mostrar paso actual
- Contenido solo lectura (no interactivo)
- Mensaje cuando profesor cambia de paso

## Base de Datos

### Tabla: presentation_sessions

```sql
CREATE TABLE presentation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid REFERENCES profiles(id),
  lesson_id uuid REFERENCES lessons(id),
  code text NOT NULL UNIQUE,  -- 6 dígitos numéricos
  status text DEFAULT 'active',  -- 'active' | 'closed'
  current_step int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz
);
```

**Restricciones:**
- Código único de 6 dígitos
- Solo una sesión activa por profesor
- Auto-cleanup de sesiones antiguas

## Flujo de Datos en Tiempo Real

### Supabase Realtime

```typescript
// Profesor: Crear y actualizar sesión
const { data: session } = await supabase
  .from('presentation_sessions')
  .insert({ lesson_id, code, professor_id })
  .select()
  .single();

// Profesor: Cambiar de paso
await supabase
  .from('presentation_sessions')
  .update({ current_step: newStep })
  .eq('id', sessionId);

// Estudiante: Suscribirse a cambios
supabase
  .channel(`presentation_${code}`)
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'presentation_sessions', filter: `code=eq.${code}` },
    (payload) => {
      setCurrentStep(payload.new.current_step);
    }
  )
  .subscribe();
```

## Código de Sesión

### Generación
```typescript
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
```

- 6 dígitos numéricos
- Rango: 100000 - 999999
- Único en tabla (constraint UNIQUE)

## Estados de la Sesión

```
CREATED → ACTIVE → CLOSED
   ↓
(student joins)
```

- **CREATED**: Sesión creada, esperando estudiantes
- **ACTIVE**: Estudiantes conectados, presentando
- **CLOSED**: Sesión cerrada por profesor, no se puede unir

## Edge Cases

1. **Código expirado**: Sesiones cerradas después de X horas (cleanup)
2. **Profesor desconectado**: Sesión permanece activa
3. **Estudiante recarga**: Reconectar con mismo código
4. **Código inválido**: Mostrar error "Código no encontrado"
5. **Sesión cerrada**: Mostrar mensaje "La presentación ha terminado"
6. **Dos profesores mismo código**: Imposible por constraint UNIQUE

## UI/UX Considerations

### Profesor
- Pantalla completa recomendada
- Controles grandes para clic fácil
- Código visible y legible desde lejos
- Preview del paso siguiente

### Estudiante
- Diseño responsive
- Indicador claro de conexión
- Animación suave al cambiar de paso
- No requiere login (solo código)

## Métricas (futuro)

- Tiempo promedio por paso
- Estudiantes que se unieron vs total
- Interacciones durante presentación
- Tasa de finalización
