begin;

alter table public.teams
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table public.tasks
  add column if not exists assigned_by uuid references public.users(id) on delete set null;

alter table public.ideas
  add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.content_items
  add column if not exists idea_id uuid references public.ideas(id) on delete set null,
  add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.reports
  add column if not exists title text not null default '',
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists date_range_start date,
  add column if not exists date_range_end date,
  add column if not exists updated_at timestamptz not null default now();

update public.reports
set title = coalesce(nullif(content ->> 'title', ''), title)
where title = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_valid_date_range'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
    add constraint reports_valid_date_range check (
      date_range_start is null
      or date_range_end is null
      or date_range_end >= date_range_start
    );
  end if;
end $$;

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create index if not exists teams_created_by_idx on public.teams(created_by);
create index if not exists tasks_assigned_by_idx on public.tasks(assigned_by);
create index if not exists ideas_company_team_idx on public.ideas(company_id, team_id);
create index if not exists content_items_company_team_idx on public.content_items(company_id, team_id);
create index if not exists content_items_idea_id_idx on public.content_items(idea_id);
create index if not exists reports_company_team_idx on public.reports(company_id, team_id);
create index if not exists reports_date_range_idx on public.reports(company_id, date_range_start, date_range_end);

insert into public.permissions (key, name, description) values
  ('teams.view', 'View teams', 'View team workspace, roster, and team statistics.'),
  ('teams.manage', 'Manage teams', 'Create, edit, archive, and assign teams.'),
  ('tasks.manage', 'Manage tasks', 'Create, assign, reassign, and update task workflow records.'),
  ('tasks.update_own', 'Update own tasks', 'Update status or comments on assigned own tasks.'),
  ('ideas.view', 'View ideas', 'View idea records within permitted scope.'),
  ('ideas.manage', 'Manage ideas', 'Edit, assign, review, approve, reject, archive, or delete ideas.'),
  ('ideas.update_own', 'Update own ideas', 'Update own draft or assigned ideas.'),
  ('content.view', 'View content', 'View content pipeline records within permitted scope.'),
  ('content.manage', 'Manage content', 'Edit, assign, schedule, publish, or archive content records.'),
  ('content.review', 'Review content', 'Approve, reject, or request changes on content submissions.'),
  ('reports.view', 'View reports', 'View report records within permitted scope.'),
  ('reports.create', 'Create reports', 'Create daily, weekly, user, team, or company reports.'),
  ('reports.export', 'Export reports', 'Export report records to CSV.')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;

with role_alias_grants(role_name, permission_key, access_level) as (
  values
    ('Admin', 'teams.view', 'full'::public.permission_access_level),
    ('Admin', 'teams.manage', 'full'::public.permission_access_level),
    ('Admin', 'tasks.manage', 'full'::public.permission_access_level),
    ('Admin', 'tasks.update_own', 'full'::public.permission_access_level),
    ('Admin', 'ideas.view', 'full'::public.permission_access_level),
    ('Admin', 'ideas.manage', 'full'::public.permission_access_level),
    ('Admin', 'ideas.update_own', 'full'::public.permission_access_level),
    ('Admin', 'content.view', 'full'::public.permission_access_level),
    ('Admin', 'content.manage', 'full'::public.permission_access_level),
    ('Admin', 'content.review', 'full'::public.permission_access_level),
    ('Admin', 'reports.view', 'full'::public.permission_access_level),
    ('Admin', 'reports.create', 'full'::public.permission_access_level),
    ('Admin', 'reports.export', 'full'::public.permission_access_level),
    ('Supervisor', 'teams.view', 'limited'::public.permission_access_level),
    ('Supervisor', 'teams.manage', 'limited'::public.permission_access_level),
    ('Supervisor', 'tasks.manage', 'limited'::public.permission_access_level),
    ('Supervisor', 'tasks.update_own', 'limited'::public.permission_access_level),
    ('Supervisor', 'ideas.view', 'full'::public.permission_access_level),
    ('Supervisor', 'ideas.manage', 'full'::public.permission_access_level),
    ('Supervisor', 'ideas.update_own', 'limited'::public.permission_access_level),
    ('Supervisor', 'content.view', 'full'::public.permission_access_level),
    ('Supervisor', 'content.manage', 'limited'::public.permission_access_level),
    ('Supervisor', 'content.review', 'full'::public.permission_access_level),
    ('Supervisor', 'reports.view', 'limited'::public.permission_access_level),
    ('Supervisor', 'reports.create', 'limited'::public.permission_access_level),
    ('Supervisor', 'reports.export', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'teams.view', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'tasks.manage', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'tasks.update_own', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'ideas.view', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'ideas.manage', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'ideas.update_own', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'content.view', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'content.manage', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'content.review', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'reports.view', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'reports.create', 'limited'::public.permission_access_level),
    ('Creator', 'teams.view', 'view'::public.permission_access_level),
    ('Creator', 'tasks.update_own', 'limited'::public.permission_access_level),
    ('Creator', 'ideas.view', 'view'::public.permission_access_level),
    ('Creator', 'ideas.update_own', 'limited'::public.permission_access_level),
    ('Creator', 'content.view', 'limited'::public.permission_access_level),
    ('Creator', 'reports.view', 'view'::public.permission_access_level),
    ('Creator', 'reports.create', 'full'::public.permission_access_level)
)
insert into public.role_permissions (role_id, permission_id, access_level)
select r.id, p.id, rag.access_level
from role_alias_grants rag
join public.roles r on r.name = rag.role_name
join public.permissions p on p.key = rag.permission_key
on conflict (role_id, permission_id) do update
set access_level = excluded.access_level;

