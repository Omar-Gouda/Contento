# Contento

Contento is a production-ready multi-company SaaS platform for content operations teams. The current implementation covers authentication, onboarding, platform Super Admin operations, organization lifecycle management, role-based route protection, Marketing Manager / Account Manager / Content Creator role labeling, Admin user management, client workspaces, working-hours tracking, teams, tasks, ideas, content review, calendar, scoped reports, header notifications, organization chat, collaboration, saved views, search, analytics, organization branding, profile settings, dark mode, and a modern dashboard shell.

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the required Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=local

# Server-only. Required for trusted user creation and platform actions.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-database-url

# Optional for local Supabase CLI workflows.
SUPABASE_PROJECT_ID=your-project-ref
```

Run the development server:

```bash
npm run dev
```

## Landing Page Decision

The app root route redirects to `/sign-in`. Contento is currently an authenticated SaaS product surface, and the previous landing page exposed internal workflow details. A future public marketing site can be added separately with benefit-focused copy.

## Routes

- `/` redirects to `/sign-in`
- `/sign-in`, `/forgot-password`, `/reset-password`
- `/auth/callback`
- `/change-password` forced password change for Marketing Manager-created users
- `/onboarding` first company workspace setup
- `/account-inactive`, `/organization-disabled`, `/organization-unavailable`
- `/marketing-manager`, `/account-manager`, `/team-lead`, `/content-creator`, `/graphic-designer`, `/video-editor`, `/client`
- Legacy dashboard aliases remain available at `/admin`, `/supervisor`, and `/creator`
- `/clients`, `/clients/[id]`
- `/admin/users`, `/admin/invitations`, `/admin/teams`, `/admin/tasks`, `/admin/ideas`, `/admin/work-hours`
- `/team`
- `/tasks`, `/tasks/[id]`
- `/ideas`, `/ideas/[id]`
- `/content`, `/content/[id]`
- `/reviews/ideas`, `/reviews/content`
- Legacy `/content/reviews` redirects to `/reviews/content`
- `/calendar`
- `/reports`, `/reports/[id]`, `/reports/export`
- `/notifications`
- `/search`
- `/settings`
- `/profile`, `/profile/work-hours`
- `/super-admin`, `/super-admin/organizations`, `/super-admin/organizations/[id]`

## Implemented Features

- Supabase authentication with sign in, reset password, sign out, protected routes, role redirects, onboarding, account-state pages, and forced password changes.
- Platform Super Admin route family with organization listing, details, analytics, lifecycle controls, platform audit logs, first Org Admin creation, and confirmation-gated permanent organization deletion.
- Organization lifecycle states: active, disabled, and deleted. Disabled and deleted organizations are blocked from tenant dashboards.
- Company-scoped RBAC with Marketing Manager, Account Manager, CC Team Lead, Content Creator, Graphic Designer, Video Editor, and Client role labels backed by tenant role keys.
- Admin user creation, status changes, role assignment, team/client assignment, Client-user plus client-profile creation, Marketing Manager user deletion with keep/remove content choices, and audit logging.
- Client workspaces with company profile cards, assignments, contract lifecycle dates, disabled/expired/archive states, and client-linked task, idea, content, report, and calendar visibility. New client profiles are created from the Client role flow in user management.
- Working-hours tracking with explicit Clock In / Clock Out controls, Cairo work dates, break sessions, 90-minute break allowance, missing time, user view, header status menu, and Admin company view.
- Teams, client workspaces, tasks, ideas, dedicated idea/content review queues, content pipeline, review scoring, modern scheduling calendar, role-scoped automated reports, and CSV report export.
- Role-aware Marketing Manager user creation changes team/client assignment fields based on the selected role and links Client users to client profiles.
- Header notification bell with unread count, recent-notification dropdown, mark-one/mark-all read actions, entity links, empty state, realtime refresh with polling fallback, toast alerts, server-backed sound preference, audio unlock handling, and browser notification permission control.
- Header organization chat drawer for same-company users and assigned client-scope conversations, with realtime/polling refresh, optimistic sends, unread indicators, and a full-height mobile conversation flow.
- Generic comments, mentions, and file attachments for tasks, ideas, content, and reports.
- Standalone global search across accessible users, teams, tasks, ideas, content, and reports.
- Advanced list filters with saved views for tasks, ideas, content, and reports.
- Real dashboard analytics backed by current database counts and role scope, with personalized dashboard titles and Client portal titles.
- Dashboard task and idea previews use sticky-note cards backed by real scoped work data.
- Organization branding and company settings for logo, colors, work target, break allowance, and timezone.
- Organization and client logo uploads use company-scoped Supabase Storage paths with signed previews, square object-fit display, persisted sidebar/client-card rendering, and remove actions that clear storage paths.
- User profile page with avatar upload/removal, full name, phone, job title, bio, timezone, organization, team, assigned clients, status, notification preferences, security settings, work-hours summary, recent activity, last login, and profile completion.
- Existing active content templates can still be used during content creation, but the standalone Templates page has been removed from navigation.
- Dashboard customization at `/settings/preferences` with show/hide widget preferences and reset support.
- `next-themes` dark mode with light, dark, and system preferences.
- Purple/violet default brand theme with semantic status colors retained for success, warning, danger, and info states.
- Responsive dashboard shell with permission-aware navigation, active states, notification interactions, collapsible sidebar, drawer navigation, compact mobile bottom navigation, and sheet-based primary forms.
- Calendar uses month/week/day grid views with a separated weekday header, compact toolbar buttons, compact event chips, and day-detail sheets for publishing dates, task due dates, day off, and sick leave.
- Premium Contento brand asset system with SVG logo/mark, favicon, PNG PWA icons, Apple touch icon, updated metadata, sidebar fallback mark, and sign-in logo.
- PWA shell with manifest, install prompt, theme color, Apple web app metadata, service worker registration, offline fallback page, and future-ready push notification handlers.
- Forgot/reset password uses a generic recovery message, production-safe callback URL generation from `NEXT_PUBLIC_SITE_URL`, recovery-email lookup for internal recovery routing, a Marketing Manager contact fallback, and session-aware reset redirects. Profile password changes update Supabase Auth in place without sending active users back to the dashboard.
- Profile security stores an optional recovery email. Supabase Auth reset links still go to the sign-in email; recovery email verification and direct recovery-email reset delivery require a future email-provider workflow, so Contento routes recovery-email requests to the internal Marketing Manager temporary-password flow.
- Report creation is automated by default from live task, idea publishing, content, comment, work-hours, and time-off data; users add optional notes and editable marketing metrics.
- Core pages are view-only by default; authorized create, edit, manage, review, comment, and final-output actions open in sheets or collapsed details sections.
- Filters are collapsed by default with visible active chips on Clients, Tasks, Ideas, Content, Reports, Users, and Reviews.
- Subscription billing foundation is in place with Starter, Growth, Business, and Enterprise plans, 1/5/7-year duration pricing, 30-day trials, a 10 Egypt business-day grace period, read-only inactive workspaces, manual InstaPay receipt upload, and Super Admin receipt review.
- Billing uses manual InstaPay verification only. Online card or wallet payments are intentionally marked Coming Soon and no payment credentials are stored.

## Supabase

Migrations live in:

```txt
supabase/
  migrations/
    202606230001_contento_phase_2_foundation.sql
    202606230002_contento_onboarding_rpc.sql
    202606230003_contento_phase_3_users_work_hours.sql
    202606230004_contento_superior_admin.sql
    202606230005_contento_phase_3_remaining_fixes.sql
    202606230006_contento_phase_4_to_10_workflows.sql
    202606240001_contento_phase_4_shared_operations_completion.sql
    202606240002_contento_phase_4_scope_fix_review_flow.sql
    202606240003_contento_phase_4_scope_policy_hardening.sql
    202606240004_contento_final_production_saas_readiness.sql
    202606240005_contento_product_review_corrections.sql
    202606250001_contento_client_revision.sql
    202606250002_contento_client_report_send_flow.sql
    202606300001_contento_client_permission_hotfix.sql
    202607010001_contento_ux_permission_chat_hotfix.sql
    202607020001_contento_client_contract_password_storage_hotfix.sql
    202607030001_contento_performance_assignment_refresh_fix.sql
    202607030002_contento_profile_stabilization.sql
    202607030003_contento_push_subscription_foundation.sql
    202607030004_contento_v7_recovery_and_org_hard_delete.sql
    202607040001_contento_critical_ux_rbac_reports_hotfix.sql
    202607100001_contento_public_demo_mode.sql
    202607100002_contento_organization_requests.sql
    202607100003_contento_demo_action_tagging.sql
    202607100004_contento_subscription_billing.sql
