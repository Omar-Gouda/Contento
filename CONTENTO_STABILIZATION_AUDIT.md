# Contento Stabilization Audit

Date: 2026-07-03

This is an audit-only report for the stabilization and UX simplification phase. No routes, auth logic, RLS policies, database objects, or feature code were deleted or changed as part of this audit.

## Audit Scope

Reviewed source-of-truth documentation:

- `CONTENTO_REQUIREMENTS.md`
- `CONTENTO_ROADMAP.md`
- `CONTENTO_CurrentFeatures.md`
- `CONTENTO_DATABASE_SCHEMA.md`
- `CONTENTO_PERMISSION_MATRIX.md`
- `CONTENTO_BACKEND_ARCHITECTURE.md`
- `CONTENTO_AUTH_FLOW.md`
- `README.md` where relevant

Reviewed implementation areas:

- App route tree under `src/app`
- Dashboard shell and navigation
- Auth redirect tree, proxy, and auth actions
- Profile, password, notification, work-hours, clients, workflows, reports, and calendar surfaces
- Server actions using redirects and revalidation
- PWA indicators in `src`, `public`, `README.md`, and `package.json`

## Executive Findings

Contento now has a wide feature surface. Most modules exist, but the app is carrying compatibility routes, redirected pages, duplicated operational routes, and server actions that often reload the current page. The main stabilization risk is not missing features; it is inconsistent interaction patterns across pages.

Highest priority findings:

1. Profile password change is currently routed through `/change-password`, but the auth redirect tree only allows `/change-password` when `must_change_password = true`. Normal active users clicking "Change password" from `/profile` are redirected away before they can use the form.
2. `/notifications` is documented as a notification center, but the current page redirects to the role dashboard. Notifications currently exist only as a header dropdown.
3. Several routes are legacy aliases or wrappers around the same surfaces. They should be kept temporarily but made canonical through a confirmed route policy.
4. Many server actions still redirect and revalidate the current page after small changes. This can make heavy pages feel slow or stale.
5. Detail pages for tasks, ideas, content, and reports load full collections and then find a single record. This is a performance risk as tenant data grows.
6. PWA home-screen support is not present. There is no manifest, service worker, app icon set, install prompt, or push subscription flow.
7. Notification sound exists as a browser-local setting, but mobile push notifications are not implemented.

## Route Inventory

### Public And Auth Routes

Keep as pages:

- `/`
- `/sign-in`
- `/forgot-password`
- `/reset-password`
- `/auth/callback`
- `/onboarding`
- `/account-inactive`
- `/organization-disabled`
- `/organization-unavailable`

Needs correction:

- `/change-password` currently serves forced password change only because active users without `must_change_password` are redirected by the central route tree. The profile password-change UX needs a separate allowed path or a profile-contained modal/action.

### Canonical Role Dashboards

Keep as pages:

- `/marketing-manager`
- `/account-manager`
- `/team-lead`
- `/content-creator`
- `/graphic-designer`
- `/video-editor`
- `/client`
- `/super-admin`
- `/super-admin/organizations`
- `/super-admin/organizations/[id]`

Legacy aliases to keep temporarily, then confirm redirect policy:

- `/admin`
- `/supervisor`
- `/creator`

These aliases are supported in `src/lib/auth/route-access.ts` and `src/types/roles.ts`, but the canonical product labels are Marketing Manager, Account Manager, and Content Creator.

### Shared Operational Pages

Keep as pages:

- `/clients`
- `/clients/[id]`
- `/tasks`
- `/tasks/[id]`
- `/ideas`
- `/ideas/[id]`
- `/content`
- `/content/[id]`
- `/reviews/ideas`
- `/reviews/content`
- `/calendar`
- `/reports`
- `/reports/[id]`
- `/reports/export`
- `/team`
- `/search`
- `/settings`
- `/profile`
- `/profile/work-hours`
- `/users/[id]`

Notes:

- `/reports/export` should remain an export endpoint or action route, not a navigation page.
- `/profile/work-hours` is useful as a full review page, while header work-hour actions should stay lightweight and avoid heavy current-page reloads.

### Admin And Management Pages

Keep as pages for now:

- `/admin/users`
- `/admin/teams`
- `/admin/work-hours`

Consolidation candidates:

- `/admin/tasks` wraps `TaskManagementSurface`, similar to `/tasks`, with stricter permission and copy.
- `/admin/ideas` wraps `IdeasSurface`, similar to `/ideas`, with stricter permission and copy.

Disabled or redirect-only:

