begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_status') then
    create type public.team_status as enum ('active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;

  if not exists (select 1 from pg_type where typname = 'calendar_event_type') then
    create type public.calendar_event_type as enum ('content', 'work_hours', 'day_off', 'general');
  end if;
end $$;

alter table public.teams
  add column if not exists status public.team_status not null default 'active',
  add column if not exists team_lead_id uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.tasks
  add column if not exists priority public.task_priority not null default 'normal',
  add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.ideas
  add column if not exists assigned_to uuid references public.users(id) on delete set null,
  add column if not exists notes text not null default '',
  add column if not exists updated_at timestamptz not null default now();

alter table public.content_items
  add column if not exists scheduled_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.calendar_events
  add column if not exists description text not null default '',
  add column if not exists event_type public.calendar_event_type not null default 'general',
  add column if not exists content_id uuid references public.content_items(id) on delete cascade,
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_items_scheduled_timestamp'
      and conrelid = 'public.content_items'::regclass
  ) then
    alter table public.content_items
    add constraint content_items_scheduled_timestamp check (
      scheduled_at is null or status in ('scheduled', 'published', 'archived')
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'content_items_published_timestamp'
      and conrelid = 'public.content_items'::regclass
  ) then
    alter table public.content_items
    add constraint content_items_published_timestamp check (
      published_at is null or status in ('published', 'archived')
    );
  end if;
end $$;

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists set_ideas_updated_at on public.ideas;
create trigger set_ideas_updated_at
before update on public.ideas
for each row execute function public.set_updated_at();

drop trigger if exists set_content_items_updated_at on public.content_items;
create trigger set_content_items_updated_at
before update on public.content_items
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

create index if not exists teams_company_status_idx on public.teams(company_id, status);
create index if not exists teams_team_lead_id_idx on public.teams(team_lead_id);
create index if not exists tasks_company_status_due_idx on public.tasks(company_id, status, due_date);
create index if not exists tasks_company_team_idx on public.tasks(company_id, team_id);
create index if not exists tasks_priority_idx on public.tasks(priority);
create index if not exists ideas_company_status_idx on public.ideas(company_id, status);
create index if not exists ideas_assigned_to_idx on public.ideas(assigned_to);
create index if not exists content_items_company_status_idx on public.content_items(company_id, status);
create index if not exists content_items_scheduled_at_idx on public.content_items(scheduled_at);
create index if not exists calendar_events_company_range_idx on public.calendar_events(company_id, start_date, end_date);
create index if not exists calendar_events_content_id_idx on public.calendar_events(content_id);
create index if not exists calendar_events_user_id_idx on public.calendar_events(user_id);
create index if not exists calendar_events_team_id_idx on public.calendar_events(team_id);
create index if not exists task_comments_company_task_idx on public.task_comments(company_id, task_id, created_at);
create index if not exists task_comments_user_id_idx on public.task_comments(user_id);

create or replace function public.current_permission_rank(permission_key text)
returns integer
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(max(public.permission_rank(rp.access_level)), 0)
  from public.users u
  join public.role_permissions rp on rp.role_id = u.role_id
  join public.permissions p on p.id = rp.permission_id
  where u.id = auth.uid()
    and u.status = 'active'
    and p.key = permission_key;
$$;

create or replace function public.is_current_user_in_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_team_id is not null and exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = auth.uid()
      and tm.team_id = target_team_id
      and t.company_id = public.current_company_id()
  );
$$;

create or replace function public.is_current_user_teammate(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_user_id is not null and exists (
    select 1
    from public.team_members current_tm
    join public.team_members target_tm on target_tm.team_id = current_tm.team_id
    join public.teams t on t.id = current_tm.team_id
    where current_tm.user_id = auth.uid()
      and target_tm.user_id = target_user_id
      and t.company_id = public.current_company_id()
  );
$$;

create or replace function public.is_same_company_content(target_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_content_id is null or exists (
    select 1
    from public.content_items ci
    where ci.id = target_content_id
      and ci.company_id = public.current_company_id()
  );
$$;

create or replace function public.can_access_task_scope(
  target_company_id uuid,
  target_team_id uuid,
  target_assignee_id uuid,
  target_creator_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_same_company(target_company_id)
    and (
      public.current_permission_rank('tasks.view') >= 3
      or target_assignee_id = auth.uid()
      or target_creator_id = auth.uid()
      or (
        public.current_permission_rank('tasks.view') >= 2
        and (
          public.is_current_user_in_team(target_team_id)
          or public.is_current_user_teammate(target_assignee_id)
        )
      )
    );
$$;

alter table public.task_comments enable row level security;
alter table public.task_comments force row level security;

drop policy if exists "Permitted users can read company teams" on public.teams;
create policy "Permitted users can read company teams"
on public.teams for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.current_permission_rank('teams.view_roster') >= 3
    or public.is_current_user_in_team(id)
    or team_lead_id = auth.uid()
    or (
      public.current_permission_rank('teams.view_roster') >= 2
      and status = 'active'
    )
  )
);

drop policy if exists "Permitted users can create teams" on public.teams;
create policy "Permitted users can create teams"
on public.teams for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('teams.create', 'limited')
  and (team_lead_id is null or public.is_same_company_user(team_lead_id))
);

