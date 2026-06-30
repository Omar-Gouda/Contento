## Current Planned Features

This file tracks the features planned for Contento from the start of the rebuild.

## 1. Authentication

Status: Foundation Implemented

Features:

* Sign in
* Forgot password
* Reset password
* Logout
* Protected routes
* Role-based redirect
* Supabase session management

## 2. Multi-Company Workspaces

Status: Onboarding Foundation Implemented

Features:

* Company workspace
* Users linked to companies
* Isolated company data
* Company settings
* Workspace-level permissions
* First authenticated user can create the initial company workspace
* First authenticated user becomes active Admin for that workspace
* Client workspaces and client-linked deliverables are scoped to the owning company

## 3. Roles

Status: RBAC Foundation Implemented

Roles:

* Marketing Manager (Admin)
* Account Manager (Supervisor)
* CC Team Lead
* Content Creator (Creator)
* Graphic Designer
* Video Editor
* Client

Foundation:

* Roles table
* Permissions table
* Role permissions table
* Permission access levels
* Server-side RBAC helpers

## 4. Dashboards

Status: Operational Foundation Implemented

Dashboards:

* Marketing Manager dashboard
* Account Manager dashboard
* CC Team Lead dashboard
* Content Creator dashboard
* Graphic Designer dashboard
* Video Editor dashboard
* Client dashboard

Current foundation:

* Role dashboards are protected and route-aware
* Dashboard cards and charts focus on the signed-in user's own or permitted scoped tasks, content, clients, reports, submissions, and work-day status
* Team and company-wide review/operations views live in scoped operational pages instead of private dashboards
* Dashboard customization lives in `/settings/preferences`

## 4.1 Teams

Status: Implemented

Features:

* Create teams
* Edit teams
* Archive teams
* Assign team lead
* Assign members
* View team roster
* View team statistics for members, open tasks, and active content
* CC Team Leads only see and operate inside their own led/assigned team scope
* Supervisors with member-assignment permission can update members on teams visible to their scope

## 4.2 Client Workspaces

Status: Implemented

Features:

* Create and edit client workspaces
* Assign account managers and scoped production users
* Track client briefs, branding, contacts, notes, and requirements
* Link tasks, ideas, content, reports, and calendar items to clients
* View client-specific workspace pages and delivery history
* Preserve structured report metrics and require an explicit internal send action before Client role users can read client-scoped reports

## 5. User Management

Status: Phase 3 Foundation Implemented

Features:

* Create users with a temporary password
* View company users
* Search and filter users
* Disable users
* Suspend users
* Reactivate users
* Assign roles
* Assign teams
* Force Marketing Manager-created users to change their password on first login
* Manage client assignments where permitted

## 5.1 User Invitations

Status: Disabled In UI

Features:

* Invitation tables and RPC support exist from the earlier Phase 3 foundation
* `/admin/invitations` now redirects to `/admin/users`
* Current active onboarding is direct Admin user creation with temporary password

## 5.2 Working Hours

Status: Phase 3 Foundation Implemented And Corrected

Features:

* Work day starts on first sign-in
* Work date is derived from `Africa/Cairo`
* Sign-out closes active work session
* Active work sessions
* Break sessions
* 90 minute daily break allowance
* Missing time when break usage exceeds allowance
* Missing time after sign-out uses a documented 480-minute default work target
* Reviewable break history
* Current user work-hours page
* Admin company work-hours page

## 5.3 Superior Admin

Status: Foundation Implemented

Features:

* Platform-level superior admin account scope
* Superior admin is not a company user
* Superior admin creates organizations and first Org Admin accounts
* Organization bootstrap uses a server action plus secure database RPC

## 6. Ideas Management

Status: Implemented

Features:

* Create ideas
* Edit ideas
* Delete ideas
* Assign ideas
* Change idea status
* Add notes
* Review ideas
* Activity logs for idea creation, updates, deletion, and status changes

## 7. Content Pipeline

Status: Implemented

Features:

* Create content item
* Assign content to creator
* Track status
* Creator submits drafts to Team Lead review
* Team Lead requests changes or sends own-team content to Account Manager review
* Supervisor approves, rejects, or requests changes
* Add reviewer feedback
* Add scoped reviewer ratings for submitted content
* Link content items to tasks
* Link content items to clients
* Schedule approved content into the calendar
* Attach final Drive links for production handoff

## 8. Content Calendar

Status: Implemented

Features:

* Monthly calendar view
* Weekly calendar view
* Day calendar view
* Schedule content
* View task due dates
* View scheduled content
* Submit day off and sick leave requests
* Review scoped pending time-off requests when the role has approval permission
* View optional general scheduling events
* `Africa/Cairo` timezone respected in display
* Calendar intentionally excludes ideas, reports, work sessions, analytics events, and activity logs

## 9. Reports

Status: Implemented

Features:

* Generated daily reports
* Generated weekly reports
* Creator reports
* Team reports
* Company reports
* Client-scoped report history
* Export reports as CSV
* Report body is generated from live task, content, work-hours, and time-off data with optional user notes

## 10. Analytics

Status: Implemented

Features:

* Total content items
* Approved content
* Rejected content
* Pending reviews
* Creator performance
* Team performance
* Activity trends
* Role-scoped dashboard metrics for Marketing Manager, Account Manager, CC Team Lead, Content Creator, Graphic Designer, Video Editor, and Client
* Company-wide Admin analytics for users, active users, teams, open tasks, approval rate, reports, and active work days
* Team-scoped Supervisor and CC Team Lead metrics

