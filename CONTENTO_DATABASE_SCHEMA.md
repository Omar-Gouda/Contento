# Contento Database Schema

This document describes the planned database architecture for Contento. It is documentation only. It does not create migrations, tables, policies, or Supabase resources.

## 1. Database Overview

Contento is a multi-tenant SaaS platform. Each company owns an isolated workspace containing its users, roles, teams, tasks, ideas, content, reviews, reports, calendar events, day off requests, notifications, activity logs, and settings.

The database should be designed around a tenant root table, `companies`, and company-scoped tables that include `company_id`. Application requests must resolve the current authenticated user's company from the server-side user profile and use that company context for every read and write.

Company data isolation is required because different companies may use Contento at the same time while storing private operational data. A user from one company must never be able to see, infer, modify, export, or report on another company's users, content, schedules, analytics, approvals, or logs.

Recommended architecture principles:

* Use Supabase Auth for authentication.
* Store application profile and role data in the `users` table.
* Store company-specific roles in `roles`.
* Store global permission definitions in `permissions`.
* Connect roles to permissions through `role_permissions`.
* Include `company_id` on every table that directly stores tenant-owned business data.
* Use Supabase Row Level Security later to enforce company isolation at the database layer.

## 2. Core Tables

### `companies`

Tenant root table. Each row represents one isolated company workspace.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the company. |
| `name` | Display name of the company. |
| `slug` | URL-safe workspace identifier. Must be unique. |
| `logo_url` | Optional company logo asset URL. |
| `status` | Company state. Current lifecycle values are active, disabled, and deleted. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `users`

Application user profile table. This should connect to Supabase Auth while keeping Contento-specific company, profile, role, and status data.

| Field | Purpose |
| --- | --- |
| `id` | User identifier. Recommended to match the Supabase Auth user id. |
| `company_id` | Company the user belongs to. |
| `email` | User email address. |
| `first_name` | User first name. |
| `last_name` | User last name. |
| `avatar_url` | Optional profile image URL. |
| `role_id` | Current role assigned to the user. |
| `status` | User state, such as invited, active, suspended, or disabled. |
| `must_change_password` | Forces Admin-created users to change their temporary password before dashboard access. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `roles`

Company-scoped role definitions. Default roles should include Admin, Supervisor, CC Team Lead, and Creator.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the role. |
| `company_id` | Company that owns the role. |
| `name` | Role name. |
| `description` | Role description and intended use. |

### `permissions`

Global permission catalog. These keys define product capabilities and can be assigned to company roles.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the permission. |
| `key` | Stable permission key, such as `users.invite`. |
| `name` | Human-readable permission name. |
| `description` | Explanation of what the permission allows. |

### `role_permissions`

Join table connecting roles to permissions.

| Field | Purpose |
| --- | --- |
| `role_id` | Role receiving the permission. |
| `permission_id` | Permission assigned to the role. |

### `teams`

Company-scoped team table for organizing users under supervisors and team leads.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the team. |
| `company_id` | Company that owns the team. |
| `name` | Team name. |
| `description` | Optional team description. |
| `status` | Team lifecycle state: active or archived. |
| `team_lead_id` | Optional user assigned as team lead. |
| `created_by` | Optional user who created the team. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `team_members`

Join table connecting users to teams.

| Field | Purpose |
| --- | --- |
| `team_id` | Team membership belongs to. |
| `user_id` | User assigned to the team. |

### `tasks`

Company-scoped task assignment table for creator and team workflow.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the task. |
| `company_id` | Company that owns the task. |
| `title` | Task title. |
| `description` | Task details. |
| `assigned_to` | User assigned to complete the task. |
| `assigned_by` | User who most recently assigned or reassigned the task. |
| `created_by` | User who created the task. |
| `status` | Current task workflow status. |
| `priority` | Priority: low, normal, high, or urgent. |
| `team_id` | Optional team associated with the task. |
| `due_date` | Expected completion date. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `task_comments`

