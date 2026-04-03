# El Profe de Inves - Plataforma Educativa Interactiva

Una plataforma web diseñada para la Universidad Laica Eloy Alfaro de Manabí (ULEAM), orientada a digitalizar y gamificar la enseñanza de las materias de investigación del profesor Arturo Rodríguez.

Esta plataforma proporciona una experiencia inmersiva mediante clases interactivas organizadas por pasos que incluyen contenido enriquecido, evaluaciones en tiempo real y redacción de ensayos finales bajo reglas estrictas controladas por el sistema.

## Características Principales

### 👨‍🏫 Panel del Profesor
- **Gestión Jerárquica:** Creación y administración de **Cursos**. Cada curso tiene asignados los estudiantes matriculados.
- **Asignación de Lecciones:** Módulo para asignar lecciones pre-existentes a múltiples cursos simultáneamente, mejorando la reutilización de material.
- **Seguimiento Continuo:** Visualización del progreso general de los estudiantes en tiempo real a través de las métricas de Supabase.

### 🎓 Panel del Estudiante
- **Aprendizaje por Pasos (Carrusel):** Las lecciones están divididas en un carrusel paso a paso que mezcla teoría (texto, video, visor de PDFs con focalización de lectura) con preguntas interactivas.
- **10 Tipos de Actividades Integradas:** Soporte para ítems de Opción Múltiple, Arrastrar y Soltar, Completar Espacios Blancos, Emparejamiento, Listening, Verdad o Falso, Imágenes interactivas y más.
- **Intentos Controlados (Gamificación):** Los estudiantes pueden reintentar las actividades si obtienen una nota reprobatoria, pero con un máximo de 3 "vidas" o intentos programados para incentivar el estudio asertivo.

### 📝 Producción Escrita (Ensayo Final)
- **Módulo de "Producción":** Una lección finaliza con un bloque de escritura argumentativa, el cual se desbloquea al superar una nota mínima en las actividades (ej. 80%).
- **Reglas Automáticas:** El sistema evalúa automáticamente el ensayo antes de permitir su envío, exigiendo un mínimo/máximo de palabras, e inhibiendo palabras "prohibidas" u obligando a utilizar "palabras requeridas".
- **Revisión del Profesor:** Permite al maestro asignar una calificación (0-100) y dar feedback. El estudiante dispone de 1 reintento para corregir y regresar a intentar subir de nota.

## Stack Tecnológico 💻
El proyecto es una SPA (Single Page Application) moderna diseñada para rapidez, reactividad y seguridad:

- **Frontend:**
  - React 18
  - Vite (Build Tooling y Dev Server)
  - TypeScript
  - Tailwind CSS (Estilos, utilidades y diseño responsivo)
  - Lucide React (Sistema de íconos)
  - Zustand / Context API (Gestión de estado)

- **Backend (Supabase):**
  - PostgreSQL (Base de datos relacional y funciones PL/pgSQL).
  - Row Level Security (RLS) policies estrictas (evita accesos no autorizados y bloquea consultas cruzadas no requeridas).
  - Supabase Auth (Sistema seguro de autenticación por email/contraseña con roles `admin`, `professor`, `student`).

## Instalación y Arranque 🚀

Para correr esta interfaz localmente:

1. Clona el repositorio:
   ```bash
   git clone https://github.com/r2damianster/elprofe-deinves.git
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura tus variables de entorno creando un `.env` basado en la clave de Supabase:
   ```env
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
   ```
4. Corre el entorno de desarrollo local:
   ```bash
   npm run dev
   ```

## Estructura de la Base de Datos
El proyecto migró recientemente de un diseño de dependencia directa simple a un sistema Many-to-Many (`lessons` <-> `lesson_activities` <-> `activities`), permitiendo que el mismo banco de preguntas o lecciones multimedia puedan reciclarse en clases futuras o distintos cursos sin tener que duplicar información.

Para más contexto en cómo crear lecciones manualmente y cómo estructurar el contenido JSON por cada tipo, revisa el archivo [DOCUMENTACION_LECCIONES.md](./DOCUMENTACION_LECCIONES.md) incluido en este repositorio.
