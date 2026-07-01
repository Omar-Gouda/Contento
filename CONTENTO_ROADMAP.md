## Phase 1: Foundation

Goal: Build the base project structure.

Tasks:

* Create Next.js project
* Install TailwindCSS
* Setup shadcn/ui
* Setup folder structure
* Add global layout
* Add theme system
* Add reusable UI components
* Add landing page
* Add authentication pages

Deliverables:

* Clean project structure
* Responsive UI foundation
* Working public pages

Current foundation created:

* Next.js App Router with TypeScript
* TailwindCSS and shadcn/ui setup
* Landing page, sign in page, and forgot password page
* Protected dashboard layout foundation
* Marketing Manager, Account Manager, CC Team Lead, and Content Creator dashboard route foundations

## Phase 2: Authentication & Authorization

Goal: Add secure login and role-based access.

Tasks:

* Setup Supabase authentication
* Create user profiles table
* Create companies/workspaces table
* Add role system
* Add protected routes
* Add dashboard redirect based on role
* Add middleware protection

Deliverables:

* Sign in
* Sign up
* Logout
* Protected dashboard
* Role-based routing

Current Phase 2 foundation created:

* Supabase sign in, forgot password, reset password, and sign out flows
* Session management with server-side auth context
* Protected dashboard route foundation
* Role-based dashboard redirects
* Multi-tenant database migration
* RBAC helper functions
* Row Level Security policy foundation
* First-company onboarding flow for authenticated users without a Contento profile
* Account inactive handling for non-active or incomplete profiles

## Phase 3: Multi-Tenant Company System

Goal: Make Contento work for multiple companies.

Tasks:

* Add company/workspace model
* Connect each user to a company
* Isolate company data
* Add company settings
* Add admin company dashboard

Deliverables:

* Each company has separate data
* Admin manages company workspace
* Users only access their company data

Current Phase 3 foundation created:

* Admin user management for company users
* Admin company-scoped invitations
* User status, role, and team assignment actions
* Working-hours database foundation
* Sign-in/sign-out work-session integration
* Current user and Admin work-hours pages
* Dark mode with light, dark, and system preferences
* Upgraded dashboard shell and navigation
* Renamed user-facing roles for Marketing Manager, Account Manager, Content Creator, Graphic Designer, Video Editor, and Client
* Client workspace routes and client-linked workflow foundations
* Landing page removed; `/` redirects to `/sign-in`
* Superior-admin organization bootstrap foundation

## Phase 4: Dashboards

Goal: Build dashboards for all roles.

Tasks:

* Marketing Manager dashboard
* Account Manager dashboard
* CC Team Lead dashboard
* Content Creator dashboard
* Stats cards
* Recent activity
* Charts
* Quick actions

Deliverables:

* Role-based dashboards
* Clean UX
* Useful analytics preview

Current Phase 4 dashboard foundation:

* Role dashboard routes now link into real operational modules for Marketing Manager, Account Manager, CC Team Lead, Content Creator, Graphic Designer, Video Editor, and Client
* Dashboard metrics are personal to the signed-in user instead of exposing team/company progress
* Sidebar navigation is permission-aware for Teams, Clients, Tasks, Ideas, Content, Calendar, Reports, and Work Hours
* Dashboard customization controls moved to `/settings/preferences`
* Focus and shortcuts widgets were removed in favor of real scoped charts

## Phase 5: Core Content Workflow

Goal: Build the main content operations system.

Tasks:

* Ideas management
* Content creation
* Content statuses
* Review flow
* Approval/rejection
* Feedback
* Content calendar

Deliverables:

* Creator can submit content
* Team Lead can manage progress
* Supervisor can approve/reject
* Admin can monitor everything

Current Phase 5 workflow implementation:

* `/admin/teams` supports team creation, editing, archiving, lead assignment, member assignment, roster visibility, and workload statistics
* `/team` provides a shared scoped team workspace for supervisors, CC Team Leads, and creators with visible rosters and workload signals
* Supervisors with member-assignment permission can update members on teams visible to their scope; CC Team Leads cannot move users between teams
* `/clients` and `/clients/[id]` manage client workspaces, client assignments, briefs, branding, and client-linked delivery items
* `/tasks`, `/tasks/[id]`, and `/admin/tasks` support task creation, assignment, reassignment, status updates, due dates, priority, comments, activity logging, and team filtering
* CC Team Leads can assign tasks only inside their own led/assigned teams
* `/ideas`, `/ideas/[id]`, and `/admin/ideas` support idea creation, editing, deletion, assignment, team scoping, notes, status tracking, and activity logging
* `/content` and `/content/[id]` support content item creation, client/task/idea linking, team scoping, creator assignment, submission, review history, ratings, final Drive handoff, and scheduling
* `/reviews/ideas` provides a dedicated submitted-idea review queue with decision and feedback controls
* `/reviews/content` supports the required Content Creator -> Team Lead -> Account Manager review handoff with feedback, rating, approval, rejection, and change requests
* All records are company-scoped and permission-checked through existing auth context and RLS

