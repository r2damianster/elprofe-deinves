# Reporte de Diagnóstico Externo: Bug-003
**ID del Error:** Bug-003 - Fallo de Persistencia en Agrupaciones
**Analista:** IA (Análisis de Caja Negra)
**Estado:** Sugerencia de Corrección

## 1. Contexto del Análisis
Este reporte se genera tras analizar la estructura del proyecto (`tree`) y el esquema de base de datos SQL proporcionado. Como entidad externa, no tengo acceso a la lógica de ejecución (runtime), pero he detectado una discrepancia entre el estado de la UI y la persistencia en el backend.

## 2. Descripción del Problema
En la interfaz de `GroupManager.tsx`, el usuario puede previsualizar grupos (estado volátil). Sin embargo, al confirmar la creación ("Crear agrupación"):
1. Se crea exitosamente el registro en `group_sets` (se visualiza "Afinidad" en la lista inferior).
2. **Falla la vinculación:** La sección indica "0 grupo(s)", lo que sugiere que los registros en la tabla `groups` no se están creando o no están vinculando correctamente el `group_set_id`.
3. **Pérdida de integridad:** Al no haber grupos vinculados, las lecciones no pueden asignarse.

## 3. Hipótesis Técnicas (Basadas en SQL)

### A. El "Id Huérfano" (Más probable)
En tu SQL, la tabla `groups` tiene una columna `group_set_id uuid`. Es muy probable que en el frontend estés enviando la petición de creación de grupos **antes** de recibir el ID de la nueva `group_set` o que simplemente no se esté pasando ese parámetro en el `INSERT`.

### B. Fallo en la Cascada de Inserción
Si estás usando Supabase u otro cliente API, recuerda que la creación de una agrupación es un proceso de 3 pasos:
1. `INSERT` en `group_sets` -> Retorna `set_id`.
2. `INSERT` en `groups` (usando el `set_id`) -> Retorna `group_ids`.
3. `INSERT` en `group_members` (usando los `group_ids`).

Si el paso 1 tiene éxito pero el paso 2 falla (por ejemplo, por falta de permisos RLS o datos mal formateados), el sistema queda en el estado "incompleto" que muestra la imagen.

## 4. Sugerencias de Corrección

### Sugerencia 1: Verificación de la Función de Guardado
Recomiendo revisar en `src/components/professor/GroupManager.tsx` la función que maneja el evento del botón azul. Debería verse similar a este flujo lógico:

```typescript
// Lógica sugerida
const crearAgrupacionCompleta = async (datosPreview) => {
  // 1. Crear el Set
  const { data: nuevoSet } = await supabase.from('group_sets').insert({...});
  
  // 2. IMPORTANTE: Usar el ID del set para los grupos
  const gruposConId = datosPreview.map(g => ({
    ...g,
    group_set_id: nuevoSet.id, // <-- Verificar que esto no sea null
    course_id: idDelCurso
  }));

  const { data: gruposCreados } = await supabase.from('groups').insert(gruposConId);
  
  // 3. Vincular miembros...
}