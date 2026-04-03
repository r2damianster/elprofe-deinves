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
  | 'listening';
export type ProductionStatus = 'draft' | 'submitted' | 'reviewed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          updated_at?: string;
        };
      };
      lessons: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          content: any;
          has_production: boolean;
          production_unlock_percentage: number;
          order_index: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          content?: any;
          has_production?: boolean;
          production_unlock_percentage?: number;
          order_index?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          content?: any;
          has_production?: boolean;
          production_unlock_percentage?: number;
          order_index?: number;
        };
      };
      courses: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          professor_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          professor_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
        };
      };
      course_students: {
        Row: {
          id: string;
          course_id: string;
          student_id: string;
          enrolled_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          student_id: string;
          enrolled_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          student_id?: string;
        };
      };
      lesson_activities: {
        Row: {
          id: string;
          lesson_id: string;
          activity_id: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          activity_id: string;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          activity_id?: string;
          order_index?: number;
        };
      };
      activities: {
        Row: {
          id: string;
          type: ActivityType;
          title: string;
          content: any;
          points: number;
          media_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: ActivityType;
          title: string;
          content?: any;
          points?: number;
          media_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: ActivityType;
          title?: string;
          content?: any;
          points?: number;
          media_url?: string | null;
        };
      };
      lesson_assignments: {
        Row: {
          id: string;
          lesson_id: string;
          course_id: string | null;
          student_id: string | null;
          assigned_by: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          course_id?: string | null;
          student_id?: string | null;
          assigned_by: string;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          course_id?: string | null;
          student_id?: string | null;
        };
      };
      student_progress: {
        Row: {
          id: string;
          student_id: string;
          lesson_id: string;
          completion_percentage: number;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          lesson_id: string;
          completion_percentage?: number;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          completion_percentage?: number;
          completed_at?: string | null;
        };
      };
      activity_responses: {
        Row: {
          id: string;
          activity_id: string;
          student_id: string;
          response: any;
          score: number;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          student_id: string;
          response: any;
          score?: number;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          response?: any;
          score?: number;
        };
      };
      production_rules: {
        Row: {
          id: string;
          lesson_id: string;
          min_words: number;
          max_words: number | null;
          required_words: string[];
          prohibited_words: string[];
          instructions: string | null;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          min_words?: number;
          max_words?: number | null;
          required_words?: string[];
          prohibited_words?: string[];
          instructions?: string | null;
        };
        Update: {
          id?: string;
          min_words?: number;
          max_words?: number | null;
          required_words?: string[];
          prohibited_words?: string[];
          instructions?: string | null;
        };
      };
      productions: {
        Row: {
          id: string;
          student_id: string;
          lesson_id: string;
          content: string;
          word_count: number;
          status: ProductionStatus;
          score: number | null;
          feedback: string | null;
          created_at: string;
          submitted_at: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          lesson_id: string;
          content?: string;
          word_count?: number;
          status?: ProductionStatus;
          score?: number | null;
          feedback?: string | null;
          created_at?: string;
          submitted_at?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          content?: string;
          word_count?: number;
          status?: ProductionStatus;
          score?: number | null;
          feedback?: string | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
        };
      };
    };
  };
}
