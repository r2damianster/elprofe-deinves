# Flujo: Presentaciones Realtime

## Descripción
Sistema de presentación sincronizada donde el profesor controla el paso de una lección y los estudiantes la siguen en tiempo real.

## Actores
- **Profesor**: Controla la presentación, navega entre pasos
- **Estudiante**: Visualiza sincronizado, no interactúa
- **Sistema**: Mantiene sesión, sincroniza estado

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│  PROFESOR                        │  ESTUDIANTE                   │
│                                  │                               │
│  ┌─────────────────────────────┐ │ ┌──────────────────────────┐ │
│  │ 1. INICIAR PRESENTACIÓN      │ │ │ 1. UNIRSE A PRESENTACIÓN  │ │
│  └──────────────┬──────────────┘ │ └──────────┬───────────────┘ │
│                 │                │            │                 │
│                 ▼                │            │                 │
│  ┌─────────────────────────────┐ │            │                 │
│  │ PresentationController       │ │            │                 │
│  │ - Seleccionar lección        │ │            │                 │
│  │ - Click "Iniciar"            │ │            │                 │
│  └──────────────┬──────────────┘ │            │                 │
│                 │                │            │                 │
│                 ▼                │            ▼                 │
│  ┌─────────────────────────────┐ │ ┌──────────────────────────┐ │
│  │ Crear en presentation_      │ │ │ Ingresar código de       │ │
│  │ sessions:                   │ │ │ 6 dígitos                │ │
│  │ - code: "123456"            │ │ │                          │ │
│  │ - status: 'active'          │ │ │ "123456"                 │ │
│  │ - current_step: 0           │ │ │                          │ │
│  └──────────────┬──────────────┘ │ └──────────┬───────────────┘ │
│                 │                │            │                 │
│                 ▼                │            ▼                 │
│  ┌─────────────────────────────┐ │ ┌──────────────────────────┐ │
│  │ Mostrar código al profesor   │ │ │ Buscar sesión activa     │ │
│  │ "Comparte: 123456"           │ │ │ con ese código           │ │
│  └──────────────┬──────────────┘ │ └──────────┬───────────────┘ │
│                 │                │            │                 │
│                 │                │            ▼                 │
│                 │                │ ┌──────────────────────────┐ │
│                 │                │ │ Suscribirse a cambios    │ │
│                 │                │ │ Realtime en:             │ │
│                 │                │ │ presentation_sessions    │ │
│                 │                │ └──────────┬───────────────┘ │
│                 │                │            │                 │
│                 ▼                │            ▼                 │
│  ┌─────────────────────────────┐ │ ┌──────────────────────────┐ │
│  │ 2. NAVEGAR                   │ │ │ 2. SEGUIR                │ │
│  └──────────────┬──────────────┘ │ └──────────┬───────────────┘ │
│                 │                │            │                 │
│                 ▼                │            │                 │
│  ┌─────────────────────────────┐ │            │                 │
│  │ Profesor:                    │ │            │                 │
│  │ [Anterior] [Siguiente]       │ │            │                 │
│  │                              │ │            │                 │
│  │ Click "Siguiente" ───────────────▶ Actualiza current_step    │ │
│  │                              │ │            │                 │
│  └──────────────┬──────────────┘ │            │                 │
│                 │                │            │                 │
│                 │                │            ▼                 │
│                 │                │ ┌──────────────────────────┐ │
│                 │                │ │ PresentationViewer       │ │
│                 │                │ │ recibe update vía        │ │
│                 │                │ │ Realtime                 │ │
│                 │                │ │                          │ │
│                 │                │ │ Muestra paso actual      │ │
│                 │                │ └──────────────────────────┘ │
│                 │                │                               │
│                 ▼                │                               │
│  ┌─────────────────────────────┐ │                               │
│  │ UPDATE presentation_sessions  │ │                               │
│  │ SET current_step = 1          │ │                               │
│  │ WHERE code = '123456'         │ │                               │
│  └─────────────────────────────┘ │                               │
│                                  │                               │
│                 ▼                │                               │
│  ┌─────────────────────────────┐ │                               │
│  │ 3. CERRAR                  │ │  3. SESIÓN CERRADA         │ │
│  └──────────────┬──────────────┘ │ └──────────┬───────────────┘ │
│                 │                │            │                 │
│                 ▼                │            ▼                 │
│  ┌─────────────────────────────┐ │ ┌──────────────────────────┐ │
│  │ Click "Cerrar Sesión"       │ │ │ Recibe evento de cierre │ │
│  └──────────────┬──────────────┘ │ └──────────┬───────────────┘ │
│                 │                │            │                 │
│                 ▼                │            ▼                 │
│  ┌─────────────────────────────┐ │ ┌──────────────────────────┐ │
│  │ UPDATE presentation_sessions│ │ │ Mostrar:                 │ │
│  │ SET status = 'closed',       │ │ │ "La presentación ha      │ │
│  │     closed_at = now()        │ │ │ terminado"               │ │
│  │ WHERE code = '123456'        │ │ │                          │ │
│  └─────────────────────────────┘ │ └──────────────────────────┘ │
└─────────────────────────────────┘ └──────────────────────────────┘
```

## Secuencia Detallada

### 1. Iniciar Presentación (Profesor)

```typescript
// PresentationController.tsx
async function startPresentation(lessonId: string) {
  // Generar código único de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Crear sesión
  const { data } = await supabase
    .from('presentation_sessions')
    .insert({
      professor_id: user.id,
      lesson_id: lessonId,
      code,
      status: 'active',
      current_step: 0
    })
    .select()
    .single();
  
  // Mostrar código al profesor
  setSession(data);
}
```

### 2. Unirse (Estudiante)

```typescript
// Student ingresa código
async function joinPresentation(code: string) {
  // Buscar sesión activa
  const { data } = await supabase
    .from('presentation_sessions')
    .select('*, lesson:lessons(*)')
    .eq('code', code)
    .eq('status', 'active')
    .single();
  
  if (!data) {
    throw new Error('Código no válido o sesión cerrada');
  }
  
  // Suscribirse a cambios
  subscribeToPresentation(code);
  
  return data;
}
```

### 3. Sincronización Realtime

```typescript
// Suscripción Supabase Realtime
function subscribeToPresentation(code: string) {
  return supabase
    .channel(`presentation_${code}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'presentation_sessions',
        filter: `code=eq.${code}`
      },
      (payload) => {
        // Actualizar paso actual
        setCurrentStep(payload.new.current_step);
        
        // Si se cerró la sesión
        if (payload.new.status === 'closed') {
          showMessage('La presentación ha terminado');
        }
      }
    )
    .subscribe();
}
```

### 4. Navegación (Profesor)

```typescript
// Cambiar de paso
async function nextStep() {
  const newStep = currentStep + 1;
  
  await supabase
    .from('presentation_sessions')
    .update({ current_step: newStep })
    .eq('id', sessionId);
  
  // Los estudiantes reciben update automáticamente
}

async function previousStep() {
  const newStep = Math.max(0, currentStep - 1);
  
  await supabase
    .from('presentation_sessions')
    .update({ current_step: newStep })
    .eq('id', sessionId);
}
```

### 5. Cierre (Profesor)

```typescript
async function closePresentation() {
  await supabase
    .from('presentation_sessions')
    .update({ 
      status: 'closed',
      closed_at: new Date().toISOString()
    })
    .eq('id', sessionId);
  
  // Los estudiantes reciben notificación de cierre
}
```

## Base de Datos

### Tabla: presentation_sessions

```sql
CREATE TABLE presentation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid REFERENCES profiles(id),
  lesson_id uuid REFERENCES lessons(id),
  code text NOT NULL UNIQUE,      -- 6 dígitos
  status text DEFAULT 'active',     -- 'active' | 'closed'
  current_step int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

-- Índice para búsqueda por código
CREATE INDEX idx_presentation_code ON presentation_sessions(code);
```

## Edge Cases

1. **Código inválido**:
   - Mostrar: "Código no encontrado"
   - Sugerir: "Verifica con tu profesor"

2. **Sesión ya cerrada**:
   - Mostrar: "Esta presentación ya terminó"
   - Opción: Recargar y buscar otra

3. **Profesor se desconecta**:
   - Sesión permanece activa
   - Estudiantes siguen viendo último paso
   - Profesor puede reconectar si guarda el código

4. **Estudiante se desconecta**:
   - Al reconectar, reingresa código
   - Se sincroniza al paso actual

5. **Dos profesores mismo código**:
   - Imposible por constraint UNIQUE
   - Genera nuevo código automáticamente

6. **Código expirado**:
   - Job periódico limpia sesiones antiguas (> 24h)
   - O trigger que marca como 'closed' tras X tiempo

## UI Considerations

### Profesor (PresentationController)
```
┌─────────────────────────────────────────────────────────────┐
│ Presentación: Saludos Básicos                    [Cerrar]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Código:  ████  ████  ████  ████  ████  ████               │
│          [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ]               │
│                                                             │
│          Comparte este código con tus estudiantes          │
│                                                             │
│  Conectados: 15 estudiantes                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Paso anterior]        Paso 2 de 8        [Paso siguiente]│
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  CONTENIDO DEL PASO ACTUAL                           │   │
│  │                                                      │   │
│  │  (Renderizado igual que LessonViewer               │   │
│  │   pero sin interactividad del estudiante)            │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Estudiante (PresentationViewer)
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🟢 Conectado    Presentación en vivo                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  CONTENIDO DEL PASO ACTUAL                           │   │
│  │                                                      │   │
│  │  (Solo lectura, no interactivo)                      │   │
│  │                                                      │   │
│  │  El profesor está controlando                        │   │
│  │  la presentación...                                  │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│            Esperando siguiente paso... 🔴                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Métricas (futuro)

- Tiempo promedio por paso
- Estudiantes conectados vs total de curso
- Interacciones (si agregamos reacciones)
- Tasa de finalización
- Tiempo total de presentación
