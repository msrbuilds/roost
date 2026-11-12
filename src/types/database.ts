
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "activation_product_secrets": {
                  Row: {
                    "license_key": string | null,"product_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "license_key"?: string | null,"product_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "license_key"?: string | null,"product_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activation_product_secrets_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "activation_products"
      referencedColumns: ["id"]
    }
                  ]
                },"activation_products": {
                  Row: {
                    "created_at": string | null,"description": string | null,"file_name": string | null,"file_url": string | null,"icon_url": string | null,"id": string,"instructions": string | null,"is_active": boolean | null,"monthly_limit": number,"name": string,"product_type": string,"slug": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"description"?: string | null,"file_name"?: string | null,"file_url"?: string | null,"icon_url"?: string | null,"id"?: string,"instructions"?: string | null,"is_active"?: boolean | null,"monthly_limit"?: number,"name": string,"product_type"?: string,"slug": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"description"?: string | null,"file_name"?: string | null,"file_url"?: string | null,"icon_url"?: string | null,"id"?: string,"instructions"?: string | null,"is_active"?: boolean | null,"monthly_limit"?: number,"name"?: string,"product_type"?: string,"slug"?: string,"updated_at"?: string | null
                  }
                  Relationships: [

                  ]
                },"activation_requests": {
                  Row: {
                    "admin_notes": string | null,"created_at": string | null,"id": string,"notes": string | null,"processed_at": string | null,"processed_by": string | null,"product_id": string,"status": Database["public"]['Enums']["activation_request_status"] | null,"updated_at": string | null,"user_id": string,"website_url": string,"wp_password": string | null,"wp_username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_notes"?: string | null,"created_at"?: string | null,"id"?: string,"notes"?: string | null,"processed_at"?: string | null,"processed_by"?: string | null,"product_id": string,"status"?: Database["public"]['Enums']["activation_request_status"] | null,"updated_at"?: string | null,"user_id": string,"website_url": string,"wp_password"?: string | null,"wp_username": string
                  }
                  Update: {
                    "admin_notes"?: string | null,"created_at"?: string | null,"id"?: string,"notes"?: string | null,"processed_at"?: string | null,"processed_by"?: string | null,"product_id"?: string,"status"?: Database["public"]['Enums']["activation_request_status"] | null,"updated_at"?: string | null,"user_id"?: string,"website_url"?: string,"wp_password"?: string | null,"wp_username"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activation_requests_processed_by_fkey"
      columns: ["processed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activation_requests_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "activation_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activation_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"activation_usage": {
                  Row: {
                    "created_at": string | null,"id": string,"month_year": string,"product_id": string,"updated_at": string | null,"usage_count": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"month_year": string,"product_id": string,"updated_at"?: string | null,"usage_count"?: number | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"month_year"?: string,"product_id"?: string,"updated_at"?: string | null,"usage_count"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activation_usage_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "activation_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activation_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcement_dismissals": {
                  Row: {
                    "announcement_id": string,"dismissed_at": string | null,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"dismissed_at"?: string | null,"id"?: string,"user_id": string
                  }
                  Update: {
                    "announcement_id"?: string,"dismissed_at"?: string | null,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_dismissals_announcement_id_fkey"
      columns: ["announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_dismissals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "content": string,"created_at": string | null,"created_by": string,"expires_at": string | null,"group_id": string | null,"id": string,"is_active": boolean | null,"is_dismissible": boolean | null,"scope": Database["public"]['Enums']["announcement_scope"] | null,"starts_at": string | null,"title": string,"type": Database["public"]['Enums']["announcement_type"] | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string | null,"created_by": string,"expires_at"?: string | null,"group_id"?: string | null,"id"?: string,"is_active"?: boolean | null,"is_dismissible"?: boolean | null,"scope"?: Database["public"]['Enums']["announcement_scope"] | null,"starts_at"?: string | null,"title": string,"type"?: Database["public"]['Enums']["announcement_type"] | null,"updated_at"?: string | null
                  }
                  Update: {
                    "content"?: string,"created_at"?: string | null,"created_by"?: string,"expires_at"?: string | null,"group_id"?: string | null,"id"?: string,"is_active"?: boolean | null,"is_dismissible"?: boolean | null,"scope"?: Database["public"]['Enums']["announcement_scope"] | null,"starts_at"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["announcement_type"] | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"assets": {
                  Row: {
                    "asset_type": Database["public"]['Enums']["asset_type"],"created_at": string | null,"feature_request_id": string | null,"file_size": number | null,"file_url": string,"filename": string,"id": string,"message_id": string | null,"mime_type": string | null,"post_id": string | null,"storage_key": string | null,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_type": Database["public"]['Enums']["asset_type"],"created_at"?: string | null,"feature_request_id"?: string | null,"file_size"?: number | null,"file_url": string,"filename": string,"id"?: string,"message_id"?: string | null,"mime_type"?: string | null,"post_id"?: string | null,"storage_key"?: string | null,"uploaded_by": string
                  }
                  Update: {
                    "asset_type"?: Database["public"]['Enums']["asset_type"],"created_at"?: string | null,"feature_request_id"?: string | null,"file_size"?: number | null,"file_url"?: string,"filename"?: string,"id"?: string,"message_id"?: string | null,"mime_type"?: string | null,"post_id"?: string | null,"storage_key"?: string | null,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assets_feature_request_id_fkey"
      columns: ["feature_request_id"]
isOneToOne: false
      referencedRelation: "feature_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "color": string | null,"created_at": string | null,"display_order": number | null,"group_id": string | null,"icon": string | null,"id": string,"is_active": boolean | null,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string | null,"display_order"?: number | null,"group_id"?: string | null,"icon"?: string | null,"id"?: string,"is_active"?: boolean | null,"name": string,"slug": string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string | null,"display_order"?: number | null,"group_id"?: string | null,"icon"?: string | null,"id"?: string,"is_active"?: boolean | null,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"comment_votes": {
                  Row: {
                    "comment_id": string,"created_at": string | null,"id": string,"user_id": string,"vote_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_id": string,"created_at"?: string | null,"id"?: string,"user_id": string,"vote_type": string
                  }
                  Update: {
                    "comment_id"?: string,"created_at"?: string | null,"id"?: string,"user_id"?: string,"vote_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comment_votes_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comment_votes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"content": string,"created_at": string | null,"id": string,"is_edited": boolean | null,"parent_comment_id": string | null,"post_id": string | null,"recording_id": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"content": string,"created_at"?: string | null,"id"?: string,"is_edited"?: boolean | null,"parent_comment_id"?: string | null,"post_id"?: string | null,"recording_id"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"content"?: string,"created_at"?: string | null,"id"?: string,"is_edited"?: boolean | null,"parent_comment_id"?: string | null,"post_id"?: string | null,"recording_id"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_comment_id_fkey"
      columns: ["parent_comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_recording_id_fkey"
      columns: ["recording_id"]
isOneToOne: false
      referencedRelation: "recordings"
      referencedColumns: ["id"]
    }
                  ]
                },"event_attendees": {
                  Row: {
                    "created_at": string | null,"event_id": string,"id": string,"status": Database["public"]['Enums']["rsvp_status"] | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"event_id": string,"id"?: string,"status"?: Database["public"]['Enums']["rsvp_status"] | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"event_id"?: string,"id"?: string,"status"?: Database["public"]['Enums']["rsvp_status"] | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_attendees_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_attendees_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string | null,"created_by": string,"description": string | null,"end_time": string,"group_id": string | null,"id": string,"is_virtual": boolean | null,"location": string | null,"meeting_url": string | null,"start_time": string,"title": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"created_by": string,"description"?: string | null,"end_time": string,"group_id"?: string | null,"id"?: string,"is_virtual"?: boolean | null,"location"?: string | null,"meeting_url"?: string | null,"start_time": string,"title": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"created_by"?: string,"description"?: string | null,"end_time"?: string,"group_id"?: string | null,"id"?: string,"is_virtual"?: boolean | null,"location"?: string | null,"meeting_url"?: string | null,"start_time"?: string,"title"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"feature_request_comments": {
                  Row: {
                    "author_id": string,"content": string,"created_at": string | null,"feature_request_id": string,"id": string,"is_edited": boolean | null,"parent_comment_id": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"content": string,"created_at"?: string | null,"feature_request_id": string,"id"?: string,"is_edited"?: boolean | null,"parent_comment_id"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"content"?: string,"created_at"?: string | null,"feature_request_id"?: string,"id"?: string,"is_edited"?: boolean | null,"parent_comment_id"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "feature_request_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feature_request_comments_feature_request_id_fkey"
      columns: ["feature_request_id"]
isOneToOne: false
      referencedRelation: "feature_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feature_request_comments_parent_comment_id_fkey"
      columns: ["parent_comment_id"]
isOneToOne: false
      referencedRelation: "feature_request_comments"
      referencedColumns: ["id"]
    }
                  ]
                },"feature_requests": {
                  Row: {
                    "admin_response": string | null,"author_id": string,"comment_count": number | null,"created_at": string | null,"description": string,"id": string,"is_pinned": boolean | null,"status": Database["public"]['Enums']["feature_request_status"],"title": string,"type": Database["public"]['Enums']["feature_request_type"],"updated_at": string | null,"vote_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_response"?: string | null,"author_id": string,"comment_count"?: number | null,"created_at"?: string | null,"description": string,"id"?: string,"is_pinned"?: boolean | null,"status"?: Database["public"]['Enums']["feature_request_status"],"title": string,"type"?: Database["public"]['Enums']["feature_request_type"],"updated_at"?: string | null,"vote_count"?: number | null
                  }
                  Update: {
                    "admin_response"?: string | null,"author_id"?: string,"comment_count"?: number | null,"created_at"?: string | null,"description"?: string,"id"?: string,"is_pinned"?: boolean | null,"status"?: Database["public"]['Enums']["feature_request_status"],"title"?: string,"type"?: Database["public"]['Enums']["feature_request_type"],"updated_at"?: string | null,"vote_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "feature_requests_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string | null,"follower_id": string,"following_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"follower_id": string,"following_id": string,"id"?: string
                  }
                  Update: {
                    "created_at"?: string | null,"follower_id"?: string,"following_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_following_id_fkey"
      columns: ["following_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_assets": {
                  Row: {
                    "asset_id": string,"created_at": string | null,"group_id": string,"id": string,"module_id": string | null,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"created_at"?: string | null,"group_id": string,"id"?: string,"module_id"?: string | null,"uploaded_by": string
                  }
                  Update: {
                    "asset_id"?: string,"created_at"?: string | null,"group_id"?: string,"id"?: string,"module_id"?: string | null,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_assets_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_assets_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_assets_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_assets_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "group_id": string,"id": string,"joined_at": string | null,"role": Database["public"]['Enums']["group_role"] | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"joined_at"?: string | null,"role"?: Database["public"]['Enums']["group_role"] | null,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"joined_at"?: string | null,"role"?: Database["public"]['Enums']["group_role"] | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "avatar_url": string | null,"cover_url": string | null,"created_at": string | null,"created_by": string,"description": string | null,"id": string,"is_premium": boolean | null,"is_private": boolean | null,"layout_mode": string,"name": string,"slug": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"cover_url"?: string | null,"created_at"?: string | null,"created_by": string,"description"?: string | null,"id"?: string,"is_premium"?: boolean | null,"is_private"?: boolean | null,"layout_mode"?: string,"name": string,"slug": string,"updated_at"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"cover_url"?: string | null,"created_at"?: string | null,"created_by"?: string,"description"?: string | null,"id"?: string,"is_premium"?: boolean | null,"is_private"?: boolean | null,"layout_mode"?: string,"name"?: string,"slug"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"leaderboard_entries": {
                  Row: {
                    "created_at": string | null,"group_id": string | null,"id": string,"period_end": string,"period_start": string,"rank": number | null,"total_points": number | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"group_id"?: string | null,"id"?: string,"period_end": string,"period_start": string,"rank"?: number | null,"total_points"?: number | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"group_id"?: string | null,"id"?: string,"period_end"?: string,"period_start"?: string,"rank"?: number | null,"total_points"?: number | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leaderboard_entries_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leaderboard_entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_completions": {
                  Row: {
                    "completed_at": string | null,"id": string,"module_id": string,"recording_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"id"?: string,"module_id": string,"recording_id": string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"id"?: string,"module_id"?: string,"recording_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_completions_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_completions_recording_id_fkey"
      columns: ["recording_id"]
isOneToOne: false
      referencedRelation: "recordings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_completions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_session_messages": {
                  Row: {
                    "content": string,"created_at": string | null,"id": string,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string | null,"id"?: string,"session_id": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string | null,"id"?: string,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_session_messages_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_session_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_session_rsvps": {
                  Row: {
                    "created_at": string | null,"display_name": string | null,"email": string,"id": string,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"display_name"?: string | null,"email": string,"id"?: string,"session_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"display_name"?: string | null,"email"?: string,"id"?: string,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_session_rsvps_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_session_rsvps_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_sessions": {
                  Row: {
                    "created_at": string | null,"created_by": string | null,"description": string | null,"ended_at": string | null,"id": string,"scheduled_at": string | null,"started_at": string | null,"status": string,"title": string,"updated_at": string | null,"visibility": string,"youtube_embed_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"ended_at"?: string | null,"id"?: string,"scheduled_at"?: string | null,"started_at"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string | null,"visibility"?: string,"youtube_embed_url"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"ended_at"?: string | null,"id"?: string,"scheduled_at"?: string | null,"started_at"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string | null,"visibility"?: string,"youtube_embed_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "content": string,"created_at": string | null,"id": string,"is_read": boolean | null,"read_at": string | null,"recipient_id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string | null,"id"?: string,"is_read"?: boolean | null,"read_at"?: string | null,"recipient_id": string,"sender_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string | null,"id"?: string,"is_read"?: boolean | null,"read_at"?: string | null,"recipient_id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "created_at": string | null,"created_by": string,"description": string | null,"display_order": number,"group_id": string,"id": string,"thumbnail_url": string | null,"title": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"created_by": string,"description"?: string | null,"display_order"?: number,"group_id": string,"id"?: string,"thumbnail_url"?: string | null,"title": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"created_by"?: string,"description"?: string | null,"display_order"?: number,"group_id"?: string,"id"?: string,"thumbnail_url"?: string | null,"title"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "modules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modules_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "created_at": string | null,"email_announcements": boolean | null,"email_comments": boolean | null,"email_mentions": boolean | null,"email_messages": boolean | null,"email_replies": boolean | null,"id": string,"notify_comments": boolean | null,"notify_mentions": boolean | null,"notify_messages": boolean | null,"notify_reactions": boolean | null,"notify_replies": boolean | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"email_announcements"?: boolean | null,"email_comments"?: boolean | null,"email_mentions"?: boolean | null,"email_messages"?: boolean | null,"email_replies"?: boolean | null,"id"?: string,"notify_comments"?: boolean | null,"notify_mentions"?: boolean | null,"notify_messages"?: boolean | null,"notify_reactions"?: boolean | null,"notify_replies"?: boolean | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"email_announcements"?: boolean | null,"email_comments"?: boolean | null,"email_mentions"?: boolean | null,"email_messages"?: boolean | null,"email_replies"?: boolean | null,"id"?: string,"notify_comments"?: boolean | null,"notify_mentions"?: boolean | null,"notify_messages"?: boolean | null,"notify_reactions"?: boolean | null,"notify_replies"?: boolean | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string | null,"email_pending": boolean | null,"email_sent_at": string | null,"id": string,"is_read": boolean | null,"link": string | null,"message": string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"email_pending"?: boolean | null,"email_sent_at"?: string | null,"id"?: string,"is_read"?: boolean | null,"link"?: string | null,"message"?: string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"email_pending"?: boolean | null,"email_sent_at"?: string | null,"id"?: string,"is_read"?: boolean | null,"link"?: string | null,"message"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"password_reset_tokens": {
                  Row: {
                    "created_at": string | null,"expires_at": string,"id": string,"token_hash": string,"used_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"expires_at": string,"id"?: string,"token_hash": string,"used_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"expires_at"?: string,"id"?: string,"token_hash"?: string,"used_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"point_activities": {
                  Row: {
                    "action_type": Database["public"]['Enums']["point_action_type"],"created_at": string | null,"description": string | null,"group_id": string | null,"id": string,"points": number,"reference_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_type": Database["public"]['Enums']["point_action_type"],"created_at"?: string | null,"description"?: string | null,"group_id"?: string | null,"id"?: string,"points": number,"reference_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "action_type"?: Database["public"]['Enums']["point_action_type"],"created_at"?: string | null,"description"?: string | null,"group_id"?: string | null,"id"?: string,"points"?: number,"reference_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "point_activities_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "point_activities_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "author_id": string,"category_id": string | null,"content": string,"created_at": string | null,"group_id": string | null,"id": string,"is_edited": boolean | null,"is_pinned": boolean | null,"title": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"category_id"?: string | null,"content": string,"created_at"?: string | null,"group_id"?: string | null,"id"?: string,"is_edited"?: boolean | null,"is_pinned"?: boolean | null,"title"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"category_id"?: string | null,"content"?: string,"created_at"?: string | null,"group_id"?: string | null,"id"?: string,"is_edited"?: boolean | null,"is_pinned"?: boolean | null,"title"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"ban_expires_at": string | null,"ban_reason": string | null,"banned_at": string | null,"banned_by": string | null,"bio": string | null,"cover_url": string | null,"created_at": string | null,"display_name": string,"id": string,"is_banned": boolean | null,"is_online": boolean | null,"last_seen_at": string | null,"location": string | null,"membership_type": string | null,"role": Database["public"]['Enums']["user_role"] | null,"two_factor_enabled": boolean | null,"updated_at": string | null,"username": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"ban_expires_at"?: string | null,"ban_reason"?: string | null,"banned_at"?: string | null,"banned_by"?: string | null,"bio"?: string | null,"cover_url"?: string | null,"created_at"?: string | null,"display_name": string,"id": string,"is_banned"?: boolean | null,"is_online"?: boolean | null,"last_seen_at"?: string | null,"location"?: string | null,"membership_type"?: string | null,"role"?: Database["public"]['Enums']["user_role"] | null,"two_factor_enabled"?: boolean | null,"updated_at"?: string | null,"username": string,"website"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"ban_expires_at"?: string | null,"ban_reason"?: string | null,"banned_at"?: string | null,"banned_by"?: string | null,"bio"?: string | null,"cover_url"?: string | null,"created_at"?: string | null,"display_name"?: string,"id"?: string,"is_banned"?: boolean | null,"is_online"?: boolean | null,"last_seen_at"?: string | null,"location"?: string | null,"membership_type"?: string | null,"role"?: Database["public"]['Enums']["user_role"] | null,"two_factor_enabled"?: boolean | null,"updated_at"?: string | null,"username"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_banned_by_fkey"
      columns: ["banned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string | null,"id": string,"reactable_id": string,"reactable_type": Database["public"]['Enums']["reactable_type"],"reaction_type": Database["public"]['Enums']["reaction_type"] | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"reactable_id": string,"reactable_type": Database["public"]['Enums']["reactable_type"],"reaction_type"?: Database["public"]['Enums']["reaction_type"] | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"reactable_id"?: string,"reactable_type"?: Database["public"]['Enums']["reactable_type"],"reaction_type"?: Database["public"]['Enums']["reaction_type"] | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recordings": {
                  Row: {
                    "created_at": string | null,"description": string | null,"display_order": number,"group_id": string,"id": string,"module_id": string | null,"published_by": string,"thumbnail_url": string | null,"title": string,"video_id": string,"video_platform": string,"video_url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"description"?: string | null,"display_order"?: number,"group_id": string,"id"?: string,"module_id"?: string | null,"published_by": string,"thumbnail_url"?: string | null,"title": string,"video_id": string,"video_platform": string,"video_url": string
                  }
                  Update: {
                    "created_at"?: string | null,"description"?: string | null,"display_order"?: number,"group_id"?: string,"id"?: string,"module_id"?: string | null,"published_by"?: string,"thumbnail_url"?: string | null,"title"?: string,"video_id"?: string,"video_platform"?: string,"video_url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recordings_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recordings_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recordings_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"showcase_images": {
                  Row: {
                    "caption": string | null,"created_at": string | null,"display_order": number | null,"id": string,"image_url": string,"showcase_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string | null,"display_order"?: number | null,"id"?: string,"image_url": string,"showcase_id": string
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string | null,"display_order"?: number | null,"id"?: string,"image_url"?: string,"showcase_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "showcase_images_showcase_id_fkey"
      columns: ["showcase_id"]
isOneToOne: false
      referencedRelation: "showcases"
      referencedColumns: ["id"]
    }
                  ]
                },"showcase_reviews": {
                  Row: {
                    "author_id": string,"content": string,"created_at": string | null,"id": string,"is_edited": boolean | null,"maker_replied_at": string | null,"maker_reply": string | null,"rating": number,"showcase_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"content": string,"created_at"?: string | null,"id"?: string,"is_edited"?: boolean | null,"maker_replied_at"?: string | null,"maker_reply"?: string | null,"rating": number,"showcase_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"content"?: string,"created_at"?: string | null,"id"?: string,"is_edited"?: boolean | null,"maker_replied_at"?: string | null,"maker_reply"?: string | null,"rating"?: number,"showcase_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "showcase_reviews_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "showcase_reviews_showcase_id_fkey"
      columns: ["showcase_id"]
isOneToOne: false
      referencedRelation: "showcases"
      referencedColumns: ["id"]
    }
                  ]
                },"showcase_tag_relations": {
                  Row: {
                    "showcase_id": string,"tag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "showcase_id": string,"tag_id": string
                  }
                  Update: {
                    "showcase_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "showcase_tag_relations_showcase_id_fkey"
      columns: ["showcase_id"]
isOneToOne: false
      referencedRelation: "showcases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "showcase_tag_relations_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "showcase_tags"
      referencedColumns: ["id"]
    }
                  ]
                },"showcase_tags": {
                  Row: {
                    "color": string | null,"created_at": string | null,"id": string,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string | null,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string | null,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [

                  ]
                },"showcases": {
                  Row: {
                    "author_id": string,"average_rating": number | null,"category": Database["public"]['Enums']["showcase_category"],"created_at": string | null,"description": string,"featured_at": string | null,"id": string,"is_featured": boolean | null,"launch_date": string | null,"moderated_at": string | null,"moderated_by": string | null,"moderation_notes": string | null,"review_count": number | null,"status": Database["public"]['Enums']["showcase_status"] | null,"tagline": string,"tech_stack": (string)[] | null,"thumbnail_url": string | null,"title": string,"updated_at": string | null,"url": string,"vote_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"average_rating"?: number | null,"category": Database["public"]['Enums']["showcase_category"],"created_at"?: string | null,"description": string,"featured_at"?: string | null,"id"?: string,"is_featured"?: boolean | null,"launch_date"?: string | null,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_notes"?: string | null,"review_count"?: number | null,"status"?: Database["public"]['Enums']["showcase_status"] | null,"tagline": string,"tech_stack"?: (string)[] | null,"thumbnail_url"?: string | null,"title": string,"updated_at"?: string | null,"url": string,"vote_count"?: number | null
                  }
                  Update: {
                    "author_id"?: string,"average_rating"?: number | null,"category"?: Database["public"]['Enums']["showcase_category"],"created_at"?: string | null,"description"?: string,"featured_at"?: string | null,"id"?: string,"is_featured"?: boolean | null,"launch_date"?: string | null,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_notes"?: string | null,"review_count"?: number | null,"status"?: Database["public"]['Enums']["showcase_status"] | null,"tagline"?: string,"tech_stack"?: (string)[] | null,"thumbnail_url"?: string | null,"title"?: string,"updated_at"?: string | null,"url"?: string,"vote_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "showcases_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "showcases_moderated_by_fkey"
      columns: ["moderated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"site_settings": {
                  Row: {
                    "id": string,"key": string,"updated_at": string | null,"updated_by": string | null,"value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"key": string,"updated_at"?: string | null,"updated_by"?: string | null,"value"?: string | null
                  }
                  Update: {
                    "id"?: string,"key"?: string,"updated_at"?: string | null,"updated_by"?: string | null,"value"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_customers": {
                  Row: {
                    "created_at": string | null,"email": string,"id": string,"stripe_customer_id": string,"updated_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"email": string,"id"?: string,"stripe_customer_id": string,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"email"?: string,"id"?: string,"stripe_customer_id"?: string,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stripe_customers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean | null,"cancelled_at": string | null,"created_at": string | null,"current_period_end": string | null,"current_period_start": string | null,"ended_at": string | null,"id": string,"status": string,"stripe_customer_id": string,"stripe_price_id": string,"stripe_subscription_id": string,"updated_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean | null,"cancelled_at"?: string | null,"created_at"?: string | null,"current_period_end"?: string | null,"current_period_start"?: string | null,"ended_at"?: string | null,"id"?: string,"status"?: string,"stripe_customer_id": string,"stripe_price_id": string,"stripe_subscription_id": string,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean | null,"cancelled_at"?: string | null,"created_at"?: string | null,"current_period_end"?: string | null,"current_period_start"?: string | null,"ended_at"?: string | null,"id"?: string,"status"?: string,"stripe_customer_id"?: string,"stripe_price_id"?: string,"stripe_subscription_id"?: string,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stripe_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_webhook_logs": {
                  Row: {
                    "created_at": string | null,"error_message": string | null,"event_type": string,"id": string,"ip_address": string | null,"payload": NonNullable<Json>,"processed": boolean | null,"processed_at": string | null,"stripe_event_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"error_message"?: string | null,"event_type": string,"id"?: string,"ip_address"?: string | null,"payload"?: NonNullable<Json>,"processed"?: boolean | null,"processed_at"?: string | null,"stripe_event_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"error_message"?: string | null,"event_type"?: string,"id"?: string,"ip_address"?: string | null,"payload"?: NonNullable<Json>,"processed"?: boolean | null,"processed_at"?: string | null,"stripe_event_id"?: string | null
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "award_points":
{ Args: { "p_action_type": Database["public"]['Enums']["point_action_type"],"p_description"?: string,"p_group_id"?: string,"p_points": number,"p_reference_id"?: string,"p_user_id": string }; Returns: string
                           },
"ban_user":
{ Args: { "admin_user_id": string,"ban_duration"?: string,"ban_reason"?: string,"target_user_id": string }; Returns: boolean
                           },
"calculate_user_points":
{ Args: { "p_end_date"?: string,"p_group_id"?: string,"p_start_date"?: string,"p_user_id": string }; Returns: number
                           },
"can_access_group":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: boolean
                           },
"check_group_admin":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: boolean
                           },
"check_group_membership":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: boolean
                           },
"cleanup_expired_reset_tokens":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"cleanup_old_notifications":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"extract_mentions":
{ Args: { "content": string }; Returns: (string)[]
                           },
"get_activation_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_active_announcements":
{ Args: { "p_group_id"?: string,"user_id": string }; Returns: {
              "content": string,"created_at": string,"group_id": string,"id": string,"is_dismissible": boolean,"scope": Database["public"]['Enums']["announcement_scope"],"title": string,"type": Database["public"]['Enums']["announcement_type"]
            }[]
                           },
"get_activity_stats":
{ Args: { "days"?: number }; Returns: {
              "comments": number,"date": string,"posts": number
            }[]
                           },
"get_admin_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_group_member_count":
{ Args: { "p_group_id": string }; Returns: number
                           },
"get_group_online_count":
{ Args: { "p_group_id": string }; Returns: number
                           },
"get_leaderboard_for_period":
{ Args: { "p_group_id"?: string,"p_limit"?: number,"p_offset"?: number,"p_period_start"?: string }; Returns: {
              "activity_count": number,"total_points": number,"user": Json,"user_id": string
            }[]
                           },
"get_notification_preferences":
{ Args: { "p_user_id": string }; Returns: {
              "created_at": string | null,
"email_announcements": boolean | null,
"email_comments": boolean | null,
"email_mentions": boolean | null,
"email_messages": boolean | null,
"email_replies": boolean | null,
"id": string,
"notify_comments": boolean | null,
"notify_mentions": boolean | null,
"notify_messages": boolean | null,
"notify_reactions": boolean | null,
"notify_replies": boolean | null,
"updated_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "notification_preferences"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_pending_notification_emails":
{ Args: { "batch_size"?: number }; Returns: {
              "created_at": string,"link": string,"message": string,"notification_id": string,"notification_type": Database["public"]['Enums']["notification_type"],"title": string,"user_email": string,"user_id": string,"user_name": string
            }[]
                           },
"get_remaining_activations":
{ Args: { "p_product_id": string,"p_user_id": string }; Returns: number
                           },
"get_user_comment_count":
{ Args: { "p_user_id": string }; Returns: number
                           },
"get_user_growth":
{ Args: { "days"?: number }; Returns: {
              "count": number,"date": string
            }[]
                           },
"get_user_id_by_email":
{ Args: { "user_email": string }; Returns: {
              "email": string,"id": string
            }[]
                           },
"get_user_post_count":
{ Args: { "p_user_id": string }; Returns: number
                           },
"get_user_rank":
{ Args: { "p_group_id"?: string,"p_period_end"?: string,"p_period_start"?: string,"p_user_id": string }; Returns: {
              "points": number,"rank": number,"total_users": number
            }[]
                           },
"get_user_role":
{ Args: { "user_uuid": string }; Returns: string
                           },
"has_active_request":
{ Args: { "p_product_id": string,"p_user_id": string }; Returns: boolean
                           },
"has_active_subscription":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"has_premium_access":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"is_feature_available":
{ Args: { "p_key": string }; Returns: boolean
                           },
"is_group_admin_or_mod":
{ Args: { "group_id": string,"user_id": string }; Returns: boolean
                           },
"is_group_member":
{ Args: { "group_id": string,"user_id": string }; Returns: boolean
                           },
"is_group_public":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: { "user_uuid": string }; Returns: boolean
                           },
"is_platform_moderator":
{ Args: { "user_uuid": string }; Returns: boolean
                           },
"is_session_allowed":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_superadmin":
{ Args: { "user_uuid": string }; Returns: boolean
                           },
"is_user_banned":
{ Args: { "user_uuid": string }; Returns: boolean
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mark_message_read":
{ Args: { "p_message_id": string }; Returns: undefined
                           },
"mark_notification_email_sent":
{ Args: { "p_notification_id": string }; Returns: undefined
                           },
"process_activation_request":
{ Args: { "p_admin_notes"?: string,"p_processor_id": string,"p_request_id": string,"p_status": Database["public"]['Enums']["activation_request_status"] }; Returns: boolean
                           },
"request_activation":
{ Args: { "p_notes"?: string,"p_product_id": string,"p_user_id": string,"p_website_url": string,"p_wp_password": string,"p_wp_username": string }; Returns: string
                           },
"search_posts":
{ Args: { "p_group_id"?: string,"p_search_term": string }; Returns: {
              "author_id": string,"content": string,"created_at": string,"group_id": string,"id": string,"rank": number,"title": string
            }[]
                           },
"search_users":
{ Args: { "p_search_term": string }; Returns: {
              "avatar_url": string,"bio": string,"display_name": string,"id": string,"username": string
            }[]
                           },
"setup_first_admin":
{ Args: { "admin_email": string }; Returns: string
                           },
"toggle_comment_vote":
{ Args: { "p_comment_id": string,"p_user_id": string,"p_vote_type": string }; Returns: Json
                           },
"toggle_reaction":
{ Args: { "p_reactable_id": string,"p_reactable_type": string,"p_reaction_type": string,"p_user_id": string }; Returns: Json
                           },
"unban_user":
{ Args: { "admin_user_id": string,"target_user_id": string }; Returns: boolean
                           },
"update_leaderboard_entry":
{ Args: { "p_group_id"?: string,"p_period_end"?: string,"p_period_start"?: string,"p_user_id": string }; Returns: undefined
                           },
"uuid_generate_v1":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v1mc":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v3":
{ Args: { "name": string,"namespace": string }; Returns: string
                           },
"uuid_generate_v4":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v5":
{ Args: { "name": string,"namespace": string }; Returns: string
                           },
"uuid_nil":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_dns":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_oid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_url":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_x500":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            "activation_request_status": "pending"|"in_progress"|"completed"|"rejected","announcement_scope": "global"|"group","announcement_type": "info"|"warning"|"success"|"error","asset_type": "image"|"video"|"document"|"other","feature_request_status": "under_review"|"planned"|"in_progress"|"released"|"declined"|"duplicate","feature_request_type": "feature_request"|"bug_report"|"improvement","group_role": "admin"|"moderator"|"member","notification_type": "new_comment"|"new_reaction"|"new_message"|"new_follower"|"mention"|"group_invite"|"group_join"|"event_reminder"|"comment_reply","point_action_type": "post_created"|"comment_created"|"reaction_given"|"reaction_received"|"event_attended"|"daily_login"|"profile_completed"|"manual_adjustment"|"showcase_approved","reactable_type": "post"|"comment"|"showcase"|"feature_request","reaction_type": "like"|"love"|"fire"|"clap"|"think"|"haha","rsvp_status": "going"|"maybe"|"not_going","showcase_category": "web_app"|"mobile_app"|"saas"|"tool"|"api"|"website"|"game"|"extension"|"other","showcase_status": "pending"|"approved"|"rejected"|"featured","user_role": "user"|"moderator"|"admin"|"superadmin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "activation_request_status": ["pending", "in_progress", "completed", "rejected"],"announcement_scope": ["global", "group"],"announcement_type": ["info", "warning", "success", "error"],"asset_type": ["image", "video", "document", "other"],"feature_request_status": ["under_review", "planned", "in_progress", "released", "declined", "duplicate"],"feature_request_type": ["feature_request", "bug_report", "improvement"],"group_role": ["admin", "moderator", "member"],"notification_type": ["new_comment", "new_reaction", "new_message", "new_follower", "mention", "group_invite", "group_join", "event_reminder", "comment_reply"],"point_action_type": ["post_created", "comment_created", "reaction_given", "reaction_received", "event_attended", "daily_login", "profile_completed", "manual_adjustment", "showcase_approved"],"reactable_type": ["post", "comment", "showcase", "feature_request"],"reaction_type": ["like", "love", "fire", "clap", "think", "haha"],"rsvp_status": ["going", "maybe", "not_going"],"showcase_category": ["web_app", "mobile_app", "saas", "tool", "api", "website", "game", "extension", "other"],"showcase_status": ["pending", "approved", "rejected", "featured"],"user_role": ["user", "moderator", "admin", "superadmin"]
          }
        }
} as const

// Application-facing aliases layered on top of the generated schema types.
export type Profile = Tables<'profiles'>
export type Group = Tables<'groups'>
export type GroupMember = Tables<'group_members'>
export type Post = Tables<'posts'>
export type Comment = Tables<'comments'>
export type Follow = Tables<'follows'>
export type Reaction = Tables<'reactions'>
export type Message = Tables<'messages'>
export type Notification = Tables<'notifications'>
export type Asset = Tables<'assets'>
export type Recording = Tables<'recordings'>
export type Module = Tables<'modules'>
export type LessonCompletion = Tables<'lesson_completions'>
export type Event = Tables<'events'>
export type EventAttendee = Tables<'event_attendees'>
export type LeaderboardEntry = Tables<'leaderboard_entries'>
export type PointActivity = Tables<'point_activities'>
export type Category = Tables<'categories'>
export type Showcase = Tables<'showcases'>
export type ShowcaseImage = Tables<'showcase_images'>
export type ShowcaseTag = Tables<'showcase_tags'>
export type ShowcaseTagRelation = Tables<'showcase_tag_relations'>
export type ShowcaseReview = Tables<'showcase_reviews'>
export type FeatureRequest = Tables<'feature_requests'>
export type FeatureRequestComment = Tables<'feature_request_comments'>
export type ActivationProduct = Tables<'activation_products'>
export type ActivationRequest = Tables<'activation_requests'>
export type ActivationUsage = Tables<'activation_usage'>

export type ProfileInsert = TablesInsert<'profiles'>
export type GroupInsert = TablesInsert<'groups'>
export type GroupMemberInsert = TablesInsert<'group_members'>
export type PostInsert = TablesInsert<'posts'>
export type CommentInsert = TablesInsert<'comments'>
export type FollowInsert = TablesInsert<'follows'>
export type ReactionInsert = TablesInsert<'reactions'>
export type MessageInsert = TablesInsert<'messages'>
export type NotificationInsert = TablesInsert<'notifications'>
export type AssetInsert = TablesInsert<'assets'>
export type RecordingInsert = TablesInsert<'recordings'>
export type ModuleInsert = TablesInsert<'modules'>
export type LessonCompletionInsert = TablesInsert<'lesson_completions'>
export type EventInsert = TablesInsert<'events'>
export type EventAttendeeInsert = TablesInsert<'event_attendees'>
export type LeaderboardEntryInsert = TablesInsert<'leaderboard_entries'>
export type PointActivityInsert = TablesInsert<'point_activities'>
export type CategoryInsert = TablesInsert<'categories'>
export type ShowcaseInsert = TablesInsert<'showcases'>
export type ShowcaseImageInsert = TablesInsert<'showcase_images'>
export type ShowcaseTagInsert = TablesInsert<'showcase_tags'>
export type ShowcaseTagRelationInsert = TablesInsert<'showcase_tag_relations'>
export type ShowcaseReviewInsert = TablesInsert<'showcase_reviews'>
export type FeatureRequestInsert = TablesInsert<'feature_requests'>
export type FeatureRequestCommentInsert = TablesInsert<'feature_request_comments'>
export type ActivationProductInsert = TablesInsert<'activation_products'>
export type ActivationRequestInsert = TablesInsert<'activation_requests'>
export type ActivationUsageInsert = TablesInsert<'activation_usage'>

export type ProfileUpdate = TablesUpdate<'profiles'>
export type GroupUpdate = TablesUpdate<'groups'>
export type GroupMemberUpdate = TablesUpdate<'group_members'>
export type PostUpdate = TablesUpdate<'posts'>
export type CommentUpdate = TablesUpdate<'comments'>
export type FollowUpdate = TablesUpdate<'follows'>
export type ReactionUpdate = TablesUpdate<'reactions'>
export type MessageUpdate = TablesUpdate<'messages'>
export type NotificationUpdate = TablesUpdate<'notifications'>
export type AssetUpdate = TablesUpdate<'assets'>
export type RecordingUpdate = TablesUpdate<'recordings'>
export type ModuleUpdate = TablesUpdate<'modules'>
export type EventUpdate = TablesUpdate<'events'>
export type EventAttendeeUpdate = TablesUpdate<'event_attendees'>
export type LeaderboardEntryUpdate = TablesUpdate<'leaderboard_entries'>
export type PointActivityUpdate = TablesUpdate<'point_activities'>
export type CategoryUpdate = TablesUpdate<'categories'>
export type ShowcaseUpdate = TablesUpdate<'showcases'>
export type ShowcaseImageUpdate = TablesUpdate<'showcase_images'>
export type ShowcaseTagUpdate = TablesUpdate<'showcase_tags'>
export type ShowcaseTagRelationUpdate = TablesUpdate<'showcase_tag_relations'>
export type ShowcaseReviewUpdate = TablesUpdate<'showcase_reviews'>
export type FeatureRequestUpdate = TablesUpdate<'feature_requests'>
export type FeatureRequestCommentUpdate = TablesUpdate<'feature_request_comments'>
export type ActivationProductUpdate = TablesUpdate<'activation_products'>
export type ActivationRequestUpdate = TablesUpdate<'activation_requests'>
export type ActivationUsageUpdate = TablesUpdate<'activation_usage'>

export type UserRole = Enums<'user_role'>
export type GroupRole = Enums<'group_role'>
export type ReactionType = Enums<'reaction_type'>
export type RSVPStatus = Enums<'rsvp_status'>
export type PointActionType = Enums<'point_action_type'>
export type AssetType = Enums<'asset_type'>
export type NotificationType = Enums<'notification_type'>
export type ReactableType = Enums<'reactable_type'>
export type ShowcaseStatus = Enums<'showcase_status'>
export type ShowcaseCategory = Enums<'showcase_category'>
export type ActivationRequestStatus = Enums<'activation_request_status'>
export type FeatureRequestStatus = Enums<'feature_request_status'>
export type FeatureRequestType = Enums<'feature_request_type'>
export type MembershipType = 'free' | 'premium'
