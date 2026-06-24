begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.company_status as enum ('active', 'suspended', 'archived');
create type public.user_status as enum ('invited', 'active', 'suspended', 'disabled');
create type public.permission_access_level as enum ('view', 'limited', 'full');
create type public.task_status as enum ('pending', 'assigned', 'in_progress', 'under_review', 'completed', 'closed');
create type public.idea_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'archived');
create type public.content_status as enum ('draft', 'in_review', 'changes_requested', 'resubmitted', 'approved', 'scheduled', 'published', 'archived');
create type public.review_decision as enum ('approved', 'rejected', 'changes_requested', 'commented');
create type public.report_type as enum ('daily', 'weekly', 'creator', 'team', 'company');
create type public.day_off_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_url text,
  owner_user_id uuid,
  status public.company_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  name text not null check (char_length(trim(name)) > 0),
  description text not null default ''
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  unique (company_id, name)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  access_level public.permission_access_level not null default 'full',
  primary key (role_id, permission_id)
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  email citext not null unique,
  first_name text not null default '',
  last_name text not null default '',
  avatar_url text,
  role_id uuid references public.roles(id) on delete set null,
  status public.user_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_name_not_blank_when_active check (
    status <> 'active'
    or (char_length(trim(first_name)) > 0 and char_length(trim(last_name)) > 0)
  )
);

alter table public.companies
  add constraint companies_owner_user_id_fkey
  foreign key (owner_user_id) references public.users(id) on delete set null
  deferrable initially deferred;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  unique (company_id, name)
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (team_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  assigned_to uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  status public.task_status not null default 'pending',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  created_by uuid references public.users(id) on delete set null,
  status public.idea_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  creator_id uuid references public.users(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  status public.content_status not null default 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint content_items_approved_timestamp check (
    approved_at is null or status in ('approved', 'scheduled', 'published', 'archived')
  )
);

create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  reviewer_id uuid references public.users(id) on delete set null,
  decision public.review_decision not null,
  feedback text not null default '',
  reviewed_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  report_type public.report_type not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  start_date timestamptz not null,
  end_date timestamptz not null,
  created_by uuid references public.users(id) on delete set null,
  constraint calendar_events_valid_date_range check (end_date >= start_date)
);

create table public.day_off_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  status public.day_off_status not null default 'pending',
  constraint day_off_requests_valid_date_range check (end_date >= start_date)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  message text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null check (action ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  entity_type text not null check (char_length(trim(entity_type)) > 0),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger set_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

create index companies_status_idx on public.companies(status);
create index users_company_id_idx on public.users(company_id);
create index users_role_id_idx on public.users(role_id);
create index users_status_idx on public.users(status);
create index roles_company_id_idx on public.roles(company_id);
create index role_permissions_permission_id_idx on public.role_permissions(permission_id);
create index teams_company_id_idx on public.teams(company_id);
create index team_members_user_id_idx on public.team_members(user_id);
create index tasks_company_id_idx on public.tasks(company_id);
create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_created_by_idx on public.tasks(created_by);
create index tasks_status_idx on public.tasks(status);
create index tasks_due_date_idx on public.tasks(due_date);
create index ideas_company_id_idx on public.ideas(company_id);
create index ideas_created_by_idx on public.ideas(created_by);
create index ideas_status_idx on public.ideas(status);
create index content_items_company_id_idx on public.content_items(company_id);
create index content_items_creator_id_idx on public.content_items(creator_id);
create index content_items_task_id_idx on public.content_items(task_id);
create index content_items_status_idx on public.content_items(status);
create index content_reviews_company_id_idx on public.content_reviews(company_id);
create index content_reviews_content_id_idx on public.content_reviews(content_id);
create index content_reviews_reviewer_id_idx on public.content_reviews(reviewer_id);
create index reports_company_id_idx on public.reports(company_id);
create index reports_user_id_idx on public.reports(user_id);
create index reports_report_type_idx on public.reports(report_type);
create index calendar_events_company_id_idx on public.calendar_events(company_id);
create index calendar_events_start_date_idx on public.calendar_events(start_date);
create index calendar_events_created_by_idx on public.calendar_events(created_by);
create index day_off_requests_company_id_idx on public.day_off_requests(company_id);
create index day_off_requests_user_id_idx on public.day_off_requests(user_id);
create index day_off_requests_status_idx on public.day_off_requests(status);
create index notifications_company_user_read_idx on public.notifications(company_id, user_id, read);
create index activity_logs_company_id_idx on public.activity_logs(company_id);
create index activity_logs_user_id_idx on public.activity_logs(user_id);
create index activity_logs_action_idx on public.activity_logs(action);
create index activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);

