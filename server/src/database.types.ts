/**
 * Tipos do banco GERADOS pelo Supabase (generate_typescript_types, 2026-10-10) e RECORTADOS.
 *
 * Só entram aqui as tabelas que o servidor pode tocar. Isso torna as regras de fusão
 * verificáveis pelo compilador: `medications`, `lab_results`, `exercises` (antiga), `meals`,
 * `profiles` e a RPC `upsert_apple_day` não existem para o servidor.
 * `biometrics` e `alcohol_log` entram só com as colunas do painel e sem Insert/Update.
 *
 * Ao mudar o schema: regenere os tipos e recorte de novo, mantendo esta regra.
 */

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      daily_logs: {
        Row: {
          created_at: string | null;
          date: string;
          id: string;
          updated_at: string | null;
          user_id: string;
        };
        // Única escrita permitida na camada antiga: get-or-create (user_id, date).
        Insert: {
          date: string;
          user_id: string;
        };
        Update: never;
        Relationships: [];
      };
      // Camada antiga, SOMENTE LEITURA (Insert/Update: never): o painel cruza dor × sono/peso/álcool.
      biometrics: {
        Row: {
          active_energy_cal: number | null;
          id: string;
          log_id: string;
          sleep_hours: number | null;
          sleep_score: number | null;
          weight_kg: number | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'biometrics_log_id_fkey';
            columns: ['log_id'];
            isOneToOne: true;
            referencedRelation: 'daily_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      alcohol_log: {
        Row: {
          amount_doses: number | null;
          id: string;
          log_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'alcohol_log_log_id_fkey';
            columns: ['log_id'];
            isOneToOne: true;
            referencedRelation: 'daily_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      knee_exercises: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          name: string;
          type: string;
          voice_instruction: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      knee_workout_templates: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      knee_workout_template_items: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          exercise_id: string;
          id: string;
          order_index: number;
          reps: number | null;
          rest_seconds: number;
          sets: number;
          template_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'knee_workout_template_items_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'knee_exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'knee_workout_template_items_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'knee_workout_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      knee_workout_sessions: {
        Row: {
          created_at: string;
          daily_log_id: string | null;
          ended_at: string | null;
          free_notes: string | null;
          id: string;
          on_anti_inflammatory: boolean | null;
          pain_after: number | null;
          pain_before: number | null;
          squat_depth_notes: string | null;
          started_at: string;
          template_id: string | null;
        };
        Insert: {
          daily_log_id: string;
          on_anti_inflammatory: boolean;
          pain_before: number;
          started_at: string;
          template_id: string;
        };
        Update: {
          ended_at?: string | null;
          free_notes?: string | null;
          pain_after?: number | null;
          squat_depth_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'knee_workout_sessions_daily_log_id_fkey';
            columns: ['daily_log_id'];
            isOneToOne: false;
            referencedRelation: 'daily_logs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'knee_workout_sessions_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'knee_workout_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      knee_workout_session_items: {
        Row: {
          actual_duration_seconds: number | null;
          actual_rest_seconds: number | null;
          completed: boolean;
          created_at: string;
          exercise_id: string;
          id: string;
          planned_duration_seconds: number | null;
          planned_rest_seconds: number | null;
          session_id: string;
          set_number: number;
          skipped: boolean;
        };
        Insert: {
          actual_duration_seconds: number | null;
          actual_rest_seconds: number | null;
          completed: boolean;
          exercise_id: string;
          planned_duration_seconds: number | null;
          planned_rest_seconds: number | null;
          session_id: string;
          set_number: number;
          skipped: boolean;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'knee_workout_session_items_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'knee_exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'knee_workout_session_items_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'knee_workout_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      knee_swim_logs: {
        Row: {
          active_kcal: number | null;
          avg_hr: number | null;
          created_at: string;
          daily_log_id: string;
          distance_m: number;
          duration_seconds: number;
          effort: number | null;
          ended_at: string | null;
          id: string;
          kick: string;
          laps: number | null;
          notes: string | null;
          on_anti_inflammatory: boolean | null;
          pain_after: number | null;
          pain_before: number | null;
          pool_length_m: number | null;
          started_at: string;
          stroke: string | null;
          total_kcal: number | null;
        };
        Insert: {
          active_kcal?: number | null;
          avg_hr?: number | null;
          daily_log_id: string;
          distance_m: number;
          duration_seconds: number;
          effort?: number | null;
          ended_at?: string | null;
          kick: string;
          laps?: number | null;
          notes?: string | null;
          on_anti_inflammatory?: boolean | null;
          pain_after?: number | null;
          pain_before?: number | null;
          pool_length_m?: number | null;
          started_at: string;
          stroke?: string | null;
          total_kcal?: number | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'knee_swim_logs_daily_log_id_fkey';
            columns: ['daily_log_id'];
            isOneToOne: false;
            referencedRelation: 'daily_logs';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      knee_recovery_daily: {
        Row: {
          active_energy_cal: number | null;
          alcohol_doses: number | null;
          date: string | null;
          on_anti_inflammatory: boolean | null;
          pain_after: number | null;
          pain_before: number | null;
          session_id: string | null;
          sleep_hours: number | null;
          sleep_score: number | null;
          started_at: string | null;
          weight_kg: number | null;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
