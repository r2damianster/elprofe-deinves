# ElProfe de Inves — QWEN Context

## Project Overview

**ElProfe de Inves** is an interactive educational platform for the Universidad Laica Eloy Alfaro de Manabí (ULEAM), designed to digitize and gamify research subjects taught by Professor Arturo Rodríguez.

- **Repository**: https://github.com/r2damianster/elprofe-deinves
- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS + Supabase (PostgreSQL + Auth + Realtime)
- **Node version**: 18+

## Key Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
```

## Architecture

### Frontend

```
src/
├── App.tsx                          # Root: AuthProvider + role-based routing (+ dual role selector)
├── contexts/
│   └── AuthContext.tsx              # useAuth() → {user, profile, loading, signIn, signUp, signOut}
├── lib/
│   ├── supabase.ts                  # Typed Supabase client
│   ├── database.types.ts            # TypeScript types for all DB tables
│   ├── activityTypes.ts             # isProduction(type): boolean
│   └── i18n.ts                      # resolveField(field, lang): string (multilingual support)
├── components/
│   ├── Login.tsx
│   ├── admin/
│   │   ├── AdminDashboard.tsx       # Admin panel: manage professors + student diagnostics
│   │   └── StudentDiagnosticPage.tsx # Full diagnostic view of all students' status
│   ├── professor/
│   │   ├── ProfessorDashboard.tsx   # Tabs: courses | assignments | productions | studio
│   │   ├── CourseManager.tsx        # Course CRUD
│   │   ├── CourseDetails.tsx        # Students, groups, lesson selector
│   │   ├── GroupManager.tsx         # Group management within a course (with group_sets)
│   │   ├── LessonAssignment.tsx     # Assign lessons to courses/students
│   │   ├── PresentationController.tsx # Real-time presentation control
│   │   ├── ProductionReviewer.tsx   # Review student productions
│   │   ├── StudentManager.tsx       # Manage course students
│   │   └── studio/                  # Content Studio — professor content creation
│   │       ├── ContentStudio.tsx
│   │       ├── LessonEditor.tsx     # Lesson CRUD + step builder (text, video, slides, image, audio, link, activity)
│   │       ├── ActivityEditor.tsx   # Activity CRUD
│   │       ├── ActivityBank.tsx     # Activity library with search/filter + "Add to lesson" for LessonEditor
│   │       └── MediaUploader.tsx    # File upload to Supabase Storage
│   └── student/
│       ├── StudentDashboard.tsx     # Tabs: lessons | groups | my results
│       ├── LessonViewer.tsx         # Step-by-step lesson progression
│       ├── ActivityRenderer.tsx     # Activity type switch
│       ├── ContentRenderer.tsx      # JSON content renderer
│       ├── GroupEnrollment.tsx      # Group self-enrollment
│       ├── PresentationViewer.tsx   # Follow live presentations
│       ├── ProductionEditor.tsx     # Free text production editor
│       ├── StudentResults.tsx       # "My Results" panel
│       ├── LessonResults.tsx        # Per-lesson detailed results
│       └── activities/              # 11+ activity type components
│           ├── MultipleChoice.tsx
│           ├── Matching.tsx
│           ├── FillBlank.tsx
│           ├── Ordering.tsx
│           ├── ErrorSpotting.tsx
│           ├── CategorySorting.tsx
│           ├── MatrixGrid.tsx
│           ├── ShortAnswer.tsx
│           ├── LongResponse.tsx
│           ├── Essay.tsx
│           ├── StructuredEssay.tsx
│           ├── useIntegrity.ts      # Anti-plagiarism hook
│           └── MetricsBar.tsx       # Real-time compliance/integrity bars
```

### Backend (Supabase)

**Key tables**: `profiles`, `courses`, `course_students`, `lessons`, `lesson_activities`, `activities`, `lesson_assignments`, `student_progress`, `activity_responses`, `productions`, `production_rules`, `presentation_sessions`, `group_sets`, `groups`, `group_members`, `group_progress`, `group_lesson_assignments`, `group_activity_completions`

**Migrations**: `supabase/migrations/` — all SQL files run in timestamp order.

**Function `get_user_role()`**: Returns `'admin'` if `is_admin = true`, otherwise returns the user's base `role`. Used extensively in RLS policies.

### User Roles

| Role | Description |
|------|-------------|
| `admin` | Full platform access: manage professors, view all data |
| `professor` | Manage own courses, students, lessons, productions |
| `student` | View assigned lessons, complete activities, submit productions |

**Dual role**: A professor can have `is_admin = true`, giving them both professor and admin capabilities. On login they see a view selector (Admin/Professor) and can switch between dashboards without logging out.

### Authentication Flow

1. `App.tsx` renders `AuthProvider`
2. `AuthContext` calls `supabase.auth.getSession()` on mount
3. If session exists → `loadProfile(userId)` fetches from `profiles` table
4. `App.tsx` routes based on `profile.role` (+ `profile.is_admin` for dual role)
5. All data access controlled by Supabase RLS policies

## Conventions

- **No CSS files**: all styling via Tailwind utility classes
- **Icons**: Lucide React only — no other icon libraries
- **No `any`**: except `err: any` in catch blocks (Supabase limitation)
- **Components**: define interfaces before the component, in the same file
- **State**: follow the established pattern — `useState` + `useEffect` + `try/catch` with Supabase
- **i18n**: use `resolveField(field, lang)` for multilingual fields (title, description) that can be `{es: '...', en: '...'}` or plain strings
- **RLS**: all tables have Row Level Security — each role sees only what they're authorized to see
- **Migrations**: must be idempotent when possible (`IF NOT EXISTS`, `IF EXISTS`)

## Environment Variables

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Documentation

| File | Content |
|------|---------|
| `README.md` | Full project documentation |
| `docs/database-schema.sql` | Complete SQL schema with 18 tables + diagnostic queries |
| `docs/actividades-json.md` | Activity type reference with JSON/SQL examples |
| `docs/gemini-gem-prompt.md` | Prompt for Google Gemini Gem to auto-generate activities |
| `.claude/agents/` | Specialized AI agents (BD, frontend, auth, pedagogy, students, etc.) |