insert into public.permissions (key, name, description) values
  ('users.invite', 'Invite users', 'Invite users to the company workspace.'),
  ('users.update', 'Update users', 'Edit user profile and account details.'),
  ('users.disable', 'Disable users', 'Disable or suspend users.'),
  ('users.assign_role', 'Assign roles', 'Assign or change user roles.'),
  ('users.view_activity', 'View user activity', 'View user activity and profile context.'),
  ('teams.create', 'Create teams', 'Create and edit teams.'),
  ('teams.assign_members', 'Assign team members', 'Add or remove users from teams.'),
  ('teams.view_roster', 'View team roster', 'View team members and role assignments.'),
  ('teams.monitor_workload', 'Monitor team workload', 'Monitor team workload and capacity.'),
  ('tasks.create', 'Create tasks', 'Create tasks.'),
  ('tasks.assign', 'Assign tasks', 'Assign tasks to creators.'),
  ('tasks.update_status', 'Update task status', 'Update task status.'),
  ('tasks.view', 'View tasks', 'View task lists and task details.'),
  ('tasks.close', 'Close tasks', 'Close completed tasks.'),
  ('ideas.create', 'Create ideas', 'Create content ideas.'),
  ('ideas.update', 'Update ideas', 'Edit idea details.'),
  ('ideas.review', 'Review ideas', 'Review and comment on ideas.'),
  ('ideas.change_status', 'Change idea status', 'Change idea status.'),
  ('content.create', 'Create content', 'Create content items.'),
  ('content.submit', 'Submit content', 'Submit content for review.'),
  ('content.update', 'Update content', 'Edit content details and metadata.'),
  ('content.track_pipeline', 'Track content pipeline', 'Track content pipeline status.'),
  ('content.archive', 'Archive content', 'Archive content items.'),
  ('reviews.view_submissions', 'View review submissions', 'View submitted content awaiting review.'),
  ('reviews.approve', 'Approve content', 'Approve content.'),
  ('reviews.request_changes', 'Request content changes', 'Reject content or request changes.'),
  ('reviews.add_feedback', 'Add review feedback', 'Add review feedback.'),
  ('reports.submit', 'Submit reports', 'Submit reports.'),
  ('reports.view_own', 'View own reports', 'View own reports.'),
  ('reports.view_team', 'View team reports', 'View assigned team reports.'),
  ('reports.view_company', 'View company reports', 'View company-wide reports.'),
  ('calendar.view', 'View calendar', 'View content and work calendar.'),
  ('calendar.schedule_content', 'Schedule content', 'Schedule approved content.'),
  ('calendar.reschedule_content', 'Reschedule content', 'Reschedule content calendar items.'),
  ('calendar.filter', 'Filter calendar', 'Filter calendar by creator, status, date, or team.'),
  ('day_off.submit', 'Submit day off request', 'Submit day off requests.'),
  ('day_off.approve', 'Approve day off request', 'Approve or reject day off requests.'),
  ('day_off.cancel_own', 'Cancel own day off request', 'Cancel own pending request.'),
  ('day_off.view_availability', 'View availability', 'View team availability and schedule impact.'),
  ('analytics.view_personal', 'View personal analytics', 'View personal performance analytics.'),
  ('analytics.view_team', 'View team analytics', 'View team performance analytics.'),
  ('analytics.view_company', 'View company analytics', 'View company-wide analytics.'),
  ('activity.view_own', 'View own activity', 'View own activity history.'),
  ('activity.view_team', 'View team activity', 'View assigned team activity.'),
  ('activity.view_company', 'View company activity', 'View company-wide activity logs.'),
  ('activity.view_sensitive', 'View sensitive activity', 'View sensitive user-management and settings activity.'),
  ('settings.company', 'Manage company settings', 'Manage company settings.'),
  ('settings.profile', 'Manage profile settings', 'Manage own profile settings.'),
  ('settings.notifications', 'Manage notification settings', 'Manage own notification preferences.'),
  ('settings.roles_permissions', 'Manage roles and permissions', 'Manage roles and permissions.'),
  ('settings.branding', 'Manage workspace branding', 'Manage workspace branding.'),
  ('exports.reports', 'Export reports', 'Export reports.'),
  ('exports.activity_logs', 'Export activity logs', 'Export activity logs.'),
  ('exports.filtered_data', 'Export filtered data', 'Export filtered operational data.'),
  ('exports.analytics', 'Export analytics', 'Export analytics data.')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;