Company-scoped task comments used for progress notes, review context, and task activity discussion.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the task comment. |
| `company_id` | Company that owns the comment. |
| `task_id` | Task being discussed. |
| `user_id` | User who created the comment. |
| `body` | Comment body. |
| `created_at` | Creation timestamp. |

### `ideas`

Company-scoped idea table for creator content concepts.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the idea. |
| `company_id` | Company that owns the idea. |
| `title` | Idea title. |
| `description` | Idea details. |
| `created_by` | User who created the idea. |
| `assigned_to` | Optional user assigned to develop or review the idea. |
| `team_id` | Optional team associated with the idea. |
| `status` | Current idea status. |
| `notes` | Operational notes for the idea. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `content_items`

Company-scoped content records that move through submission, review, approval, scheduling, publishing, and archival.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the content item. |
| `company_id` | Company that owns the content item. |
| `title` | Content title. |
| `description` | Content details. |
| `creator_id` | Creator responsible for the content. |
| `task_id` | Optional task linked to the content item. |
| `idea_id` | Optional idea linked to the content item. |
| `team_id` | Optional team associated with the content item. |
| `status` | Current content workflow status. |
| `submitted_at` | Timestamp when submitted for review. |
| `approved_at` | Timestamp when approved. |
| `scheduled_at` | Timestamp when scheduled for publishing. |
| `published_at` | Timestamp when published. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `content_reviews`

Company-scoped review records for approval decisions and feedback.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the review. |
| `company_id` | Company that owns the review. |
| `content_id` | Content item being reviewed. |
| `reviewer_id` | User who reviewed the content. |
| `decision` | Review result, such as approved, rejected, or changes requested. |
| `feedback` | Reviewer feedback. |
| `quality_score` | Optional quality score from 1 to 5. |
| `creativity_score` | Optional creativity score from 1 to 5. |
| `accuracy_score` | Optional accuracy score from 1 to 5. |
| `overall_rating` | Optional overall rating from 1 to 5. |
| `score_comment` | Optional scoring comment. |
| `reviewed_at` | Review timestamp. |

### `content_ratings`

Company-scoped rating records attached to submitted content reviews.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the rating. |
| `company_id` | Company that owns the rating. |
| `content_id` | Content item being rated. |
| `reviewer_id` | User who rated the content. |
| `rating_value` | Integer rating from 1 to 5. |
| `comment` | Optional rating comment. |
| `created_at` | Creation timestamp. |

### `reports`

Company-scoped report table for daily, weekly, creator, team, and company reports.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the report. |
| `company_id` | Company that owns the report. |
| `user_id` | User associated with the report. |
| `team_id` | Optional team associated with the report. |
| `report_type` | Report category. |
| `title` | Report title used by lists, details, and exports. |
| `content` | Report body or structured report payload. |
| `date_range_start` | Optional report coverage start date. |
| `date_range_end` | Optional report coverage end date. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `calendar_events`

Company-scoped scheduling table for content calendar and work calendar items.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the event. |
| `company_id` | Company that owns the event. |
| `title` | Event title. |
| `description` | Event details. |
| `event_type` | Content, work-hours, day-off, or general event category. |
| `content_id` | Optional linked content item. |
| `user_id` | Optional linked user. |
| `team_id` | Optional linked team. |
| `start_date` | Event start date or datetime. |
| `end_date` | Event end date or datetime. |
| `created_by` | User who created the event. |
| `updated_at` | Last update timestamp. |

### `day_off_requests`

Company-scoped day off request table for schedule availability.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the request. |
| `company_id` | Company that owns the request. |
| `user_id` | User requesting time off. |
| `start_date` | First requested day off. |
| `end_date` | Last requested day off. |
| `reason` | Optional request reason. |
| `status` | Current request status. |

### `notifications`

