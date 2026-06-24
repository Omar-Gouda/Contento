export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      companies: Table<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        owner_user_id: string | null;
        status: Database["public"]["Enums"]["company_status"];
        created_at: string;
        updated_at: string;
      }>;
      users: Table<{
        id: string;
        company_id: string;
        email: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
        role_id: string | null;
        status: Database["public"]["Enums"]["user_status"];
        must_change_password: boolean;
        created_at: string;
        updated_at: string;
      }>;
      roles: Table<{
        id: string;
        company_id: string;
        name: string;
        description: string;
      }>;
      permissions: Table<{
        id: string;
        key: string;
        name: string;
        description: string;
      }>;
      role_permissions: Table<{
        role_id: string;
        permission_id: string;
        access_level: Database["public"]["Enums"]["permission_access_level"];
      }>;
      teams: Table<{
        id: string;
        company_id: string;
        name: string;
        description: string;
        status: Database["public"]["Enums"]["team_status"];
        team_lead_id: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      team_members: Table<{
        team_id: string;
        user_id: string;
      }>;
      tasks: Table<{
        id: string;
        company_id: string;
        title: string;
        description: string;
        assigned_to: string | null;
        assigned_by: string | null;
        created_by: string | null;
        status: Database["public"]["Enums"]["task_status"];
        priority: Database["public"]["Enums"]["task_priority"];
        team_id: string | null;
        due_date: string | null;
        created_at: string;
        updated_at: string;
      }>;
      task_comments: Table<{
        id: string;
        company_id: string;
        task_id: string;
        user_id: string | null;
        body: string;
        created_at: string;
      }>;
      ideas: Table<{
        id: string;
        company_id: string;
        title: string;
        description: string;
        created_by: string | null;
        assigned_to: string | null;
        team_id: string | null;
        status: Database["public"]["Enums"]["idea_status"];
        notes: string;
        created_at: string;
        updated_at: string;
      }>;
      content_items: Table<{
        id: string;
        company_id: string;
        title: string;
        description: string;
        creator_id: string | null;
        task_id: string | null;
        idea_id: string | null;
        team_id: string | null;
        status: Database["public"]["Enums"]["content_status"];
        submitted_at: string | null;
        approved_at: string | null;
        scheduled_at: string | null;
        published_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      content_reviews: Table<{
        id: string;
        company_id: string;
        content_id: string;
        reviewer_id: string | null;
        decision: Database["public"]["Enums"]["review_decision"];
        feedback: string;
        reviewed_at: string;
      }>;
      content_ratings: Table<{
        id: string;
        company_id: string;
        content_id: string;
        reviewer_id: string | null;
        rating_value: number;
        comment: string;
        created_at: string;
      }>;
      reports: Table<{
        id: string;
        company_id: string;
        user_id: string | null;
        team_id: string | null;
        report_type: Database["public"]["Enums"]["report_type"];
        title: string;
        content: Json;
        date_range_start: string | null;
        date_range_end: string | null;
        created_at: string;
        updated_at: string;
      }>;
      calendar_events: Table<{
        id: string;
        company_id: string;
        title: string;
        description: string;
        event_type: Database["public"]["Enums"]["calendar_event_type"];
        content_id: string | null;
        user_id: string | null;
        team_id: string | null;
        start_date: string;
        end_date: string;
        created_by: string | null;
        updated_at: string;
      }>;
      day_off_requests: Table<{
        id: string;
        company_id: string;
        user_id: string;
        start_date: string;
        end_date: string;
        reason: string;
        status: Database["public"]["Enums"]["day_off_status"];
      }>;
      notifications: Table<{
        id: string;
        company_id: string;
        user_id: string;
        title: string;
        message: string;
        read: boolean;
        created_at: string;
      }>;
      activity_logs: Table<{
        id: string;
        company_id: string;
        user_id: string | null;
        action: string;
        entity_type: string;
        entity_id: string | null;
        metadata: Json;
        created_at: string;
      }>;
      company_settings: Table<{
        id: string;
        company_id: string;
        settings_json: Json;
        updated_at: string;
      }>;
      user_invitations: Table<{
        id: string;
        company_id: string;
        email: string;
        role_id: string;
        team_id: string | null;
        token_hash: string;
        status: Database["public"]["Enums"]["user_invitation_status"];
        message: string;
        invited_by: string | null;
        expires_at: string;
        accepted_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      work_days: Table<{
        id: string;
        company_id: string;
        user_id: string;
        work_date: string;
        first_sign_in_at: string | null;
        last_sign_out_at: string | null;
        total_worked_minutes: number;
        total_break_minutes: number;
        total_missing_minutes: number;
        status: Database["public"]["Enums"]["work_day_status"];
        created_at: string;
        updated_at: string;
      }>;
      work_sessions: Table<{
        id: string;
        company_id: string;
        user_id: string;
        work_day_id: string;
        sign_in_at: string;
        sign_out_at: string | null;
        duration_minutes: number;
        created_at: string;
      }>;
      break_sessions: Table<{
        id: string;
        company_id: string;
        user_id: string;
        work_day_id: string;
        started_at: string;
        ended_at: string | null;
        duration_minutes: number;
        created_at: string;
      }>;
      superior_admins: Table<{
        id: string;
        email: string;
        status: Database["public"]["Enums"]["superior_admin_status"];
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_company_with_admin_profile: {
        Args: {
          company_name: string;
          company_slug: string;
          first_name: string;
          last_name: string;
        };
        Returns: string;
      };
      clear_current_user_must_change_password: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      contento_cairo_work_date: {
        Args: {
          input_timestamp: string;
        };
        Returns: string;
      };
      accept_pending_invitation_for_current_user: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      record_work_sign_in: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      record_work_sign_out: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      current_role_name: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      can_access_user_scope: {
        Args: {
          target_user_id: string;
          target_company_id: string;
        };
        Returns: boolean;
      };
      can_access_content_scope: {
        Args: {
          target_company_id: string;
          target_team_id: string | null;
          target_creator_id: string | null;
          target_status: string;
        };
        Returns: boolean;
      };
      can_review_content_scope: {
        Args: {
          target_content_id: string;
        };
        Returns: boolean;
      };
      can_rate_content_scope: {
        Args: {
          target_content_id: string;
        };
        Returns: boolean;
      };
      start_break_session: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      end_break_session: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      create_organization_with_admin_profile: {
        Args: {
          company_name: string;
          company_slug: string;
          admin_user_id: string;
          admin_email: string;
          admin_first_name: string;
          admin_last_name: string;
        };
        Returns: string;
      };
    };
    Enums: {
      company_status: "active" | "suspended" | "archived";
      user_status: "invited" | "active" | "suspended" | "disabled";
      superior_admin_status: "active" | "suspended";
      team_status: "active" | "archived";
      user_invitation_status: "pending" | "accepted" | "expired" | "cancelled";
      work_day_status: "active" | "completed" | "missing_time" | "absent" | "incomplete";
      permission_access_level: "view" | "limited" | "full";
      task_priority: "low" | "normal" | "high" | "urgent";
      task_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "under_review"
        | "completed"
        | "closed";
      idea_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "archived";
      content_status:
        | "draft"
        | "in_review"
        | "changes_requested"
        | "resubmitted"
        | "submitted_to_team_lead"
        | "changes_requested_by_team_lead"
        | "sent_to_supervisor"
        | "changes_requested_by_supervisor"
        | "approved"
        | "rejected"
        | "scheduled"
        | "published"
        | "archived";
      review_decision: "approved" | "rejected" | "changes_requested" | "commented";
      report_type: "daily" | "weekly" | "creator" | "team" | "company";
      day_off_status: "pending" | "approved" | "rejected" | "cancelled";
      calendar_event_type: "content" | "work_hours" | "day_off" | "general";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