create or replace function public.permission_rank(access_level public.permission_access_level)
returns integer
language sql
immutable
as $$
  select case access_level
    when 'view' then 1
    when 'limited' then 2
    when 'full' then 3
  end;
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.company_id
  from public.users u
  where u.id = auth.uid()
    and u.status = 'active'
  limit 1;
$$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select r.name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid()
    and u.status = 'active'
  limit 1;
$$;

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(lower(public.current_role_name()) = lower(required_role), false);
$$;

create or replace function public.has_permission(
  permission_key text,
  minimum_access public.permission_access_level default 'limited'
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users u
    join public.role_permissions rp on rp.role_id = u.role_id
    join public.permissions p on p.id = rp.permission_id
    where u.id = auth.uid()
      and u.status = 'active'
      and u.company_id = public.current_company_id()
      and p.key = permission_key
      and public.permission_rank(rp.access_level) >= public.permission_rank(minimum_access)
  );
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_role('Admin');
$$;

create or replace function public.is_same_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_company_id is not null
    and target_company_id = public.current_company_id();
$$;

create or replace function public.is_same_company_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users u
    where u.id = target_user_id
      and u.company_id = public.current_company_id()
  );
$$;

create or replace function public.is_same_company_role(target_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_role_id is null or exists (
    select 1
    from public.roles r
    where r.id = target_role_id
      and r.company_id = public.current_company_id()
  );
$$;

create or replace function public.is_same_company_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and t.company_id = public.current_company_id()
  );
$$;

create or replace function public.is_same_company_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_task_id is null or exists (
    select 1
    from public.tasks t
    where t.id = target_task_id
      and t.company_id = public.current_company_id()
  );
$$;

