-- Supabase change (effective Oct 30 2026): new tables in "public" schema
-- no longer get implicit Data API access. This migration adds explicit
-- GRANTs so all existing tables remain accessible via PostgREST/supabase-js.

-- Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Core platform tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lessons               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_students       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activities            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lesson_assignments    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_progress      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activity_responses    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.production_rules      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.productions           TO authenticated;

-- Activity linking
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lesson_activities     TO authenticated;

-- Groups
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.groups                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_members         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_lesson_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_progress        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_activity_completions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_sets            TO authenticated;

-- Presentations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.presentation_sessions TO authenticated;

-- Research projects
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects                     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_object_types         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lesson_project_objects       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_objects              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_object_edit_requests TO authenticated;

-- sequences / functions (PostgREST needs these for INSERT returning)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
