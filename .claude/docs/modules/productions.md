# Módulo: Producciones

## Descripción
Sistema de producción escrita donde los estudiantes crean textos que son evaluados automáticamente y revisados por profesores. Incluye validación de reglas, análisis de integridad y retroalimentación.

## Componentes

### ProductionEditor.tsx
Editor de texto para que el estudiante escriba su producción.

**Props:**
```typescript
interface Props {
  lessonId: string;
  rules: ProductionRules;      // Reglas de la lección
  onSubmit: () => void;         // Callback al enviar
}
```

**Features:**
- Editor de texto enriquecido (o textarea)
- Contador de palabras en tiempo real
- Validación de reglas:
  - Mínimo/máximo de palabras
  - Palabras requeridas (deben aparecer)
  - Palabras prohibidas (no deben aparecer)
- Barra de métricas de integridad
- Autoguardado de borradores
- Botón "Enviar a revisión"

**Reglas validadas:**
```typescript
interface ProductionRules {
  min_words: number;
  max_words: number | null;
  required_words: string[];   // Deben estar presentes
  prohibited_words: string[]; // No deben estar presentes
  instructions: { es: string; en: string };
}
```

**Score de cumplimiento (compliance_score):**
- Calculado automáticamente
- 0-100 basado en:
  - Cumple mínimo de palabras: +25
  - Cumple máximo de palabras: +25
  - Contiene todas las palabras requeridas: +25
  - No contiene palabras prohibidas: +25

### ProductionReviewer.tsx
Panel del profesor para revisar producciones.

**Props:**
```typescript
interface Props {
  lessonId: string;
  productions: Production[];   // Lista de producciones
}
```

**Features:**
- Lista de producciones con estado
- Filtros: Pendientes, Revisadas, Todas
- Vista detallada de cada producción:
  - Texto completo
  - Conteo de palabras
  - Cumplimiento de reglas
  - Score de integridad
  - Eventos de integridad
- Asignar puntaje (0-100)
- Escribir retroalimentación
- Guardar revisión

**Estados de producción:**
- `draft` - Borrador, no enviado
- `submitted` - Enviado, esperando revisión
- `reviewed` - Revisado por el profesor

## Hook: useIntegrity.ts
Hook personalizado para métricas de integridad.

```typescript
interface IntegrityMetrics {
  score: number;               // 0-100
  timeOnTask: number;          // Segundos
  events: IntegrityEvent[];    // Eventos registrados
}

interface IntegrityEvent {
  type: 'paste' | 'blur' | 'focus' | 'idle' | 'typing_burst';
  timestamp: number;
  details?: any;
}
```

**Eventos trackeados:**
- `paste` - Pegar texto desde clipboard
- `blur` - Perder foco del editor
- `focus` - Ganar foco del editor
- `idle` - Sin actividad por X segundos
- `typing_burst` - Ráfaga de escritura

**Cálculo del score:**
```typescript
// Basado en:
// - Tiempo mínimo razonable para la longitud del texto
// - Ausencia de eventos de pegar
// - Patrones de escritura naturales
// - Tiempo de inactividad
```

## Base de Datos

### Tabla: productions

```sql
CREATE TABLE productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id),
  lesson_id uuid REFERENCES lessons(id),
  content text NOT NULL,
  word_count int DEFAULT 0,
  status production_status DEFAULT 'draft',
  score int,                    -- Puntaje del profesor
  feedback text,                -- Retroalimentación
  attempts int DEFAULT 1,
  compliance_score int,          -- Cálculo automático
  integrity_score int,          -- Análisis de comportamiento
  integrity_events jsonb[],     -- Array de eventos
  time_on_task int,             -- Segundos
  created_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz
);
```

### Tabla: production_rules

```sql
CREATE TABLE production_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES lessons(id) UNIQUE,
  min_words int DEFAULT 50,
  max_words int,
  required_words text[] DEFAULT '{}',
  prohibited_words text[] DEFAULT '{}',
  instructions jsonb,
  extra_rules jsonb             -- Extensible
);
```

## Flujo del Estudiante

1. **Desbloqueo**: Accede cuando `completion_percentage >= production_unlock_percentage`
2. **Lectura**: Ve las instrucciones y reglas
3. **Escritura**: Escribe en el editor
4. **Validación**: Sistema verifica reglas en tiempo real
5. **Revisión**: Estudiante revisa métricas de integridad
6. **Envío**: Click "Enviar a revisión"
7. **Espera**: Estado cambia a `submitted`
8. **Resultado**: Profesor revisa y asigna puntaje

## Flujo del Profesor

1. **Acceso**: Ver lista de producciones por lección
2. **Filtrado**: Ver solo las `submitted` pendientes
3. **Revisión**: Abre producción individual
4. **Análisis**: Lee texto, verifica cumplimiento
5. **Evaluación**: Asigna puntaje 0-100
6. **Feedback**: Escribe retroalimentación
7. **Guardar**: Estado cambia a `reviewed`

## Validación de Reglas

### Ejemplo de validación

```typescript
function validateProduction(
  content: string,
  rules: ProductionRules
): ValidationResult {
  const words = content.trim().split(/\s+/);
  const wordCount = words.length;
  
  const hasMinWords = wordCount >= rules.min_words;
  const hasMaxWords = rules.max_words ? wordCount <= rules.max_words : true;
  
  const contentLower = content.toLowerCase();
  const hasRequired = rules.required_words.every(w => 
    contentLower.includes(w.toLowerCase())
  );
  const hasProhibited = rules.prohibited_words.some(w => 
    contentLower.includes(w.toLowerCase())
  );
  
  return {
    valid: hasMinWords && hasMaxWords && hasRequired && !hasProhibited,
    checks: { hasMinWords, hasMaxWords, hasRequired, hasNoProhibited: !hasProhibited }
  };
}
```

## Score de Cumplimiento

```typescript
function calculateCompliance(result: ValidationResult): number {
  let score = 0;
  if (result.checks.hasMinWords) score += 25;
  if (result.checks.hasMaxWords) score += 25;
  if (result.checks.hasRequired) score += 25;
  if (result.checks.hasNoProhibited) score += 25;
  return score;
}
```

## Edge Cases

1. **Intentos múltiples**: Incrementar `attempts`, crear nuevo registro o actualizar según reglas de negocio
2. **Copiar y pegar**: Detectar con `integrity_events`, alertar profesor
3. **Ventana inactiva**: Pausar contador de tiempo
4. **Palabras con tildes**: Normalizar antes de validar
5. **Profesor no revisa**: Producción queda en `submitted` indefinidamente
6. **Estudiante edita después de enviar**: No permitir, o crear nuevo intento

## UI/UX Considerations

### Para Estudiantes
- Barra de progreso de palabras (visual)
- Highlight de palabras requeridas encontradas
- Alerta si se usa palabra prohibida
- Contador de tiempo visible (opcional)
- Mensaje de confirmación antes de enviar

### Para Profesores
- Vista rápida de métricas
- Comparación con reglas (checkmarks)
- Timeline de eventos de integridad
- Plantillas de feedback rápido
- Atajos de teclado para revisión masiva