create or replace function public.create_default_roles_for_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  with inserted_roles as (
    insert into public.roles (company_id, name, description) values
      (new.id, 'Admin', 'Full company workspace control.'),
      (new.id, 'Supervisor', 'Team performance, approvals, reports, and monitoring.'),
      (new.id, 'CC Team Lead', 'Team workflow, task assignment, progress, and scheduling.'),
      (new.id, 'Creator', 'Own tasks, ideas, submissions, reports, calendar, and performance.')
    on conflict (company_id, name) do update set description = excluded.description
    returning id, name
  ),
  non_admin_matrix(role_name, permission_key, access_level) as (
    values
      ('Supervisor', 'users.update', 'view'::public.permission_access_level),
      ('Supervisor', 'users.view_activity', 'limited'::public.permission_access_level),
      ('Supervisor', 'teams.create', 'limited'::public.permission_access_level),
      ('Supervisor', 'teams.assign_members', 'limited'::public.permission_access_level),
      ('Supervisor', 'teams.view_roster', 'limited'::public.permission_access_level),
      ('Supervisor', 'teams.monitor_workload', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.create', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.assign', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.update_status', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.view', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.close', 'limited'::public.permission_access_level),
      ('Supervisor', 'ideas.create', 'limited'::public.permission_access_level),
      ('Supervisor', 'ideas.update', 'limited'::public.permission_access_level),
      ('Supervisor', 'ideas.review', 'full'::public.permission_access_level),
      ('Supervisor', 'ideas.change_status', 'full'::public.permission_access_level),
      ('Supervisor', 'content.create', 'limited'::public.permission_access_level),
      ('Supervisor', 'content.submit', 'limited'::public.permission_access_level),
      ('Supervisor', 'content.update', 'limited'::public.permission_access_level),
      ('Supervisor', 'content.track_pipeline', 'full'::public.permission_access_level),
      ('Supervisor', 'content.archive', 'limited'::public.permission_access_level),
      ('Supervisor', 'reviews.view_submissions', 'full'::public.permission_access_level),
      ('Supervisor', 'reviews.approve', 'full'::public.permission_access_level),
      ('Supervisor', 'reviews.request_changes', 'full'::public.permission_access_level),
      ('Supervisor', 'reviews.add_feedback', 'full'::public.permission_access_level),
      ('Supervisor', 'reports.submit', 'limited'::public.permission_access_level),
      ('Supervisor', 'reports.view_own', 'full'::public.permission_access_level),
      ('Supervisor', 'reports.view_team', 'full'::public.permission_access_level),
      ('Supervisor', 'reports.view_company', 'view'::public.permission_access_level),
      ('Supervisor', 'calendar.view', 'limited'::public.permission_access_level),
      ('Supervisor', 'calendar.schedule_content', 'limited'::public.permission_access_level),
      ('Supervisor', 'calendar.reschedule_content', 'limited'::public.permission_access_level),
      ('Supervisor', 'calendar.filter', 'limited'::public.permission_access_level),
      ('Supervisor', 'day_off.submit', 'full'::public.permission_access_level),
      ('Supervisor', 'day_off.approve', 'limited'::public.permission_access_level),
      ('Supervisor', 'day_off.cancel_own', 'full'::public.permission_access_level),
      ('Supervisor', 'day_off.view_availability', 'limited'::public.permission_access_level),
      ('Supervisor', 'analytics.view_personal', 'full'::public.permission_access_level),
      ('Supervisor', 'analytics.view_team', 'full'::public.permission_access_level),
      ('Supervisor', 'analytics.view_company', 'view'::public.permission_access_level),
      ('Supervisor', 'activity.view_own', 'full'::public.permission_access_level),
      ('Supervisor', 'activity.view_team', 'limited'::public.permission_access_level),
      ('Supervisor', 'activity.view_company', 'view'::public.permission_access_level),
      ('Supervisor', 'settings.profile', 'full'::public.permission_access_level),
      ('Supervisor', 'settings.notifications', 'full'::public.permission_access_level),
      ('Supervisor', 'exports.reports', 'limited'::public.permission_access_level),
      ('Supervisor', 'exports.filtered_data', 'limited'::public.permission_access_level),
      ('Supervisor', 'exports.analytics', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'users.update', 'view'::public.permission_access_level),
      ('CC Team Lead', 'users.view_activity', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'teams.view_roster', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'teams.monitor_workload', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'tasks.create', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'tasks.assign', 'full'::public.permission_access_level),
      ('CC Team Lead', 'tasks.update_status', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'tasks.view', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'tasks.close', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'ideas.create', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'ideas.update', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'ideas.review', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'ideas.change_status', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'content.create', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'content.submit', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'content.update', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'content.track_pipeline', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reviews.view_submissions', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reviews.request_changes', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reviews.add_feedback', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reports.submit', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reports.view_own', 'full'::public.permission_access_level),
      ('CC Team Lead', 'reports.view_team', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'calendar.view', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'calendar.schedule_content', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'calendar.reschedule_content', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'calendar.filter', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'day_off.submit', 'full'::public.permission_access_level),
      ('CC Team Lead', 'day_off.cancel_own', 'full'::public.permission_access_level),
      ('CC Team Lead', 'day_off.view_availability', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'analytics.view_personal', 'full'::public.permission_access_level),
      ('CC Team Lead', 'analytics.view_team', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'activity.view_own', 'full'::public.permission_access_level),
      ('CC Team Lead', 'activity.view_team', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'settings.profile', 'full'::public.permission_access_level),
      ('CC Team Lead', 'settings.notifications', 'full'::public.permission_access_level),
      ('Creator', 'users.update', 'limited'::public.permission_access_level),
      ('Creator', 'users.view_activity', 'view'::public.permission_access_level),
      ('Creator', 'teams.view_roster', 'view'::public.permission_access_level),
      ('Creator', 'tasks.update_status', 'limited'::public.permission_access_level),
      ('Creator', 'tasks.view', 'limited'::public.permission_access_level),
      ('Creator', 'ideas.create', 'full'::public.permission_access_level),
      ('Creator', 'ideas.update', 'limited'::public.permission_access_level),
      ('Creator', 'ideas.review', 'view'::public.permission_access_level),
      ('Creator', 'ideas.change_status', 'limited'::public.permission_access_level),
      ('Creator', 'content.create', 'full'::public.permission_access_level),
      ('Creator', 'content.submit', 'full'::public.permission_access_level),
      ('Creator', 'content.update', 'limited'::public.permission_access_level),
      ('Creator', 'content.track_pipeline', 'limited'::public.permission_access_level),
      ('Creator', 'reviews.view_submissions', 'view'::public.permission_access_level),
      ('Creator', 'reviews.add_feedback', 'view'::public.permission_access_level),
      ('Creator', 'reports.submit', 'full'::public.permission_access_level),
      ('Creator', 'reports.view_own', 'full'::public.permission_access_level),
      ('Creator', 'calendar.view', 'limited'::public.permission_access_level),
      ('Creator', 'calendar.filter', 'limited'::public.permission_access_level),
      ('Creator', 'day_off.submit', 'full'::public.permission_access_level),
      ('Creator', 'day_off.cancel_own', 'full'::public.permission_access_level),
      ('Creator', 'day_off.view_availability', 'view'::public.permission_access_level),
      ('Creator', 'analytics.view_personal', 'full'::public.permission_access_level),
      ('Creator', 'activity.view_own', 'full'::public.permission_access_level),
      ('Creator', 'settings.profile', 'full'::public.permission_access_level),
      ('Creator', 'settings.notifications', 'full'::public.permission_access_level)
  )
  insert into public.role_permissions (role_id, permission_id, access_level)
  select r.id, p.id, 'full'::public.permission_access_level
  from inserted_roles r
  cross join public.permissions p
  where r.name = 'Admin'
  on conflict (role_id, permission_id) do update set access_level = excluded.access_level;

  with inserted_roles as (
    select id, name
    from public.roles
    where company_id = new.id
  ),
  non_admin_matrix(role_name, permission_key, access_level) as (
    values
      ('Supervisor', 'users.update', 'view'::public.permission_access_level),
      ('Supervisor', 'users.view_activity', 'limited'::public.permission_access_level),
      ('Supervisor', 'teams.create', 'limited'::public.permission_access_level),
      ('Supervisor', 'teams.assign_members', 'limited'::public.permission_access_level),
      ('Supervisor', 'teams.view_roster', 'limited'::public.permission_access_level),
      ('Supervisor', 'teams.monitor_workload', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.create', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.assign', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.update_status', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.view', 'limited'::public.permission_access_level),
      ('Supervisor', 'tasks.close', 'limited'::public.permission_access_level),
      ('Supervisor', 'ideas.create', 'limited'::public.permission_access_level),
      ('Supervisor', 'ideas.update', 'limited'::public.permission_access_level),
      ('Supervisor', 'ideas.review', 'full'::public.permission_access_level),
      ('Supervisor', 'ideas.change_status', 'full'::public.permission_access_level),
      ('Supervisor', 'content.create', 'limited'::public.permission_access_level),
      ('Supervisor', 'content.submit', 'limited'::public.permission_access_level),
      ('Supervisor', 'content.update', 'limited'::public.permission_access_level),
      ('Supervisor', 'content.track_pipeline', 'full'::public.permission_access_level),
      ('Supervisor', 'content.archive', 'limited'::public.permission_access_level),
      ('Supervisor', 'reviews.view_submissions', 'full'::public.permission_access_level),
      ('Supervisor', 'reviews.approve', 'full'::public.permission_access_level),
      ('Supervisor', 'reviews.request_changes', 'full'::public.permission_access_level),
      ('Supervisor', 'reviews.add_feedback', 'full'::public.permission_access_level),
      ('Supervisor', 'reports.submit', 'limited'::public.permission_access_level),
      ('Supervisor', 'reports.view_own', 'full'::public.permission_access_level),
      ('Supervisor', 'reports.view_team', 'full'::public.permission_access_level),
      ('Supervisor', 'reports.view_company', 'view'::public.permission_access_level),
      ('Supervisor', 'calendar.view', 'limited'::public.permission_access_level),
      ('Supervisor', 'calendar.schedule_content', 'limited'::public.permission_access_level),
      ('Supervisor', 'calendar.reschedule_content', 'limited'::public.permission_access_level),
      ('Supervisor', 'calendar.filter', 'limited'::public.permission_access_level),
      ('Supervisor', 'day_off.submit', 'full'::public.permission_access_level),
      ('Supervisor', 'day_off.approve', 'limited'::public.permission_access_level),
      ('Supervisor', 'day_off.cancel_own', 'full'::public.permission_access_level),
      ('Supervisor', 'day_off.view_availability', 'limited'::public.permission_access_level),
      ('Supervisor', 'analytics.view_personal', 'full'::public.permission_access_level),
      ('Supervisor', 'analytics.view_team', 'full'::public.permission_access_level),
      ('Supervisor', 'analytics.view_company', 'view'::public.permission_access_level),
      ('Supervisor', 'activity.view_own', 'full'::public.permission_access_level),
      ('Supervisor', 'activity.view_team', 'limited'::public.permission_access_level),
      ('Supervisor', 'activity.view_company', 'view'::public.permission_access_level),
      ('Supervisor', 'settings.profile', 'full'::public.permission_access_level),
      ('Supervisor', 'settings.notifications', 'full'::public.permission_access_level),
      ('Supervisor', 'exports.reports', 'limited'::public.permission_access_level),
      ('Supervisor', 'exports.filtered_data', 'limited'::public.permission_access_level),
      ('Supervisor', 'exports.analytics', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'users.update', 'view'::public.permission_access_level),
      ('CC Team Lead', 'users.view_activity', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'teams.view_roster', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'teams.monitor_workload', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'tasks.create', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'tasks.assign', 'full'::public.permission_access_level),
      ('CC Team Lead', 'tasks.update_status', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'tasks.view', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'tasks.close', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'ideas.create', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'ideas.update', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'ideas.review', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'ideas.change_status', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'content.create', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'content.submit', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'content.update', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'content.track_pipeline', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reviews.view_submissions', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reviews.request_changes', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reviews.add_feedback', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reports.submit', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'reports.view_own', 'full'::public.permission_access_level),
      ('CC Team Lead', 'reports.view_team', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'calendar.view', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'calendar.schedule_content', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'calendar.reschedule_content', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'calendar.filter', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'day_off.submit', 'full'::public.permission_access_level),
      ('CC Team Lead', 'day_off.cancel_own', 'full'::public.permission_access_level),
      ('CC Team Lead', 'day_off.view_availability', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'analytics.view_personal', 'full'::public.permission_access_level),
      ('CC Team Lead', 'analytics.view_team', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'activity.view_own', 'full'::public.permission_access_level),
      ('CC Team Lead', 'activity.view_team', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'settings.profile', 'full'::public.permission_access_level),
      ('CC Team Lead', 'settings.notifications', 'full'::public.permission_access_level),
      ('Creator', 'users.update', 'limited'::public.permission_access_level),
      ('Creator', 'users.view_activity', 'view'::public.permission_access_level),
      ('Creator', 'teams.view_roster', 'view'::public.permission_access_level),
      ('Creator', 'tasks.update_status', 'limited'::public.permission_access_level),
      ('Creator', 'tasks.view', 'limited'::public.permission_access_level),
      ('Creator', 'ideas.create', 'full'::public.permission_access_level),
      ('Creator', 'ideas.update', 'limited'::public.permission_access_level),
      ('Creator', 'ideas.review', 'view'::public.permission_access_level),
      ('Creator', 'ideas.change_status', 'limited'::public.permission_access_level),
      ('Creator', 'content.create', 'full'::public.permission_access_level),
      ('Creator', 'content.submit', 'full'::public.permission_access_level),
      ('Creator', 'content.update', 'limited'::public.permission_access_level),
      ('Creator', 'content.track_pipeline', 'limited'::public.permission_access_level),
      ('Creator', 'reviews.view_submissions', 'view'::public.permission_access_level),
      ('Creator', 'reviews.add_feedback', 'view'::public.permission_access_level),
      ('Creator', 'reports.submit', 'full'::public.permission_access_level),
      ('Creator', 'reports.view_own', 'full'::public.permission_access_level),
      ('Creator', 'calendar.view', 'limited'::public.permission_access_level),
      ('Creator', 'calendar.filter', 'limited'::public.permission_access_level),
      ('Creator', 'day_off.submit', 'full'::public.permission_access_level),
      ('Creator', 'day_off.cancel_own', 'full'::public.permission_access_level),
      ('Creator', 'day_off.view_availability', 'view'::public.permission_access_level),
      ('Creator', 'analytics.view_personal', 'full'::public.permission_access_level),
      ('Creator', 'activity.view_own', 'full'::public.permission_access_level),
      ('Creator', 'settings.profile', 'full'::public.permission_access_level),
      ('Creator', 'settings.notifications', 'full'::public.permission_access_level)
  )
  insert into public.role_permissions (role_id, permission_id, access_level)
  select r.id, p.id, m.access_level
  from inserted_roles r
  join non_admin_matrix m on m.role_name = r.name
  join public.permissions p on p.key = m.permission_key
  on conflict (role_id, permission_id) do update set access_level = excluded.access_level;

  return new;
end;
$$;

create trigger create_default_roles_after_company_insert
after insert on public.companies
for each row execute function public.create_default_roles_for_company();

alter table public.companies enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.ideas enable row level security;
alter table public.content_items enable row level security;
alter table public.content_reviews enable row level security;
alter table public.reports enable row level security;
alter table public.calendar_events enable row level security;
alter table public.day_off_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.company_settings enable row level security;

alter table public.companies force row level security;
alter table public.permissions force row level security;
alter table public.roles force row level security;
alter table public.role_permissions force row level security;
alter table public.users force row level security;
alter table public.teams force row level security;
alter table public.team_members force row level security;
alter table public.tasks force row level security;
alter table public.ideas force row level security;
alter table public.content_items force row level security;
alter table public.content_reviews force row level security;
alter table public.reports force row level security;
alter table public.calendar_events force row level security;
alter table public.day_off_requests force row level security;
alter table public.notifications force row level security;
alter table public.activity_logs force row level security;
alter table public.company_settings force row level security;

create policy "Company members can read their company"
on public.companies for select to authenticated
using (public.is_same_company(id));

create policy "Company admins can update their company"
on public.companies for update to authenticated
using (public.is_same_company(id) and public.has_permission('settings.company', 'limited'))
with check (public.is_same_company(id));

create policy "Authenticated users can read permission catalog"
on public.permissions for select to authenticated
using (true);

create policy "Company members can read company roles"
on public.roles for select to authenticated
using (public.is_same_company(company_id));

create policy "Company admins can create roles"
on public.roles for insert to authenticated
with check (public.is_same_company(company_id) and public.has_permission('settings.roles_permissions', 'limited'));

create policy "Company admins can update roles"
on public.roles for update to authenticated
using (public.is_same_company(company_id) and public.has_permission('settings.roles_permissions', 'limited'))
with check (public.is_same_company(company_id));

create policy "Company admins can delete roles"
on public.roles for delete to authenticated
using (public.is_same_company(company_id) and public.has_permission('settings.roles_permissions', 'full'));

create policy "Company members can read role permissions"
on public.role_permissions for select to authenticated
using (public.is_same_company_role(role_id));

create policy "Company admins can manage role permissions"
on public.role_permissions for all to authenticated
using (public.is_same_company_role(role_id) and public.has_permission('settings.roles_permissions', 'limited'))
with check (public.is_same_company_role(role_id) and public.has_permission('settings.roles_permissions', 'limited'));

create policy "Users can read their own profile"
on public.users for select to authenticated
using (id = auth.uid());

create policy "Permitted users can read company users"
on public.users for select to authenticated
using (public.is_same_company(company_id) and public.has_permission('users.view_activity', 'view'));

create policy "Permitted users can invite company users"
on public.users for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('users.invite', 'limited')
  and public.is_same_company_role(role_id)
);

create policy "Permitted users can update company users"
on public.users for update to authenticated
using (public.is_same_company(company_id) and public.has_permission('users.update', 'limited'))
with check (public.is_same_company(company_id) and public.is_same_company_role(role_id));

create policy "Permitted users can read company teams"
on public.teams for select to authenticated
using (public.is_same_company(company_id) and public.has_permission('teams.view_roster', 'view'));

create policy "Permitted users can create teams"
on public.teams for insert to authenticated
with check (public.is_same_company(company_id) and public.has_permission('teams.create', 'limited'));

create policy "Permitted users can update teams"
on public.teams for update to authenticated
using (public.is_same_company(company_id) and public.has_permission('teams.create', 'limited'))
with check (public.is_same_company(company_id));

create policy "Permitted users can manage team members"
on public.team_members for all to authenticated
using (public.is_same_company_team(team_id) and public.has_permission('teams.assign_members', 'limited'))
with check (
  public.is_same_company_team(team_id)
  and public.is_same_company_user(user_id)
  and public.has_permission('teams.assign_members', 'limited')
);

create policy "Permitted users can read team members"
on public.team_members for select to authenticated
using (public.is_same_company_team(team_id) and public.has_permission('teams.view_roster', 'view'));

create policy "Permitted users can read company tasks"
on public.tasks for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('tasks.view', 'view')
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  )
);

