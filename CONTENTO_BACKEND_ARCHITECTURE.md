# Contento Backend Architecture

This document describes the backend architecture for Contento as of the final production SaaS readiness phase. Contento uses Supabase Auth, Supabase PostgreSQL, Row Level Security, Supabase Storage, Next.js App Router server components/actions, role permissions, platform-admin controls, and company-scoped data access.

## 1. Backend Goals

Contento needs a backend that is simple, secure, and scalable enough for a multi-company SaaS platform. The backend must support authentication, company workspaces, client workspaces, user management, invitations, working-hours tracking, role-based access, content workflows, approvals, reports, schedules, analytics, notifications, activity logs, and exports over time.

Primary backend goals:

* Keep every company workspace isolated.
* Use Supabase for authentication, PostgreSQL, and Row Level Security.
* Keep authorization clear, role-driven, and permission-aware.
* Prefer server-side data access for protected operations.
* Never trust browser-provided `company_id`.
* Make activity logging and audit trails part of important workflows.
* Keep frontend routes aligned with authenticated user role and company.

## 2. Backend Stack

| Area | Tool |
| --- | --- |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| Authorization | Role permissions plus Supabase RLS |
| Server runtime | Next.js App Router server components, server actions, and route handlers |
| Validation | Zod |
| Forms | React Hook Form |
| UI | TailwindCSS and shadcn/ui |
| Theme | `next-themes` |
| File Storage | Supabase Storage |
| Hosting | Vercel for Next.js, Supabase for backend services |

## 3. Architecture Overview

```txt
Browser
  |
  | Public pages, auth forms, dashboard UI
  v
Next.js App Router
  |
  | Server components, server actions, middleware
  v
Application Access Layer
  |
  | Session, profile, company, role, permissions, validation
  v
Supabase
  |
  | Auth, PostgreSQL, RLS
  v
Company-scoped data
```

Supabase is the system of record. Next.js coordinates session-aware access, route protection, form validation, workflow actions, and dashboard queries.

## 4. Backend Layers

### Public Layer

The `/` route redirects to `/sign-in` for the app foundation. Auth routes do not query protected company data.

Responsibilities:

* Present authentication screens.
* Send users into the authentication flow.
* Avoid service-role credentials.
* Avoid loading company-scoped records.

### Auth Layer

The auth layer validates user identity through Supabase Auth and maps that identity to a platform-admin account, legacy superior-admin account, or Contento company-user profile.

Responsibilities:

* Sign users in and out.
* Send password reset emails.
* Refresh sessions.
* Resolve platform-admin access.
* Resolve company-user profile, role, status, company, and permissions.
* Redirect users to the correct route.
* Accept pending invitations after authenticated sign-in.
* Start and close working-hours sessions around sign-in/sign-out.

### Application Access Layer

The application access layer decides whether an authenticated user can perform an action.

Responsibilities:

* Load `users` profile and `company_id` for company routes.
* Load platform-admin context for `/super-admin`.
* Load role and permission data.
* Enforce role checks before sensitive actions.
* Keep all company writes scoped to the authenticated company.
* Keep service-role work inside trusted server-only modules.

### Data Layer

The data layer reads and writes Supabase PostgreSQL records.

Responsibilities:

* Query company-scoped tables.
* Apply consistent filters.
* Use RLS as the database-level guard.
* Keep relational integrity between company-owned records.
* Add indexes for foreign keys and common tenant filters.
* Keep database access patterns predictable and auditable.

### Workflow Layer

The current implemented workflows are authentication, onboarding, invitations, user management, platform organization management, working-hours tracking, teams, client workspaces, tasks, ideas, content pipeline, approvals, reports, analytics, notifications, collaboration, templates, profile/settings, and exports.

Responsibilities:

* Validate input before writes.
* Check permissions before state changes.
* Enforce valid status transitions.
* Write activity logs for important future actions.
* Create notifications for affected users in later phases.

## 5. Multi-Tenant Model

The tenant root is `companies`. Business tables include `company_id` directly or inherit company scope through a parent table.

Implemented company-scoped tables:

* `users`
* `roles`
* `teams`
* `team_members`
* `clients`
* `client_assignments`
* `company_settings`
* `user_invitations`
* `work_days`
* `work_sessions`
* `break_sessions`
* `task_comments`
* Existing workflow tables now actively used: `tasks`, `ideas`, `content_items`, `content_reviews`, `reports`, `calendar_events`, `day_off_requests`, `notifications`, and `activity_logs`
* Final production tables: `attachments`, `comments`, `mentions`, `saved_views`, `content_templates`, and `dashboard_preferences`

Global or platform tables:

* `companies` is the tenant root.
* `permissions` is the global permission catalog.
* `role_permissions` inherits scope through `roles`.
* `superior_admins`, `platform_admins`, and `platform_activity_logs` are platform-scoped and not tenant membership.

