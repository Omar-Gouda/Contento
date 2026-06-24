# Contento Auth Flow

This document describes the implemented and planned authentication and authorization flow for Contento. The current foundation uses Supabase Auth, Contento profile resolution, company-scoped RBAC, first-company onboarding, Admin direct user creation, forced first-login password changes, working-hours session tracking, operational workflow modules, and a platform-level superior-admin path.

## 1. Auth Flow Goals

Contento authentication must support a secure multi-company SaaS model where each company user is connected to one company workspace and one role.

Primary goals:

* Use Supabase Auth for identity.
* Store Contento company-user profile, role, status, and company scope in `users`.
* Protect dashboard routes with middleware and server-side profile resolution.
* Redirect users to the correct role dashboard.
* Enforce tenant isolation through application checks and RLS.
* Support password reset, first-company onboarding, and Admin-created users.
* Force Admin-created users to change temporary passwords before dashboard access.
* Track working-hours sign-in and sign-out events without weakening authentication.
* Support superior-admin organization bootstrap outside tenant workspaces.

## 2. Core Concepts

| Concept | Description |
| --- | --- |
| Supabase Auth User | The identity record managed by Supabase Auth. |
| Contento User Profile | The application record in `users` that stores company, role, profile, and status. |
| Company | The tenant workspace that owns business data. |
| Role | Admin, Supervisor, CC Team Lead, or Creator. |
| Permission | A product capability assigned to a role through `role_permissions`. |
| Session | The authenticated Supabase session used by the app. |
| Superior Admin | A platform operator account that can create organizations and their first Org Admin without joining a tenant. |

The Supabase Auth user confirms identity. The Contento `users` row confirms workspace access, role, company, and operational status. Superior admins are resolved separately through `superior_admins`.

## 3. Auth-Related Routes

| Route | Purpose | Status |
| --- | --- | --- |
| `/sign-in` | User sign in. | Implemented in Phase 2. |
| `/forgot-password` | Request password reset. | Implemented in Phase 2. |
| `/reset-password` | Complete Supabase password reset. | Implemented in Phase 2. |
| `/change-password` | Required password change for Admin-created users. | Implemented in Phase 3 fixes. |
| `/onboarding` | First authenticated user creates the company workspace and Admin profile. | Implemented in Phase 2.5. |
| `/account-inactive` | Signed-in account exists but cannot access dashboards because status or role resolution is not active. | Implemented in Phase 2.5. |
| `/admin` | Admin dashboard. | Protected in Phase 2. |
| `/supervisor` | Supervisor dashboard. | Protected in Phase 2. |
| `/team-lead` | CC Team Lead dashboard. | Protected in Phase 2. |
| `/creator` | Creator dashboard. | Protected in Phase 2. |
| `/profile/work-hours` | Current user's work-hours view and break controls. | Implemented in Phase 3. |
| `/admin/users` | Admin company user management. | Implemented in Phase 3. |
| `/admin/invitations` | Redirects to Admin user management. | Disabled in Phase 3 fixes. |
| `/admin/work-hours` | Admin company work-hours view. | Implemented in Phase 3. |
| `/super-admin/organizations` | Superior-admin organization and first Org Admin creation. | Implemented in Phase 3. |
| `/admin/teams` | Admin team creation, editing, archiving, lead assignment, and member assignment. | Implemented in Phase 4-10 workflow foundation. |
| `/tasks` | Shared task management for permitted users. | Implemented in Phase 4-10 workflow foundation. |
| `/admin/tasks` | Admin company-wide task management. | Implemented in Phase 4-10 workflow foundation. |
| `/ideas` | Shared idea management for permitted users. | Implemented in Phase 4-10 workflow foundation. |
| `/admin/ideas` | Admin company-wide idea management. | Implemented in Phase 4-10 workflow foundation. |
| `/content` | Content pipeline creation, submission, and scheduling. | Implemented in Phase 4-10 workflow foundation. |
| `/content/reviews` | Content review, approval, rejection, feedback, and change requests. | Implemented in Phase 4-10 workflow foundation. |
| `/calendar` | Monthly and weekly content/work/day-off calendar. | Implemented in Phase 4-10 workflow foundation. |
| `/reports` | Report submission and review. | Implemented in Phase 4-10 workflow foundation. |
| `/reports/export` | Permission-checked CSV report export. | Implemented in Phase 4-10 workflow foundation. |

## 4. User Statuses