create policy "Permitted users can create tasks"
on public.tasks for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('tasks.create', 'limited')
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (created_by is null or created_by = auth.uid())
);

create policy "Permitted users can update tasks"
on public.tasks for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('tasks.update_status', 'limited')
    or assigned_to = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and (assigned_to is null or public.is_same_company_user(assigned_to))
);

create policy "Permitted users can read ideas"
on public.ideas for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('ideas.review', 'view')
    or created_by = auth.uid()
  )
);

create policy "Permitted users can create ideas"
on public.ideas for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('ideas.create', 'limited')
  and (created_by is null or created_by = auth.uid())
);

create policy "Permitted users can update ideas"
on public.ideas for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('ideas.update', 'limited')
    or created_by = auth.uid()
  )
)
with check (public.is_same_company(company_id));

create policy "Permitted users can read content items"
on public.content_items for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('content.track_pipeline', 'view')
    or creator_id = auth.uid()
  )
);

create policy "Permitted users can create content items"
on public.content_items for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('content.create', 'limited')
  and (creator_id is null or public.is_same_company_user(creator_id))
  and public.is_same_company_task(task_id)
);

create policy "Permitted users can update content items"
on public.content_items for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('content.update', 'limited')
    or creator_id = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and (creator_id is null or public.is_same_company_user(creator_id))
  and public.is_same_company_task(task_id)
);