drop policy if exists "Permitted users can update teams" on public.teams;
create policy "Permitted users can update teams"
on public.teams for update to authenticated
using (
  public.is_same_company(company_id)
  and public.has_permission('teams.create', 'limited')
)
with check (
  public.is_same_company(company_id)
  and (team_lead_id is null or public.is_same_company_user(team_lead_id))
);

drop policy if exists "Permitted users can read company tasks" on public.tasks;
create policy "Permitted users can read company tasks"
on public.tasks for select to authenticated
using (public.can_access_task_scope(company_id, team_id, assigned_to, created_by));

drop policy if exists "Permitted users can create tasks" on public.tasks;
create policy "Permitted users can create tasks"
on public.tasks for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('tasks.create', 'limited')
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (team_id is null or public.is_same_company_team(team_id))
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Permitted users can update tasks" on public.tasks;
create policy "Permitted users can update tasks"
on public.tasks for update to authenticated
using (
  public.can_access_task_scope(company_id, team_id, assigned_to, created_by)
  and (
    public.has_permission('tasks.update_status', 'limited')
    or assigned_to = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (team_id is null or public.is_same_company_team(team_id))
);

create policy "Permitted users can read task comments"
on public.task_comments for select to authenticated
using (
  public.is_same_company(company_id)
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and public.can_access_task_scope(t.company_id, t.team_id, t.assigned_to, t.created_by)
  )
);

create policy "Permitted users can create task comments"
on public.task_comments for insert to authenticated
with check (
  public.is_same_company(company_id)
  and user_id = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and public.can_access_task_scope(t.company_id, t.team_id, t.assigned_to, t.created_by)
  )
);

drop policy if exists "Permitted users can read ideas" on public.ideas;
create policy "Permitted users can read ideas"
on public.ideas for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.current_permission_rank('ideas.review') >= 3
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_current_user_teammate(created_by)
    or public.is_current_user_teammate(assigned_to)
  )
);

drop policy if exists "Permitted users can update ideas" on public.ideas;
create policy "Permitted users can update ideas"
on public.ideas for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('ideas.update', 'limited')
    or created_by = auth.uid()
    or assigned_to = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and (assigned_to is null or public.is_same_company_user(assigned_to))
);

create policy "Permitted users can delete ideas"
on public.ideas for delete to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.current_permission_rank('ideas.update') >= 3
    or (created_by = auth.uid() and status = 'draft')
  )
);

drop policy if exists "Permitted users can read content items" on public.content_items;
create policy "Permitted users can read content items"
on public.content_items for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.current_permission_rank('content.track_pipeline') >= 3
    or creator_id = auth.uid()
    or public.is_current_user_teammate(creator_id)
  )
);

drop policy if exists "Permitted users can create content items" on public.content_items;
create policy "Permitted users can create content items"
on public.content_items for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('content.create', 'limited')
  and (creator_id is null or public.is_same_company_user(creator_id))
  and public.is_same_company_task(task_id)
);

drop policy if exists "Permitted users can update content items" on public.content_items;
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

drop policy if exists "Permitted users can read calendar events" on public.calendar_events;
create policy "Permitted users can read calendar events"
on public.calendar_events for select to authenticated
using (
  public.is_same_company(company_id)
  and public.has_permission('calendar.view', 'view')
  and (
    public.current_permission_rank('calendar.view') >= 3
    or user_id = auth.uid()
    or public.is_current_user_in_team(team_id)
    or public.is_current_user_teammate(user_id)
    or event_type = 'content'
  )
);

drop policy if exists "Permitted users can create calendar events" on public.calendar_events;
create policy "Permitted users can create calendar events"
on public.calendar_events for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('calendar.schedule_content', 'limited')
  and (created_by is null or created_by = auth.uid())
  and (content_id is null or public.is_same_company_content(content_id))
  and (user_id is null or public.is_same_company_user(user_id))
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can update calendar events" on public.calendar_events;
create policy "Permitted users can update calendar events"
on public.calendar_events for update to authenticated
using (public.is_same_company(company_id) and public.has_permission('calendar.reschedule_content', 'limited'))
with check (
  public.is_same_company(company_id)
  and (content_id is null or public.is_same_company_content(content_id))
  and (user_id is null or public.is_same_company_user(user_id))
  and (team_id is null or public.is_same_company_team(team_id))
);

comment on table public.task_comments is 'Company-scoped comments on tasks for progress and review context.';
comment on column public.teams.status is 'Team lifecycle state. Archived teams remain historical but are hidden from active assignment defaults.';
comment on column public.teams.team_lead_id is 'Optional Contento user responsible for the team.';
comment on column public.tasks.priority is 'Task priority used by task lists and reports.';
comment on column public.tasks.team_id is 'Optional team context for task filtering and workload reporting.';
comment on column public.ideas.assigned_to is 'Optional user assigned to develop or review the idea.';
comment on column public.ideas.notes is 'Operational notes for idea tracking.';
comment on column public.content_items.scheduled_at is 'Scheduled publish datetime, stored as timestamptz and presented in Africa/Cairo.';
comment on column public.calendar_events.event_type is 'Calendar event category for content, work hours, day off, and general scheduling.';
comment on function public.current_permission_rank(text) is 'Returns the authenticated active user permission rank for RLS policy branching.';
comment on function public.can_access_task_scope(uuid, uuid, uuid, uuid) is 'Task visibility helper combining company, full access, own assignment, and assigned team scope.';

commit;
