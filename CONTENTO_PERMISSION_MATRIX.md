# Contento Permission Matrix

This document defines the planned role-based permission matrix for Contento. It is documentation only and does not implement authorization, database policies, migrations, or application code.

## Permission Levels

| Level | Meaning |
| --- | --- |
| Full Access | Can create, view, update, delete, approve, manage, or export within the company workspace, depending on the capability. |
| Limited Access | Can use the capability within a constrained scope, such as assigned team, assigned tasks, own records, or workflow-specific actions. |
| View Only | Can view allowed data but cannot create, update, approve, delete, or export it. |
| No Access | Capability is not available for the role. |

## Role Scope

| Role | Default Scope |
| --- | --- |
| Admin | Full company workspace. |
| Supervisor | Assigned teams, approvals, reports, analytics, feedback, and activity monitoring. |
| CC Team Lead | Assigned team workflow, task assignment, progress tracking, content schedule coordination, and escalation. |
| Creator | Own tasks, ideas, content submissions, reports, calendar, performance, and day off requests. |

## User Management

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `users.invite` | Create users in the company workspace with temporary password access. | Full Access | No Access | No Access | No Access |
| `users.update` | Edit user profile and account details. | Full Access | View Only | View Only | Limited Access |
| `users.disable` | Disable or suspend users. | Full Access | No Access | No Access | No Access |
| `users.assign_role` | Assign or change user roles. | Full Access | No Access | No Access | No Access |
| `users.view_activity` | View user activity and profile context. | Full Access | Limited Access | Limited Access | View Only |

## Team Management

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `teams.create` | Create and edit teams. | Full Access | Limited Access | No Access | No Access |
| `teams.assign_members` | Add or remove users from teams. | Full Access | Limited Access | No Access | No Access |
| `teams.view_roster` | View team members and role assignments. | Full Access | Limited Access | Limited Access | View Only |
| `teams.monitor_workload` | Monitor team workload and capacity. | Full Access | Limited Access | Limited Access | No Access |

## Task Management

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `tasks.create` | Create tasks. | Full Access | Limited Access | Limited Access | No Access |
| `tasks.assign` | Assign tasks to creators. | Full Access | Limited Access | Full Access | No Access |
| `tasks.update_status` | Update task status. | Full Access | Limited Access | Limited Access | Limited Access |
| `tasks.view` | View task lists and task details. | Full Access | Limited Access | Limited Access | Limited Access |
| `tasks.close` | Close completed tasks. | Full Access | Limited Access | Limited Access | No Access |

## Ideas Management

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `ideas.create` | Create content ideas. | Full Access | Limited Access | Limited Access | Full Access |
| `ideas.update` | Edit idea details. | Full Access | Limited Access | Limited Access | Limited Access |
| `ideas.review` | Review and comment on ideas. | Full Access | Full Access | Limited Access | View Only |
| `ideas.change_status` | Change idea status. | Full Access | Full Access | Limited Access | Limited Access |

## Content Management

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `content.create` | Create content items. | Full Access | Limited Access | Limited Access | Full Access |
| `content.submit` | Submit content for review. | Full Access | Limited Access | Limited Access | Full Access |
| `content.update` | Edit content details and metadata. | Full Access | Limited Access | Limited Access | Limited Access |
| `content.track_pipeline` | Track content pipeline status. | Full Access | Full Access | Limited Access | Limited Access |
| `content.archive` | Archive content items. | Full Access | Limited Access | No Access | No Access |
| `content.rate` | Rate submitted content during review. | Full Access | Full Access | Limited Access | No Access |

## Reviews & Approvals

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `reviews.view_submissions` | View submitted content awaiting review. | Full Access | Full Access | Limited Access | View Only |
| `reviews.approve` | Approve content. | Full Access | Full Access | No Access | No Access |
| `reviews.request_changes` | Reject content or request changes. | Full Access | Full Access | Limited Access | No Access |
| `reviews.add_feedback` | Add review feedback. | Full Access | Full Access | Limited Access | View Only |

Review boundaries:

* Admin can review and override submitted content inside company scope.
* Supervisor reviews content sent by Team Leads to Supervisor review.
* CC Team Lead reviews own-team submissions only and can request changes or send content to Supervisor review.
* Creator can view own submitted content, feedback, and ratings but cannot review or rate own content.