```

Apply migrations with the Supabase CLI or a trusted migration pipeline. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

## Vercel Setup

Configure these environment variables in Vercel:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_APP_ENV
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
SUPABASE_PROJECT_ID
CONTENTO_INSTAPAY_NAME
CONTENTO_INSTAPAY_HANDLE
CONTENTO_INSTAPAY_PHONE
```

Set `NEXT_PUBLIC_SITE_URL` to the production domain, for example `https://your-app.vercel.app`. In Supabase Auth, add the production site URL and callback URL, including:

```txt
https://your-app.vercel.app/auth/callback
```

Keep service-role and database credentials server-only in Vercel project settings.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
supabase db lint --linked
```

## Known Limitations

- Email delivery templates and provider-level transactional email customization are configured in Supabase, not in this repository.
- Background workers, activity-log export, and advanced custom role/permission editing UI remain future enhancements.
- Real Web Push delivery is prepared but not fully enabled. The app has notification permission UI, service worker push handlers, and subscription storage, but production push sending still needs VAPID keys and a trusted server-side delivery worker.
- Permanent organization deletion removes tenant database rows transactionally first, then server-side code cleans storage objects and Supabase Auth users. Storage/Auth cleanup warnings are logged because they cannot share the database transaction.
- Subscription grace processing is explicit through Super Admin billing controls. Expired grace periods are marked `scheduled_deletion` and blacklisted before a Super Admin performs the existing confirmation-gated hard delete.
