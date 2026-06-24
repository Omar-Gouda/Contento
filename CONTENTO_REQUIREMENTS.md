## 1. Project Vision

Contento is a multi-company SaaS platform for managing content operations, creators, approvals, reporting, scheduling, and performance tracking.

The platform helps companies organize their content workflow between admins, supervisors, team leads, and creators from one centralized dashboard.

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

### Admin

Full control over the company workspace.

Permissions:

* Manage users
* Manage roles
* View all dashboards
* Manage company settings
* Review all activity logs
* Export reports
* Access analytics
* Approve/reject major actions

### Supervisor

Responsible for monitoring team performance and approvals.

Permissions:

* View team dashboards
* Review creator submissions
* Approve or reject content
* Track reports
* View analytics
* Add feedback
* Monitor team activity

### CC Team Lead

Responsible for managing content/customer-care team workflow.

Permissions:

* Assign tasks to creators in own assigned team
* Review own-team submitted content
* Track daily work
* View assigned team reports
* Manage content schedules
* Send own-team approved submissions to supervisor review
* Escalate issues to supervisor/admin

### Creator

Responsible for creating and submitting work.

Permissions:

* Create ideas
* Submit content
* View assigned tasks
  View Task Progress
* Update task status
* Submit reports
* View personal performance
* Access content calendar

## 5. Core Modules

* Authentication
* Company workspace management
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
* Settings
* Exporting data

## 6. Main Pages

### Public Pages

* Landing page
* Sign in
  Forgot password

### Shared App Pages

* Dashboard
* Profile
* Notifications
* Settings

### Admin Pages

* Admin dashboard
* Users management
* Roles and permissions
* Company settings
* Analytics
* Activity logs
* Reports
* Exports

### Supervisor Pages

* Supervisor dashboard
* Team performance
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

### Creator Pages

* Creator dashboard
* My tasks
* Ideas
* Content submissions
* Calendar
* My reports
* Performance

## 7. Main Workflows

### Content Workflow

1. Creator creates idea or content draft.
2. Creator submits content to CC Team Lead review.
3. CC Team Lead reviews own-team submissions and either requests changes or sends content to Supervisor review.
4. Supervisor approves, rejects, or requests changes.
5. Admin can monitor and override inside company scope.
6. Approved content moves to calendar/scheduled state.
7. Reports and analytics are updated.

### User Management Workflow

1. Admin invites user.
2. User joins company workspace.
3. Admin assigns role.
4. User sees dashboard based on role.

### Review Workflow

1. Creator submits content.
2. CC Team Lead adds feedback and optional rating for own-team submitted content.
3. CC Team Lead requests changes or sends content to Supervisor review.
4. Supervisor adds feedback/rating and approves, rejects, or requests changes.
5. Activity is logged.

## 8. Data Requirements

The system should store:

* Companies
* Users
* Roles
* Permissions
* Teams
* Ideas
* Content items
* Reviews
* Reports
* Calendar events
* Activity logs
* Notifications
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

* Authentication, onboarding, superior-admin organization bootstrap, protected routes, RBAC, and RLS.
* Admin user management, shared team workspace, task management with detail pages, ideas with detail pages, content pipeline with detail pages, content reviews, calendar month/week/list views, reports with detail pages, CSV report export with activity logging, working hours, scoped dashboard summaries, dark mode, and modern dashboard shell.
* Role dashboards are private productivity spaces for the signed-in user's own work. Team/company review queues live in scoped operational pages.
* New operational workflow routes are server-rendered, permission-checked, company-scoped, team-boundary-aware, and backed by Supabase tables.

Still deferred:

* Advanced analytics charts.
* Notifications.
* Background jobs.
* Advanced role/permission editing UI.
