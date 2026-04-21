# Bug-006: `<button>` Anidado en GroupManager (Warning DOM)

**Estado:** ABIERTO — warning visible en consola, no bloquea funcionalidad  
**Fecha apertura:** 2026-04-21  
**Severidad:** BAJA — degradación técnica (HTML inválido), sin impacto visual directo

---

## Síntoma

Consola del navegador al abrir la sección de Agrupaciones (profesor):

```
Warning: validateDOMNesting(...): <button> cannot appear as a descendant of <button>.
    at button
    at div
    at button
    at div
    at div
    at div
    at GroupManager (GroupManager.tsx:39)
    at CourseDetails (CourseDetails.tsx:25)
```

---

## Causa raíz

En `src/components/professor/GroupManager.tsx`, un elemento `<button>` contiene en su interior otro `<button>`. El HTML spec no permite anidar botones. React lo renderiza pero advierte porque es DOM inválido.

**Patrón típico del problema:**
```tsx
// Ejemplo de lo que probablemente ocurre:
<button onClick={handleGroupClick}>   {/* botón contenedor */}
  <div>
    <button onClick={handleEnable}>Habilitar</button>  {/* botón anidado */}
  </div>
</button>
```

---

## Fix recomendado

Reemplazar el botón exterior por `<div>` con `role="button"` y `onClick`, o reestructurar el layout para que los botones de acción sean hermanos, no hijos:

```tsx
// Opción A: div con rol semántico
<div role="button" tabIndex={0} onClick={handleGroupClick} className="...">
  <button onClick={(e) => { e.stopPropagation(); handleEnable(); }}>Habilitar</button>
</div>

// Opción B: separar área clickable del botón de acción
<div className="flex items-center justify-between">
  <div onClick={handleGroupClick} className="cursor-pointer flex-1">...</div>
  <button onClick={handleEnable}>Habilitar</button>
</div>
```

---

## Archivo afectado

`src/components/professor/GroupManager.tsx` — alrededor de la línea 39 (según stack trace)

---

## Notas

- No impide crear ni habilitar grupos (Bug-003 resuelto y verificado)
- El `e.stopPropagation()` es necesario en Opción A para evitar que el click del botón interior también dispare el handler del div exterior