## Reports

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `reports.submit` | Submit reports. | Full Access | Limited Access | Limited Access | Full Access |
| `reports.view_own` | View own reports. | Full Access | Full Access | Full Access | Full Access |
| `reports.view_team` | View assigned team reports. | Full Access | Full Access | Limited Access | No Access |
| `reports.view_company` | View company-wide reports. | Full Access | View Only | No Access | No Access |

## Calendar

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `calendar.view` | View content and work calendar. | Full Access | Limited Access | Limited Access | Limited Access |
| `calendar.schedule_content` | Schedule approved content. | Full Access | Limited Access | Limited Access | No Access |
| `calendar.reschedule_content` | Reschedule content calendar items. | Full Access | Limited Access | Limited Access | No Access |
| `calendar.filter` | Filter calendar by creator, status, date, or team. | Full Access | Limited Access | Limited Access | Limited Access |

## Day Off Requests

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `day_off.submit` | Submit day off requests. | Full Access | Full Access | Full Access | Full Access |
| `day_off.approve` | Approve or reject day off requests. | Full Access | Limited Access | No Access | No Access |
| `day_off.cancel_own` | Cancel own pending request. | Full Access | Full Access | Full Access | Full Access |
| `day_off.view_availability` | View team availability and schedule impact. | Full Access | Limited Access | Limited Access | View Only |

## Analytics

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `analytics.view_personal` | View personal performance analytics. | Full Access | Full Access | Full Access | Full Access |
| `analytics.view_team` | View team performance analytics. | Full Access | Full Access | Limited Access | No Access |
| `analytics.view_company` | View company-wide analytics. | Full Access | View Only | No Access | No Access |

## Activity Logs

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `activity.view_own` | View own activity history. | Full Access | Full Access | Full Access | Full Access |
| `activity.view_team` | View assigned team activity. | Full Access | Limited Access | Limited Access | No Access |
| `activity.view_company` | View company-wide activity logs. | Full Access | View Only | No Access | No Access |
| `activity.view_sensitive` | View sensitive user-management and settings activity. | Full Access | No Access | No Access | No Access |

## Working Hours

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `work_hours.view_own` | View own work-day, work-session, break, and missing-time records. | Full Access | Full Access | Full Access | Full Access |
| `work_hours.view_team` | View assigned team working-hour records and break history. | Full Access | Limited Access | Limited Access | No Access |
| `work_hours.view_company` | View company-wide working-hour records and break history. | Full Access | No Access | No Access | No Access |
| `work_hours.manage` | Manage or audit company working-hour records. | Full Access | No Access | No Access | No Access |

Working-hours visibility uses Cairo work dates (`Africa/Cairo`). Current UI exposes own work hours to users and company work-hours/break history to Admin.

## Settings

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `settings.company` | Manage company settings. | Full Access | No Access | No Access | No Access |
| `settings.profile` | Manage own profile settings. | Full Access | Full Access | Full Access | Full Access |
| `settings.notifications` | Manage own notification preferences. | Full Access | Full Access | Full Access | Full Access |
| `settings.roles_permissions` | Manage roles and permissions. | Full Access | No Access | No Access | No Access |
| `settings.branding` | Manage workspace branding. | Full Access | No Access | No Access | No Access |

## Notifications And Collaboration

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `notifications.view` | View own in-app notifications. | Full Access | Full Access | Full Access | Full Access |
| `notifications.manage` | Manage own notification read state. | Full Access | Full Access | Full Access | Full Access |
| `attachments.manage` | Upload and delete scoped entity attachments. | Full Access | Limited Access | Limited Access | Limited Access |
| `comments.create` | Add comments to accessible tasks, ideas, content, and reports. | Full Access | Limited Access | Limited Access | Limited Access |
| `comments.delete` | Soft-delete accessible comments where permitted. | Full Access | Limited Access | Limited Access | No Access |
| `mentions.create` | Mention same-company users who can access the entity. | Full Access | Limited Access | Limited Access | Limited Access |