Company-scoped notification table for assignment, review, approval, rejection, and feedback alerts.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the notification. |
| `company_id` | Company that owns the notification. |
| `user_id` | User receiving the notification. |
| `title` | Notification title. |
| `message` | Notification message. |
| `entity_type` | Optional entity type linked by the notification. |
| `entity_id` | Optional entity id linked by the notification. |
| `link_href` | Optional app route for navigation. |
| `read` | Read state. |
| `read_at` | Timestamp when read. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `attachments`

Company-scoped file metadata for files attached to tasks, ideas, content, and reports. File bytes live in Supabase Storage.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the attachment. |
| `company_id` | Company that owns the attachment. |
| `entity_type` | Attached entity type, such as task, idea, content, or report. |
| `entity_id` | Identifier of the attached entity. |
| `uploaded_by` | User who uploaded the file. |
| `file_name` | Original display file name. |
| `file_path` | Private Supabase Storage path. |
| `file_type` | MIME type when available. |
| `file_size` | File size in bytes. |
| `created_at` | Creation timestamp. |

### `comments`

Generic company-scoped comments for tasks, ideas, content, and reports.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the comment. |
| `company_id` | Company that owns the comment. |
| `entity_type` | Commented entity type. |
| `entity_id` | Commented entity id. |
| `author_id` | User who wrote the comment. |
| `body` | Comment body. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |
| `deleted_at` | Soft-delete timestamp. |

### `mentions`

Company-scoped mention records created from comments.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the mention. |
| `company_id` | Company that owns the mention. |
| `comment_id` | Comment containing the mention. |
| `mentioned_user_id` | User mentioned in the comment. |
| `created_at` | Creation timestamp. |

### `saved_views`

Private saved filter views for operational pages.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the saved view. |
| `company_id` | Company that owns the saved view. |
| `user_id` | User who owns the saved view. |
| `name` | Saved view name. |
| `module` | Module key, such as tasks, ideas, content, or reports. |
| `filters_json` | Stored filter payload. |
| `is_default` | Whether this is the user's default view for the module. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `content_templates`

Company-scoped templates used when creating content items.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the template. |
| `company_id` | Company that owns the template. |
| `title` | Template title. |
| `description` | Optional template description. |
| `body` | Reusable content body. |
| `category` | Optional template category. |
| `status` | Template status, active or archived. |
| `created_by` | User who created the template. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `dashboard_preferences`

Private user dashboard widget preferences.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the preference row. |
| `company_id` | Company that owns the preference. |
| `user_id` | User who owns the preference. |
| `role` | Role dashboard the preferences apply to. |
| `widgets_json` | Widget visibility and ordering payload. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `activity_logs`

Company-scoped audit trail for important user and system actions.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the activity log. |
| `company_id` | Company that owns the log. |
| `user_id` | User who performed the action. |
| `action` | Action key, such as `content.approved`. |
| `entity_type` | Entity affected by the action. |
| `entity_id` | Identifier of the affected entity. |
| `metadata` | Structured contextual metadata. |
| `created_at` | Creation timestamp. |

### `company_settings`

Company-scoped settings table for workspace configuration.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the settings row. |
| `company_id` | Company that owns the settings. |
| `settings_json` | Structured settings payload. |
| `updated_at` | Last update timestamp. |

### `user_invitations`

Company-scoped invitation records retained from the Phase 3 invitation foundation. The active UI now uses direct Admin user creation instead of invitations.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the invitation. |
| `company_id` | Company that owns the invitation. |
| `email` | Invited user email. |
| `role_id` | Company role assigned when accepted. |
| `team_id` | Optional team assignment when accepted. |
| `token_hash` | Hash of the invitation token; raw tokens are not stored. |
| `status` | Pending, accepted, expired, or cancelled. |
| `message` | Optional message from the inviter. |
| `invited_by` | Admin user who created the invitation. |
| `expires_at` | Invitation expiration timestamp. |
| `accepted_at` | Timestamp when accepted. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `work_days`

