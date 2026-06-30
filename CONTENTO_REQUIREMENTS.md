## 1. Project Vision

Contento is a multi-company SaaS platform for managing content operations, creators, approvals, client delivery, reporting, scheduling, and performance tracking.

The platform helps companies organize their content workflow between Marketing Managers, Account Managers, CC Team Leads, creators, production specialists, and client workspaces from one centralized dashboard.

## 2. Target Users

* Marketing agencies
* Social media teams
* Content creation teams
* Customer care / content moderation teams
* Companies managing multiple creators or departments

## 3. System Type

Contento will be built as a multi-tenant SaaS platform.

Each company should have its own isolated workspace, users, content, reports, schedules, analytics, and permissions.

## 4. Core Roles

### Marketing Manager

Administrative company role with full control over one company workspace. This role is stored as `Admin` in the database for backward compatibility, but appears as Marketing Manager in the product UI. Marketing Manager does not manage other organizations or platform routes.

Permissions:

* Manage users
* Manage roles
* View all dashboards
* Manage company settings
* Review all activity logs
* Export reports
* Access analytics
* Approve/reject major actions

### Account Manager

Managerial role responsible for monitoring assigned team performance, client delivery, quality, approvals, and reports. This role is stored as `Supervisor` in the database for backward compatibility, but appears as Account Manager in the product UI.

Permissions:

* View team dashboards
* Review creator submissions
* Approve or reject content
* Track reports
* View analytics
* Add feedback
* Monitor team activity

### CC Team Lead

Operational role responsible for day-to-day execution inside their own team scope.

Permissions:

* Assign tasks to creators in own assigned team
* Review own-team submitted content
* Track daily work
* View assigned team reports
* Manage content schedules
* Send own-team approved submissions to Account Manager review
* Escalate issues to supervisor/admin

### Content Creator

Productive role responsible for creating and submitting their own work.

Permissions:

* Create ideas
* Submit content
* View assigned tasks
  View Task Progress
* Update task status
* Submit reports
* View personal performance
* Access content calendar
* Request day off or sick leave

### Graphic Designer

Production role responsible for assigned design work, content assets, and final delivery links inside permitted company/client scope.

Permissions:

* View assigned tasks
* Update assigned task progress
* Submit final output links when permitted
* View assigned content and calendar work
* View own reports and performance

### Video Editor

Production role responsible for assigned video work, edits, and final delivery links inside permitted company/client scope.

Permissions:

* View assigned tasks
* Update assigned task progress
* Submit final output links when permitted
* View assigned content and calendar work
* View own reports and performance

### Client

External workspace role for client-facing visibility. Client users can view only assigned client workspaces and approved/shared delivery information.

Permissions:

* View assigned client workspace
* View shared content and final Drive links
* View shared reports
* View relevant calendar delivery dates
* No access to internal team operations, work-hours, private reviews, or unrelated company data

### Super Admin

Platform role for organization lifecycle only. Super Admin can create organizations, create first Org Admin accounts, view platform organization metadata, and disable/reactivate/soft-delete organizations. Super Admin is not a company role and cannot access tenant dashboards unless separately assigned a normal company profile.

## 5. Core Modules

* Authentication
* Company workspace management
* Client workspace management
* Role-based access control
* User management
* Dashboard per role
* Ideas management
* Content pipeline
* Content calendar
* Reviews and approvals
* Reports
* Analytics
* Activity logs
* Notifications
* Collaboration: comments, mentions, and attachments
* Global search
* Saved views and advanced filters
* Content templates
* Platform Super Admin
* Settings
* Exporting data

## 6. Main Pages

### Public Pages

* Root redirect to sign in
* Sign in
* Forgot password
* Reset password
* Organization blocked-state pages

### Shared App Pages

* Dashboard
* Clients
* Profile
* Notifications
* Settings
* Search
* Saved operational views

### Marketing Manager Pages

* Marketing Manager dashboard
* Users management
* Client workspaces
* Roles and permissions
* Company settings
* Analytics
* Activity logs
* Reports
* Exports
* Organization branding

### Account Manager Pages

* Account Manager dashboard
* Team performance
* Client delivery oversight
* Pending reviews
* Reports
* Activity monitoring
* Feedback center

### CC Team Lead Pages

* Team lead dashboard
* Task assignment
* Team content pipeline
* Daily progress
* Calendar
* Reports