## Search, Saved Views, Templates, And Dashboards

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `search.global` | Search across accessible company modules. | Full Access | Limited Access | Limited Access | Limited Access |
| `saved_views.manage` | Save and manage reusable filters. | Full Access | Full Access | Full Access | Full Access |
| `analytics.view` | View role-scoped analytics. | Full Access | Limited Access | Limited Access | View Only |
| `content.templates.use` | Use active content templates. | Full Access | Full Access | Full Access | View Only |
| `content.templates.manage` | Create, update, and archive content templates. | Full Access | Limited Access | Limited Access | No Access |
| `dashboard.customize` | Show, hide, and reset dashboard widgets. | Full Access | Full Access | Full Access | Full Access |

## Exporting

| Permission Key | Capability | Admin | Supervisor | CC Team Lead | Creator |
| --- | --- | --- | --- | --- | --- |
| `exports.reports` | Export reports. | Full Access | Limited Access | No Access | No Access |
| `exports.activity_logs` | Export activity logs. | Full Access | No Access | No Access | No Access |
| `exports.filtered_data` | Export filtered operational data. | Full Access | Limited Access | No Access | No Access |
| `exports.analytics` | Export analytics data. | Full Access | Limited Access | No Access | No Access |

## Permission Summary

* Permission capabilities identified: 71
* Roles covered: Admin, Supervisor, CC Team Lead, Creator
* Access levels used: Full Access, Limited Access, View Only, No Access
* Default isolation model: company-scoped access with role and ownership constraints

## Platform Superior Admin Scope

Superior Admin and Platform Admin are not tenant roles and are not assigned through `roles` or `role_permissions`. They are platform operator accounts used to create organizations, create first Org Admin accounts, view organization metadata, and manage organization lifecycle. Platform operators cannot access normal company dashboards as their primary route.

## Phase 4-10 Implementation Notes

The current implementation uses this matrix for Teams, Tasks, Ideas, Content, Calendar, Reports, and report exports:

* Admin-only `/admin/teams`, `/admin/tasks`, and `/admin/ideas` routes rely on Admin route protection plus the documented permission keys.
* Shared `/team`, `/tasks`, `/tasks/[id]`, `/ideas`, `/ideas/[id]`, `/content`, `/content/[id]`, `/content/reviews`, `/calendar`, `/reports`, and `/reports/[id]` routes require the matching view permission before rendering.
* Server actions require the documented create, assign, update, review, schedule, submit, close, or export permission before writing.
* RLS remains company-scoped and adds task/team, idea-link, content-link, review-scope, rating-scope, and report-scope helper checks for limited team visibility.
* CC Team Leads are restricted to own-team members, own-team task assignment, and own-team submitted content review.
* Role dashboards show private user productivity counts; review queues and team/company data live in permission-scoped operational pages.
* Report CSV export requires `exports.reports`, never accepts a browser-provided `company_id`, and writes `reports.exported` to `activity_logs`.
* Notifications, comments, mentions, attachments, saved views, content templates, search, analytics, and dashboard preferences use the final production permissions above.
* Generic collaboration records are only visible when the user can access the linked entity.
* Saved views and dashboard preferences are private to the owning user.
* Content templates are company-scoped; Creators can use active templates but cannot manage them.

Phase 4 also seeds permission aliases for future shared-module code:

| Alias Permission | Current Granular Equivalent |
| --- | --- |
| `teams.view` | `teams.view_roster` |
| `teams.manage` | `teams.create`, `teams.assign_members` |
| `tasks.manage` | `tasks.create`, `tasks.assign`, `tasks.update_status`, `tasks.close` |
| `tasks.update_own` | Own-scope task status/comment updates |
| `ideas.view` | `ideas.review` view scope |
| `ideas.manage` | `ideas.update`, `ideas.change_status` |
| `ideas.update_own` | Own-scope draft or assigned idea updates |
| `content.view` | `content.track_pipeline` |
| `content.manage` | `content.update`, `calendar.schedule_content`, `content.archive` |
| `content.review` | `reviews.view_submissions`, `reviews.approve`, `reviews.request_changes`, `reviews.add_feedback`, `content.rate` |
| `reports.view` | `reports.view_own`, `reports.view_team`, `reports.view_company` |
| `reports.create` | `reports.submit` |
| `reports.export` | `exports.reports` |