## Phase 6: Reports & Analytics

Goal: Add reporting and performance tracking.

Tasks:

* Creator reports
* Team reports
* Company reports
* Charts
* Filters
* Date ranges
* CSV export

Deliverables:

* Reports dashboard
* Analytics charts
* Export functionality

Current Phase 6 reporting implementation:

* `/reports` generates daily and weekly report records from live tasks, content decisions, client scope, work hours, and time-off records
* `/reports/[id]` shows report details inside the same permission scope
* `/reports/export` exports permission-checked report CSV data and writes an activity log record
* Advanced charts and analytics remain deferred

## Phase 7: Activity Logs & Notifications

Goal: Track actions and notify users.

Tasks:

* Activity logging
* Notification center
* User action history
* Review alerts
* Approval alerts
* Task assignment alerts

Deliverables:

* Clear audit trail
* In-app notifications

Current Phase 7 implementation:

* Workflow server actions create activity logs for user, team, task, idea, content, report, and export actions.
* Platform organization lifecycle changes write `platform_activity_logs`.
* `/notifications` provides a real notification center with read/unread filters and mark-read actions.
* Dashboard shell shows an interactive notification bell with unread counts, recent notifications, mark-read controls, and browser-local sound preference.
* Task assignment/status, idea submission/status, content submission/review, comment mentions, team membership, and organization lifecycle changes create notifications where relevant.

## Phase 8: UI/UX Upgrade

Goal: Make the product feel premium and client-ready.

Tasks:

* Improve dashboard layout
* Add animations
* Add empty states
* Add loading states
* Add error states
* Add better tables
* Add filters and search
* Improve mobile experience

Deliverables:

* Polished SaaS UI
* Better user experience
* Client-ready interface

Current Phase 8 UI implementation:

* New operational pages use dark-mode-aware cards, tables, filters, empty states, and action forms
* Dashboard navigation includes permission-aware workflow groups, client workspaces, and Admin groups
* Mobile shell inherits the same route navigation and theme support
* Search, notifications, profile, settings, preferences, templates, and Super Admin pages use the upgraded app surface
* Organization branding colors are applied inside tenant workspaces without breaking dark mode
* Dashboard widgets can be shown, hidden, and reset per user under `/settings/preferences`
* Header search input was removed; scoped search remains available on `/search`

## Phase 9: Production Readiness

Goal: Prepare for real deployment.

Tasks:

* Environment variables
* Security rules
* Database policies
* Error handling
* Performance optimization
* Testing
* Deployment guide
* README

Deliverables:

* Production-ready app
* Clear setup instructions
* Ready for Vercel deployment

Current Phase 9 implementation:

* `.env.example` documents public, server-only, and Supabase CLI variables.
* README documents local setup, Supabase migrations, Vercel variables, production callback URLs, validation commands, and known limitations.
* Supabase README documents all migrations, RLS policy model, storage buckets, and DB lint workflow.
* Temporary TODO/debug marker files were removed.
* `npm run lint`, `npm run build`, and `supabase db lint --linked` are the required release checks.

## Final Production SaaS Readiness

Goal: Finish core SaaS operations and deployment readiness.

Implemented:

* Platform Admin model with `platform_admins` and `platform_activity_logs`
* Organization lifecycle management for active, disabled, and deleted states
* Tenant access blocking for disabled or deleted organizations
* Notification center and workflow notifications
* Generic comments, mentions, and attachments
* Supabase Storage buckets for attachments and avatars
* Global search across accessible operational data
* Advanced filters and saved views
* Role-scoped real analytics
* Organization branding and settings
* User profile management
* Content review scoring
* Content templates
* Dashboard widget customization
* GitHub and Vercel readiness documentation

Future enhancements:

* Real-time notification delivery
* Background workers for scheduled jobs
* Activity log export
* Advanced custom role and permission editing UI
* Rich text editing and media preview workflows