Tenant rules:

* A normal user belongs to one company.
* Admins have full access inside their own company only.
* Supervisors and CC Team Leads are constrained to permissions and assigned teams when those modules arrive.
* Creators are constrained to their own work.
* Client workspaces stay inside the owning company and are constrained by `clients` and `client_assignments` helpers.
* Superior admins bootstrap organizations but are not company users.
* Exports, analytics, notifications, search, saved views, and collaboration records must never cross company boundaries.

## 6. Authorization Model

Contento combines role-based access control with company-scoped data rules.

Authorization inputs:

* Authenticated Supabase user id.
* Contento `users` profile, `platform_admins` record, or legacy `superior_admins` record.
* User `company_id`.
* User `role_id`.
* Role permissions from `role_permissions`.
* Record ownership or team membership where applicable.

Recommended authorization order:

1. Confirm the request has a valid Supabase session.
2. Resolve platform-admin, superior-admin, or company-user profile.
3. Confirm the account is active.
4. Resolve company scope for company routes.
5. Resolve role and permissions.
6. Check role permission.
7. Check record ownership or team membership where needed.
8. Perform the read or write.
9. Write an activity log when the action is important in future phases.

## 7. Implemented Backend Modules

### Authentication

Implemented responsibilities:

* Sign in.
* Forgot password.
* Reset password.
* Marketing Manager-issued temporary password reset through trusted server-only Supabase Admin API.
* Sign out.
* Protected routes.
* Role-based redirect.
* Session refresh through middleware.
* Active/inactive account handling.
* Organization disabled/deleted access handling.

### Company Workspaces

Implemented responsibilities:

* First-company onboarding.
* Company creation through onboarding RPC.
* Company creation by superior admin with first Org Admin profile.
* Company settings creation.
* Company owner assignment.

### Users, Roles, and Permissions

Implemented responsibilities:

* Default company roles.
* Global permissions.
* Role permissions.
* Admin user listing, filtering, status changes, role assignment, and team assignment.
* Admin invitations.
* Admin temporary password reset with `must_change_password` enforcement.
* Client assignments and client workspace ownership metadata.

### Working Hours

Implemented responsibilities:

* Daily work-day record per user.
* Work session creation on sign in.
* Work session close on sign out.
* Break start/end controls.
* 90-minute daily break allowance.
* Missing-time calculation when break allowance is exceeded.
* Current-user work-hours page.
* Admin company work-hours page.

### Teams, Tasks, Ideas, Content, Calendar, and Reports

Implemented responsibilities:

* Admin team creation, updates, archive state, lead assignment, member assignment, and team statistics.
* Client workspace creation, editing, assignments, contract lifecycle status, expiry blocking, and client-linked delivery visibility.
* Task creation, assignment, reassignment, status updates, priority, due dates, comments, and activity logs.
* Idea creation, editing, deletion, assignment, notes, status tracking, and activity logs.
* Content item creation, client/task/idea linking, creator assignment, submission, resubmission, review feedback, approval, rejection, change requests, final Drive handoff, and scheduling.
* Calendar month, week, and day grid views for scheduling only: task due dates, scheduled content, submitted day off/sick leave requests, and optional general meetings using `Africa/Cairo` display rules.
* Time-off request submission and scoped Admin/Supervisor approval with reviewer metadata.
* Generated daily and weekly reports from real tasks, content decisions, client scope, work hours, and time-off records, plus CSV export with permission checks.

### Superior Admin

Implemented responsibilities:

* Platform-level `platform_admins` table with legacy `superior_admins` compatibility.
* Super Admin route protection.
* Platform overview analytics.
* Organization and first Org Admin creation.
* Organization detail view with owner/admin/user/team/activity counts.
* Organization disable, reactivate, and soft-delete lifecycle actions.
* Platform activity logs.
* No tenant dashboard access by default.

### Notifications, Collaboration, Search, And Preferences

Implemented responsibilities:

* Notification records with entity links, unread counts, header dropdown, read/unread filters, mark-read actions, and browser-local sound preference.
* Generic comments, mentions, and attachments for tasks, ideas, content, and reports.
* Mention notifications for same-company accessible users.
* Supabase Storage buckets for attachments and avatars, with profile avatar and organization/client logo removal clearing database paths and deleting storage objects when available.
* Standalone global search across accessible company records. The app shell does not show a fake header search field.
* Saved views for advanced filters.
* Content templates for reusable content creation.
* Dashboard preferences for per-user widget visibility under `/settings/preferences`.
* Organization branding and settings stored in company/company settings rows.
* User profile and avatar management.

## 8. Planned Backend Modules

Future enhancements:

* Real-time notification delivery.
* Background jobs for scheduled workflows.
* Advanced role editing UI.
* Activity log export.
* Rich text and media preview workflows.