Company-scoped daily working-hours summary per user.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the work day. |
| `company_id` | Company that owns the work day. |
| `user_id` | User whose day is tracked. |
| `work_date` | Calendar date being tracked, derived from `Africa/Cairo`. |
| `first_sign_in_at` | First sign-in timestamp for the day. |
| `last_sign_out_at` | Last sign-out timestamp for the day. |
| `total_worked_minutes` | Total worked minutes, net of recorded break minutes. |
| `total_break_minutes` | Total break minutes. |
| `total_missing_minutes` | Missing time, based on break usage over allowance and the default expected work target after sign-out. |
| `status` | Active, completed, missing_time, absent, or incomplete. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `work_sessions`

Individual sign-in/sign-out sessions for a work day.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the work session. |
| `company_id` | Company that owns the session. |
| `user_id` | User who signed in. |
| `work_day_id` | Work day summary row. |
| `sign_in_at` | Session start timestamp. |
| `sign_out_at` | Session end timestamp. |
| `duration_minutes` | Closed session duration in minutes. |
| `created_at` | Creation timestamp. |

### `break_sessions`

Break sessions linked to a work day.

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier for the break session. |
| `company_id` | Company that owns the break session. |
| `user_id` | User taking the break. |
| `work_day_id` | Work day summary row. |
| `started_at` | Break start timestamp. |
| `ended_at` | Break end timestamp. |
| `duration_minutes` | Closed break duration in minutes. |
| `created_at` | Creation timestamp. |

Working-hours calculation rules:

* Timestamps are stored as `timestamptz`.
* `work_date` is the Cairo local date for the event timestamp.
* Only one active work session and one active break are allowed for a user/work day.
* Closed `work_sessions.duration_minutes` and `break_sessions.duration_minutes` are persisted for review.
* Daily break allowance is 90 minutes.
* Missing time uses the greater of break overage and missing minutes against the current 480-minute default work target.

### `superior_admins`

Platform-level superior admin accounts. These users are not company members and are only used to create organizations and the first Org Admin account.

| Field | Purpose |
| --- | --- |
| `id` | Supabase Auth user id. |
| `email` | Superior admin email. |
| `status` | Active or suspended. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `platform_admins`

Current platform-level admin table used by the final production phase. Platform admins are not company users and are resolved before tenant profile resolution.

| Field | Purpose |
| --- | --- |
| `id` | Primary platform admin identifier. |
| `auth_user_id` | Supabase Auth user id. |
| `email` | Platform admin email. |
| `status` | Active or suspended. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `platform_activity_logs`

Platform-level audit logs for organization lifecycle actions.

| Field | Purpose |
| --- | --- |
| `id` | Primary log identifier. |
| `platform_admin_id` | Platform admin who performed the action. |
| `action` | Platform action key. |
| `entity_type` | Entity type, usually company. |
| `entity_id` | Affected entity id. |
| `metadata` | Structured before/after context. |
| `created_at` | Creation timestamp. |

## 3. Relationships

Relationship count: 33 documented direct relationships, plus additional Phase 4 workflow links listed in the migration notes.

```txt
companies
├─ users
│  ├─ role_id -> roles.id
│  ├─ assigned tasks via tasks.assigned_to
│  ├─ created tasks via tasks.created_by
│  ├─ created ideas via ideas.created_by
│  ├─ created content via content_items.creator_id
│  ├─ review decisions via content_reviews.reviewer_id
│  ├─ reports via reports.user_id
│  ├─ calendar events via calendar_events.created_by
│  ├─ day off requests via day_off_requests.user_id
│  ├─ notifications via notifications.user_id
│  └─ activity logs via activity_logs.user_id
├─ roles
│  └─ role_permissions
│     └─ permissions
├─ teams
│  └─ team_members
│     └─ users
├─ tasks
│  └─ content_items
├─ ideas
├─ content_items
│  ├─ content_reviews
│  └─ content_ratings
├─ reports
├─ calendar_events
├─ day_off_requests
├─ notifications
├─ activity_logs
└─ company_settings
```

