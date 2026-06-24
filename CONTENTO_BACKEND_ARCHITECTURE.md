# Contento Backend Architecture

This document describes the backend architecture for Contento as of the Phase 3 foundation. Contento uses Supabase Auth, Supabase PostgreSQL, Row Level Security, Next.js App Router server components/actions, role permissions, and company-scoped data access.

## 1. Backend Goals

Contento needs a backend that is simple, secure, and scalable enough for a multi-company SaaS platform. The backend must support authentication, company workspaces, user management, invitations, working-hours tracking, role-based access, content workflows, approvals, reports, schedules, analytics, notifications, activity logs, and exports over time.

Primary backend goals:

* Keep every company workspace isolated.
* Use Supabase for authentication, PostgreSQL, and Row Level Security.
* Keep authorization clear, role-driven, and permission-aware.
* Prefer server-side data access for protected operations.
* Never trust browser-provided `company_id`.
* Make activity logging and audit trails part of important future workflows.
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

The auth layer validates user identity through Supabase Auth and maps that identity to either a superior-admin account or a Contento company-user profile.

Responsibilities:

* Sign users in and out.
* Send password reset emails.
* Refresh sessions.
* Resolve superior-admin access.
* Resolve company-user profile, role, status, company, and permissions.
* Redirect users to the correct route.
* Accept pending invitations after authenticated sign-in.
* Start and close working-hours sessions around sign-in/sign-out.

### Application Access Layer

The application access layer decides whether an authenticated user can perform an action.

Responsibilities:

* Load `users` profile and `company_id` for company routes.
* Load superior-admin context for `/super-admin`.
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

The current implemented workflows are authentication, onboarding, invitations, user management, superior-admin organization bootstrap, and working-hours tracking. Future workflows include tasks, ideas, content pipeline, approvals, reporting, analytics, notifications, and exports.

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
* `company_settings`
* `user_invitations`
* `work_days`
* `work_sessions`
* `break_sessions`
* `task_comments`
* Existing workflow tables now actively used: `tasks`, `ideas`, `content_items`, `content_reviews`, `reports`, `calendar_events`, `day_off_requests`, and `activity_logs`

Global or platform tables:

* `companies` is the tenant root.
* `permissions` is the global permission catalog.
* `role_permissions` inherits scope through `roles`.
* `superior_admins` is platform-scoped and not tenant membership.

Future company-scoped tables include tasks, ideas, content items, reviews, reports, calendar events, day-off requests, notifications, activity logs, and exports.

Tenant rules:

* A normal user belongs to one company.
* Admins have full access inside their own company only.
* Supervisors and CC Team Leads are constrained to permissions and assigned teams when those modules arrive.
* Creators are constrained to their own work.
* Superior admins bootstrap organizations but are not company users.
* Exports and analytics must never cross company boundaries.

## 6. Authorization Model

Contento combines role-based access control with company-scoped data rules.

Authorization inputs:

* Authenticated Supabase user id.
* Contento `users` profile or `superior_admins` record.
* User `company_id`.
* User `role_id`.
* Role permissions from `role_permissions`.
* Record ownership or team membership where applicable.

Recommended authorization order:

1. Confirm the request has a valid Supabase session.
2. Resolve superior-admin context or company-user profile.
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
* Sign out.
* Protected routes.
* Role-based redirect.
* Session refresh through middleware.
* Active/inactive account handling.

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
* Task creation, assignment, reassignment, status updates, priority, due dates, comments, and activity logs.
* Idea creation, editing, deletion, assignment, notes, status tracking, and activity logs.
* Content item creation, task linking, creator assignment, submission, resubmission, review feedback, approval, rejection, change requests, and scheduling.
* Calendar monthly and weekly views that combine scheduled content, calendar events, work-hour rows, and day-off rows using `Africa/Cairo` display rules.
* Report submission and CSV export with permission checks.

### Superior Admin

Implemented responsibilities:

* Platform-level superior-admin table.
* Superior-admin route protection.
* Organization and first Org Admin creation.
* No tenant dashboard access by default.

## 8. Planned Backend Modules

Future modules:

* Advanced analytics charts
* Notifications
* Background jobs
* Advanced role editing UI
* Activity log export

These modules should inherit the current tenant, RBAC, RLS, validation, and server-action patterns.

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
| Superior Admin | `/super-admin/organizations` |

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
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

Rules:

* Public Supabase values can be exposed to the browser.
* Service-role keys and database URLs must never be exposed to the browser.
* Environment files stay in the project root.
* Production secrets should be configured in the hosting provider.

## 13. RLS and Security Principles

* Keep RLS enabled and forced on company-scoped tables.
* Restrict company records by the authenticated user's company.
* Use security-definer helper functions only where needed for scoped checks and RPC workflows.
* Add indexes on foreign keys and RLS lookup columns.
* Never trust `company_id` from the browser.
* Never expose service-role credentials to client code.
* Check both role permission and record scope.
* Keep inactive, suspended, or disabled users blocked from protected workflows.
* Keep superior-admin access separate from tenant membership.

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

## 15. Current Foundation Boundary

The current foundation includes authentication, onboarding, RBAC, RLS, Admin user management, invitations, working-hours tracking, superior-admin organization bootstrap, the app shell, teams, tasks, ideas, content pipeline, calendar, and reports.

The current foundation intentionally does not include:

* Advanced analytics
* Notifications
* Activity log export
* Background jobs

These belong to later roadmap phases.