| Status | Meaning |
| --- | --- |
| Invited | User has been invited but has not completed setup. |
| Active | User can access the company workspace. |
| Suspended | User is temporarily blocked from access. |
| Disabled | User is blocked from access and should not appear in active workflows. |

Only `Active` company users should access protected company routes.

## 5. Role Redirect Map

| Role | Default Route |
| --- | --- |
| Admin | `/admin` |
| Supervisor | `/supervisor` |
| CC Team Lead | `/team-lead` |
| Creator | `/creator` |
| Superior Admin | `/super-admin/organizations` |

If a signed-in company user visits the wrong role dashboard, the app redirects to the user's default route unless the user has valid permission for that route.

## 6. Sign In Flow

```txt
User opens /sign-in
  |
  v
User submits email and password
  |
  v
Supabase Auth validates credentials
  |
  v
App resolves superior_admins or Contento users profile
  |
  v
Missing company profile attempts pending invitation acceptance
  |
  v
Active company user records or reuses today's work session
  |
  v
User with must_change_password goes to /change-password
  |
  v
App redirects user to the correct dashboard
```

Expected behavior:

* Invalid credentials show a generic sign-in error.
* Active superior admins redirect to `/super-admin/organizations`.
* Missing Contento profile first attempts to accept a pending invitation matching the authenticated email.
* Missing Contento profile with no pending invitation redirects to `/onboarding`.
* Suspended, disabled, invited, or incomplete profiles redirect to `/account-inactive`.
* Active users with `must_change_password = true` redirect to `/change-password`.
* Active company users redirect based on role.
* All protected data reads after sign in remain company-scoped.
* Work-hours tracking failures are logged safely and do not block sign in unless the failure indicates a security problem.

## 7. First Company Onboarding Flow

```txt
Authenticated user has no Contento profile
  |
  v
User opens /onboarding
  |
  v
User submits company name, company slug, first name, and last name
  |
  v
Database RPC creates company, default roles, company settings, and active Admin profile
  |
  v
App records the first work session
  |
  v
User redirects to /admin
```

Rules:

* User must be authenticated through Supabase Auth.
* User must not already have a Contento profile.
* Company slug must be unique.
* The created profile id must match the Supabase Auth user id.
* The created user is assigned the company Admin role.

## 8. Admin Direct User Creation Flow

Admin user creation is the active Phase 3 user onboarding path.

```txt
Admin opens /admin/users
  |
  v
Admin enters email, first name, last name, role, optional team, status, temporary password, and confirmation
  |
  v
Server action validates Admin permission and company-scoped role/team
  |
  v
Server-only Supabase service-role client creates Auth user
  |
  v
Contento creates users profile in Admin company with must_change_password = true
  |
  v
New user signs in with temporary password
  |
  v
New user is forced to /change-password before dashboard access
```

Rules:

* Service-role credentials are used only in trusted server code.
* Temporary passwords are not logged and are not stored in Contento tables.
* The browser never provides `company_id`.
* The selected role and team must belong to the Admin company.
* If profile creation fails, the server action deletes the created Auth user.

## 9. Forced Password Change Flow

```txt
Admin-created user signs in
  |
  v
App resolves active profile with must_change_password = true
  |
  v
Middleware and server context block protected dashboards
  |
  v
User submits new password on /change-password
  |
  v
Supabase Auth password is updated
  |
  v
Database RPC clears must_change_password
  |
  v
User redirects to role dashboard
```

Rules:

* `/change-password` requires authentication.
* Users who do not need a password change are redirected to their role dashboard.
* Clearing the flag uses `clear_current_user_must_change_password()` so broad self-profile updates are not exposed.

## 10. Invitation Acceptance Flow

Invitation tables and RPC support exist from the earlier Phase 3 foundation, but invitation UI is disabled for now. `/admin/invitations` redirects to `/admin/users`.

```txt
Admin invites user
  |
  v
System creates user_invitations row with company_id, role_id, optional team_id, token_hash, status, and expiry
  |
  v
Supabase sends invitation email
  |
  v
Invited user accepts and signs in
  |
  v
App accepts matching pending invitation server-side
  |
  v
System creates active Contento profile with assigned role and optional team membership
  |
  v
User redirects to role dashboard
```

Rules:

* Only Admin can invite users by default.
* Invited users must belong to the Admin's company.
* Role assignment must use a role owned by the same company.
* New users do not choose their own company or role.
* The browser is not trusted to provide `company_id`.
* Pending invitation acceptance must match the authenticated Supabase email.
* Expired or cancelled invitations must not create profiles.

