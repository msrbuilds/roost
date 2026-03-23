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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string | null
          file_size: number | null
          file_url: string
          filename: string
          feature_request_id: string | null
          id: string
          message_id: string | null
          mime_type: string | null
          post_id: string | null
          uploaded_by: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string | null
          feature_request_id?: string | null
          file_size?: number | null
          file_url: string
          filename: string
          id?: string
          message_id?: string | null
          mime_type?: string | null
          post_id?: string | null
          uploaded_by: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string | null
          feature_request_id?: string | null
          file_size?: number | null
          file_url?: string
          filename?: string
          id?: string
          message_id?: string | null
          mime_type?: string | null
          post_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_feature_request_id_fkey"
            columns: ["feature_request_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          id: string
          announcement_id: string
          user_id: string
          dismissed_at: string | null
        }
        Insert: {
          id?: string
          announcement_id: string
          user_id: string
          dismissed_at?: string | null
        }
        Update: {
          id?: string
          announcement_id?: string
          user_id?: string
          dismissed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          type: Database["public"]["Enums"]["announcement_type"] | null
          scope: Database["public"]["Enums"]["announcement_scope"] | null
          group_id: string | null
          is_active: boolean | null
          is_dismissible: boolean | null
          starts_at: string | null
          expires_at: string | null
          created_by: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          type?: Database["public"]["Enums"]["announcement_type"] | null
          scope?: Database["public"]["Enums"]["announcement_scope"] | null
          group_id?: string | null
          is_active?: boolean | null
          is_dismissible?: boolean | null
          starts_at?: string | null
          expires_at?: string | null
          created_by: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          type?: Database["public"]["Enums"]["announcement_type"] | null
          scope?: Database["public"]["Enums"]["announcement_scope"] | null
          group_id?: string | null
          is_active?: boolean | null
          is_dismissible?: boolean | null
          starts_at?: string | null
          expires_at?: string | null
          created_by?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          group_id: string | null
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_edited: boolean | null
          parent_comment_id: string | null
          post_id: string | null
          recording_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          parent_comment_id?: string | null
          post_id?: string | null
          recording_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          parent_comment_id?: string | null
          post_id?: string | null
          recording_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          status: Database["public"]["Enums"]["rsvp_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          status?: Database["public"]["Enums"]["rsvp_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          status?: Database["public"]["Enums"]["rsvp_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          end_time: string
          group_id: string
          id: string
          is_virtual: boolean | null
          location: string | null
          meeting_url: string | null
          start_time: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          end_time: string
          group_id: string
          id?: string
          is_virtual?: boolean | null
          location?: string | null
          meeting_url?: string | null
          start_time: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_time?: string
          group_id?: string
          id?: string
          is_virtual?: boolean | null
          location?: string | null
          meeting_url?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_assets: {
        Row: {
          asset_id: string
          created_at: string | null
          group_id: string
          id: string
          module_id: string | null
          uploaded_by: string
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          group_id: string
          id?: string
          module_id?: string | null
          uploaded_by: string
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          group_id?: string
          id?: string
          module_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_assets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_assets_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["group_role"] | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["group_role"] | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["group_role"] | null
          user_id?: string
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
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          cover_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_private: boolean | null
          is_premium: boolean | null
          layout_mode: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          is_premium?: boolean | null
          layout_mode?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          is_premium?: boolean | null
          layout_mode?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gumroad_customers: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          gumroad_id: string
          id: string
          ip_country: string | null
          purchase_email: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          gumroad_id: string
          id?: string
          ip_country?: string | null
          purchase_email?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          gumroad_id?: string
          id?: string
          ip_country?: string | null
          purchase_email?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gumroad_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gumroad_products: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          group_id: string | null
          gumroad_product_id: string
          id: string
          is_subscription: boolean | null
          name: string
          price_cents: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          group_id?: string | null
          gumroad_product_id: string
          id?: string
          is_subscription?: boolean | null
          name: string
          price_cents?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          group_id?: string | null
          gumroad_product_id?: string
          id?: string
          is_subscription?: boolean | null
          name?: string
          price_cents?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gumroad_products_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      gumroad_subscriptions: {
        Row: {
          billing_cycle: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          ends_at: string | null
          failed_at: string | null
          gumroad_customer_id: string
          gumroad_subscription_id: string
          id: string
          next_charge_date: string | null
          price_cents: number
          product_id: string
          product_name: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
          user_id: string | null
          variant_name: string | null
        }
        Insert: {
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          ends_at?: string | null
          failed_at?: string | null
          gumroad_customer_id: string
          gumroad_subscription_id: string
          id?: string
          next_charge_date?: string | null
          price_cents: number
          product_id: string
          product_name: string
          started_at: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id?: string | null
          variant_name?: string | null
        }
        Update: {
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          ends_at?: string | null
          failed_at?: string | null
          gumroad_customer_id?: string
          gumroad_subscription_id?: string
          id?: string
          next_charge_date?: string | null
          price_cents?: number
          product_id?: string
          product_name?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gumroad_subscriptions_gumroad_customer_id_fkey"
            columns: ["gumroad_customer_id"]
            isOneToOne: false
            referencedRelation: "gumroad_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gumroad_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gumroad_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: Database["public"]["Enums"]["webhook_event_type"]
          gumroad_sale_id: string | null
          id: string
          ip_address: string | null
          payload: Json
          processed: boolean | null
          processed_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: Database["public"]["Enums"]["webhook_event_type"]
          gumroad_sale_id?: string | null
          id?: string
          ip_address?: string | null
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["webhook_event_type"]
          gumroad_sale_id?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      live_session_messages: {
        Row: {
          id: string
          session_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_session_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          created_at: string | null
          group_id: string | null
          id: string
          period_end: string
          period_start: string
          points: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          period_end: string
          period_start: string
          points?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          period_end?: string
          period_start?: string
          points?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          notify_comments: boolean | null
          notify_replies: boolean | null
          notify_mentions: boolean | null
          notify_messages: boolean | null
          notify_reactions: boolean | null
          email_comments: boolean | null
          email_replies: boolean | null
          email_mentions: boolean | null
          email_messages: boolean | null
          email_announcements: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          notify_comments?: boolean | null
          notify_replies?: boolean | null
          notify_mentions?: boolean | null
          notify_messages?: boolean | null
          notify_reactions?: boolean | null
          email_comments?: boolean | null
          email_replies?: boolean | null
          email_mentions?: boolean | null
          email_messages?: boolean | null
          email_announcements?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          notify_comments?: boolean | null
          notify_replies?: boolean | null
          notify_mentions?: boolean | null
          notify_messages?: boolean | null
          notify_reactions?: boolean | null
          email_comments?: boolean | null
          email_replies?: boolean | null
          email_mentions?: boolean | null
          email_messages?: boolean | null
          email_announcements?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          email_pending: boolean | null
          email_sent_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_pending?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_pending?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      point_activities: {
        Row: {
          action_type: Database["public"]["Enums"]["point_action_type"]
          created_at: string | null
          description: string | null
          group_id: string | null
          id: string
          points: number
          reference_id: string | null
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["point_action_type"]
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          points: number
          reference_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["point_action_type"]
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_activities_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          category_id: string | null
          content: string
          created_at: string | null
          group_id: string | null
          id: string
          is_edited: boolean | null
          is_pinned: boolean | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_edited?: boolean | null
          is_pinned?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_edited?: boolean | null
          is_pinned?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          display_name: string
          id: string
          is_online: boolean | null
          last_seen_at: string | null
          location: string | null
          membership_type: Database["public"]["Enums"]["membership_type"] | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          username: string
          website: string | null
          is_banned: boolean | null
          ban_reason: string | null
          ban_expires_at: string | null
          banned_by: string | null
          banned_at: string | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          two_factor_verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name: string
          id: string
          is_online?: boolean | null
          last_seen_at?: string | null
          location?: string | null
          membership_type?: Database["public"]["Enums"]["membership_type"] | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          username: string
          website?: string | null
          is_banned?: boolean | null
          ban_reason?: string | null
          ban_expires_at?: string | null
          banned_by?: string | null
          banned_at?: string | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          two_factor_verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          location?: string | null
          membership_type?: Database["public"]["Enums"]["membership_type"] | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          username?: string
          website?: string | null
          is_banned?: boolean | null
          ban_reason?: string | null
          ban_expires_at?: string | null
          banned_by?: string | null
          banned_at?: string | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          two_factor_verified_at?: string | null
        }
        Relationships: []
      }
      two_factor_backup_codes: {
        Row: {
          id: string
          user_id: string
          code_hash: string
          used_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          code_hash: string
          used_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          code_hash?: string
          used_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "two_factor_backup_codes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string | null
          id: string
          reactable_id: string
          reactable_type: Database["public"]["Enums"]["reactable_type"]
          reaction_type: Database["public"]["Enums"]["reaction_type"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reactable_id: string
          reactable_type: Database["public"]["Enums"]["reactable_type"]
          reaction_type?: Database["public"]["Enums"]["reaction_type"] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reactable_id?: string
          reactable_type?: Database["public"]["Enums"]["reactable_type"]
          reaction_type?: Database["public"]["Enums"]["reaction_type"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          group_id: string
          id: string
          module_id: string | null
          published_by: string
          thumbnail_url: string | null
          title: string
          video_id: string
          video_platform: string
          video_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          group_id: string
          id?: string
          module_id?: string | null
          published_by: string
          thumbnail_url?: string | null
          title: string
          video_id: string
          video_platform: string
          video_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          group_id?: string
          id?: string
          module_id?: string | null
          published_by?: string
          thumbnail_url?: string | null
          title?: string
          video_id?: string
          video_platform?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          id: string
          group_id: string
          title: string
          description: string | null
          thumbnail_url: string | null
          display_order: number
          created_by: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          title: string
          description?: string | null
          thumbnail_url?: string | null
          display_order?: number
          created_by: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          title?: string
          description?: string | null
          thumbnail_url?: string | null
          display_order?: number
          created_by?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          id: string
          user_id: string
          recording_id: string
          module_id: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          recording_id: string
          module_id: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          recording_id?: string
          module_id?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completions_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      showcases: {
        Row: {
          id: string
          title: string
          tagline: string
          description: string
          url: string
          thumbnail_url: string | null
          category: Database["public"]["Enums"]["showcase_category"]
          tech_stack: string[]
          author_id: string
          status: Database["public"]["Enums"]["showcase_status"]
          moderation_notes: string | null
          moderated_by: string | null
          moderated_at: string | null
          launch_date: string | null
          is_featured: boolean
          featured_at: string | null
          vote_count: number
          review_count: number
          average_rating: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          tagline: string
          description: string
          url: string
          thumbnail_url?: string | null
          category: Database["public"]["Enums"]["showcase_category"]
          tech_stack?: string[]
          author_id: string
          status?: Database["public"]["Enums"]["showcase_status"]
          moderation_notes?: string | null
          moderated_by?: string | null
          moderated_at?: string | null
          launch_date?: string | null
          is_featured?: boolean
          featured_at?: string | null
          vote_count?: number
          review_count?: number
          average_rating?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          tagline?: string
          description?: string
          url?: string
          thumbnail_url?: string | null
          category?: Database["public"]["Enums"]["showcase_category"]
          tech_stack?: string[]
          author_id?: string
          status?: Database["public"]["Enums"]["showcase_status"]
          moderation_notes?: string | null
          moderated_by?: string | null
          moderated_at?: string | null
          launch_date?: string | null
          is_featured?: boolean
          featured_at?: string | null
          vote_count?: number
          review_count?: number
          average_rating?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcases_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcases_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_images: {
        Row: {
          id: string
          showcase_id: string
          image_url: string
          display_order: number
          caption: string | null
          created_at: string
        }
        Insert: {
          id?: string
          showcase_id: string
          image_url: string
          display_order?: number
          caption?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          showcase_id?: string
          image_url?: string
          display_order?: number
          caption?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_images_showcase_id_fkey"
            columns: ["showcase_id"]
            isOneToOne: false
            referencedRelation: "showcases"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_tags: {
        Row: {
          id: string
          name: string
          slug: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          color?: string
          created_at?: string
        }
        Relationships: []
      }
      showcase_tag_relations: {
        Row: {
          showcase_id: string
          tag_id: string
        }
        Insert: {
          showcase_id: string
          tag_id: string
        }
        Update: {
          showcase_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_tag_relations_showcase_id_fkey"
            columns: ["showcase_id"]
            isOneToOne: false
            referencedRelation: "showcases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "showcase_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_reviews: {
        Row: {
          id: string
          showcase_id: string
          author_id: string
          content: string
          rating: number
          maker_reply: string | null
          maker_replied_at: string | null
          is_edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          showcase_id: string
          author_id: string
          content: string
          rating: number
          maker_reply?: string | null
          maker_replied_at?: string | null
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          showcase_id?: string
          author_id?: string
          content?: string
          rating?: number
          maker_reply?: string | null
          maker_replied_at?: string | null
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_reviews_showcase_id_fkey"
            columns: ["showcase_id"]
            isOneToOne: false
            referencedRelation: "showcases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_products: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          product_type: string
          monthly_limit: number
          is_active: boolean | null
          icon_url: string | null
          instructions: string | null
          license_key: string | null
          file_url: string | null
          file_name: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          product_type?: string
          monthly_limit?: number
          is_active?: boolean | null
          icon_url?: string | null
          instructions?: string | null
          license_key?: string | null
          file_url?: string | null
          file_name?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          product_type?: string
          monthly_limit?: number
          is_active?: boolean | null
          icon_url?: string | null
          instructions?: string | null
          license_key?: string | null
          file_url?: string | null
          file_name?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      activation_requests: {
        Row: {
          id: string
          user_id: string
          product_id: string
          status: Database["public"]["Enums"]["activation_request_status"] | null
          website_url: string
          wp_username: string
          wp_password: string
          notes: string | null
          admin_notes: string | null
          processed_by: string | null
          processed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          status?: Database["public"]["Enums"]["activation_request_status"] | null
          website_url: string
          wp_username: string
          wp_password: string
          notes?: string | null
          admin_notes?: string | null
          processed_by?: string | null
          processed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          status?: Database["public"]["Enums"]["activation_request_status"] | null
          website_url?: string
          wp_username?: string
          wp_password?: string
          notes?: string | null
          admin_notes?: string | null
          processed_by?: string | null
          processed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "activation_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_usage: {
        Row: {
          id: string
          user_id: string
          product_id: string
          month_year: string
          usage_count: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          month_year: string
          usage_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          month_year?: string
          usage_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "activation_products"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_packages: {
        Row: {
          id: string
          name: string
          description: string | null
          gumroad_product_id: string | null
          products: Json
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          gumroad_product_id?: string | null
          products?: Json
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          gumroad_product_id?: string | null
          products?: Json
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_activation_packages: {
        Row: {
          id: string
          user_id: string
          package_id: string
          status: string | null
          started_at: string | null
          expires_at: string | null
          gumroad_subscription_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          package_id: string
          status?: string | null
          started_at?: string | null
          expires_at?: string | null
          gumroad_subscription_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          package_id?: string
          status?: string | null
          started_at?: string | null
          expires_at?: string | null
          gumroad_subscription_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activation_packages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activation_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "activation_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          id: string
          title: string
          description: string
          type: Database["public"]["Enums"]["feature_request_type"]
          status: Database["public"]["Enums"]["feature_request_status"]
          author_id: string
          admin_response: string | null
          is_pinned: boolean
          vote_count: number
          comment_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          type?: Database["public"]["Enums"]["feature_request_type"]
          status?: Database["public"]["Enums"]["feature_request_status"]
          author_id: string
          admin_response?: string | null
          is_pinned?: boolean
          vote_count?: number
          comment_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          type?: Database["public"]["Enums"]["feature_request_type"]
          status?: Database["public"]["Enums"]["feature_request_status"]
          author_id?: string
          admin_response?: string | null
          is_pinned?: boolean
          vote_count?: number
          comment_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_requests_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_request_comments: {
        Row: {
          id: string
          feature_request_id: string
          author_id: string
          content: string
          parent_comment_id: string | null
          is_edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          feature_request_id: string
          author_id: string
          content: string
          parent_comment_id?: string | null
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          feature_request_id?: string
          author_id?: string
          content?: string
          parent_comment_id?: string | null
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_request_comments_feature_request_id_fkey"
            columns: ["feature_request_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_request_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_request_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "feature_request_comments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_points: {
        Args: {
          p_action_type: Database["public"]["Enums"]["point_action_type"]
          p_description?: string
          p_group_id?: string
          p_points: number
          p_reference_id?: string
          p_user_id: string
        }
        Returns: string
      }
      calculate_user_points: {
        Args: {
          p_end_date?: string
          p_group_id?: string
          p_start_date?: string
          p_user_id: string
        }
        Returns: number
      }
      cancel_gumroad_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      cleanup_expired_subscriptions: { Args: never; Returns: undefined }
      cleanup_old_leaderboard_entries: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      get_group_member_count: { Args: { p_group_id: string }; Returns: number }
      get_group_online_count: { Args: { p_group_id: string }; Returns: number }
      get_subscription_status: {
        Args: { p_user_id: string }
        Returns: {
          ends_at: string
          is_active: boolean
          product_name: string
          status: Database["public"]["Enums"]["subscription_status"]
        }[]
      }
      get_user_comment_count: { Args: { p_user_id: string }; Returns: number }
      get_user_post_count: { Args: { p_user_id: string }; Returns: number }
      get_user_rank: {
        Args: {
          p_group_id?: string
          p_period_end?: string
          p_period_start?: string
          p_user_id: string
        }
        Returns: {
          points: number
          rank: number
          total_users: number
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_active_subscription: { Args: { p_user_id: string }; Returns: boolean }
      has_premium_access: { Args: { p_user_id: string }; Returns: boolean }
      can_access_group: { Args: { p_user_id: string; p_group_id: string }; Returns: boolean }
      is_group_admin_or_mod: {
        Args: { group_id: string; user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { group_id: string; user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { user_id: string }; Returns: boolean }
      is_platform_moderator: { Args: { user_id: string }; Returns: boolean }
      is_superadmin: { Args: { user_id: string }; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_message_read: { Args: { p_message_id: string }; Returns: undefined }
      process_gumroad_purchase: {
        Args: {
          p_email: string
          p_full_name: string
          p_gumroad_id: string
          p_is_subscription: boolean
          p_price_cents: number
          p_product_id: string
          p_product_name: string
          p_subscription_id?: string
          p_variant_name: string
        }
        Returns: string
      }
      reactivate_gumroad_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      search_posts: {
        Args: { p_group_id?: string; p_search_term: string }
        Returns: {
          author_id: string
          content: string
          created_at: string
          group_id: string
          id: string
          rank: number
          title: string
        }[]
      }
      search_users: {
        Args: { p_search_term: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          id: string
          username: string
        }[]
      }
      update_leaderboard_entry: {
        Args: {
          p_group_id?: string
          p_period_end?: string
          p_period_start?: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_remaining_activations: {
        Args: {
          p_user_id: string
          p_product_id: string
        }
        Returns: number
      }
      has_active_request: {
        Args: {
          p_user_id: string
          p_product_id: string
        }
        Returns: boolean
      }
      request_activation: {
        Args: {
          p_user_id: string
          p_product_id: string
          p_website_url: string
          p_wp_username: string
          p_wp_password: string
          p_notes?: string
        }
        Returns: string
      }
      process_activation_request: {
        Args: {
          p_request_id: string
          p_processor_id: string
          p_status: Database["public"]["Enums"]["activation_request_status"]
          p_admin_notes?: string
        }
        Returns: boolean
      }
      get_activation_stats: {
        Args: Record<string, never>
        Returns: Json
      }
    }
    Enums: {
      announcement_scope: "global" | "group"
      announcement_type: "info" | "warning" | "success" | "error"
      asset_type: "image" | "video" | "document" | "other"
      group_role: "admin" | "moderator" | "member"
      membership_type: "free" | "premium"
      notification_type:
      | "new_comment"
      | "comment_reply"
      | "new_reaction"
      | "new_message"
      | "new_follower"
      | "mention"
      | "group_invite"
      | "group_join"
      | "event_reminder"
      point_action_type:
      | "post_created"
      | "comment_created"
      | "reaction_given"
      | "reaction_received"
      | "event_attended"
      | "daily_login"
      | "profile_completed"
      | "manual_adjustment"
      reactable_type: "post" | "comment" | "showcase" | "feature_request"
      showcase_status: "pending" | "approved" | "rejected" | "featured"
      showcase_category: "web_app" | "mobile_app" | "saas" | "tool" | "api" | "website" | "game" | "extension" | "other"
      feature_request_status: "under_review" | "planned" | "in_progress" | "released" | "declined" | "duplicate"
      feature_request_type: "feature_request" | "bug_report" | "improvement"
      reaction_type: "like" | "love" | "fire" | "clap" | "think" | "haha"
      rsvp_status: "going" | "maybe" | "not_going"
      subscription_status:
      | "active"
      | "cancelled"
      | "expired"
      | "failed_payment"
      | "refunded"
      user_role: "user" | "moderator" | "admin" | "superadmin"
      webhook_event_type:
      | "sale"
      | "refund"
      | "dispute"
      | "dispute_won"
      | "subscription_updated"
      | "subscription_ended"
      | "subscription_restarted"
      | "cancellation"
      | "unknown"
      activation_request_status:
      | "pending"
      | "in_progress"
      | "completed"
      | "rejected"
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
      announcement_scope: ["global", "group"],
      announcement_type: ["info", "warning", "success", "error"],
      asset_type: ["image", "video", "document", "other"],
      group_role: ["admin", "moderator", "member"],
      notification_type: [
        "new_comment",
        "new_reaction",
        "new_message",
        "new_follower",
        "mention",
        "group_invite",
        "group_join",
        "event_reminder",
      ],
      point_action_type: [
        "post_created",
        "comment_created",
        "reaction_given",
        "reaction_received",
        "event_attended",
        "daily_login",
        "profile_completed",
        "manual_adjustment",
      ],
      reactable_type: ["post", "comment", "showcase", "feature_request"],
      showcase_status: ["pending", "approved", "rejected", "featured"],
      showcase_category: ["web_app", "mobile_app", "saas", "tool", "api", "website", "game", "extension", "other"],
      feature_request_status: ["under_review", "planned", "in_progress", "released", "declined", "duplicate"],
      feature_request_type: ["feature_request", "bug_report", "improvement"],
      reaction_type: ["like", "love", "fire", "clap", "think", "haha"],
      rsvp_status: ["going", "maybe", "not_going"],
      subscription_status: [
        "active",
        "cancelled",
        "expired",
        "failed_payment",
        "refunded",
      ],
      user_role: ["user", "moderator", "admin", "superadmin"],
      webhook_event_type: [
        "sale",
        "refund",
        "dispute",
        "dispute_won",
        "subscription_updated",
        "subscription_ended",
        "subscription_restarted",
        "cancellation",
        "unknown",
      ],
      activation_request_status: [
        "pending",
        "in_progress",
        "completed",
        "rejected",
      ],
    },
  },
} as const

// Helper type exports for convenient access to table types
export type Profile = Tables<'profiles'>;
export type Group = Tables<'groups'>;
export type GroupMember = Tables<'group_members'>;
export type Post = Tables<'posts'>;
export type Comment = Tables<'comments'>;
export type Follow = Tables<'follows'>;
export type Reaction = Tables<'reactions'>;
export type Message = Tables<'messages'>;
export type Notification = Tables<'notifications'>;
export type Asset = Tables<'assets'>;
export type Recording = Tables<'recordings'>;
export type Module = Tables<'modules'>;
export type LessonCompletion = Tables<'lesson_completions'>;
export type Event = Tables<'events'>;
export type EventAttendee = Tables<'event_attendees'>;
export type LeaderboardEntry = Tables<'leaderboard_entries'>;
export type PointActivity = Tables<'point_activities'>;
export type Category = Tables<'categories'>;
export type Showcase = Tables<'showcases'>;
export type ShowcaseImage = Tables<'showcase_images'>;
export type ShowcaseTag = Tables<'showcase_tags'>;
export type ShowcaseTagRelation = Tables<'showcase_tag_relations'>;
export type ShowcaseReview = Tables<'showcase_reviews'>;
export type FeatureRequest = Tables<'feature_requests'>;
export type FeatureRequestComment = Tables<'feature_request_comments'>;
export type ActivationProduct = Tables<'activation_products'>;
export type ActivationRequest = Tables<'activation_requests'>;
export type ActivationUsage = Tables<'activation_usage'>;
export type ActivationPackage = Tables<'activation_packages'>;
export type UserActivationPackage = Tables<'user_activation_packages'>;

// Insert type helpers
export type ProfileInsert = TablesInsert<'profiles'>;
export type GroupInsert = TablesInsert<'groups'>;
export type GroupMemberInsert = TablesInsert<'group_members'>;
export type PostInsert = TablesInsert<'posts'>;
export type CommentInsert = TablesInsert<'comments'>;
export type FollowInsert = TablesInsert<'follows'>;
export type ReactionInsert = TablesInsert<'reactions'>;
export type MessageInsert = TablesInsert<'messages'>;
export type NotificationInsert = TablesInsert<'notifications'>;
export type AssetInsert = TablesInsert<'assets'>;
export type RecordingInsert = TablesInsert<'recordings'>;
export type ModuleInsert = TablesInsert<'modules'>;
export type LessonCompletionInsert = TablesInsert<'lesson_completions'>;
export type EventInsert = TablesInsert<'events'>;
export type EventAttendeeInsert = TablesInsert<'event_attendees'>;
export type LeaderboardEntryInsert = TablesInsert<'leaderboard_entries'>;
export type PointActivityInsert = TablesInsert<'point_activities'>;
export type CategoryInsert = TablesInsert<'categories'>;
export type ShowcaseInsert = TablesInsert<'showcases'>;
export type ShowcaseImageInsert = TablesInsert<'showcase_images'>;
export type ShowcaseTagInsert = TablesInsert<'showcase_tags'>;
export type ShowcaseTagRelationInsert = TablesInsert<'showcase_tag_relations'>;
export type ShowcaseReviewInsert = TablesInsert<'showcase_reviews'>;
export type FeatureRequestInsert = TablesInsert<'feature_requests'>;
export type FeatureRequestCommentInsert = TablesInsert<'feature_request_comments'>;
export type ActivationProductInsert = TablesInsert<'activation_products'>;
export type ActivationRequestInsert = TablesInsert<'activation_requests'>;
export type ActivationUsageInsert = TablesInsert<'activation_usage'>;
export type ActivationPackageInsert = TablesInsert<'activation_packages'>;
export type UserActivationPackageInsert = TablesInsert<'user_activation_packages'>;

// Update type helpers
export type ProfileUpdate = TablesUpdate<'profiles'>;
export type GroupUpdate = TablesUpdate<'groups'>;
export type GroupMemberUpdate = TablesUpdate<'group_members'>;
export type PostUpdate = TablesUpdate<'posts'>;
export type CommentUpdate = TablesUpdate<'comments'>;
export type FollowUpdate = TablesUpdate<'follows'>;
export type ReactionUpdate = TablesUpdate<'reactions'>;
export type MessageUpdate = TablesUpdate<'messages'>;
export type NotificationUpdate = TablesUpdate<'notifications'>;
export type AssetUpdate = TablesUpdate<'assets'>;
export type RecordingUpdate = TablesUpdate<'recordings'>;
export type ModuleUpdate = TablesUpdate<'modules'>;
export type EventUpdate = TablesUpdate<'events'>;
export type EventAttendeeUpdate = TablesUpdate<'event_attendees'>;
export type LeaderboardEntryUpdate = TablesUpdate<'leaderboard_entries'>;
export type PointActivityUpdate = TablesUpdate<'point_activities'>;
export type CategoryUpdate = TablesUpdate<'categories'>;
export type ShowcaseUpdate = TablesUpdate<'showcases'>;
export type ShowcaseImageUpdate = TablesUpdate<'showcase_images'>;
export type ShowcaseTagUpdate = TablesUpdate<'showcase_tags'>;
export type ShowcaseTagRelationUpdate = TablesUpdate<'showcase_tag_relations'>;
export type ShowcaseReviewUpdate = TablesUpdate<'showcase_reviews'>;
export type FeatureRequestUpdate = TablesUpdate<'feature_requests'>;
export type FeatureRequestCommentUpdate = TablesUpdate<'feature_request_comments'>;
export type ActivationProductUpdate = TablesUpdate<'activation_products'>;
export type ActivationRequestUpdate = TablesUpdate<'activation_requests'>;
export type ActivationUsageUpdate = TablesUpdate<'activation_usage'>;
export type ActivationPackageUpdate = TablesUpdate<'activation_packages'>;
export type UserActivationPackageUpdate = TablesUpdate<'user_activation_packages'>;

// Enum type helpers
export type UserRole = Enums<'user_role'>;
export type GroupRole = Enums<'group_role'>;
export type ReactionType = Enums<'reaction_type'>;
export type RSVPStatus = Enums<'rsvp_status'>;
export type PointActionType = Enums<'point_action_type'>;
export type AssetType = Enums<'asset_type'>;
export type NotificationType = Enums<'notification_type'>;
export type ReactableType = Enums<'reactable_type'>;
export type SubscriptionStatus = Enums<'subscription_status'>;
export type WebhookEventType = Enums<'webhook_event_type'>;
export type ShowcaseStatus = Enums<'showcase_status'>;
export type ShowcaseCategory = Enums<'showcase_category'>;
export type ActivationRequestStatus = Enums<'activation_request_status'>;
export type MembershipType = Enums<'membership_type'>;
export type FeatureRequestStatus = Enums<'feature_request_status'>;
export type FeatureRequestType = Enums<'feature_request_type'>;