create policy "Permitted users can read content reviews"
on public.content_reviews for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('reviews.view_submissions', 'view')
    or reviewer_id = auth.uid()
    or exists (
      select 1
      from public.content_items ci
      where ci.id = content_id
        and ci.creator_id = auth.uid()
    )
  )
);

create policy "Permitted users can create content reviews"
on public.content_reviews for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('reviews.add_feedback', 'limited')
  and public.is_same_company_user(reviewer_id)
  and exists (
    select 1
    from public.content_items ci
    where ci.id = content_id
      and ci.company_id = public.current_company_id()
  )
);

create policy "Permitted users can read reports"
on public.reports for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    user_id = auth.uid()
    or public.has_permission('reports.view_team', 'view')
    or public.has_permission('reports.view_company', 'view')
  )
);

create policy "Permitted users can create reports"
on public.reports for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('reports.submit', 'limited')
  and (user_id is null or user_id = auth.uid() or public.has_permission('reports.view_team', 'limited'))
);

create policy "Permitted users can read calendar events"
on public.calendar_events for select to authenticated
using (public.is_same_company(company_id) and public.has_permission('calendar.view', 'view'));

create policy "Permitted users can create calendar events"
on public.calendar_events for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('calendar.schedule_content', 'limited')
  and (created_by is null or created_by = auth.uid())
);