### Content Creator Pages

* Content Creator dashboard
* My tasks
* Ideas
* Content submissions
* Calendar
* My reports
* Performance

### Production Specialist Pages

* Graphic Designer dashboard
* Video Editor dashboard
* Assigned tasks
* Assigned content
* Calendar

### Client Pages

* Client dashboard
* Assigned client workspace
* Shared content delivery links
* Shared reports
* Delivery calendar

### Platform Pages

* Super Admin overview
* Organizations list
* Organization detail and lifecycle controls

## 7. Main Workflows

### Content Workflow

1. Content Creator creates idea or content draft.
2. Content Creator submits content to CC Team Lead review.
3. CC Team Lead reviews own-team submissions and either requests changes or sends content to Account Manager review.
4. Account Manager approves, rejects, or requests changes.
5. Marketing Manager can monitor and override inside company scope.
6. Approved content moves to calendar/scheduled state.
7. Final Drive links can be attached for approved task/content handoff.
8. Reports and analytics are updated.

### User Management Workflow

1. Marketing Manager creates or invites a user inside the company workspace.
2. Marketing Manager assigns role and optional team.
3. Marketing Manager-created users receive temporary password access and must change password on first login.
4. User sees dashboard based on role and company status.

### Client Workspace Workflow

1. Marketing Manager creates a client workspace inside the company.
2. Users can be assigned to the client workspace based on role and responsibility.
3. Tasks, ideas, content, reports, and calendar events can be linked to that client.
4. Client users see only their assigned client workspace and shared delivery information.
5. Internal users retain company, role, team, and client-scope boundaries.

### Review Workflow

1. Content Creator submits content.
2. CC Team Lead adds feedback and optional rating for own-team submitted content.
3. CC Team Lead requests changes or sends content to Account Manager review.
4. Account Manager adds feedback/rating and approves, rejects, or requests changes.
5. Activity is logged.

## 8. Data Requirements

The system should store:

* Companies
* Users
* Roles
* Permissions
* Teams
* Clients
* Client assignments
* Ideas
* Content items
* Reviews
* Reports
* Calendar events
* Activity logs
* Notifications
* Attachments
* Comments
* Mentions
* Saved views
* Content templates
* Dashboard preferences
* Platform admins
* Platform activity logs
* Settings

## 9. Non-Functional Requirements

* Secure authentication
* Role-based authorization
* Multi-company data isolation
* Responsive UI
* Clean dashboard UX
* Fast loading
* Scalable database structure
* Audit logging
* Easy deployment
* Simple backend instructions

## 10. Preferred Tech Stack

* Next.js App Router
* TypeScript
* TailwindCSS
* shadcn/ui
* Supabase
* PostgreSQL
* React Hook Form
* Zod
* Recharts
* Framer Motion
* Lucide Icons

## 11. Current Implementation Status

Implemented production foundations now include:

* Authentication, onboarding, platform Super Admin organization bootstrap, organization lifecycle management, protected routes, RBAC, and RLS.
* Admin user management, shared team workspace, task management with detail pages, ideas with detail pages, content pipeline with detail pages, content reviews and scoring, calendar month/week/list views, reports with detail pages, CSV report export with activity logging, working hours, scoped dashboard summaries, dark mode, and modern dashboard shell.
* Notifications with header dropdown, global search as a standalone page, comments, mentions, attachments, saved views, content templates, organization settings and branding, profile management, dashboard customization under `/settings/preferences`, and Supabase Storage buckets.
* Role dashboards are private productivity spaces for the signed-in user's own work. Team/company review queues live in scoped operational pages.
* Calendar is scheduling-only: task due dates, scheduled content, submitted day off/sick leave requests, and optional meetings. It does not show ideas, reports, work sessions, analytics events, or activity logs.
* Reports are generated from real task, content, work-hours, and time-off data, with optional user notes and preserved history.
* New operational workflow routes are server-rendered, permission-checked, company-scoped, team-boundary-aware, and backed by Supabase tables.
* Client workspace management is implemented with company-scoped clients, client assignments, client-linked tasks/ideas/content/reports/calendar entries, final Drive handoff links, and client-facing dashboards.

Still deferred:

* Background jobs.
* Advanced role/permission editing UI.
* Real-time subscriptions.
* Activity log export.
