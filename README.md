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
- `/content`, `/content/[id]`, `/content/templates`
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
- Platform Super Admin route family with organization listing, details, analytics, lifecycle controls, platform audit logs, and first Org Admin creation.
- Organization lifecycle states: active, disabled, and deleted. Disabled and deleted organizations are blocked from tenant dashboards.
- Company-scoped RBAC with Marketing Manager, Account Manager, CC Team Lead, Content Creator, Graphic Designer, Video Editor, and Client role labels backed by tenant role keys.
- Admin user creation, status changes, role assignment, team/client assignment, Client-user plus client-profile creation, Marketing Manager user deletion with keep/remove content choices, and audit logging.
- Client workspaces with company profile cards, assignments, and client-linked task, idea, content, report, and calendar visibility. New client profiles are created from the Client role flow in user management.
- Working-hours tracking with explicit Clock In / Clock Out controls, Cairo work dates, break sessions, 90-minute break allowance, missing time, user view, header status menu, and Admin company view.
- Teams, client workspaces, tasks, ideas, dedicated idea/content review queues, content pipeline, review scoring, scheduling calendar, role-scoped generated reports, and CSV report export.
- Role-aware Marketing Manager user creation changes team/client assignment fields based on the selected role and links Client users to client profiles.
- Header notification bell with unread count, recent-notification dropdown, mark-one/mark-all read actions, entity links, empty state, and browser-local sound preference.
- Header organization chat drawer for same-company users and assigned client-scope conversations.
- Generic comments, mentions, and file attachments for tasks, ideas, content, and reports.
- Standalone global search across accessible users, teams, tasks, ideas, content, and reports.
- Advanced list filters with saved views for tasks, ideas, content, and reports.
- Real dashboard analytics backed by current database counts and role scope, with personalized dashboard titles and Client portal titles.
- Organization branding and company settings for logo, colors, work target, break allowance, and timezone.
- User profile page with profile updates, avatar upload, role/team context, password change, and work-hours link.
- Content templates with create, edit, archive, and use-on-content-create flows.
- Dashboard customization at `/settings/preferences` with show/hide widget preferences and reset support.
- `next-themes` dark mode with light, dark, and system preferences.
- Responsive dashboard shell with permission-aware navigation, active states, notification interactions, collapsible sidebar, and mobile navigation.

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
```

Set `NEXT_PUBLIC_SITE_URL` to the production domain, for example `https://your-app.vercel.app`. In Supabase Auth, add the production site URL and callback URL, including:

```txt
https://your-app.vercel.app/auth/callback
```

Keep service-role and database credentials server-only in Vercel project settings.

## Validation

```bash
npm run lint
npm run build
supabase db lint --linked
```

## Known Limitations

- Email delivery templates and provider-level transactional email customization are configured in Supabase, not in this repository.
- Real-time subscriptions, background workers, activity-log export, and advanced custom role/permission editing UI remain future enhancements.
- Hard deletion of organizations is intentionally not implemented; Super Admin uses soft delete.
