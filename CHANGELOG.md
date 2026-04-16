# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Activity management in lessons**: Fixed display of activity titles when editing existing lessons. Now professors can properly view, add, reorder, and remove activities within lessons via the LessonEditor.

## [0.5.0] — 2026-04-12

### Added
- **Dual role support** (professor + administrator): `is_admin` column in `profiles` table
- **`get_user_role()` function**: returns `'admin'` if `is_admin = true`, otherwise base role
- **View selector** on login for users with dual role — switch between Admin and Professor dashboards
- **Switch view buttons** in both AdminDashboard and ProfessorDashboard headers
- **StudentDiagnosticPage**: automatic detection of student access issues (no profile, no enrollment, no lesson assignments, courses without lessons)
- **Complete database schema documentation** (`docs/database-schema.sql`) with 18 tables and 9 diagnostic queries
- `is_admin` column to `database.types.ts`

### Changed
- Updated `README.md` with dual role documentation, admin panel features, and new migrations
- Updated all Claude agent docs: `agente-auth.md`, `especialista-bd.md`, `gerente-general.md`, `agente-frontend.md`

### Fixed
- Hidden "Crear Contenido" button on small screens

## [0.4.0] — 2026-04-11

### Added
- **Content Studio**: professors can create/edit lessons and activities with full editor (`LessonEditor`, `ActivityEditor`, `ActivityBank`, `MediaUploader`)
- **RLS policies for Content Studio**: professors can only manage their own content

### Changed
- Production activities now flow through normal lesson progression
- Production feedback visible to students after review

## [0.3.0] — 2026-04-07

### Added
- **Multilingual support per course**: `language` column in `courses` table (`es` / `en`)
- **Multilingual activities**: `title` and `content` support `{es: '...', en: '...'}` format
- **Multilingual lessons**: `title` and `description` support `{es: '...', en: '...'}` format
- `i18n.ts` with `resolveField(field, lang)` utility

### Fixed
- React error #31 when rendering title/description as objects
- Pass `courseLanguage` to `CourseDetails` and `ProfessorLessonView`

## [0.2.0] — 2026-04-06

### Added
- **Real-time presentation mode**: professor controls slides, students follow live
- **Presentation blocking**: activities lock when presentation is active
- **Slide/PDF embedding**: support for embedded Google Slides and PDFs in content steps
- **Lesson unassignment**: button to unassign lessons from a course
- **5 new activity types**: error_spotting, category_sorting, matrix_grid, image_question, listening

### Fixed
- Presentation not loading slides/PDFs due to incorrect content format
- Content steps not rendering when content is a JSON array

## [0.1.0] — 2026-04-05

### Added
- **Group system**:
  - `group_sets`: named groupings per course with `is_active` for archiving
  - `groups`: groups within a grouping
  - `group_members`, `group_progress`, `group_lesson_assignments`, `group_activity_completions`
- **Three group creation modes**: random, affinity (student choice), manual
- **Move students** between groups with one click
- **Assign lessons to entire grouping** at once
- **Real-time sync of group completions**
- **Group enrollment tab** in student dashboard

### Changed
- Lesson selector now appears in grouping view
- Group sets can be activated/deactivated (archived)

## [0.0.1] — 2026-04-03

### Added
- **Core platform**: authentication, role-based routing (admin/professor/student)
- **Professor dashboard**: course management, lesson assignment, production review
- **Student dashboard**: assigned lessons, activity completion, progress tracking
- **11 activity types**: multiple_choice, matching, fill_blank, ordering, short_answer, long_response, essay, structured_essay, drag_drop, true_false, open_writing
- **Production system**: text editor with word count, compliance scoring, integrity detection (copy-paste, tab change, right-click, keyboard shortcuts)
- **Real-time compliance and integrity bars** in all writing components
- **Student results panel** with per-lesson detailed view
- **Lesson retry** functionality
- **Forensic integrity system**: `integrity_events`, `time_on_task`, `extra_rules`
- **Metrics columns**: `attempts`, `compliance_score`, `integrity_score`
- **Supabase RLS policies** for all tables

### Removed
- Public registration from Login (private platform only)

---

[Unreleased]: https://github.com/r2damianster/elprofe-deinves/compare/f3a3684...HEAD
[0.5.0]: https://github.com/r2damianster/elprofe-deinves/compare/66e3f5e...f3a3684
[0.4.0]: https://github.com/r2damianster/elprofe-deinves/compare/3b7ca93...66e3f5e
[0.3.0]: https://github.com/r2damianster/elprofe-deinves/compare/80aa6c9...3b7ca93
[0.2.0]: https://github.com/r2damianster/elprofe-deinves/compare/156bb92...80aa6c9
[0.1.0]: https://github.com/r2damianster/elprofe-deinves/compare/3c63c77...156bb92
[0.0.1]: https://github.com/r2damianster/elprofe-deinves/commits/3c63c77
