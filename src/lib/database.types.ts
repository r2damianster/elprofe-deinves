export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          description: string | null
          description_en: string | null
          difficulty: number | null
          id: string
          media_url: string | null
          points: number
          tags: string[] | null
          title: Json
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          content: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_en?: string | null
          difficulty?: number | null
          id?: string
          media_url?: string | null
          points?: number
          tags?: string[] | null
          title: Json
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_en?: string | null
          difficulty?: number | null
          id?: string
          media_url?: string | null
          points?: number
          tags?: string[] | null
          title?: Json
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_responses: {
        Row: {
          activity_id: string
          id: string
          response: Json
          score: number
          student_id: string
          submitted_at: string
        }
        Insert: {
          activity_id: string
          id?: string
          response: Json
          score?: number
          student_id: string
          submitted_at?: string
        }
        Update: {
          activity_id?: string
          id?: string
          response?: Json
          score?: number
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_responses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_students: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language: string
          name: string
          professor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          name: string
          professor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          name?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_activity_completions: {
        Row: {
          activity_id: string
          completed_at: string | null
          completed_by: string
          group_id: string
          id: string
          response: Json | null
          score: number | null
        }
        Insert: {
          activity_id: string
          completed_at?: string | null
          completed_by: string
          group_id: string
          id?: string
          response?: Json | null
          score?: number | null
        }
        Update: {
          activity_id?: string
          completed_at?: string | null
          completed_by?: string
          group_id?: string
          id?: string
          response?: Json | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_activity_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_activity_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_activity_completions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_lesson_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          group_id: string
          id: string
          lesson_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          group_id: string
          id?: string
          lesson_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          group_id?: string
          id?: string
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_lesson_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_lesson_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_lesson_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          added_at: string | null
          group_id: string
          student_id: string
        }
        Insert: {
          added_at?: string | null
          group_id: string
          student_id: string
        }
        Update: {
          added_at?: string | null
          group_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_production_locks: {
        Row: {
          group_id: string
          id: string
          lesson_id: string
          production_id: string | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          group_id: string
          id?: string
          lesson_id: string
          production_id?: string | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          group_id?: string
          id?: string
          lesson_id?: string
          production_id?: string | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_production_locks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_production_locks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_production_locks_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_production_locks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_progress: {
        Row: {
          completed_at: string | null
          completion_percentage: number | null
          group_id: string
          id: string
          lesson_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_percentage?: number | null
          group_id: string
          id?: string
          lesson_id: string
        }
        Update: {
          completed_at?: string | null
          completion_percentage?: number | null
          group_id?: string
          id?: string
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      group_sets: {
        Row: {
          course_id: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          course_id: string
          created_at: string | null
          created_by: string
          enrollment_open: boolean | null
          group_set_id: string | null
          id: string
          max_members: number | null
          name: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          created_by: string
          enrollment_open?: boolean | null
          group_set_id?: string | null
          id?: string
          max_members?: number | null
          name: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          created_by?: string
          enrollment_open?: boolean | null
          group_set_id?: string | null
          id?: string
          max_members?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_group_set_id_fkey"
            columns: ["group_set_id"]
            isOneToOne: false
            referencedRelation: "group_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_activities: {
        Row: {
          activity_id: string
          created_at: string | null
          id: string
          lesson_id: string
          order_index: number
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          id?: string
          lesson_id: string
          order_index?: number
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          id?: string
          lesson_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          course_id: string | null
          id: string
          lesson_id: string
          student_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          course_id?: string | null
          id?: string
          lesson_id: string
          student_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          course_id?: string | null
          id?: string
          lesson_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_project_objects: {
        Row: {
          created_at: string | null
          id: string
          is_new_object: boolean | null
          lesson_id: string
          object_type_id: string
          order_index: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_new_object?: boolean | null
          lesson_id: string
          object_type_id: string
          order_index?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_new_object?: boolean | null
          lesson_id?: string
          object_type_id?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_project_objects_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_project_objects_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "project_object_types"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          description: Json | null
          has_production: boolean
          id: string
          order_index: number
          production_unlock_percentage: number
          title: Json
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: Json | null
          has_production?: boolean
          id?: string
          order_index?: number
          production_unlock_percentage?: number
          title: Json
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: Json | null
          has_production?: boolean
          id?: string
          order_index?: number
          production_unlock_percentage?: number
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_sessions: {
        Row: {
          course_id: string
          current_step_index: number | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          lesson_id: string
          professor_id: string
          started_at: string | null
        }
        Insert: {
          course_id: string
          current_step_index?: number | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          lesson_id: string
          professor_id: string
          started_at?: string | null
        }
        Update: {
          course_id?: string
          current_step_index?: number | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          lesson_id?: string
          professor_id?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_sessions_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_rules: {
        Row: {
          compliance_threshold: number | null
          example_text: Json | null
          extra_rules: Json | null
          id: string
          instructions: Json | null
          integrity_threshold: number | null
          lesson_id: string
          max_words: number | null
          min_words: number
          prohibited_words: Json | null
          required_words: Json | null
        }
        Insert: {
          compliance_threshold?: number | null
          example_text?: Json | null
          extra_rules?: Json | null
          id?: string
          instructions?: Json | null
          integrity_threshold?: number | null
          lesson_id: string
          max_words?: number | null
          min_words?: number
          prohibited_words?: Json | null
          required_words?: Json | null
        }
        Update: {
          compliance_threshold?: number | null
          example_text?: Json | null
          extra_rules?: Json | null
          id?: string
          instructions?: Json | null
          integrity_threshold?: number | null
          lesson_id?: string
          max_words?: number | null
          min_words?: number
          prohibited_words?: Json | null
          required_words?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "production_rules_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          attempts: number | null
          compliance_score: number | null
          content: string
          created_at: string
          feedback: string | null
          id: string
          integrity_events: Json | null
          integrity_score: number | null
          lesson_id: string
          reviewed_at: string | null
          score: number | null
          status: Database["public"]["Enums"]["production_status"]
          student_id: string
          submitted_at: string | null
          time_on_task: number | null
          word_count: number
        }
        Insert: {
          attempts?: number | null
          compliance_score?: number | null
          content?: string
          created_at?: string
          feedback?: string | null
          id?: string
          integrity_events?: Json | null
          integrity_score?: number | null
          lesson_id: string
          reviewed_at?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["production_status"]
          student_id: string
          submitted_at?: string | null
          time_on_task?: number | null
          word_count?: number
        }
        Update: {
          attempts?: number | null
          compliance_score?: number | null
          content?: string
          created_at?: string
          feedback?: string | null
          id?: string
          integrity_events?: Json | null
          integrity_score?: number | null
          lesson_id?: string
          reviewed_at?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["production_status"]
          student_id?: string
          submitted_at?: string | null
          time_on_task?: number | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "productions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_admin?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_admin?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          assigned_at: string | null
          course_id: string
          id: string
          project_id: string
          student_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          course_id: string
          id?: string
          project_id: string
          student_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          course_id?: string
          id?: string
          project_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_object_edit_requests: {
        Row: {
          created_at: string | null
          id: string
          professor_note: string | null
          project_object_id: string
          reason: string
          resolved_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          professor_note?: string | null
          project_object_id: string
          reason: string
          resolved_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          professor_note?: string | null
          project_object_id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_object_edit_requests_project_object_id_fkey"
            columns: ["project_object_id"]
            isOneToOne: false
            referencedRelation: "project_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_object_edit_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_object_types: {
        Row: {
          created_at: string | null
          description: string | null
          edit_policy: string
          id: string
          instructions: string | null
          max_words: number | null
          min_words: number | null
          name: string
          order_index: number
          parent_object_type_id: string | null
          project_id: string
          required_words: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          edit_policy?: string
          id?: string
          instructions?: string | null
          max_words?: number | null
          min_words?: number | null
          name: string
          order_index?: number
          parent_object_type_id?: string | null
          project_id: string
          required_words?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          edit_policy?: string
          id?: string
          instructions?: string | null
          max_words?: number | null
          min_words?: number | null
          name?: string
          order_index?: number
          parent_object_type_id?: string | null
          project_id?: string
          required_words?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "project_object_types_parent_object_type_id_fkey"
            columns: ["parent_object_type_id"]
            isOneToOne: false
            referencedRelation: "project_object_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_object_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_objects: {
        Row: {
          content: string | null
          created_at: string | null
          feedback: string | null
          id: string
          object_type_id: string
          project_id: string
          reviewed_at: string | null
          score: number | null
          status: string
          student_id: string
          submitted_at: string | null
          updated_at: string | null
          version: number | null
          word_count: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          object_type_id: string
          project_id: string
          reviewed_at?: string | null
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string | null
          updated_at?: string | null
          version?: number | null
          word_count?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          object_type_id?: string
          project_id?: string
          reviewed_at?: string | null
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          updated_at?: string | null
          version?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_objects_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "project_object_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_objects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_objects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          object_logic: string
          professor_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          object_logic?: string
          professor_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          object_logic?: string
          professor_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress: {
        Row: {
          attempts: number | null
          completed_at: string | null
          completion_percentage: number
          id: string
          lesson_id: string
          started_at: string
          student_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          completion_percentage?: number
          id?: string
          lesson_id: string
          started_at?: string
          student_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          completion_percentage?: number
          id?: string
          lesson_id?: string
          started_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_group_members: { Args: { gid: string }; Returns: number }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      group_course_id: { Args: { gid: string }; Returns: string }
      group_is_open: { Args: { gid: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      activity_type:
        | "multiple_choice"
        | "drag_drop"
        | "essay"
        | "short_answer"
        | "fill_blank"
        | "true_false"
        | "matching"
        | "ordering"
        | "image_question"
        | "listening"
        | "category_sorting"
        | "error_spotting"
        | "matrix_grid"
        | "structured_essay"
        | "long_response"
      production_status: "draft" | "submitted" | "reviewed"
      user_role: "admin" | "professor" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "multiple_choice",
        "drag_drop",
        "essay",
        "short_answer",
        "fill_blank",
        "true_false",
        "matching",
        "ordering",
        "image_question",
        "listening",
        "category_sorting",
        "error_spotting",
        "matrix_grid",
        "structured_essay",
        "long_response",
      ],
      production_status: ["draft", "submitted", "reviewed"],
      user_role: ["admin", "professor", "student"],
    },
  },
} as const
