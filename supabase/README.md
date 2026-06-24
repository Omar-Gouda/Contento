# Contento Supabase Foundation

This folder contains the database foundation for Contento.

## Migrations

| File | Purpose |
| --- | --- |
| `migrations/202606230001_contento_phase_2_foundation.sql` | Creates the Phase 2 schema, enums, constraints, foreign keys, indexes, permission catalog, default company roles, RBAC helpers, and RLS policies. |
| `migrations/202606230002_contento_onboarding_rpc.sql` | Adds the authenticated first-workspace onboarding RPC that creates a company, owner profile, Admin role assignment, and company settings row. |
| `migrations/202606230003_contento_phase_3_users_work_hours.sql` | Adds user invitations, working-hours tables, work/break RPCs, Phase 3 work-hours permissions, and RLS policies. |
| `migrations/202606230004_contento_superior_admin.sql` | Adds platform-level superior admins and a superior-admin-only RPC for creating organizations and their first Org Admin account. |
| `migrations/202606230005_contento_phase_3_remaining_fixes.sql` | Adds `must_change_password`, forced-password RPC support, Cairo work-date helpers, corrected work/break calculations, missing-time rules, and active session uniqueness constraints. |
| `migrations/202606230006_contento_phase_4_to_10_workflows.sql` | Adds team lifecycle fields, task priority/team/comments, idea assignment/notes, content schedule timestamps, calendar links, workflow indexes, and RLS helper/policy updates. |
| `migrations/202606240001_contento_phase_4_shared_operations_completion.sql` | Adds shared operations completion fields for team creators, task assigners, idea/content/report team links, report ranges, permission aliases, indexes, and RLS policy updates. |
| `migrations/202606240002_contento_phase_4_scope_fix_review_flow.sql` | Adds Team Lead scope fixes, content handoff statuses, content ratings, `content.rate`, and tighter users/teams/tasks/content/review/rating RLS helpers and policies. |
| `migrations/202606240003_contento_phase_4_scope_policy_hardening.sql` | Adds explicit same-company link checks to team member, task, and content write policies. |
| `migrations/202606240004_contento_final_production_saas_readiness.sql` | Adds final production SaaS readiness: `platform_admins`, `platform_activity_logs`, organization disabled/deleted statuses, notifications, attachments, comments, mentions, saved views, content templates, dashboard preferences, review scoring, storage buckets, permissions, indexes, triggers, helper functions, and RLS policies. |

## RLS Policy Model

The migrations enable and force Row Level Security on Contento application tables.

Policy principles:

* Company-scoped tables are filtered through the authenticated user's active `company_id`.
* `permissions` is a global read-only catalog for authenticated users.
* `role_permissions` includes an `access_level` so Full Access, Limited Access, and View Only can be represented without hardcoding access in application code.
* Helper functions such as `current_company_id()`, `has_role()`, `has_permission()`, and entity-scope helpers are used by policies and application code.
* First-workspace onboarding uses a narrow `SECURITY DEFINER` RPC because a signed-in user without a Contento profile cannot pass tenant RLS for direct table inserts.
* Work-hours writes are performed through authenticated RPCs so sign-in, sign-out, and break rules stay database-consistent.
* Platform admins are stored outside company membership and can only operate through platform-specific routes, helpers, and server-side actions.
* Organization lifecycle policies allow platform admins to view and update organization status while company users remain scoped to their own active company.
* Admin-created users are created through server-only Supabase Auth code, then linked to `users` with `must_change_password = true`.
* Workflow pages use server actions that resolve `company_id` from the authenticated profile and let RLS enforce tenant boundaries.
* Task, idea, content, report, comments, mentions, and attachment visibility use scope helpers so Admins stay company-wide, Supervisors and Team Leads stay team-scoped, and Creators stay own-scope.
* Notifications are readable and updateable only by their recipient inside the same company.
* Saved views and dashboard preferences are private to the owning user.
* Content templates are company-scoped; active templates can be used by permitted creators, while management requires template permissions.
* `contento-attachments` and `contento-avatars` storage buckets use company/user folder policies.
* Report CSV export is server-side and requires `exports.reports`.
* Service-role access should remain server-only and must never be exposed to the browser.

## Working-Hours Rules

* A work day starts when an active company user signs in.
* `work_days.work_date` is derived from `Africa/Cairo`, while timestamps remain `timestamptz`.
* Sign-out closes the active work session and updates daily totals.
* Users can start one break at a time only while a work session is active.
* Daily break allowance is 90 minutes by default and can be configured in company settings.
* Break time over the allowance is counted as missing time.
* Missing time also uses a 480-minute default expected work target after sign-out unless company settings override it.
* `break_sessions` remain reviewable history for users and Admins.

## Storage

The final production migration creates these Supabase Storage buckets:

| Bucket | Purpose |
| --- | --- |
| `contento-attachments` | Private task, idea, content, and report attachments. Paths are company-scoped. |
| `contento-avatars` | Private user avatar uploads. Paths are company and user scoped. |

Do not make these buckets public unless the access model is deliberately redesigned.

## Applying Migrations

Use the Supabase CLI or a trusted database migration pipeline to apply migrations:

```bash
supabase db push --linked
supabase db lint --linked
```

Do not store database passwords or service-role keys in this repository.
