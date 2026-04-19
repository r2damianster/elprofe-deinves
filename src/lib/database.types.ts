export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'professor' | 'student';
export type ActivityType =
  | 'multiple_choice'
  | 'drag_drop'
  | 'essay'
  | 'short_answer'
  | 'fill_blank'
  | 'true_false'
  | 'matching'
  | 'ordering'
  | 'image_question'
  | 'listening'
  | 'long_response'
  | 'structured_essay'
  | 'category_sorting'
  | 'error_spotting'
  | 'matrix_grid'
  | 'open_writing';
export type ProductionStatus = 'draft' | 'submitted' | 'reviewed';

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      activities: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          media_url: string | null
          points: number
          title: Json
          type: ActivityType
        }
        Insert: {
          content: Json
          created_at?: string
          created_by?: string | null
          id?: string
          media_url?: string | null
          points?: number
          title: Json
          type: ActivityType
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          media_url?: string | null
          points?: number
          title?: Json
          type?: ActivityType
        }
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
      }
      production_rules: {
        Row: {
          extra_rules: Json | null
          id: string
          instructions: string | null
          lesson_id: string
          max_words: number | null
          min_words: number
          prohibited_words: string[]
          required_words: string[]
        }
        Insert: {
          extra_rules?: Json | null
          id?: string
          instructions?: string | null
          lesson_id: string
          max_words?: number | null
          min_words?: number
          prohibited_words?: string[]
          required_words?: string[]
        }
        Update: {
          extra_rules?: Json | null
          id?: string
          instructions?: string | null
          lesson_id?: string
          max_words?: number | null
          min_words?: number
          prohibited_words?: string[]
          required_words?: string[]
        }
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
          status: ProductionStatus
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
          status?: ProductionStatus
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
          status?: ProductionStatus
          student_id?: string
          submitted_at?: string | null
          time_on_task?: number | null
          word_count?: number
        }
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          role: UserRole
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_admin?: boolean
          role?: UserRole
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_admin?: boolean
          role?: UserRole
          updated_at?: string
        }
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
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: never; Returns: UserRole }
      group_course_id: { Args: { gid: string }; Returns: string }
      group_is_open: { Args: { gid: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      activity_type: ActivityType
      production_status: ProductionStatus
      user_role: UserRole
    }
  }
}