- `/admin/invitations` redirects to `/admin/users`.
- `/content/reviews` redirects to `/reviews/content`.
- `/notifications` redirects to the role dashboard.

## Pages That Should Stay Pages

These pages represent real navigation destinations, long-lived records, or role entry points:

- Auth pages and account-state pages
- Canonical role dashboards
- Clients list and client detail
- Tasks list and task detail
- Ideas list and idea detail
- Content list and content detail
- Review queues
- Calendar
- Reports list and report detail
- Team workspace
- Admin users, teams, and work-hours
- Super Admin organization pages
- Profile, settings, search, and own work-hours

## Pages That Should Become Modals, Drawers, Or Actions

These flows should generally not require separate pages:

- Create/edit task
- Assign/reassign task
- Update task status
- Add task final output link
- Create/edit idea
- Review idea
- Create/edit content
- Submit/resubmit content
- Review/rate content
- Schedule content
- Generate report
- Report filters
- Send report to client
- Create/edit client profile fields where already on a client detail page
- Client assignment management
- Reset user password
- Edit current profile
- Upload/remove avatar/logo
- Request time off
- Mark notification read/all read
- Chat send message
- Save/remove saved views

Many of these already use sheets or inline forms. The stabilization goal should be to make this consistent everywhere: pages display information first; actions open in a sheet, drawer, dialog, or compact form and return a result without unnecessary full-page reloads.

## Duplicated Or Redirected Pages

Confirmed duplicates or route aliases:

- `/admin` and `/marketing-manager`
- `/supervisor` and `/account-manager`
- `/creator` and `/content-creator`
- `/admin/tasks` and `/tasks`
- `/admin/ideas` and `/ideas`
- `/content/reviews` and `/reviews/content`
- `/admin/invitations` and `/admin/users`

Confirmed route behavior mismatch:

- `/notifications` is documented as implemented, but current code redirects to the role dashboard.

Recommended policy:

1. Pick one canonical URL per user-facing concept.
2. Keep legacy URLs as redirects during transition.
3. Remove legacy links from navigation.
4. Do not delete route files until usage is confirmed through logs or stakeholder approval.

## Broken Or High-Risk UX Findings

### Password Change From Profile Is Blocked

Files involved:

- `src/app/(dashboard)/profile/page.tsx`
- `src/app/(auth)/change-password/page.tsx`
- `src/lib/auth/route-access.ts`
- `src/components/forms/change-password-form.tsx`

Current behavior:

- `/profile` links to `/change-password`.
- `getRedirectPathForAuthState()` redirects active users without `mustChangePassword` away from `/change-password`.
- Result: normal active users cannot use the profile password-change form.

Recommended fix after approval:

- Keep forced password change at `/change-password`.
- Add a profile-contained password-change sheet or a separate protected route such as `/profile/security`.
- Do not weaken the forced password-change redirect rules.

### Notifications Page Is Not A Notification Center

Files involved:

- `src/app/(dashboard)/notifications/page.tsx`
- `src/components/layout/notification-menu.tsx`
- `src/lib/notifications/actions.ts`
- `src/lib/notifications/queries.ts`

Current behavior:

- The header dropdown shows recent notifications.
- `/notifications` redirects to the role dashboard.
- Mark-read actions redirect and revalidate paths.

Recommended fix after approval:

- Either remove `/notifications` from documentation/navigation and keep notifications header-only, or implement the page as a real notification center.
- Convert mark-read actions used from the header into result-returning actions so the current page does not reload.

### Account Inactive Page Is Overloaded

Files involved:

- `src/lib/auth/route-access.ts`
- `src/lib/auth/context.ts`
- `src/proxy.ts`
- `src/app/(auth)/account-inactive/page.tsx`

Current behavior:

- Inactive, incomplete profile, and unresolved profile states all route to `/account-inactive`.
- This makes true inactive accounts and backend/profile-resolution failures look similar.
- `src/proxy.ts` still contains an account-inactive debug `console.warn`.

Recommended fix after approval:

- Keep the security block.
- Split display copy by query/state where possible.
- Remove or guard noisy debug logging after diagnosing the current tenant state.

### No Standalone Not Found Pages

Current state:

- A dashboard error boundary exists at `src/app/(dashboard)/error.tsx`.
- No `not-found.tsx` files were found.

Recommended fix after approval:

- Add app-level and dashboard-level not-found pages so broken links fail gracefully.

## Actions That Cause Heavy Reloads

Work-hours header actions were recently corrected to return result objects and targeted revalidation.

Other action areas still commonly redirect and revalidate:

