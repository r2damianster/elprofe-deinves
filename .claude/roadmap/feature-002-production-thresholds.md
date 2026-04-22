# Feature-002 — Umbrales configurables de exigencia en Producciones

**Estado:** 🗺️ DISEÑO — pendiente de implementación  
**Categoría:** Feature nueva  
**Prioridad:** Media  
**Componentes:** `production_rules` (BD), `ProductionEditor.tsx`, Content Studio

---

## Objetivo

Permitir al profesor ajustar el **grado de exigencia** de compliance e integridad
por lección. En lugar de exigir el 100% de cada métrica, el profesor define un
umbral mínimo aceptable.

---

## Ejemplos concretos

| Configuración | Efecto |
|---|---|
| `required_words: 20`, `compliance_threshold: 50%` | Solo 10 de las 20 palabras requeridas son obligatorias |
| `integrity_threshold: 60%` | Un estudiante con `integrity_score = 60` pasa; con 59, no |
| `compliance_threshold: 100%` | Comportamiento actual (todas las reglas obligatorias) |

---

## Campos nuevos en `production_rules`

```sql
ALTER TABLE production_rules
  ADD COLUMN compliance_threshold  int2 DEFAULT 100,  -- % mínimo de cumplimiento (0-100)
  ADD COLUMN integrity_threshold   int2 DEFAULT 0;    -- % mínimo de integridad (0 = sin límite)
```

- `compliance_threshold`: porcentaje del score de compliance requerido para habilitar el submit. Default 100 (comportamiento actual intacto).
- `integrity_threshold`: si `integrity_score < integrity_threshold`, se muestra advertencia antes del submit (no bloquea, pero avisa). Default 0 (sin restricción).

---

## Impacto en validación (`ProductionEditor.tsx`)

### Compliance
Actualmente el submit se habilita cuando `wordCount >= min_words` y todas las `required_words` presentes.

Con este feature:
```typescript
// compliance_threshold = 80 → solo necesita 80% de las reglas cumplidas
const requiredCompliance = rules.compliance_threshold ?? 100;
const canSubmit = compliance >= requiredCompliance && wordCount >= rules.min_words;
```

### Integridad
Actualmente la integridad no bloquea el submit (solo se registra).

Con este feature:
```typescript
const requiredIntegrity = rules.integrity_threshold ?? 0;
if (requiredIntegrity > 0 && integrity < requiredIntegrity) {
  // Mostrar advertencia: "Tu integridad está por debajo del mínimo requerido"
  // No bloquea — permite enviar con confirmación
}
```

---

## UI en Content Studio (configuración por el profesor)

En la sección de reglas de producción, agregar dos sliders:

```
Exigencia de cumplimiento:  [====50%====] 50%
(Porcentaje mínimo de las reglas que debe cumplir el estudiante)

Umbral de integridad:  [=======0%=====] Sin límite
(Integridad mínima requerida para enviar sin advertencia)
```

---

## Cómo se muestra al estudiante

En `ProductionEditor`, el panel de métricas ya muestra compliance e integrity.
Agregar junto al valor el umbral requerido:

```
Cumplimiento  72% / mín. 50% ✓
Integridad    65% / mín. 60% ✓
```

---

## Notas

- Default 100/0 preserva comportamiento actual — migración no rompe nada
- Relacionado con Feature-001: la IA podría considerar estos umbrales al calificar
- La advertencia de integridad es orientativa — el profesor decide si bloquear o no