## 11. Activity Logs

Status: Foundation Implemented

Features:

* Track user actions
* Track approvals
* Track rejections
* Track content changes
* Track task, idea, content, team, and report actions from server actions

## 12. Notifications

Status: Implemented

Features:

* Task assigned notification
* Content approved notification
* Content rejected notification
* Review requested notification
* Feedback received notification
* Notification center at `/notifications`
* Header notification bell with unread count and recent-notification dropdown
* Read/unread filtering
* Mark one or all notifications as read
* Browser-local notification sound preference
* Entity links when a notification maps to a task, idea, content item, report, or organization event

## 13. UI/UX

Status: Phase 3 Upgrade Implemented

Features:

* Modern SaaS design
* Responsive layout
* Sidebar navigation
* Mobile navigation
* Loading states
* Empty states
* Error states
* Smooth animations
* Dark mode with light, dark, and system preferences
* Theme toggle in app shell
* `/` redirects to sign in after landing page removal

## 14. Exporting

Status: Reports Export Implemented

Features:

* CSV export for reports
* Filtered report export by report type
* CSV export for activity logs remains deferred

## 15. Initial Foundation

Status: Created

Created in Phase 1:

* Next.js App Router project foundation
* TailwindCSS and shadcn/ui setup
* Public landing page
* Sign in page
* Forgot password page
* Protected dashboard layout foundation
* Role-based dashboard routes for Admin, Supervisor, CC Team Lead, and Creator
* Supabase environment variable setup

## 16. Phase 2 Production Foundation

Status: Implemented

Created in Phase 2:

* Supabase authentication actions
* Sign in, forgot password, reset password, and sign out flows
* Session-aware protected routes through Next.js proxy
* Server-side auth context resolution
* Role-based dashboard route protection
* Database migration for companies, users, roles, permissions, teams, tasks, ideas, content, reviews, reports, calendar events, day off requests, notifications, activity logs, and company settings
* Row Level Security policies for company isolation
* RBAC helpers for roles and permissions

## 17. Phase 2.5 Onboarding Foundation

Status: Implemented

Created in Phase 2.5:

* Authenticated first-company setup flow
* Company workspace creation through secure server action and database RPC
* First Admin profile creation linked to the Supabase Auth user
* Active, missing-profile, inactive, and incomplete-profile auth state handling
* Role-based dashboard redirect after onboarding
* Account inactive route for blocked dashboard access

## 18. Phase 3 User Management, UI, And Working Hours

Status: Implemented

Created in Phase 3:

* Modern dashboard shell and active navigation
* Dark mode with `next-themes`
* Landing page removed; `/` redirects to `/sign-in`
* Role-based sidebar navigation
* Admin direct user creation and management page
* Forced password-change page for Marketing Manager-created users
* User invitation migration and RLS policies
* Working-hours migration and RPCs
* Cairo timezone work-date fix
* Reviewable break history
* Current user work-hours page
* Admin company work-hours page
* Superior-admin organization bootstrap foundation

## 19. Phase 4-10 Workflow Implementation

Status: Implemented

Created in the current implementation:

* Redirect loop fix retained through centralized route-access decision tree
* Teams management page at `/admin/teams`
* Shared scoped team page at `/team`
* Shared task management at `/tasks`
* Task detail page at `/tasks/[id]`
* Admin task management at `/admin/tasks`
* Shared idea management at `/ideas`
* Idea detail page at `/ideas/[id]`
* Admin idea management at `/admin/ideas`
* Content pipeline at `/content`
* Content detail page at `/content/[id]`
* Content review queue at `/content/reviews`
* Two-step content review flow: Content Creator draft -> Team Lead review -> Account Manager review -> approved/rejected/changes requested
* Content rating support through `content_ratings` and `content.rate`
* Content calendar at `/calendar` with month, week, and list views
* Reports page at `/reports`
* Report detail page at `/reports/[id]`
* CSV report export route at `/reports/export`
* Lightweight role dashboard summaries backed by scoped database counts
* Workflow migration for team leads/status, task priority/comments, idea assignment/notes, content schedule timestamps, calendar links, RLS helpers, and workflow indexes
* Shared operations completion migration for team creators, task assigners, idea team links, content idea/team links, report titles/team/date ranges, report export activity logs, and permission aliases
* Phase 4 scope-fix migration for private dashboards, Team Lead own-team boundaries, scoped task/content review helpers, content review handoff statuses, content ratings, and tightened RLS policies

## 20. Final Production SaaS Readiness

Status: Implemented

Created in the final production phase:

* Platform Admin table and route family at `/super-admin`, `/super-admin/organizations`, and `/super-admin/organizations/[id]`
* Organization lifecycle management for active, disabled, and deleted states
* Organization blocked-state pages at `/organization-disabled` and `/organization-unavailable`
* Platform activity logs for organization lifecycle changes
* Notification center, notification unread count, mark-read actions, and workflow-generated notifications
* Generic company-scoped comments, mentions, and attachments for tasks, ideas, content, and reports
* Supabase Storage buckets and policies for attachments and avatars
* Global search at `/search`
* Saved views and advanced filter persistence for operational list pages
* Organization settings and branding at `/settings`
* User profile management at `/profile`
* Review scoring fields on content reviews
* Content templates at `/content/templates`
* Dashboard widget customization with user preferences under `/settings/preferences`
* Expanded audit logging for user management and workflow actions
* GitHub and Vercel readiness documentation, safe `.env.example`, and temporary file cleanup
