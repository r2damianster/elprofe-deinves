# Feature-003 — Taxonomía y Etiquetado de Actividades

**Estado:** 🗺️ DISEÑO  
**Prioridad:** Media (no bloquea flujo actual, pero escala con el crecimiento del banco)  
**Problema raíz:** A futuro habrá cientos de actividades en el banco. Sin clasificación, el profesor tiene que revisar todas para encontrar las que necesita.

---

## Diagnóstico del problema

Actualmente una actividad tiene: `type`, `title` (implícito en el JSON), `content JSONB`.  
No tiene: descripción breve, etiquetas, nivel de dificultad ni jerarquía más allá de la lección a la que pertenece.

El profesor necesita poder:
- **Filtrar** por tema, tipo, nivel o etiqueta personalizada
- **Ver poco** (tarjetas compactas) o **ver mucho** (tabla densa con todos los metadatos)
- **Saber de qué trata** una actividad sin tener que abrirla
- **Reutilizar** la misma actividad en varias lecciones sin duplicarla

---

## Propuesta de arquitectura

### Nivel 1 — Lección como categoría natural (ya existe)
La lección actúa como la agrupación principal (`#`). Las actividades dentro de ella heredan el contexto de esa lección.  
**No requiere cambio.** La lección ya tiene `title` y `description`.

### Nivel 2 — Metadatos por actividad (nuevo)

Agregar a la tabla `activities` tres columnas:

| Columna | Tipo | Descripción |
|---|---|---|
| `description` | `text` | Frase corta (1-2 líneas) que resume qué practica el estudiante |
| `tags` | `text[]` | Etiquetas libres: `["present-tense", "vocabulary", "b1", "reading"]` |
| `difficulty` | `int2` | 1 = fácil, 2 = medio, 3 = difícil |

Migración mínima — 3 columnas, sin cambios en JSONB existente.

### Nivel 3 — Temas globales (opcional, fase 2)

Tabla `topics` con `id`, `name`, `color`. Relación M:N `activity_topics`. Permite agrupar actividades de distintas lecciones bajo un mismo tema pedagógico (e.g., "Presente Simple", "Salud", "Viajes").

---

## Flujo de creación (Content Studio)

Al crear o editar una actividad, agregar debajo del tipo:

```
┌─────────────────────────────────────────────────────────┐
│ Descripción breve (opcional)                            │
│ [textarea 1 línea: "Seleccionar la opción correcta..."] │
│                                                          │
│ Etiquetas   [present-tense ×] [b1 ×] [+ Agregar]       │
│ Dificultad  ○ Fácil  ● Medio  ○ Difícil                 │
└─────────────────────────────────────────────────────────┘
```

- Etiquetas: input con autocompletar contra etiquetas ya usadas en el proyecto
- Al guardar: se actualiza `activities.description`, `activities.tags`, `activities.difficulty`

---

## Flujo de asignación a lección

En el panel de vinculación de actividades a lección, reemplazar la lista plana por:

**Barra de herramientas:**
```
[ Buscar por título o descripción ]  [ Filtrar por tipo ▾ ]  [ Etiquetas ▾ ]  [ Dificultad ▾ ]
[ Vista: ☰ Lista  ⊞ Tarjetas ]
```

**Vista Lista** (densa, para cuando hay muchas):
| | Título | Tipo | Etiquetas | Dif. | Lección actual |
|---|---|---|---|---|---|
| ☐ | Fill in the blank — Past | fill_blank | past, b1 | ● | Lesson 3 |

**Vista Tarjetas** (exploración visual):
```
┌────────────────────────┐
│ [fill_blank]  ● Medio  │
│ Fill the blank — Past  │
│ "Completar con la forma│
│  correcta del pasado"  │
│ #past  #b1  #grammar   │
│ [ + Asignar ]          │
└────────────────────────┘
```

---

## Cambios por componente

| Componente | Cambio |
|---|---|
| `activities` (BD) | `ADD COLUMN description text`, `tags text[] DEFAULT '{}'`, `difficulty int2 DEFAULT 2` |
| `ActivityEditor` (Content Studio) | Agregar campos description, tags, difficulty |
| `LessonEditor` / vinculación | Filtros + toggle vista lista/tarjetas |
| `ActivityCard` (nuevo) | Componente reutilizable para la tarjeta de actividad |

---

## Lo que NO cambia

- El JSONB `content` de las actividades — no se toca.
- La forma en que las actividades se renderizan para el estudiante — sin cambio.
- La tabla `lesson_activities` — sin cambio.

---

## Fases de implementación sugeridas

**Fase A (mínima, valor inmediato):**
1. Migración: 3 columnas en `activities`
2. Agregar campos en `ActivityEditor` (content studio)
3. Agregar buscador por título/descripción en el panel de vinculación

**Fase B (filtrado completo):**
4. Filtros por tipo, etiquetas y dificultad en vinculación
5. Toggle vista lista / tarjetas

**Fase C (temas globales):**
6. Tabla `topics` + relación M:N
7. Vista de banco de actividades por tema (transversal a lecciones)

---

## Notas

- Las etiquetas son texto libre para máxima flexibilidad. Si se quiere consistencia, una tabla de tags con autocompletar basta — no hace falta normalizar.
- El campo `description` resuelve el 80% del problema: con una frase visible sin abrir la actividad, el profesor ya sabe qué es.
- Implementar Fase A no bloquea ni rompe nada existente.
