# Bug-007: Producción Grupal — Solo el Primero en Entregar Cuenta para el Grupo

**Estado:** ABIERTO — feature no implementada  
**Fecha apertura:** 2026-04-21  
**Severidad:** MEDIA — comportamiento esperado ausente; actualmente cada estudiante entrega de forma independiente

---

## Comportamiento deseado

Cuando una lección tiene producción escrita y los estudiantes están en grupos:

1. Cualquier miembro del grupo puede redactar y enviar la producción.
2. El **primero en entregar** cuenta como la entrega oficial del grupo.
3. Los demás miembros del grupo ven que "el grupo ya entregó" y no necesitan (o no pueden) entregar otra vez.
4. El profesor revisa **una sola producción por grupo**, no una por estudiante.

---

## Comportamiento actual

Cada estudiante entrega su propia producción de forma completamente independiente. No existe vinculación entre producciones del mismo grupo. El profesor recibe tantas producciones como estudiantes hayan enviado.

---

## Diseño propuesto

### Opción A — Producción grupal: un solo documento compartido (recomendada)

- Al abrir `ProductionEditor`, si el estudiante pertenece a un grupo activo en esa lección, el componente carga la producción del grupo (no la individual).
- La producción se almacena con `group_id` en lugar de (o además de) `student_id`.
- El primer estudiante que escribe y guarda "activa" la producción del grupo.
- Si otro miembro del grupo abre el editor, ve el texto ya escrito con un badge "Entregado por [nombre]".
- Los demás miembros pueden seguir editando hasta que alguien presione "Entregar" — momento en que se bloquea para todos.

### Opción B — Primera entrega bloquea al resto (más simple)

- Se mantiene la producción individual.
- Cuando un miembro del grupo entrega (`status = 'submitted'`), se registra en una tabla `group_production_lock` con `(group_id, lesson_id, student_id, submitted_at)`.
- Los demás miembros del grupo ven el editor en modo "solo lectura" con un mensaje: "Tu compañero [nombre] ya entregó la producción del grupo."
- El profesor solo ve/califica esa producción (la del primero).

---

## Cambios requeridos

### Base de datos

**Opción A:**
- Agregar columna `group_id UUID REFERENCES groups(id)` a la tabla `productions` (nullable).
- RLS: estudiantes del grupo pueden leer la producción de su grupo.

**Opción B:**
- Nueva tabla:
```sql
CREATE TABLE group_production_locks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid REFERENCES groups(id) ON DELETE CASCADE,
  lesson_id   uuid REFERENCES lessons(id) ON DELETE CASCADE,
  student_id  uuid REFERENCES profiles(id),
  production_id uuid REFERENCES productions(id),
  submitted_at timestamptz DEFAULT now(),
  UNIQUE (group_id, lesson_id)
);
```

### Frontend

- `ProductionEditor.tsx`: al cargar, verificar si hay un lock activo para el grupo del estudiante en esa lección.
  - Si hay lock y el estudiante NO es quien entregó → mostrar vista de solo lectura con nombre del compañero.
  - Si hay lock y el estudiante SÍ es quien entregó → mostrar confirmación de entrega.
  - Si no hay lock → flujo normal; al entregar, crear el lock.
- `ProductionReviewer.tsx` (profesor): agrupar producciones por grupo y mostrar solo la producción con lock activo.

### Lógica de grupos

- Verificar que el estudiante tiene un grupo activo en el curso de la lección antes de aplicar la lógica grupal.
- Si el estudiante no pertenece a ningún grupo, el flujo es individual (sin cambios).

---

## Archivos clave a modificar

| Archivo | Cambio |
|---|---|
| `src/components/student/ProductionEditor.tsx` | Detectar grupo activo + lógica de lock |
| `src/components/professor/ProductionReviewer.tsx` | Filtrar por lock grupal |
| Supabase — nueva tabla o columna | Según opción elegida |
| RLS de `productions` / nueva tabla | Políticas de acceso grupal |

---

## Decisión pendiente

Elegir entre **Opción A** (documento compartido) o **Opción B** (lock al primer envío). La Opción B es más sencilla de implementar y menos invasiva del modelo de datos actual.