- `src/lib/workflows/actions.ts`
  - `safeRedirect()` revalidates `"/", "layout"` and the destination before redirecting.
  - Used for teams, tasks, ideas, content, reviews, time off, and reports.
- `src/lib/clients/actions.ts`
  - `safeRedirect()` revalidates layout and destination.
  - Assignment changes revalidate several pages: `/clients`, client detail, `/admin/users`, user detail, `/team`, and `/admin/teams`.
- `src/lib/notifications/actions.ts`
  - `revalidateNotificationPaths()` revalidates layout, `/notifications`, and the current pathname.
  - Header mark-read actions can reload the current heavy page.
- `src/lib/chat/actions.ts`
  - Revalidates layout and current path before redirecting.
- `src/lib/collaboration/actions.ts`
  - Redirects back to the current page after comment and attachment operations.
- `src/lib/saved-views/actions.ts`
  - Redirects back to the current filtered page.

Recommended action policy:

1. Header/global actions should never redirect to the current heavy page.
2. Small inline actions should return `{ success, message }` and let the client update local state or call a targeted `router.refresh()`.
3. Page-level mutations can revalidate the current route only when the page data actually changes.
4. Prefer `revalidatePath("/", "layout")` only for shell state changes.
5. Avoid passing arbitrary `redirectTo` into actions without sanitizing module boundaries.

## Slow Or Scaling-Risk Pages

Known or likely slow surfaces:

- Role dashboards call `getDashboardSections()` which loads clients, tasks, ideas, content, reports, and notifications in parallel.
- `src/app/(dashboard)/layout.tsx` fetches unread notification count, recent notifications, branding, chat data, and current work hours for every dashboard page.
- Detail routes use collection loaders:
  - `getWorkflowTaskById()` loads all visible tasks, then finds one.
  - `getWorkflowIdeaById()` loads all visible ideas, then finds one.
  - `getWorkflowContentById()` loads all visible content, then finds one.
  - `getWorkflowReportById()` loads all visible reports, then finds one.
- `getWorkflowContentReviews()` and `getWorkflowContentRatings()` still call `getWorkflowContent(context)` even when `contentIds` are provided.
- Large UI files increase maintenance risk:
  - `src/app/(dashboard)/clients/[id]/page.tsx`
  - `src/components/calendar/contento-calendar.tsx`
  - `src/components/dashboard/content-surface.tsx`
  - `src/lib/workflows/actions.ts`
  - `src/lib/workflows/queries.ts`
  - `src/lib/clients/actions.ts`

Recommended performance policy:

1. Detail pages should query by ID plus scope, not load a full list.
2. Layout should fetch only data that is needed to draw the shell immediately.
3. Chat, notifications, and work-hours can be split into lightweight islands with their own refresh behavior.
4. Dashboard previews should use count/summary queries, not broad module queries.
5. Keep loading skeletons, but do not use them to hide avoidable full-page data work.

## Auth, Password, And Profile Flow

Implemented:

- Supabase sign in
- Forgot password
- Reset password via `/auth/callback?next=/reset-password`
- Forced first-login password change
- Onboarding
- Organization disabled/unavailable states
- Profile editing for first and last name
- Avatar upload/removal through private storage paths and signed URLs

Needs stabilization:

- Normal active user password change from profile is blocked by route rules.
- Profile is limited to name, email, avatar, role, team, status, created date, and work-hours link.
- Profile does not yet include user notification preferences beyond browser-local sound.
- Profile does not expose contact details, timezone preference, device/session management, or push notification preference.
- Account inactive/unresolved states need clearer copy and diagnostics.

Recommended profile completion scope:

- Profile identity: avatar, first name, last name, email display.
- Security: change password in a profile-owned sheet or `/profile/security`.
- Preferences: theme is already global; add notification sound and push preferences in profile/settings.
- Work: team, role, status, and work-hours summary should remain read-only unless changed by permitted managers.

## Notification Flow

Implemented:

- Database-backed notifications.
- Header unread count.
- Header recent notification dropdown.
- Mark one/all as read.
- Browser-local sound preference.
- In-app notification creation from workflows and mentions.

Missing or incomplete:

- No real `/notifications` center page.
- No realtime subscriptions.
- No Web Push subscription storage.
- No service worker push handling.
- No notification permission prompt.
- No mobile push support.
- Mark-read actions can reload heavy current pages.

Recommended stabilization:

1. Decide whether `/notifications` is a full page or header-only.
2. Convert header mark-read actions to result-returning client calls.
3. Add notification preferences in profile/settings.
4. Add Web Push only after PWA manifest and service worker foundation exists.

