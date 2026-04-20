# Reporte de Diagnóstico Técnico: Bug-003

**ID del Error:** Bug-003 - Recursión Infinita en Políticas RLS y Fallo de Persistencia Atomizada  
**Estado:** **RESUELTO** (2026-04-19)

---

## 1. Descripción del Escenario

Al crear una agrupación aleatoria (ej: 4 grupos), el sistema fallaba con:

1. **Error de Base de Datos:** `infinite recursion detected in policy for relation "group_members"`.
2. **Persistencia Parcial:** La transacción se interrumpía. El `group_set` se creaba, pero los `groups` o sus `members` fallaban, dejando la agrupación "vacía" o incompleta.
3. **Estado Fantasma:** Tras un Hard Refresh (Ctrl+Shift+R), los datos aparecían parcialmente porque la caché del navegador se limpiaba y lograba leer lo que alcanzó a insertarse antes del error.

---

## 2. Causa Raíz

La política INSERT `"Estudiantes se auto-inscriben en grupos abiertos"` contenía un subquery autorreferencial en su `WITH CHECK`:

```sql
-- PROBLEMÁTICO: consulta group_members desde dentro de una política de group_members
SELECT count(*) FROM group_members gm WHERE gm.group_id = group_members.group_id
```

Al evaluar esta política durante un INSERT, PostgreSQL intentaba aplicar RLS al subquery, lo que volvía a evaluar la misma política, creando un bucle infinito hasta que el motor lo abortaba.

**Políticas confirmadas en producción antes del fix:**

| Política | Cmd | Problema |
|---|---|---|
| Miembros ven su grupo | SELECT | OK |
| Profesores y admin gestionan miembros | ALL | OK |
| Estudiantes se auto-inscriben en grupos abiertos | INSERT | **Recursión en WITH CHECK** |
| Estudiantes ven miembros de grupos de sus cursos | SELECT | OK |
| Estudiantes pueden salir de grupos abiertos | DELETE | OK |

---

## 3. Solución Aplicada

### Migración: `fix_group_members_rls_recursion`

```sql
-- 1. Función SECURITY DEFINER que consulta group_members sin disparar RLS
CREATE OR REPLACE FUNCTION count_group_members(gid uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*) FROM group_members WHERE group_id = gid;
$$;

-- 2. Reemplazar la política INSERT que causaba recursión
DROP POLICY IF EXISTS "Estudiantes se auto-inscriben en grupos abiertos" ON public.group_members;

CREATE POLICY "Estudiantes se auto-inscriben en grupos abiertos"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  (student_id = auth.uid()) AND (EXISTS (
    SELECT 1
    FROM groups g
    JOIN course_students cs ON (cs.course_id = g.course_id AND cs.student_id = auth.uid())
    WHERE g.id = group_members.group_id
      AND g.enrollment_open = true
      AND (g.max_members IS NULL OR count_group_members(g.id) < g.max_members)
  ))
);
```

**Clave:** `SECURITY DEFINER` hace que la función se ejecute con los permisos del creador (superuser), bypasseando RLS y rompiendo el ciclo.

---

## 4. Validación

- Crear agrupación aleatoria de 4 grupos sin recibir error `infinite recursion`.
- Los 4 grupos aparecen inmediatamente en la UI sin recargar.
- Estudiantes aún no pueden auto-inscribirse en grupos cerrados (lógica preservada).

---

## 5. Archivos Afectados

| Artefacto | Tipo | Detalle |
|---|---|---|
| `supabase/migrations/fix_group_members_rls_recursion` | Migración BD | Aplicada vía MCP |
| `group_members` (RLS) | Política INSERT | Reescrita con función SECURITY DEFINER |