create policy "Permitted users can update calendar events"
on public.calendar_events for update to authenticated
using (public.is_same_company(company_id) and public.has_permission('calendar.reschedule_content', 'limited'))
with check (public.is_same_company(company_id));

create policy "Permitted users can read day off requests"
on public.day_off_requests for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    user_id = auth.uid()
    or public.has_permission('day_off.view_availability', 'view')
  )
);

create policy "Users can submit day off requests"
on public.day_off_requests for insert to authenticated
with check (
  public.is_same_company(company_id)
  and user_id = auth.uid()
  and public.has_permission('day_off.submit', 'limited')
);

create policy "Users can update permitted day off requests"
on public.day_off_requests for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    user_id = auth.uid()
    or public.has_permission('day_off.approve', 'limited')
  )
)
with check (public.is_same_company(company_id));

create policy "Users can read own notifications"
on public.notifications for select to authenticated
using (public.is_same_company(company_id) and user_id = auth.uid());

create policy "Users can update own notification read state"
on public.notifications for update to authenticated
using (public.is_same_company(company_id) and user_id = auth.uid())
with check (public.is_same_company(company_id) and user_id = auth.uid());

create policy "Permitted users can read activity logs"
on public.activity_logs for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    user_id = auth.uid()
    or public.has_permission('activity.view_team', 'view')
    or public.has_permission('activity.view_company', 'view')
  )
);

