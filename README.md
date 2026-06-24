# Contento

Contento is a production-ready multi-company SaaS foundation for content operations teams. The current implementation covers authentication, company onboarding, superior-admin organization bootstrap, role-based route protection, Admin direct user creation, forced first-login password changes, working-hours tracking, teams, tasks, ideas, content pipeline, calendar, reports, dark mode, and a modern dashboard shell.

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

# Server-only. Required for Admin-created Supabase Auth users.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-database-url
```

Run the development server:

```bash
npm run dev
```

## Landing Page Decision

Phase 3 removes the marketing landing page. The `/` route redirects to `/sign-in` because the previous page exposed internal workflow and dashboard details. A future marketing site can be added separately with abstract, benefit-focused copy.

## Routes

- `/` redirects to `/sign-in`
- `/sign-in`, `/forgot-password`, `/reset-password`
- `/change-password` forced password change for Admin-created users
- `/onboarding` first company workspace setup
- `/account-inactive` inactive or incomplete account state
- `/admin`, `/supervisor`, `/team-lead`, `/creator`
- `/admin/users` Admin user creation and management
- `/admin/invitations` redirects to `/admin/users`
- `/admin/teams` Admin team management
- `/team` scoped team workspace
- `/tasks`, `/tasks/[id]`, and `/admin/tasks` task management
- `/ideas`, `/ideas/[id]`, and `/admin/ideas` idea management
- `/content`, `/content/[id]`, and `/content/reviews` content pipeline and reviews
- `/calendar` content, work-hours, and day-off calendar with month, week, and list views
- `/reports` and `/reports/[id]` report submission and review
- `/reports/export` CSV report export
- `/admin/work-hours` company work-hours view
- `/profile/work-hours` current user work-hours view
- `/super-admin/organizations` platform superior-admin organization creation

## Implemented Features

- `next-themes` dark mode with light, dark, and system preferences
- Premium dashboard shell with active navigation, responsive mobile menu, and theme toggle
- Role-based sidebar navigation; users only see routes allowed for their role and permissions
- Admin direct user creation with server-only Supabase Auth creation, temporary password, and `must_change_password`
- Forced `/change-password` flow before Admin-created users can access dashboards
- Admin user search, filtering, role assignment, team assignment, suspension, disable, and reactivation
- Work-day, work-session, and break-session tracking
- Work dates are derived from the `Africa/Cairo` calendar day
- Sign-in starts or resumes today's work session
- Sign-out closes the active work session unless a break is active
- Break allowance is 90 minutes per day; excess break time is recorded as missing time
- Missing time also uses a documented 480-minute default work-day target after sign-out
- User and Admin work-hours pages show reviewable break history
- Superior Admin can create organizations and the first Org Admin account without joining tenant workspaces
- Admin team creation, editing, archiving, lead assignment, member assignment, and team statistics
- Shared scoped team page for visible team rosters and workload signals
- Supervisor scoped member assignment on visible teams; CC Team Leads cannot move users between teams
- Task creation, assignment, reassignment, detail view, status updates, priority, due dates, comments, activity logs, and team filtering
- CC Team Lead task assignment is limited to own led/assigned team members
- Idea creation, editing, deletion, detail view, assignment, team scoping, notes, status tracking, and activity logs
- Content item creation, detail view, task/idea linking, team scoping, creator assignment, Team Lead review, Supervisor review, approve, reject, request changes, feedback, ratings, and scheduling
- Calendar monthly and weekly views for scheduled content, work-hours records, day-off rows, and calendar events in `Africa/Cairo`
- Calendar list view for scoped operational agenda review
- Daily, weekly, user, team, and company reports with team/date ranges, detail views, CSV export, and export activity logging
- Lightweight role dashboards backed by real private user productivity counts

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
```

Apply migrations with the Supabase CLI or a trusted migration pipeline. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

## Validation

```bash
npm run lint
npm run build
```

## Deferred Modules

Advanced analytics dashboards, notifications, background jobs, advanced role editing UI, and richer charting remain intentionally deferred.
