# Guía Técnica: Creación de Lecciones y Actividades en la Base de Datos

Esta plataforma educativa utiliza una arquitectura relacional en **Supabase** que permite el reúso de actividades entre diferentes lecciones. Como no existe aún un panel de creación de lecciones automatizado para el profesor, este documento explica a nivel técnico cómo se debe poblar la base de datos para crear material educativo.

---

## 1. Estructura de "Lessons" (Lecciones)
La tabla `lessons` es el contenedor principal. Define el título, descripción, y un archivo JSON (`content`) que diagrama el "camino" o "temario" inicial de la lección (textos, videos o PDFs), antes de llegar a las actividades evaluativas.

**Columnas Importantes:**
- `has_production` (boolean): `true` si la lección requiere la redacción de un ensayo final.
- `production_unlock_percentage` (int): Porcentaje necesario (0-100) en las actividades para desbloquear el ensayo final.

### Estructura JSON de `content`:
Debes enviar un JSON con la estructura plana de bloques `steps`:

```json
{
  "steps": [
    {
      "type": "CONTENT",
      "title": "Introducción",
      "text": "Bienvenidos al curso de metodología. Estudiaremos bla bla bla..."
    },
    {
      "type": "VIDEO",
      "title": "Aprende lo Básico",
      "url": "https://www.youtube.com/embed/XXXXXX"
    },
    {
      "type": "READING_FOCUS",
      "title": "Lectura Guiada",
      "pdf_url": "https://mi-servidor.com/documento.pdf",
      "page": 3,
      "task": "Lee con atención el segundo párrafo y extrae las 3 ideas principales."
    }
  ]
}
```

---

## 2. Tipos de "Activities" (Actividades Evaluativas)
Las actividades viven en el banco central (`activities`) y luego se enlazan cruzadamente con las lecciones a través de `lesson_activities`. En la tabla `activities` debes proveer un JSON llamado `content` que dependerá del tipo (`type`) de actividad elegida.

Existen 10 tipos de actividades permitidas en el ENUM `activity_type`:

### a. `multiple_choice` / `true_false`
```json
{
  "question": "¿Cuál es la capital de Francia?",
  "options": ["Madrid", "París", "Berlín"],
  "correct_answer": 1 
}
```
*(Nota: El `correct_answer` es el índice del arreglo, comenzando en 0).*

### b. `fill_blank`
```json
{
  "text": "El agua hierve a [100] grados Celsius a nivel del mar.",
  "blanks": ["100"]
}
```

### c. `drag_drop` / `ordering`
```json
{
  "question": "Ordena los planetas desde el más cercano al sol",
  "items": ["Mercurio", "Venus", "Tierra", "Marte"]
}
```

### d. `matching`
```json
{
  "question": "Empareja los animales con su tipo",
  "pairs": [
    { "left": "Perro", "right": "Mamífero" },
    { "left": "Águila", "right": "Ave" }
  ]
}
```

### e. `listening` / `image_question`
Para estos tipos, debes hacer uso adicional de la columna `media_url` en la tabla SQL para apuntar a la imagen o al archivo de audio MP3.
```json
{
  "question": "¿Qué animal hace el sonido que estás escuchando?",
  "options": ["Perro", "Gato", "Pato"],
  "correct_answer": 2
}
```

### f. `essay` / `short_answer`
```json
{
  "question": "Describe brevemente la fotosíntesis."
}
```

---

## 3. Flujo de Inserción Correcto

Al momento de hacer scripts SQL, siempre sigue estos 3 pasos en orden:

**1. Crear la Lección:**
```sql
INSERT INTO lessons (id, title, description, content, has_production, production_unlock_percentage)
VALUES ('mi-uuid-leccion', 'Lección 1', 'Desc...', '{"steps":[]}'::jsonb, true, 80);
```

**2. Crear las Actividades (Banco Público):**
```sql
INSERT INTO activities (id, type, title, content, points, media_url)
VALUES ('mi-uuid-actividad', 'multiple_choice', 'Pregunta Fácil', '{...}'::jsonb, 10, NULL);
```

**3. Crear el Enlace Lección <-> Actividad (Tabla Puente):**
```sql
INSERT INTO lesson_activities (lesson_id, activity_id, order_index)
VALUES ('mi-uuid-leccion', 'mi-uuid-actividad', 1);
```

---

## 4. Ensayo Final (Producción)
Si configuraste tu lección con `has_production = true`, puedes (y debes) insertar las reglas para esa redacción en la tabla `production_rules`:

```sql
INSERT INTO production_rules (lesson_id, min_words, max_words, required_words, prohibited_words, instructions)
VALUES (
  'mi-uuid-leccion',
  100, 
  500, 
  ARRAY['metodología', 'ciencia'], 
  ARRAY['obvio', 'quizás'], 
  'Haz un ensayo argumentativo usando los conceptos aprendidos.'
);
```