## Mobile UX

Implemented:

- Mobile drawer navigation.
- Mobile bottom navigation.
- Collapsible desktop sidebar.
- Sheets for many large forms and filters.
- Calendar month grid has recently been stabilized for mobile.

UX risks:

- Too many navigation destinations compete for five bottom-nav slots.
- Legacy/dashboard aliases increase route confusion.
- Some large detail pages contain many action sections and can feel heavy on mobile.
- Header contains multiple controls: theme, notifications, work hours, chat, sign out. On small screens this can become cramped.
- Tables and management pages need consistent card-first mobile presentation.

Recommended mobile simplification:

1. Keep bottom nav to Dashboard, Clients or Work, Calendar, Reports, Profile based on role.
2. Put secondary destinations inside the drawer only.
3. Move create/edit/review actions into sheets with consistent full-screen mobile treatment.
4. Keep filters collapsed by default with chips visible.
5. Avoid redirecting small actions because mobile users feel full reloads more strongly.

## PWA Readiness

Current state:

- `package.json` has no PWA dependency.
- `public` appears empty.
- No manifest file found.
- No service worker file found.
- No app icons found.
- No `theme-color`, `apple-touch-icon`, or install prompt code found.
- No push subscription code found.

Recommended PWA foundation:

1. Add `manifest.webmanifest` with app name, short name, colors, display mode, start URL, and icons.
2. Add app icons and Apple touch icon.
3. Add metadata links in the root layout.
4. Add a service worker only after deciding whether offline caching and Web Push are in scope.
5. Add push subscriptions and VAPID/server handling only after notification preference UX is confirmed.

## Navigation Simplification Proposal

Canonical top-level groups:

- Dashboard
- Clients
- Work
- Reviews
- Reports
- Team
- Management
- Settings

Recommended route policy:

- Use canonical role dashboard paths only in navigation.
- Keep legacy role paths as silent redirects until logs prove they are unused.
- Merge `/admin/tasks` and `/admin/ideas` into saved/filter views inside `/tasks` and `/ideas`, or keep them as hidden direct links for Marketing Manager only.
- Remove `/admin/invitations` from navigation and keep it redirecting while invitations are disabled.
- Either restore `/notifications` as a real center or remove it as a page concept.

## Suggested Stabilization Phases

### Phase A - Confirm Route Policy

- Confirm canonical dashboard URLs.
- Confirm whether `/notifications` should exist as a page.
- Confirm whether `/admin/tasks` and `/admin/ideas` remain standalone management pages.
- Confirm how long legacy aliases stay.

### Phase B - Fix Known User Flow Bugs

- Fix profile password-change flow without weakening forced password-change security.
- Clarify account-inactive/incomplete/unresolved states.
- Remove or guard temporary proxy/debug logs.
- Add not-found pages.

### Phase C - Standardize Actions

- Convert header notification and chat actions to result-returning actions.
- Keep work-hours result-returning pattern as the model.
- Stop revalidating the current heavy page for shell-only changes.
- Create one action feedback pattern for sheets, drawers, and inline controls.

### Phase D - Performance Pass

- Replace collection-wide detail loaders with scoped by-ID queries.
- Split dashboard summary queries from full module list queries.
- Reduce layout fetch weight.
- Add targeted fallbacks so one failed widget does not crash a full page.

### Phase E - Profile, Notifications, And PWA

- Complete profile/security/preferences layout.
- Add notification preferences.
- Add manifest and icons.
- Add service worker and mobile push only after preference and permission UX are approved.

## Decisions Needed Before Deleting Or Moving Anything

Do not delete routes until these are confirmed:

1. Should `/admin`, `/supervisor`, and `/creator` remain public compatibility aliases?
2. Should `/admin/tasks` and `/admin/ideas` be standalone Marketing Manager pages, or just filtered views of `/tasks` and `/ideas`?
3. Should `/notifications` become a real page or stay header-only?
4. Should profile password change live in `/profile`, `/profile/security`, or a modal on `/profile`?
5. Which five mobile bottom-nav destinations should each role see?
6. Should PWA include offline caching, Web Push, or only home-screen install support in the first pass?

## Audit Conclusion

Contento does not need a rebuild. It needs a route and interaction contract.

The safest next step is to fix the confirmed password-change and notification-center mismatches, then standardize action behavior so small actions no longer reload heavy pages. After that, performance work should focus on detail queries and layout fetch weight before adding PWA and push notification support.