create or replace function public.is_same_company_idea(target_idea_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_idea_id is null or exists (
    select 1
    from public.ideas i
    where i.id = target_idea_id
      and i.company_id = public.current_company_id()
  );
$$;

create or replace function public.can_access_report_scope(
  target_company_id uuid,
  target_user_id uuid,
  target_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_same_company(target_company_id)
    and (
      public.current_permission_rank('reports.view_company') >= 1
      or public.current_permission_rank('reports.view') >= 3
      or target_user_id = auth.uid()
      or (
        public.current_permission_rank('reports.view_team') >= 1
        and (
          public.is_current_user_in_team(target_team_id)
          or public.is_current_user_teammate(target_user_id)
        )
      )
    );
$$;

drop policy if exists "Permitted users can create teams" on public.teams;
create policy "Permitted users can create teams"
on public.teams for insert to authenticated
with check (
  public.is_same_company(company_id)
  and (
    public.has_permission('teams.create', 'limited')
    or public.has_permission('teams.manage', 'limited')
  )
  and (team_lead_id is null or public.is_same_company_user(team_lead_id))
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Permitted users can update teams" on public.teams;
create policy "Permitted users can update teams"
on public.teams for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('teams.create', 'limited')
    or public.has_permission('teams.manage', 'limited')
  )
)
with check (
  public.is_same_company(company_id)
  and (team_lead_id is null or public.is_same_company_user(team_lead_id))
  and (created_by is null or public.is_same_company_user(created_by))
);

drop policy if exists "Permitted users can create tasks" on public.tasks;
create policy "Permitted users can create tasks"
on public.tasks for insert to authenticated
with check (
  public.is_same_company(company_id)
  and (
    public.has_permission('tasks.create', 'limited')
    or public.has_permission('tasks.manage', 'limited')
  )
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (assigned_by is null or assigned_by = auth.uid())
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
    or public.has_permission('tasks.manage', 'limited')
    or assigned_to = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (assigned_by is null or assigned_by = auth.uid() or public.is_same_company_user(assigned_by))
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can create ideas" on public.ideas;
create policy "Permitted users can create ideas"
on public.ideas for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('ideas.create', 'limited')
  and (created_by is null or created_by = auth.uid())
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can update ideas" on public.ideas;
create policy "Permitted users can update ideas"
on public.ideas for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('ideas.update', 'limited')
    or public.has_permission('ideas.manage', 'limited')
    or created_by = auth.uid()
    or assigned_to = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can create content items" on public.content_items;
create policy "Permitted users can create content items"
on public.content_items for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('content.create', 'limited')
  and (creator_id is null or public.is_same_company_user(creator_id))
  and public.is_same_company_task(task_id)
  and public.is_same_company_idea(idea_id)
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can update content items" on public.content_items;
create policy "Permitted users can update content items"
on public.content_items for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('content.update', 'limited')
    or public.has_permission('content.manage', 'limited')
    or creator_id = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and (creator_id is null or public.is_same_company_user(creator_id))
  and public.is_same_company_task(task_id)
  and public.is_same_company_idea(idea_id)
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can read reports" on public.reports;
create policy "Permitted users can read reports"
on public.reports for select to authenticated
using (public.can_access_report_scope(company_id, user_id, team_id));

drop policy if exists "Permitted users can create reports" on public.reports;
create policy "Permitted users can create reports"
on public.reports for insert to authenticated
with check (
  public.is_same_company(company_id)
  and (
    public.has_permission('reports.submit', 'limited')
    or public.has_permission('reports.create', 'limited')
  )
  and (user_id is null or user_id = auth.uid() or public.has_permission('reports.view_team', 'limited'))
  and (team_id is null or public.is_same_company_team(team_id))
);

comment on column public.teams.created_by is 'User who created the team, if captured by the application action.';
comment on column public.tasks.assigned_by is 'User who most recently assigned or reassigned the task.';
comment on column public.ideas.team_id is 'Optional team scope for review and workload visibility.';
comment on column public.content_items.idea_id is 'Optional idea linked to the content item.';
comment on column public.content_items.team_id is 'Optional team scope for pipeline and calendar visibility.';
comment on column public.reports.title is 'Report title duplicated from content JSON for filtering, exports, and detail views.';
comment on column public.reports.team_id is 'Optional team scope for team reports and scoped report visibility.';
comment on column public.reports.date_range_start is 'Optional report coverage start date.';
comment on column public.reports.date_range_end is 'Optional report coverage end date.';
comment on function public.is_same_company_idea(uuid) is 'Checks that an idea link belongs to the authenticated user company.';
comment on function public.can_access_report_scope(uuid, uuid, uuid) is 'Report visibility helper combining company, own, team, and company report access.';

commit;