Direct relationship list:

| # | Relationship |
| --- | --- |
| 1 | `companies.id` -> `users.company_id` |
| 2 | `companies.id` -> `roles.company_id` |
| 3 | `companies.id` -> `teams.company_id` |
| 4 | `companies.id` -> `tasks.company_id` |
| 5 | `companies.id` -> `ideas.company_id` |
| 6 | `companies.id` -> `content_items.company_id` |
| 7 | `companies.id` -> `content_reviews.company_id` |
| 8 | `companies.id` -> `content_ratings.company_id` |
| 9 | `companies.id` -> `reports.company_id` |
| 10 | `companies.id` -> `calendar_events.company_id` |
| 11 | `companies.id` -> `day_off_requests.company_id` |
| 12 | `companies.id` -> `notifications.company_id` |
| 13 | `companies.id` -> `activity_logs.company_id` |
| 14 | `companies.id` -> `company_settings.company_id` |
| 15 | `roles.id` -> `users.role_id` |
| 16 | `roles.id` -> `role_permissions.role_id` |
| 17 | `permissions.id` -> `role_permissions.permission_id` |
| 18 | `teams.id` -> `team_members.team_id` |
| 19 | `users.id` -> `team_members.user_id` |
| 20 | `users.id` -> `tasks.assigned_to` |
| 21 | `users.id` -> `tasks.created_by` |
| 22 | `users.id` -> `ideas.created_by` |
| 23 | `users.id` -> `content_items.creator_id` |
| 24 | `tasks.id` -> `content_items.task_id` |
| 25 | `content_items.id` -> `content_reviews.content_id` |
| 26 | `content_items.id` -> `content_ratings.content_id` |
| 27 | `users.id` -> `content_reviews.reviewer_id` |
| 28 | `users.id` -> `content_ratings.reviewer_id` |
| 29 | `users.id` -> `reports.user_id` |
| 30 | `users.id` -> `calendar_events.created_by` |
| 31 | `users.id` -> `day_off_requests.user_id` |
| 32 | `users.id` -> `notifications.user_id` |
| 33 | `users.id` -> `activity_logs.user_id` |

`activity_logs.entity_type` and `activity_logs.entity_id` are polymorphic references for audit context. They should be validated in application logic and background services, but they should not be treated as a strict foreign key relationship in the first schema version.

## 4. Multi-Tenant Rules

### Tables that must contain `company_id`

These tables directly store tenant-owned data and must include `company_id`:

* `users`
* `roles`
* `teams`
* `user_invitations`
* `work_days`
* `work_sessions`
* `break_sessions`
* `task_comments`
* `tasks`
* `ideas`
* `content_items`
* `content_reviews`
* `content_ratings`
* `reports`
* `calendar_events`
* `day_off_requests`
* `notifications`
* `attachments`
* `comments`
* `mentions`
* `saved_views`
* `content_templates`
* `dashboard_preferences`
* `activity_logs`
* `company_settings`

### Tables without `company_id`

* `companies` is the tenant root and does not need `company_id`.
* `permissions` is a global product catalog and should not be company-scoped.
* `role_permissions` inherits company scope through `role_id`.
* `team_members` inherits company scope through both `team_id` and `user_id`.
* `task_comments` includes `company_id` directly and also inherits task scope through `task_id`.
* `superior_admins` and `platform_admins` are platform-scoped and should not include `company_id`.
* `platform_activity_logs` is platform-scoped and references platform admin actions.

### Data isolation rules

