export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          church_id: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          church_id: string
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["ai_message_role"]
          tokens_used: number | null
          tool_calls: Json
        }
        Insert: {
          church_id: string
          citations?: Json
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["ai_message_role"]
          tokens_used?: number | null
          tool_calls?: Json
        }
        Update: {
          church_id?: string
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["ai_message_role"]
          tokens_used?: number | null
          tool_calls?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          beneficiary_id: string | null
          church_id: string
          created_at: string
          id: string
          notes: string | null
          recorded_by: string
          servant_id: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          beneficiary_id?: string | null
          church_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by: string
          servant_id?: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          beneficiary_id?: string | null
          church_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          servant_id?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_servant_id_fkey"
            columns: ["servant_id"]
            isOneToOne: false
            referencedRelation: "servants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          church_id: string
          class_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          service_id: string
          session_date: string
          stage_id: string
        }
        Insert: {
          church_id: string
          class_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          service_id: string
          session_date: string
          stage_id: string
        }
        Update: {
          church_id?: string
          class_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          service_id?: string
          session_date?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          church_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          church_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          church_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          address: string | null
          church_id: string
          confession_father: string | null
          created_at: string
          date_of_birth: string
          deleted_at: string | null
          father_mobile: string | null
          full_name_ar: string
          full_name_en: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          mobile: string | null
          mother_mobile: string | null
          notes: string | null
          photo_url: string | null
          school: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          church_id: string
          confession_father?: string | null
          created_at?: string
          date_of_birth: string
          deleted_at?: string | null
          father_mobile?: string | null
          full_name_ar: string
          full_name_en?: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          id?: string
          mobile?: string | null
          mother_mobile?: string | null
          notes?: string | null
          photo_url?: string | null
          school?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          church_id?: string
          confession_father?: string | null
          created_at?: string
          date_of_birth?: string
          deleted_at?: string | null
          father_mobile?: string | null
          full_name_ar?: string
          full_name_en?: string | null
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          mobile?: string | null
          mother_mobile?: string | null
          notes?: string | null
          photo_url?: string | null
          school?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiary_assignments: {
        Row: {
          assigned_by: string
          beneficiary_id: string
          church_id: string
          class_id: string | null
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean
          servant_id: string
          service_id: string
          stage_id: string
          start_date: string
          transfer_reason: string | null
        }
        Insert: {
          assigned_by: string
          beneficiary_id: string
          church_id: string
          class_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          servant_id: string
          service_id: string
          stage_id: string
          start_date?: string
          transfer_reason?: string | null
        }
        Update: {
          assigned_by?: string
          beneficiary_id?: string
          church_id?: string
          class_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          servant_id?: string
          service_id?: string
          stage_id?: string
          start_date?: string
          transfer_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficiary_assignments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_assignments_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_assignments_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_assignments_servant_id_fkey"
            columns: ["servant_id"]
            isOneToOne: false
            referencedRelation: "servants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address_ar: string | null
          address_en: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          feature_flags: Json
          id: string
          is_active: boolean
          locale: string
          logo_url: string | null
          name_ar: string
          name_en: string | null
          settings: Json
          slug: string
          status: string
          subscription_status: string
          subscription_tier: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          feature_flags?: Json
          id?: string
          is_active?: boolean
          locale?: string
          logo_url?: string | null
          name_ar: string
          name_en?: string | null
          settings?: Json
          slug: string
          status?: string
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          feature_flags?: Json
          id?: string
          is_active?: boolean
          locale?: string
          logo_url?: string | null
          name_ar?: string
          name_en?: string | null
          settings?: Json
          slug?: string
          status?: string
          subscription_status?: string
          subscription_tier?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          church_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          sort_order: number
          stage_id: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          sort_order?: number
          stage_id: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          sort_order?: number
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          chunk_index: number
          church_id: string
          content: string
          created_at: string
          document_id: string | null
          embedding: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          chunk_index: number
          church_id: string
          content: string
          created_at?: string
          document_id?: string | null
          embedding: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          chunk_index?: number
          church_id?: string
          content?: string
          created_at?: string
          document_id?: string | null
          embedding?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          church_id: string
          created_at: string
          deleted_at: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["document_entity_type"]
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          uploaded_by: string
        }
        Insert: {
          church_id: string
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["document_entity_type"]
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          uploaded_by: string
        }
        Update: {
          church_id?: string
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["document_entity_type"]
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          beneficiary_id: string
          church_id: string
          created_at: string
          event_id: string
          id: string
          notes: string | null
          registered_at: string
          registered_by: string | null
          status: Database["public"]["Enums"]["event_registration_status"]
          updated_at: string
        }
        Insert: {
          beneficiary_id: string
          church_id: string
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string | null
          status?: Database["public"]["Enums"]["event_registration_status"]
          updated_at?: string
        }
        Update: {
          beneficiary_id?: string
          church_id?: string
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string | null
          status?: Database["public"]["Enums"]["event_registration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          church_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          description_ar: string | null
          description_en: string | null
          end_at: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          is_active: boolean
          location_ar: string | null
          service_id: string
          stage_id: string | null
          start_at: string
          title_ar: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          church_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          end_at?: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          is_active?: boolean
          location_ar?: string | null
          service_id: string
          stage_id?: string | null
          start_at: string
          title_ar: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          church_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          end_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          is_active?: boolean
          location_ar?: string | null
          service_id?: string
          stage_id?: string | null
          start_at?: string
          title_ar?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          assigned_to: string | null
          beneficiary_id: string
          church_id: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          next_action: string | null
          notes: string | null
          outcome: string | null
          scheduled_at: string | null
          servant_id: string
          status: Database["public"]["Enums"]["followup_status"]
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          beneficiary_id: string
          church_id: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          next_action?: string | null
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string | null
          servant_id: string
          status?: Database["public"]["Enums"]["followup_status"]
          type: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          beneficiary_id?: string
          church_id?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          next_action?: string | null
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string | null
          servant_id?: string
          status?: Database["public"]["Enums"]["followup_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_servant_id_fkey"
            columns: ["servant_id"]
            isOneToOne: false
            referencedRelation: "servants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "servants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body_ar: string
          body_en: string | null
          channel: string
          church_id: string
          created_at: string
          data: Json | null
          dedupe_key: string | null
          id: string
          is_read: boolean
          notification_type: string
          read_at: string | null
          recipient_id: string
          sent_at: string
          title_ar: string
          title_en: string | null
        }
        Insert: {
          body_ar: string
          body_en?: string | null
          channel: string
          church_id: string
          created_at?: string
          data?: Json | null
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          notification_type?: string
          read_at?: string | null
          recipient_id: string
          sent_at?: string
          title_ar: string
          title_en?: string | null
        }
        Update: {
          body_ar?: string
          body_en?: string | null
          channel?: string
          church_id?: string
          created_at?: string
          data?: Json | null
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          sent_at?: string
          title_ar?: string
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description_ar: string | null
          id: string
          module: string
          name_ar: string
          name_en: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description_ar?: string | null
          id?: string
          module: string
          name_ar: string
          name_en?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description_ar?: string | null
          id?: string
          module?: string
          name_ar?: string
          name_en?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          church_id: string
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string
          full_name_ar: string
          full_name_en: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          preferred_locale: string
          service_started_at: string | null
          spiritual_title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          church_id: string
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email: string
          full_name_ar: string
          full_name_en?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          preferred_locale?: string
          service_started_at?: string | null
          spiritual_title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          church_id?: string
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string
          full_name_ar?: string
          full_name_en?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          preferred_locale?: string
          service_started_at?: string | null
          spiritual_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          church_id: string
          created_at: string
          description_ar: string | null
          id: string
          is_system: boolean
          name_ar: string
          name_en: string | null
          role_type: Database["public"]["Enums"]["user_role_type"]
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          description_ar?: string | null
          id?: string
          is_system?: boolean
          name_ar: string
          name_en?: string | null
          role_type: Database["public"]["Enums"]["user_role_type"]
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          description_ar?: string | null
          id?: string
          is_system?: boolean
          name_ar?: string
          name_en?: string | null
          role_type?: Database["public"]["Enums"]["user_role_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      servants: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          church_id: string
          confession_father_name: string | null
          created_at: string
          deleted_at: string | null
          id: string
          join_date: string | null
          notes: string | null
          service_history: Json
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          church_id: string
          confession_father_name?: string | null
          created_at?: string
          deleted_at?: string | null
          id: string
          join_date?: string | null
          notes?: string | null
          service_history?: Json
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          church_id?: string
          confession_father_name?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          join_date?: string | null
          notes?: string | null
          service_history?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servants_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servants_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servants_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      servant_stage_assignments: {
        Row: {
          assigned_by: string
          church_id: string
          class_id: string | null
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          role: string
          servant_id: string
          service_id: string
          stage_id: string | null
          start_date: string
        }
        Insert: {
          assigned_by: string
          church_id: string
          class_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          role?: string
          servant_id: string
          service_id: string
          stage_id?: string | null
          start_date?: string
        }
        Update: {
          assigned_by?: string
          church_id?: string
          class_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          role?: string
          servant_id?: string
          service_id?: string
          stage_id?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "servant_stage_assignments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servant_stage_assignments_servant_id_fkey"
            columns: ["servant_id"]
            isOneToOne: false
            referencedRelation: "servants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servant_stage_assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servant_stage_assignments_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servant_stage_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servant_stage_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          church_id: string
          created_at: string
          deleted_at: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_journal_entries: {
        Row: {
          bible_reading: boolean
          church_id: string
          communion: boolean
          confession: boolean
          created_at: string
          entry_date: string
          id: string
          liturgy_attendance: boolean
          morning_prayer: boolean
          ninth_hour_prayer: boolean
          prayer_completed: boolean
          servant_id: string
          sixth_hour_prayer: boolean
          sleep_prayer: boolean
          spiritual_notes: string | null
          sunset_prayer: boolean
          third_hour_prayer: boolean
          updated_at: string
        }
        Insert: {
          bible_reading?: boolean
          church_id: string
          communion?: boolean
          confession?: boolean
          created_at?: string
          entry_date: string
          id?: string
          liturgy_attendance?: boolean
          morning_prayer?: boolean
          ninth_hour_prayer?: boolean
          prayer_completed?: boolean
          servant_id: string
          sixth_hour_prayer?: boolean
          sleep_prayer?: boolean
          spiritual_notes?: string | null
          sunset_prayer?: boolean
          third_hour_prayer?: boolean
          updated_at?: string
        }
        Update: {
          bible_reading?: boolean
          church_id?: string
          communion?: boolean
          confession?: boolean
          created_at?: string
          entry_date?: string
          id?: string
          liturgy_attendance?: boolean
          morning_prayer?: boolean
          ninth_hour_prayer?: boolean
          prayer_completed?: boolean
          servant_id?: string
          sixth_hour_prayer?: boolean
          sleep_prayer?: boolean
          spiritual_notes?: string | null
          sunset_prayer?: boolean
          third_hour_prayer?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiritual_journal_entries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiritual_journal_entries_servant_id_fkey"
            columns: ["servant_id"]
            isOneToOne: false
            referencedRelation: "servants"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          age_max: number | null
          age_min: number | null
          church_id: string
          created_at: string
          deleted_at: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          service_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          church_id: string
          created_at?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          service_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          church_id?: string
          created_at?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          service_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string
          church_id: string
          created_at: string
          end_date: string | null
          id: string
          role_id: string
          start_date: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          church_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          role_id: string
          start_date: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          church_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          role_id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
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
      change_church_manager: {
        Args: { p_church_id: string; p_new_user_id: string }
        Returns: string
      }
      create_beneficiary_with_assignment: {
        Args: {
          p_address?: string
          p_confession_father?: string
          p_date_of_birth?: string
          p_father_mobile?: string
          p_full_name_ar: string
          p_full_name_en?: string
          p_gender?: string
          p_mobile?: string
          p_mother_mobile?: string
          p_notes?: string
          p_photo_url?: string
          p_school?: string
          p_service_id: string
          p_stage_id: string
          p_whatsapp?: string
        }
        Returns: string
      }
      deactivate_church_user: {
        Args: { p_church_id: string; p_user_id: string }
        Returns: string
      }
      get_user_church_id: { Args: never; Returns: string }
      get_user_role_types: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role_type"][]
      }
      seed_church_roles: { Args: { p_church_id: string }; Returns: undefined }
      user_has_any_role: {
        Args: {
          required_roles: Database["public"]["Enums"]["user_role_type"][]
        }
        Returns: boolean
      }
      user_has_permission: {
        Args: { permission_code: string }
        Returns: boolean
      }
      user_has_role: {
        Args: { required_role: Database["public"]["Enums"]["user_role_type"] }
        Returns: boolean
      }
      user_has_stage_access: {
        Args: { target_stage_id: string }
        Returns: boolean
      }
      user_is_church_admin_or_above: { Args: never; Returns: boolean }
      write_audit_log: {
        Args: {
          p_action: string
          p_church_id: string
          p_entity_id?: string
          p_entity_type: string
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: string
      }
    }
    Enums: {
      ai_message_role: "user" | "assistant" | "system" | "tool"
      attendance_status: "present" | "absent" | "excused"
      document_entity_type: "child" | "event" | "church" | "user"
      event_registration_status:
        | "registered"
        | "confirmed"
        | "cancelled"
        | "attended"
      event_type: "meeting" | "camp" | "conference" | "trip" | "other"
      followup_status: "open" | "in_progress" | "completed" | "cancelled"
      gender_type: "male" | "female"
      user_role_type:
        | "platform_owner"
        | "super_admin"
        | "admin"
        | "servant"
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
      ai_message_role: ["user", "assistant", "system", "tool"],
      attendance_status: ["present", "absent", "excused"],
      document_entity_type: ["child", "event", "church", "user"],
      event_registration_status: [
        "registered",
        "confirmed",
        "cancelled",
        "attended",
      ],
      event_type: ["meeting", "camp", "conference", "trip", "other"],
      followup_status: ["open", "in_progress", "completed", "cancelled"],
      gender_type: ["male", "female"],
      user_role_type: [
        "platform_owner",
        "super_admin",
        "admin",
        "servant",
      ],
    },
  },
} as const
