# TODO - Contento Phase 3 Fixes

## Step 1 - Repo Understanding

- [x] Inspect sidebar/navigation component
- [x] Inspect auth context and routing guards
- [x] Inspect work-hours UI/actions/queries baseline
- [x] Inspect Phase 3 database migrations

## Step 2 - Navigation Role Fix

- [x] Ensure only role-allowed sidebar workspace/dashboard links render
- [x] Ensure active route state still works
- [x] Ensure direct role-dashboard access is protected

## Step 3 - Admin Direct User Creation

- [x] Disable/redirect invitation UI routes
- [x] Build server-only Admin user creation under `/admin/users`
- [x] Ensure created users are scoped to Admin `company_id`
- [x] Ensure Supabase Auth user creation is server-only and permission-validated
- [x] Add temporary password and confirm temporary password fields
- [x] Store `must_change_password = true` without storing the temporary password

## Step 4 - Forced Password Change

- [x] Add `/change-password`
- [x] Require authentication for password changes
- [x] Block protected dashboard access while `must_change_password = true`
- [x] Update Supabase Auth password
- [x] Clear `must_change_password` through a narrow database RPC

## Step 5 - Cairo Timezone Correctness

- [x] Add reusable Cairo date/time helpers in TypeScript
- [x] Patch database RPCs to compute `work_date` using `Africa/Cairo`
- [x] Patch UI date grouping and display to use Cairo timezone

## Step 6 - Working-Hours Accuracy

- [x] Fix sign-in: create today's `work_day` by Cairo date, prevent duplicate active sessions, set `first_sign_in_at` once
- [x] Fix sign-out: close session, set `duration_minutes`, recalculate totals
- [x] Fix break start/end: enforce one active break and persist `duration_minutes`
- [x] Track break overage as missing time
- [x] Add documented 480-minute default expected work target

## Step 7 - Reviewable Break History

- [x] Ensure break history query includes start/end/duration/work_date/user name
- [x] Render break history for current user
- [x] Render break history for Admin

## Step 8 - Database Fixes

- [x] Add `must_change_password`
- [x] Add active session uniqueness constraint
- [x] Add active break uniqueness constraint
- [x] Ensure `work_days` totals recalculate after relevant mutations

## Step 9 - Documentation

- [x] Update README
- [x] Update Supabase README
- [x] Update current features
- [x] Update database schema
- [x] Update permission matrix
- [x] Update auth flow

## Step 10 - Validation

- [x] Run `npm run lint`
- [x] Run `npm run build`