* Every authenticated user belongs to exactly one company in the initial SaaS model.
* All company-scoped reads must filter by the user's resolved `company_id`.
* All company-scoped writes must set `company_id` from the authenticated user's server-side profile, not from client input.
* Join tables must only connect records from the same company.
* Admin access is full access inside the admin's company only.
* Supervisor and CC Team Lead access should be scoped to assigned teams where possible.
* Creator access should be scoped to the creator's own tasks, ideas, content, reports, requests, notifications, and performance data.
* Cross-company analytics, exports, and logs must be unavailable to company users.
* Service-role access should be reserved for trusted server-side jobs and never exposed to the browser.

## 5. Status Workflows

### Content Status Flow

```txt
Draft
Submitted To Team Lead
Changes Requested By Team Lead
Sent To Supervisor
Changes Requested By Supervisor
Approved
Rejected
Scheduled
Published
Archived
```

Recommended transition behavior:

* Creator creates content as `Draft`.
* Creator submits content into `Submitted To Team Lead`.
* CC Team Lead reviews own-team submissions and moves content to `Changes Requested By Team Lead` or `Sent To Supervisor`.
* Supervisor reviews `Sent To Supervisor` content and moves it to `Approved`, `Rejected`, or `Changes Requested By Supervisor`.
* Creator can resubmit requested changes back to `Submitted To Team Lead`.
* Approved content may move to `Scheduled`, then `Published`.
* Completed or retired records move to `Archived`.

### Task Status Flow

```txt
Pending
Assigned
In Progress
Under Review
Completed
Closed
```

Recommended transition behavior:

* Admin, Supervisor, or CC Team Lead creates a task as `Pending`.
* Assignment moves the task to `Assigned`.
* Creator work moves the task to `In Progress`.
* Submission moves the task to `Under Review`.
* Accepted work moves the task to `Completed`.
* Final administrative closure moves the task to `Closed`.

### Day Off Request Flow

```txt
Pending
Approved
Rejected
Cancelled
```

Recommended transition behavior:

* Creator or team member submits a request as `Pending`.
* Supervisor or Admin moves the request to `Approved` or `Rejected`.
* Request owner can cancel an open request by moving it to `Cancelled`.

## 6. RLS Strategy

Supabase Row Level Security should be added when the authentication and company model are implemented. No SQL is included in this document.

Recommended RLS approach:

* Enable RLS on every company-scoped table.
* Resolve the current user's app profile from `users.id` using the Supabase Auth user id.
* Allow access to company-scoped rows only when the row's `company_id` matches the authenticated user's `company_id`.
* Add stricter role and ownership checks on top of company checks.
* Use role permissions for actions such as managing users, approving content, exporting reports, and managing settings.
* For `users`, allow users to read their own profile, and allow Admins to manage users in the same company.
* For `roles` and `role_permissions`, allow Admins to manage company roles, while other roles may only read limited role information if needed.
* For `permissions`, allow authenticated users to read the global permission catalog, but restrict writes to trusted system administration only.
* For `team_members`, ensure the team and user both belong to the authenticated user's company.
* For `tasks`, allow Admins broad company access, Supervisors and CC Team Leads team-scoped access, and Creators own-assigned access.
* For `task_comments`, allow users who can access the related task to read and create comments.
* For `ideas`, `content_items`, `reports`, and `day_off_requests`, allow Creators to manage their own records while allowing reviewers and managers scoped access based on role.
* For `content_reviews`, allow only permitted reviewers to create review decisions in the same company.
* For `content_ratings`, allow only Admins, scoped Team Leads, or scoped Supervisors to rate submitted content; block private drafts and self-rating outside Admin override.
* For `notifications`, allow users to read and update read state for their own notifications only.
* For `activity_logs`, allow insert through trusted server actions or database triggers where possible, with read access scoped by role.
* For exports and analytics, prefer server-side functions that enforce role permissions before querying data.
* Never trust a browser-provided `company_id` for authorization decisions.
* User invitation acceptance must create the profile inside the invited company only.
* Working-hours writes should be performed through server actions or database RPCs that resolve `company_id` from the active user profile.
* Superior admins and platform admins can bootstrap and manage organization lifecycle through dedicated server actions, but should not read tenant data as company members.
* Disabled and deleted companies block company users from dashboards before tenant data is rendered.

