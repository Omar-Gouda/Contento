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
| `migrations/202606240005_contento_product_review_corrections.sql` | Adds time-off request type/review metadata, time-off indexes, updated trigger, and scoped time-off RLS helper/policies for own/team/company visibility. |
| `migrations/202606250001_contento_client_revision.sql` | Adds client workspaces, client assignments, client-linked workflow fields, final Drive handoff fields, Graphic Designer / Video Editor / Client roles, client permissions, indexes, helper functions, and RLS policies. |
| `migrations/202606250002_contento_client_report_send_flow.sql` | Hardens report visibility so Client role users only read client-scoped reports after they are explicitly sent to the client workspace. |
| `migrations/202606300001_contento_client_permission_hotfix.sql` | Adds client create/update/delete/assignment permission hardening and client RLS fixes for Marketing Manager and Account Manager client management. |
| `migrations/202607010001_contento_ux_permission_chat_hotfix.sql` | Tightens report visibility for Account Manager scope, adds direct organization chat tables, helper functions, indexes, triggers, and chat RLS policies. |
| `migrations/202607020001_contento_client_contract_password_storage_hotfix.sql` | Adds client contract lifecycle fields, disabled/expired statuses, client expiry normalization, and a company-scoped client expiry RPC. |
| `migrations/202607030001_contento_performance_assignment_refresh_fix.sql` | Adds scoped client-assignment RLS helpers, client assignment indexes, and Account Manager same-team production assignment support. |
| `migrations/202607030002_contento_profile_stabilization.sql` | Adds user profile metadata, notification preferences, last-login/profile-completion timestamps, and narrow authenticated RPCs for self profile, avatar, notification preference, and login timestamp updates. |
| `migrations/202607030003_contento_push_subscription_foundation.sql` | Adds future-ready Web Push subscription storage with company/user-scoped RLS. Delivery still requires VAPID keys and a trusted sender. |
| `migrations/202607030004_contento_v7_recovery_and_org_hard_delete.sql` | Adds recovery-email profile fields/RPCs and a platform-admin-only transactional database RPC for permanent organization deletion. |
| `migrations/202607040001_contento_critical_ux_rbac_reports_hotfix.sql` | Adds work-hours/report/search/chat/avatar hotfixes and report generation access hardening. |
| `migrations/202607100001_contento_public_demo_mode.sql` | Adds public demo sandbox infrastructure and safe demo isolation. |
| `migrations/202607100002_contento_organization_requests.sql` | Adds public demo organization request submissions for Super Admin review. |
| `migrations/202607100003_contento_demo_action_tagging.sql` | Adds demo action tagging and cleanup support. |
| `migrations/202607100004_contento_subscription_billing.sql` | Adds subscription plans, organization subscription lifecycle, manual InstaPay payment receipts, billing events, trial blacklist, and private receipt storage. |

## RLS Policy Model

The migrations enable and force Row Level Security on Contento application tables.

Policy principles:

* Company-scoped tables are filtered through the authenticated user's active `company_id`.
* `permissions` is a global read-only catalog for authenticated users.
* `role_permissions` includes an `access_level` so Full Access, Limited Access, and View Only can be represented without hardcoding access in application code.
* Helper functions such as `current_company_id()`, `has_role()`, `has_permission()`, and entity-scope helpers are used by policies and application code.
* First-workspace onboarding uses a narrow `SECURITY DEFINER` RPC because a signed-in user without a Contento profile cannot pass tenant RLS for direct table inserts.
* Work-hours writes are performed through authenticated RPCs so explicit Clock In, Clock Out, and break rules stay database-consistent.
* Platform admins are stored outside company membership and can only operate through platform-specific routes, helpers, and server-side actions.
* Organization lifecycle policies allow platform admins to view and update organization status while company users remain scoped to their own active company.
* Permanent organization deletion is confirmation-gated in the app. The database portion runs in `hard_delete_organization_database()` for active platform admins; Supabase Auth user deletion and storage cleanup happen afterward in server-only code.
* Marketing Manager-created users are created through server-only Supabase Auth code, then linked to `users` with `must_change_password = true`.
* Self-profile updates use narrow authenticated RPCs instead of broad `users` table update policies.
* Recovery email updates use narrow authenticated RPCs. Direct Supabase Auth reset links still target the auth email, so recovery-email requests feed the internal Marketing Manager temporary-password flow until email-provider verification is implemented.
* Workflow pages use server actions that resolve `company_id` from the authenticated profile and let RLS enforce tenant boundaries.
* Task, idea, content, report, time-off, comments, mentions, and attachment visibility use scope helpers so Admins stay company-wide, Supervisors and Team Leads stay team-scoped, and Creators stay own-scope.
* Client workspace visibility is company-scoped and uses `clients`, `client_assignments`, `is_same_company_client()`, and `can_access_client_scope()` so client users only see assigned client workspaces and internal users remain inside company/team/client boundaries.
* Client-linked task, idea, content, report, and calendar policies validate that referenced clients belong to the same company before inserts or updates are allowed.
* Disabled and expired clients block Client-role portal access and new work creation while preserving internal historical visibility inside normal role scope.
* Client-role report visibility requires `reports.sent_to_client_at`; internal users with report access can prepare reports before sharing them with clients.
* Account Manager report visibility is scoped to assigned users, assigned teams, and assigned clients; Marketing Manager remains company-wide.
* Notifications are readable and updateable only by their recipient inside the same company.
* Push subscriptions are readable and writeable only by the owning user inside the same company; production delivery is not enabled until VAPID/server sending is added.
* Chat conversations and messages are company-scoped, participant-scoped, and optionally client-scoped for Client users and assigned Account Managers.
* Client assignments use `client_assignments`; Marketing Managers can manage company-wide assignments, while Account Managers can manage same-team production users on clients assigned to them.
* Saved views and dashboard preferences are private to the owning user.
* Content templates are company-scoped; active templates can be used by permitted creators, while management requires template permissions.
* `contento-attachments` and `contento-avatars` storage buckets use company/user folder policies. Avatar, organization logo, and client logo removal clears database paths and removes the private storage object when available.
* Profile avatar updates are restricted to the authenticated user's company/user storage prefix by `update_current_user_avatar()`.
* Report CSV export is server-side and requires `exports.reports`.
* Generated reports are stored as new historical rows based on live task, content, work-hours, and time-off data.
* Service-role access should remain server-only and must never be exposed to the browser.
* Subscription billing RLS keeps billing rows company-scoped for tenant users and platform-scoped for Super Admins. Billing writes are performed only by server-only actions with trusted service-role access so browser clients cannot spoof subscription state or receipt metadata.
* Read-only subscription states are enforced in application server actions because existing workflow tables remain readable under normal tenant RLS.

## Working-Hours Rules

* A work day starts when an active company user explicitly clocks in.
* `work_days.work_date` is derived from `Africa/Cairo`, while timestamps remain `timestamptz`.
* Clock Out closes the active work session and updates daily totals. Sign-out still performs a defensive close if an active session reaches the server.
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
| `contento-billing-receipts` | Private manual InstaPay receipt uploads. Paths are company and subscription scoped. |

Do not make these buckets public unless the access model is deliberately redesigned.

## Applying Migrations

Use the Supabase CLI or a trusted database migration pipeline to apply migrations:

```bash
supabase db push --linked
supabase db lint --linked
```

Backfill existing organizations that predate subscription billing without starting trials:

```bash
node scripts/backfill-missing-subscriptions.mjs --dry-run
node scripts/backfill-missing-subscriptions.mjs
```

The same operation is available to Super Admins from `/super-admin/billing` through **Backfill missing subscriptions**.

Do not store database passwords or service-role keys in this repository.
