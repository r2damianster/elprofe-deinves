# Actividades con Media: listening, image_question

Ambas actividades dependen del campo `activities.media_url` para cargar el recurso multimedia. El contenido JSONB define la pregunta y opciones; el archivo en sí vive en `media_url`.

---

## listening

Comprensión auditiva. El estudiante escucha un audio y elige la respuesta correcta.

```typescript
{
  question: string;    // Pregunta sobre el audio
  options: {
    id: string;        // 'a', 'b', 'c', 'd'
    text: string;      // Texto de la opción
  }[];
  correct_id: string;  // ID de la opción correcta
  transcript?: string; // Transcripción del audio (accesibilidad, no visible por defecto)
}
```

**`media_url`:** URL directa al archivo de audio (MP3, WAV, OGG). Se usa en `<audio controls src={mediaUrl}>`.

**Evaluación:** Todo o nada — puntaje completo si `selected === correct_id`.

**Notas de implementación (`Listening.tsx`):**
- El componente acepta ambos formatos de options: `{id, text}` y strings planos (compatibilidad legada: `typeof opt === 'object' ? opt.text : opt`)
- El reproductor es el `<audio>` nativo del navegador

---

## image_question

Pregunta con imagen. El estudiante ve una imagen y elige entre opciones de texto.

```typescript
{
  question: string;    // Pregunta sobre la imagen
  options: {
    id: string;        // 'a', 'b', 'c', 'd'
    text: string;      // Texto de la opción
  }[];
  correct_id: string;  // ID de la opción correcta
}
```

**`media_url`:** URL directa a la imagen (JPG, PNG, WebP). Se usa en `<img src={mediaUrl}>`.

**Evaluación:** Todo o nada — puntaje completo si `selected === correct_id`.

**Notas de implementación (`ImageQuestion.tsx`):**
- Las opciones se muestran en grid 2×2 en pantallas medianas
- La imagen tiene `max-h-80` para no desplazar el contenido
- También acepta options como strings planos (compatibilidad legada)

---

## Subir media

Se usa `MediaUploader.tsx` en el Content Studio. Sube el archivo a Supabase Storage y devuelve la URL pública que se guarda en `activities.media_url`.
