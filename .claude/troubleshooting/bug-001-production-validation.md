# Reporte de Error: Omisión de Validación en Reglas de Producción

## 🚨 Descripción
El sistema permite enviar producciones (ensayos) con 1 sola palabra, ignorando el campo `min_words` de `public.production_rules`.

## 🛠 Contexto Técnico
- **Lección Test:** `6e4b4013-46dd-4e23-9f23-25cf6a49dc4e`
- **Regla en DB:** `min_words: 80`, `max_words: 250`.
- **Problema Detectado:** El componente `ActivityRenderer` o los subcomponentes de producción no están bloqueando el `onSubmit` cuando los requisitos no se cumplen.

## 🔍 Check-list para el Desarrollador (IA)
1. [ ] Verificar que el componente esté haciendo el fetch de `production_rules`.
2. [ ] Validar que el botón de envío tenga la propiedad `disabled={wordCount < minWords}`.
3. [ ] Limpiar signos de puntuación en `required_words` (Ej: Cambiar `"Context."` por `"Context"`).
4. [ ] Asegurar que el `compliance_score` se calcule antes del insert en Supabase.

## 📅 Estado
**Abierto.** Pendiente de revisión en la lógica de validación del Frontend.