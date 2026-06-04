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
      achievements: {
        Row: {
          code: string
          description: string | null
          id: string
          metadata: Json | null
          title: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_personality_state: {
        Row: {
          depth: string
          empathy_level: number
          notes: string | null
          pacing: string
          tone: string
          trust_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          depth?: string
          empathy_level?: number
          notes?: string | null
          pacing?: string
          tone?: string
          trust_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          depth?: string
          empathy_level?: number
          notes?: string | null
          pacing?: string
          tone?: string
          trust_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          reply_to_message_id: string | null
          role: string
          session_id: string
          stt_language: string | null
          stt_transcript: string | null
          user_id: string
          voice_duration_ms: number | null
          voice_generation_source: string | null
          voice_metrics: Json | null
          voice_mime: string | null
          voice_size_bytes: number | null
          voice_status: string | null
          voice_url: string | null
          voice_waveform: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reply_to_message_id?: string | null
          role: string
          session_id: string
          stt_language?: string | null
          stt_transcript?: string | null
          user_id: string
          voice_duration_ms?: number | null
          voice_generation_source?: string | null
          voice_metrics?: Json | null
          voice_mime?: string | null
          voice_size_bytes?: number | null
          voice_status?: string | null
          voice_url?: string | null
          voice_waveform?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reply_to_message_id?: string | null
          role?: string
          session_id?: string
          stt_language?: string | null
          stt_transcript?: string | null
          user_id?: string
          voice_duration_ms?: number | null
          voice_generation_source?: string | null
          voice_metrics?: Json | null
          voice_mime?: string | null
          voice_size_bytes?: number | null
          voice_status?: string | null
          voice_url?: string | null
          voice_waveform?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      emotion_analyses: {
        Row: {
          created_at: string
          distortions: Json | null
          id: string
          intensity: number | null
          message_id: string | null
          primary_emotion: string | null
          sentiment: number | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          distortions?: Json | null
          id?: string
          intensity?: number | null
          message_id?: string | null
          primary_emotion?: string | null
          sentiment?: number | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          distortions?: Json | null
          id?: string
          intensity?: number | null
          message_id?: string | null
          primary_emotion?: string | null
          sentiment?: number | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      emotional_memories: {
        Row: {
          confidence: number
          content: string | null
          created_at: string
          embedding: Json | null
          emotion: string | null
          emotional_weight: number
          id: string
          last_referenced_at: string | null
          recurrence_score: number
          source_session_ids: string[]
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["memory_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          content?: string | null
          created_at?: string
          embedding?: Json | null
          emotion?: string | null
          emotional_weight?: number
          id?: string
          last_referenced_at?: string | null
          recurrence_score?: number
          source_session_ids?: string[]
          tags?: string[]
          title: string
          type: Database["public"]["Enums"]["memory_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          content?: string | null
          created_at?: string
          embedding?: Json | null
          emotion?: string | null
          emotional_weight?: number
          id?: string
          last_referenced_at?: string | null
          recurrence_score?: number
          source_session_ids?: string[]
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["memory_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emotional_pulses: {
        Row: {
          avg_intensity: number | null
          created_at: string
          dominant_emotion: string | null
          id: string
          message_count: number | null
          pulse_date: string
          session_count: number | null
          summary: string | null
          user_id: string
        }
        Insert: {
          avg_intensity?: number | null
          created_at?: string
          dominant_emotion?: string | null
          id?: string
          message_count?: number | null
          pulse_date: string
          session_count?: number | null
          summary?: string | null
          user_id: string
        }
        Update: {
          avg_intensity?: number | null
          created_at?: string
          dominant_emotion?: string | null
          id?: string
          message_count?: number | null
          pulse_date?: string
          session_count?: number | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      insights: {
        Row: {
          created_at: string
          description: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      key_moments: {
        Row: {
          created_at: string
          emotion: string | null
          id: string
          intensity: number | null
          message_id: string | null
          moment_type: string
          position: number | null
          session_id: string
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emotion?: string | null
          id?: string
          intensity?: number | null
          message_id?: string | null
          moment_type: string
          position?: number | null
          session_id: string
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emotion?: string | null
          id?: string
          intensity?: number | null
          message_id?: string | null
          moment_type?: string
          position?: number | null
          session_id?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memory_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          intensity: number | null
          memory_id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          intensity?: number | null
          memory_id: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          intensity?: number | null
          memory_id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memory_relationships: {
        Row: {
          created_at: string
          from_memory_id: string
          id: string
          relation_type: string
          strength: number
          to_memory_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_memory_id: string
          id?: string
          relation_type?: string
          strength?: number
          to_memory_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_memory_id?: string
          id?: string
          relation_type?: string
          strength?: number
          to_memory_id?: string
          user_id?: string
        }
        Relationships: []
      }
      message_feedback: {
        Row: {
          created_at: string
          id: string
          message_id: string
          rating: number
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          rating: number
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          rating?: number
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          mood: Database["public"]["Enums"]["mood"] | null
          role: Database["public"]["Enums"]["msg_role"]
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mood?: Database["public"]["Enums"]["mood"] | null
          role: Database["public"]["Enums"]["msg_role"]
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mood?: Database["public"]["Enums"]["mood"] | null
          role?: Database["public"]["Enums"]["msg_role"]
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: string | null
          ai_tone: string | null
          avatar: string | null
          created_at: string
          display_name: string | null
          email: string | null
          focus_default: boolean
          gender: string | null
          id: string
          identity_mode: string | null
          interview_answers: Json | null
          nickname: string | null
          nickname_reason: string | null
          notifications: boolean
          theme: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          age?: string | null
          ai_tone?: string | null
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          focus_default?: boolean
          gender?: string | null
          id: string
          identity_mode?: string | null
          interview_answers?: Json | null
          nickname?: string | null
          nickname_reason?: string | null
          notifications?: boolean
          theme?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          age?: string | null
          ai_tone?: string | null
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          focus_default?: boolean
          gender?: string | null
          id?: string
          identity_mode?: string | null
          interview_answers?: Json | null
          nickname?: string | null
          nickname_reason?: string | null
          notifications?: boolean
          theme?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      session_memories: {
        Row: {
          context: string | null
          created_at: string
          emotion_pattern: string | null
          id: string
          session_id: string | null
          topic: string
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          emotion_pattern?: string | null
          id?: string
          session_id?: string | null
          topic: string
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          emotion_pattern?: string | null
          id?: string
          session_id?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_memories_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          stage: Database["public"]["Enums"]["session_stage"]
          started_at: string
          summary_emotion: string | null
          summary_intensity: number | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          stage?: Database["public"]["Enums"]["session_stage"]
          started_at?: string
          summary_emotion?: string | null
          summary_intensity?: number | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          stage?: Database["public"]["Enums"]["session_stage"]
          started_at?: string
          summary_emotion?: string | null
          summary_intensity?: number | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      memory_type:
        | "person"
        | "goal"
        | "fear"
        | "trigger"
        | "recovery"
        | "achievement"
        | "preference"
        | "theme"
        | "event"
        | "habit"
      mood: "calm" | "anxious" | "overwhelmed" | "hopeful" | "neutral"
      msg_role: "user" | "ai"
      session_stage: "assessment" | "exploration" | "action"
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
      memory_type: [
        "person",
        "goal",
        "fear",
        "trigger",
        "recovery",
        "achievement",
        "preference",
        "theme",
        "event",
        "habit",
      ],
      mood: ["calm", "anxious", "overwhelmed", "hopeful", "neutral"],
      msg_role: ["user", "ai"],
      session_stage: ["assessment", "exploration", "action"],
    },
  },
} as const
