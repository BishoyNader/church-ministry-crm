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
      attendance: {
        Row: {
          attendance_date: string
          child_id: string
          church_id: string
          created_at: string
          id: string
          notes: string | null
          recorded_by: string
          stage_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          attendance_date: string
          child_id: string
          church_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by: string
          stage_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          child_id?: string
          church_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          stage_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          church_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          church_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          church_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
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
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          allergies: string | null
          baptism_date: string | null
          church_id: string
          confession_frequency: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrolled_at: string
          father_name_ar: string | null
          first_name_ar: string
          first_name_en: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          grade_level: string | null
          id: string
          last_name_ar: string
          last_name_en: string | null
          medical_conditions: string | null
          medications: string | null
          ministry_id: string
          mobile: string | null
          mother_name_ar: string | null
          notes: string | null
          parent_address_ar: string | null
          parent_email: string | null
          parent_phone: string | null
          photo_url: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage_type"]
          school_name_ar: string | null
          spiritual_notes: string | null
          stage_id: string
          status: Database["public"]["Enums"]["child_status"]
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          baptism_date?: string | null
          church_id: string
          confession_frequency?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrolled_at?: string
          father_name_ar?: string | null
          first_name_ar: string
          first_name_en?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          grade_level?: string | null
          id?: string
          last_name_ar: string
          last_name_en?: string | null
          medical_conditions?: string | null
          medications?: string | null
          ministry_id: string
          mobile?: string | null
          mother_name_ar?: string | null
          notes?: string | null
          parent_address_ar?: string | null
          parent_email?: string | null
          parent_phone?: string | null
          photo_url?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage_type"]
          school_name_ar?: string | null
          spiritual_notes?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["child_status"]
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          baptism_date?: string | null
          church_id?: string
          confession_frequency?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrolled_at?: string
          father_name_ar?: string | null
          first_name_ar?: string
          first_name_en?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          grade_level?: string | null
          id?: string
          last_name_ar?: string
          last_name_en?: string | null
          medical_conditions?: string | null
          medications?: string | null
          ministry_id?: string
          mobile?: string | null
          mother_name_ar?: string | null
          notes?: string | null
          parent_address_ar?: string | null
          parent_email?: string | null
          parent_phone?: string | null
          photo_url?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage_type"]
          school_name_ar?: string | null
          spiritual_notes?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["child_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name_ar: string
          name_en: string | null
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar: string
          name_en?: string | null
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar?: string
          name_en?: string | null
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
          child_id: string
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
          child_id: string
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
          child_id?: string
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
            foreignKeyName: "event_registrations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
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
          ministry_id: string | null
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
          ministry_id?: string | null
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
          ministry_id?: string | null
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
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          assigned_to: string | null
          child_id: string
          church_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          outcome: string | null
          scheduled_at: string | null
          stage_id: string
          status: Database["public"]["Enums"]["followup_status"]
          type: Database["public"]["Enums"]["followup_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          child_id: string
          church_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["followup_status"]
          type: Database["public"]["Enums"]["followup_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          child_id?: string
          church_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["followup_status"]
          type?: Database["public"]["Enums"]["followup_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
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
            foreignKeyName: "ministries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body_ar: string
          body_en: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          church_id: string
          created_at: string
          id: string
          metadata: Json
          read_at: string | null
          sent_at: string | null
          title_ar: string
          title_en: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body_ar: string
          body_en?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          church_id: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          sent_at?: string | null
          title_ar: string
          title_en?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body_ar?: string
          body_en?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          church_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          sent_at?: string | null
          title_ar?: string
          title_en?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
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
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
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
          deleted_at: string | null
          email: string | null
          full_name_ar: string
          full_name_en: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          preferred_locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          church_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name_ar: string
          full_name_en?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          preferred_locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          church_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name_ar?: string
          full_name_en?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          preferred_locale?: string
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
      spiritual_records: {
        Row: {
          child_id: string
          church_id: string
          created_at: string
          id: string
          notes: string | null
          record_date: string
          record_type: Database["public"]["Enums"]["spiritual_record_type"]
          recorded_by: string
          updated_at: string
        }
        Insert: {
          child_id: string
          church_id: string
          created_at?: string
          id?: string
          notes?: string | null
          record_date: string
          record_type: Database["public"]["Enums"]["spiritual_record_type"]
          recorded_by: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          church_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          record_date?: string
          record_type?: Database["public"]["Enums"]["spiritual_record_type"]
          recorded_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiritual_records_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiritual_records_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiritual_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          ministry_id: string
          name_ar: string
          name_en: string | null
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
          ministry_id: string
          name_ar: string
          name_en?: string | null
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
          ministry_id?: string
          name_ar?: string
          name_en?: string | null
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
            foreignKeyName: "stages_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          church_id: string
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          church_id: string
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          church_id?: string
          created_at?: string
          id?: string
          role_id?: string
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
      user_stage_assignments: {
        Row: {
          assigned_by: string | null
          church_id: string
          created_at: string
          id: string
          stage_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          church_id: string
          created_at?: string
          id?: string
          stage_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          church_id?: string
          created_at?: string
          id?: string
          stage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stage_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stage_assignments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stage_assignments_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stage_assignments_user_id_fkey"
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
          p_action: Database["public"]["Enums"]["audit_action"]
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
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "export"
        | "ai_action"
      child_status: "active" | "inactive" | "transferred" | "graduated"
      document_entity_type: "child" | "event" | "church" | "user"
      event_registration_status:
        | "registered"
        | "confirmed"
        | "cancelled"
        | "attended"
      event_type: "meeting" | "camp" | "conference" | "trip" | "other"
      followup_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      followup_type:
        | "phone_call"
        | "home_visit"
        | "whatsapp"
        | "church_meeting"
        | "other"
      gender_type: "male" | "female"
      notification_channel:
        | "absence_alert"
        | "followup_reminder"
        | "birthday"
        | "event_reminder"
        | "system"
      notification_type: "in_app" | "email"
      pipeline_stage_type:
        | "new_visitor"
        | "first_followup"
        | "regular_attendee"
        | "active_member"
        | "leader_candidate"
      spiritual_record_type:
        | "baptism"
        | "confession"
        | "communion"
        | "prayer"
        | "other"
      user_role_type:
        | "super_admin"
        | "church_admin"
        | "stage_leader"
        | "servant"
        | "viewer"
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
      audit_action: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "export",
        "ai_action",
      ],
      child_status: ["active", "inactive", "transferred", "graduated"],
      document_entity_type: ["child", "event", "church", "user"],
      event_registration_status: [
        "registered",
        "confirmed",
        "cancelled",
        "attended",
      ],
      event_type: ["meeting", "camp", "conference", "trip", "other"],
      followup_status: ["scheduled", "in_progress", "completed", "cancelled"],
      followup_type: [
        "phone_call",
        "home_visit",
        "whatsapp",
        "church_meeting",
        "other",
      ],
      gender_type: ["male", "female"],
      notification_channel: [
        "absence_alert",
        "followup_reminder",
        "birthday",
        "event_reminder",
        "system",
      ],
      notification_type: ["in_app", "email"],
      pipeline_stage_type: [
        "new_visitor",
        "first_followup",
        "regular_attendee",
        "active_member",
        "leader_candidate",
      ],
      spiritual_record_type: [
        "baptism",
        "confession",
        "communion",
        "prayer",
        "other",
      ],
      user_role_type: [
        "super_admin",
        "church_admin",
        "stage_leader",
        "servant",
        "viewer",
      ],
    },
  },
} as const