## 11. Logout Flow

```txt
User clicks logout
  |
  v
App closes active work session when possible
  |
  v
Supabase session is cleared
  |
  v
App redirects to /sign-in
```

Expected behavior:

* Clear the Supabase session.
* Clear protected UI state.
* Redirect away from dashboard routes.
* Do not leave company data in client state after logout.
* If a break is active, the app keeps the user signed in and redirects to work-hours controls so the break can be ended first.

## 12. Protected Route Flow

```txt
Request protected route
  |
  v
Middleware checks Supabase session
  |
  v
No session -> redirect to /sign-in
  |
  v
Session exists -> resolve superior-admin account or Contento profile
  |
  v
Inactive profile -> block or account inactive
  |
  v
Role mismatch -> redirect to correct dashboard
  |
  v
Render protected route with scoped data
```

Protected route responsibilities:

* Require authentication.
* Resolve active superior-admin account for `/super-admin`.
* Resolve active Contento user profile for company routes.
* Resolve company context, role, and permissions.
* Block dashboard access while `must_change_password = true`.
* Render only role-appropriate and company-scoped data.
* Redirect unauthorized users.

## 13. Middleware Responsibilities

Middleware stays focused and lightweight:

* Refresh Supabase auth session.
* Redirect unauthenticated users away from protected routes.
* Redirect authenticated users away from auth pages when appropriate.
* Redirect active superior admins to `/super-admin/organizations`.
* Redirect active company users according to role.
* Redirect active company users with `must_change_password = true` to `/change-password`.
* Avoid large dashboard queries, analytics, exports, or workflow writes.

Detailed permission checks still happen server-side after profile resolution.

## 14. Profile Resolution Flow

```txt
Supabase session user id
  |
  v
Check superior_admins.id for active platform access
  |
  v
If not superior admin, find users.id
  |
  v
Load company_id, role_id, status
  |
  v
Load roles row
  |
  v
Load role_permissions and permission keys
  |
  v
Return auth context to server-side route/action
```

Company-user auth context includes:

* `user_id`
* `company_id`
* `role`
* `status`
* `must_change_password`
* `permissions`

Superior-admin context includes only the platform account id, email, and status. It does not include `company_id`, role permissions, or tenant membership.

## 15. Authorization Flow

```txt
Authenticated action requested
  |
  v
Resolve auth context
  |
  v
Check user status
  |
  v
Check company scope or superior-admin scope
  |
  v
Check permission key
  |
  v
Check ownership or team scope if needed
  |
  v
Allow or deny action
```

Examples:

| Action | Required Checks |
| --- | --- |
| Create user | Active Admin, same company, `users.invite`. |
| Manage company user | Active Admin, same company, `users.manage`. |
| View own working hours | Active user, own user id, `work_hours.view_own`. |
| View company working hours | Active Admin, same company, `work_hours.view_company`. |
| Create organization | Active superior admin, no company context accepted from browser. |
| Assign task | Active Admin, Supervisor, or CC Team Lead with task assignment permission and same company. |
| Submit content | Active Creator or permitted role, own or assigned task, same company. |
| Approve content | Active Admin or Supervisor, same company, `reviews.approve`. |
| Export reports | Active Admin or permitted Supervisor, same company, export permission. |
| Manage teams | Active Admin, same company, `teams.create` and `teams.assign_members`. |
| Comment on task | Active user with task visibility in the same company. |
| Schedule content | Active user with `calendar.schedule_content`, approved content in the same company. |
| Submit report | Active user with `reports.submit`, own or permitted team/company context. |

## 16. Company Isolation Flow

Every protected read or write must resolve `company_id` from the authenticated user's profile.

```txt
Authenticated company user
  |
  v
Load users.company_id
  |
  v
Query or write company-scoped records using resolved company_id
  |
  v
RLS confirms row company_id matches authenticated user's company
```

Company isolation rules:

* Do not accept `company_id` from client forms.
* Do not expose cross-company queries to company users.
* Do not allow Admins to access another company.
* Ensure join tables connect records from the same company.
* Use RLS as a database-level safety net.

## 17. Superior Admin Flow

```txt
Superior admin signs in
  |
  v
App resolves superior_admins.id
  |
  v
Active superior admin redirects to /super-admin/organizations
  |
  v
Superior admin submits company and first Org Admin fields
  |
  v
Server-only action creates Supabase Auth user for Org Admin
  |
  v
Database RPC creates company, roles, company settings, active Org Admin profile, and owner link
```