## 9. Data Access Strategy

Recommended access patterns:

* Use server-side reads for protected dashboard data.
* Use server actions for authenticated form submissions.
* Use route handlers for exports, webhooks, and integration endpoints later.
* Keep Supabase service-role access limited to trusted server-only operations.
* Validate all write payloads before touching the database.
* Use RLS as the final guard for tenant isolation.

Client-side Supabase usage should be limited to safe auth tasks and user-specific interactions where RLS fully protects the data.

## 10. Route Protection Strategy

Protected routes require a valid session. The dashboard area must not render protected content until context resolution finishes.

Protected route groups:

* `/admin`
* `/supervisor`
* `/team-lead`
* `/creator`
* `/marketing-manager`
* `/account-manager`
* `/content-creator`
* `/graphic-designer`
* `/video-editor`
* `/client`
* `/clients`
* `/profile`
* `/super-admin`
* `/tasks`
* `/ideas`
* `/content`
* `/calendar`
* `/reports`

Default redirects:

| Account | Default Route |
| --- | --- |
| Admin | `/admin` |
| Supervisor | `/supervisor` |
| CC Team Lead | `/team-lead` |
| Creator | `/creator` |
| Marketing Manager | `/marketing-manager` |
| Account Manager | `/account-manager` |
| Content Creator | `/content-creator` |
| Graphic Designer | `/graphic-designer` |
| Video Editor | `/video-editor` |
| Client | `/client` |
| Superior Admin | `/super-admin/organizations` |

Legacy aliases `/admin`, `/supervisor`, and `/creator` remain available for compatibility.

## 11. Validation and Error Handling

Validation responsibilities:

* Validate all form inputs with Zod.
* Validate status transitions.
* Validate assigned users, roles, and teams belong to the same company.
* Validate role permissions before workflow changes.
* Validate company slug uniqueness.
* Validate working-hours state transitions, such as no overlapping active breaks.

Error handling responsibilities:

* Show clear UI errors for expected failures.
* Avoid leaking private company data in error messages.
* Log unexpected server failures.
* Return generic unauthorized messages for failed permission checks.
* Keep failed auth and permission attempts auditable where appropriate.

## 12. Environment Variables

Expected environment variables:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_APP_ENV
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
SUPABASE_PROJECT_ID
```

Rules:

* Public Supabase values can be exposed to the browser.
* Service-role keys and database URLs must never be exposed to the browser.
* Environment files stay in the project root.
* Production secrets should be configured in the hosting provider.
* Vercel production must set `NEXT_PUBLIC_SITE_URL` to the deployed domain and Supabase Auth must include the production callback URL.

## 13. RLS and Security Principles

* Keep RLS enabled and forced on company-scoped tables.
* Restrict company records by the authenticated user's company.
* Use security-definer helper functions only where needed for scoped checks and RPC workflows.
* Add indexes on foreign keys and RLS lookup columns.
* Never trust `company_id` from the browser.
* Never expose service-role credentials to client code.
* Check both role permission and record scope.
* Keep inactive, suspended, or disabled users blocked from protected workflows.
* Keep platform-admin access separate from tenant membership.
* Keep platform-admin access separate from tenant membership.
* Keep Supabase Storage buckets private and company/user folder scoped.

## 14. Phase Alignment

| Roadmap Phase | Backend Focus |
| --- | --- |
| Phase 2 | Supabase auth, user profiles, companies, roles, protected routes, role redirects, middleware, RLS foundation. |
| Phase 2.5 | First-company onboarding and active/inactive profile resolution. |
| Phase 3 | User invitations, Admin user management, working-hours foundation, superior-admin organization bootstrap, UI/dark mode support. |
| Phase 4 | Role dashboard shortcuts and permission-aware workflow navigation. |
| Phase 5 | Teams, tasks, ideas, content pipeline, reviews, approvals, feedback, and calendar foundation. |
| Phase 6 | Reports, filters, and CSV export foundation. |
| Phase 7 | Activity logs and notifications. |
| Phase 9 | Security hardening, error handling, performance, testing, deployment guide. |
| Final Production | Platform admin lifecycle, notifications, collaboration, search, saved views, analytics, branding, profile, templates, dashboard customization, GitHub/Vercel readiness. |

## 15. Current Foundation Boundary

The current foundation includes authentication, onboarding, RBAC, RLS, Admin user management, invitations, working-hours tracking, platform organization management, the app shell, teams, tasks, ideas, content pipeline, calendar, reports, notifications, collaboration, search, analytics, branding/settings, user profiles, content templates, and dashboard customization.

The current foundation intentionally does not include:

* Activity log export
* Background jobs
* Real-time subscriptions
* Advanced role/permission editing UI

These belong to later roadmap phases.