create policy "Permitted users can create activity logs"
on public.activity_logs for insert to authenticated
with check (
  public.is_same_company(company_id)
  and (
    user_id = auth.uid()
    or public.has_permission('activity.view_sensitive', 'limited')
  )
);

create policy "Company members can read company settings"
on public.company_settings for select to authenticated
using (public.is_same_company(company_id));

create policy "Company admins can manage company settings"
on public.company_settings for all to authenticated
using (public.is_same_company(company_id) and public.has_permission('settings.company', 'limited'))
with check (public.is_same_company(company_id) and public.has_permission('settings.company', 'limited'));

comment on table public.companies is 'Tenant root table. RLS restricts normal users to their own company.';
comment on table public.users is 'Contento user profiles linked to Supabase Auth users. RLS allows own-profile reads and permission-scoped company access.';
comment on table public.roles is 'Company-scoped roles. Default roles are seeded for each company.';
comment on table public.permissions is 'Global permission catalog based on CONTENTO_PERMISSION_MATRIX.md.';
comment on table public.role_permissions is 'Role-to-permission mapping with access level from the permission matrix.';
comment on table public.activity_logs is 'Company-scoped audit log for important user and workflow actions.';
comment on function public.current_company_id() is 'Returns the active authenticated user company id for RLS checks.';
comment on function public.has_permission(text, public.permission_access_level) is 'Permission-driven authorization helper used by RLS policies.';

commit;