## Schema Summary

* Tables designed: 32
* Direct relationships defined: 49 including Phase 4-10 and final production workflow additions
* Tenant root table: `companies`
* Company-scoped tables with `company_id`: 25
* Global/platform tables: `permissions`, `superior_admins`, `platform_admins`, `platform_activity_logs`
* Join tables: `role_permissions`, `team_members`

## Phase 4-10 Workflow Additions

Migration `202606230006_contento_phase_4_to_10_workflows.sql` extends the foundation with:

* Team lifecycle fields: `teams.status`, `teams.team_lead_id`, and `teams.updated_at`.
* Task workflow fields: `tasks.priority` and `tasks.team_id`.
* Task discussion table: `task_comments`.
* Idea workflow fields: `ideas.assigned_to`, `ideas.notes`, and `ideas.updated_at`.
* Content schedule fields: `content_items.scheduled_at`, `content_items.published_at`, and `content_items.updated_at`.
* Calendar context fields: `calendar_events.description`, `calendar_events.event_type`, `calendar_events.content_id`, `calendar_events.user_id`, `calendar_events.team_id`, and `calendar_events.updated_at`.
* RLS helper functions for permission rank, team membership, teammate checks, content ownership, and task scope.
* Indexes for common company/status/date/team workflow filters.

Migration `202606240001_contento_phase_4_shared_operations_completion.sql` completes the shared operations foundation with:

* Team creator metadata: `teams.created_by` and `teams.created_at`.
* Task assignment metadata: `tasks.assigned_by`.
* Team scope for ideas: `ideas.team_id`.
* Idea and team links for content: `content_items.idea_id` and `content_items.team_id`.
* Report metadata: `reports.title`, `reports.team_id`, `reports.date_range_start`, `reports.date_range_end`, and `reports.updated_at`.
* Permission aliases requested by Phase 4, including `teams.view`, `teams.manage`, `tasks.manage`, `tasks.update_own`, `ideas.view`, `ideas.manage`, `ideas.update_own`, `content.view`, `content.manage`, `content.review`, `reports.view`, `reports.create`, and `reports.export`.
* RLS helpers for same-company idea checks and scoped report visibility.
* Updated RLS checks for new team, idea, content, task assignment, and report fields.

Migration `202606240002_contento_phase_4_scope_fix_review_flow.sql` tightens Phase 4 scope boundaries with:

* Content handoff statuses: `submitted_to_team_lead`, `changes_requested_by_team_lead`, `sent_to_supervisor`, `changes_requested_by_supervisor`, and `rejected`.
* Content rating table: `content_ratings`.
* `content.rate` permission for Admin, Supervisor, and CC Team Lead review scopes.
* RLS helpers for current role, team-lead ownership, scoped user visibility, scoped task assignment, content review eligibility, and content rating eligibility.
* Updated RLS for users, teams, team members, tasks, content items, content reviews, and content ratings so CC Team Leads stay inside own-team boundaries and dashboards remain private.

Migration `202606240003_contento_phase_4_scope_policy_hardening.sql` adds explicit same-company link checks to:

* Team member write policies.
* Task create/update policies for assignees, assigners, and teams.
* Content create/update policies for creators, teams, tasks, and ideas.

Migration `202606240004_contento_final_production_saas_readiness.sql` adds final production SaaS readiness:

* Platform admin tables and policies.
* Organization lifecycle status support for active, disabled, and deleted companies.
* Notification entity links and read timestamps.
* Generic comments, mentions, and attachments with entity-scope helpers.
* Supabase Storage buckets for company-scoped attachments and avatars.
* Saved views, content templates, and dashboard preferences.
* Content review scoring fields.
* Additional permissions for notifications, attachments, comments, mentions, search, saved views, analytics, templates, and dashboard customization.
* RLS policies and indexes for the final production tables and helper functions.