Rules:

* Superior admins are not company users.
* Superior admins cannot access tenant dashboards unless they also have a separate Contento profile.
* Organization creation must happen through trusted server code and the superior-admin-only RPC.
* The first Org Admin becomes the company owner.

## 18. Working-Hours Auth Integration

Working-hours tracking is connected to sign-in and sign-out:

* Sign in finds or creates today's `work_days` row for the active user using the `Africa/Cairo` work date.
* Sign in sets `first_sign_in_at` when missing.
* Sign in creates a `work_sessions` row only when no active session exists.
* Sign out closes the active `work_sessions` row, updates `last_sign_out_at`, and recalculates totals.
* Breaks must be explicitly ended before sign out.
* Break allowance is 90 minutes per day; excess break time is counted into missing time.
* Missing time also uses a documented 480-minute default target after sign-out.
* Break history remains reviewable through saved `break_sessions`.

## 19. RLS Role In Auth

Supabase Row Level Security enforces the same company isolation rules described in the database schema.

RLS responsibilities:

* Restrict company-scoped rows by authenticated user's company.
* Restrict user profile access by role and ownership.
* Restrict working-hours records to the owner or Admins in the same company.
* Clear `must_change_password` through a narrow authenticated RPC.
* Restrict superior-admin reads to the matching superior-admin account.

RLS does not replace application authorization entirely. The app still checks permissions before sensitive workflow actions.

## 20. Auth Error States

| Scenario | Expected Response |
| --- | --- |
| No session on protected route | Redirect to `/sign-in`. |
| Invalid credentials | Show generic sign-in failure. |
| Missing Contento profile | Accept pending invitation or redirect to `/onboarding`. |
| Invited but incomplete setup | Continue invitation flow or show account state. |
| Suspended user | Block access and show workspace access unavailable. |
| Disabled user | Block access and sign out if needed. |
| Missing role | Block access and ask Admin to assign role. |
| Missing company | Block access and ask Admin or support to fix workspace. |
| Unauthorized role route | Redirect to correct dashboard or show unauthorized state. |
| Permission denied | Show no-access state without exposing private data. |
| Active break during sign out | Keep the user signed in and redirect to work-hours controls. |
| Must change password | Redirect to `/change-password` before dashboard access. |
| Suspended superior admin | Block access and redirect to account inactive. |

## 21. Security Rules

* Supabase service-role key must never be exposed to the browser.
* Public Supabase anon key is allowed in browser code because RLS protects data.
* Only active users should access dashboards.
* Password reset responses should not reveal whether an email exists.
* Auth pages should not load company data.
* Protected pages should not render until company and role context is resolved.
* Permission failures should not reveal another company's data.
* Session refresh should happen consistently for protected routes.
* User status changes should take effect quickly.
* Temporary passwords must not be logged or stored in Contento tables.
* Admin-created users must change temporary passwords before dashboard access.
* Superior admins must not be treated as tenant users.
* User creation and superior-admin operations that require service-role access must remain server-only.

## 22. Phase Alignment

| Roadmap Phase | Auth Work |
| --- | --- |
| Phase 2 | Supabase authentication, user profiles, companies, role system, protected routes, role redirects, middleware protection. |
| Phase 2.5 | First-company onboarding, first Admin profile creation, active/inactive profile routing. |
| Phase 3 | Admin user creation, forced password change, working-hours auth integration, superior-admin organization bootstrap, dark-mode-aware app shell. |
| Phase 4 | Role-aware navigation and operational dashboard shortcuts. |
| Phase 5 | Teams, tasks, ideas, content pipeline, and reviews protected by role permissions. |
| Phase 6 | Reports and CSV export protected by report/export permissions. |
| Phase 7 | Notifications and expanded activity-log UI tied to workflow actions. |
| Phase 9 | Security policies, error handling, testing, deployment readiness. |

## 23. Current Foundation Boundary

The current foundation includes real Supabase authentication, password reset, protected routes, role redirects, database migrations, RLS policies, first-company onboarding, Admin direct user creation, forced password change, working-hours tracking, dark mode, superior-admin organization bootstrap, Teams, Tasks, Ideas, Content, Calendar, and Reports.

It should not yet include:

* Advanced analytics dashboard charts.
* Notifications.
* Background jobs.
* Advanced role/permission editing UI.

Those items continue in later roadmap phases.
