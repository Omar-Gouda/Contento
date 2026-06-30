begin;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  slug text,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  contact_person text,
  contact_email text,
  contact_phone text,
  notes text not null default '',
  brief_drive_link text,
  requirements text not null default '',
  assigned_account_manager_id uuid references public.users(id) on delete set null,
  status text not null default 'active',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_not_blank check (btrim(name) <> ''),
  constraint clients_status_check check (status in ('active', 'paused', 'archived')),
  constraint clients_slug_company_unique unique (company_id, slug)
);

create table if not exists public.client_assignments (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assignment_role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint client_assignments_role_check check (
    assignment_role in ('account_manager', 'content_creator', 'graphic_designer', 'video_editor', 'client_contact', 'member')
  ),
  primary key (client_id, user_id, assignment_role)
);

alter table public.tasks
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists final_drive_link text,
  add column if not exists final_output_submitted_at timestamptz,
  add column if not exists final_output_submitted_by uuid references public.users(id) on delete set null;

alter table public.ideas
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists idea_type text not null default 'post',
  add column if not exists platforms text[] not null default '{}',
  add column if not exists headline text not null default '',
  add column if not exists subtext text not null default '',
  add column if not exists visual text not null default '',
  add column if not exists cta text not null default '',
  add column if not exists script text not null default '',
  add column if not exists urgency text not null default 'normal',
  add column if not exists publishing_at timestamptz,
  add column if not exists final_drive_link text;

alter table public.content_items
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists final_drive_link text,
  add column if not exists final_output_submitted_at timestamptz,
  add column if not exists final_output_submitted_by uuid references public.users(id) on delete set null;

alter table public.reports
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists metrics_json jsonb not null default '{}'::jsonb,
  add column if not exists sent_to_client_at timestamptz,
  add column if not exists sent_to_client_by uuid references public.users(id) on delete set null;

alter table public.calendar_events
  add column if not exists client_id uuid references public.clients(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ideas_idea_type_check'
      and conrelid = 'public.ideas'::regclass
  ) then
    alter table public.ideas
      add constraint ideas_idea_type_check check (idea_type in ('post', 'reel', 'story'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ideas_urgency_check'
      and conrelid = 'public.ideas'::regclass
  ) then
    alter table public.ideas
      add constraint ideas_urgency_check check (urgency in ('low', 'normal', 'high', 'urgent'));
  end if;
end $$;

create index if not exists clients_company_status_idx on public.clients(company_id, status);
create index if not exists clients_account_manager_idx on public.clients(assigned_account_manager_id);
create index if not exists client_assignments_user_idx on public.client_assignments(user_id);
create index if not exists tasks_company_client_idx on public.tasks(company_id, client_id);
create index if not exists tasks_final_output_by_idx on public.tasks(final_output_submitted_by);
create index if not exists ideas_company_client_idx on public.ideas(company_id, client_id);
create index if not exists ideas_publishing_at_idx on public.ideas(company_id, publishing_at);
create index if not exists content_items_company_client_idx on public.content_items(company_id, client_id);
create index if not exists content_items_final_output_by_idx on public.content_items(final_output_submitted_by);
create index if not exists reports_company_client_idx on public.reports(company_id, client_id);
create index if not exists calendar_events_company_client_idx on public.calendar_events(company_id, client_id);

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

insert into public.permissions (key, name, description) values
  ('clients.view', 'View clients', 'View assigned client profiles, briefs, contacts, and client-linked work.'),
  ('clients.manage', 'Manage clients', 'Create and edit company client profiles and briefs.'),
  ('clients.assign', 'Assign client teams', 'Assign account managers, production users, and client contacts to client profiles.'),
  ('content.final_output', 'Submit final output', 'Attach final Drive links for produced content and production tasks.'),
  ('reports.send_to_client', 'Send reports to client', 'Mark client-scoped reports as sent to the client.')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

insert into public.roles (company_id, name, description)
select c.id, role_data.name, role_data.description
from public.companies c
cross join (
  values
    ('Graphic Designer', 'Visual production role for client artwork and static creative assets.'),
    ('Video Editor', 'Video production role for editing, reels, and final video handoffs.'),
    ('Client', 'Client-side review role scoped to assigned client profiles and deliverables.')
) as role_data(name, description)
on conflict (company_id, name) do update
set description = excluded.description;

create or replace function public.assign_client_revision_permissions_for_company(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.role_permissions (role_id, permission_id, access_level)
  select r.id, p.id, grant_data.access_level::public.permission_access_level
  from public.roles r
  join (
    values
      ('Admin', 'clients.view', 'full'),
      ('Admin', 'clients.manage', 'full'),
      ('Admin', 'clients.assign', 'full'),
      ('Admin', 'content.final_output', 'full'),
      ('Admin', 'reports.send_to_client', 'full'),
      ('Supervisor', 'clients.view', 'full'),
      ('Supervisor', 'clients.manage', 'limited'),
      ('Supervisor', 'clients.assign', 'limited'),
      ('Supervisor', 'content.final_output', 'limited'),
      ('Supervisor', 'reports.send_to_client', 'limited'),
      ('CC Team Lead', 'clients.view', 'limited'),
      ('CC Team Lead', 'content.final_output', 'limited'),
      ('Creator', 'clients.view', 'limited'),
      ('Creator', 'content.final_output', 'limited'),
      ('Graphic Designer', 'clients.view', 'limited'),
      ('Graphic Designer', 'tasks.view', 'limited'),
      ('Graphic Designer', 'tasks.update_status', 'limited'),
      ('Graphic Designer', 'ideas.review', 'view'),
      ('Graphic Designer', 'content.track_pipeline', 'limited'),
      ('Graphic Designer', 'content.update', 'limited'),
      ('Graphic Designer', 'content.final_output', 'full'),
      ('Graphic Designer', 'calendar.view', 'limited'),
      ('Graphic Designer', 'reports.view_own', 'view'),
      ('Graphic Designer', 'notifications.view', 'full'),
      ('Graphic Designer', 'notifications.manage', 'full'),
      ('Graphic Designer', 'comments.create', 'limited'),
      ('Graphic Designer', 'attachments.manage', 'limited'),
      ('Graphic Designer', 'search.global', 'view'),
      ('Graphic Designer', 'saved_views.manage', 'limited'),
      ('Graphic Designer', 'dashboard.customize', 'full'),
      ('Graphic Designer', 'settings.profile', 'full'),
      ('Graphic Designer', 'settings.notifications', 'full'),
      ('Video Editor', 'clients.view', 'limited'),
      ('Video Editor', 'tasks.view', 'limited'),
      ('Video Editor', 'tasks.update_status', 'limited'),
      ('Video Editor', 'ideas.review', 'view'),
      ('Video Editor', 'content.track_pipeline', 'limited'),
      ('Video Editor', 'content.update', 'limited'),
      ('Video Editor', 'content.final_output', 'full'),
      ('Video Editor', 'calendar.view', 'limited'),
      ('Video Editor', 'reports.view_own', 'view'),
      ('Video Editor', 'notifications.view', 'full'),
      ('Video Editor', 'notifications.manage', 'full'),
      ('Video Editor', 'comments.create', 'limited'),
      ('Video Editor', 'attachments.manage', 'limited'),
      ('Video Editor', 'search.global', 'view'),
      ('Video Editor', 'saved_views.manage', 'limited'),
      ('Video Editor', 'dashboard.customize', 'full'),
      ('Video Editor', 'settings.profile', 'full'),
      ('Video Editor', 'settings.notifications', 'full'),
      ('Client', 'clients.view', 'view'),
      ('Client', 'ideas.review', 'view'),
      ('Client', 'content.track_pipeline', 'view'),
      ('Client', 'calendar.view', 'view'),
      ('Client', 'reports.view_own', 'view'),
      ('Client', 'notifications.view', 'full'),
      ('Client', 'notifications.manage', 'full'),
      ('Client', 'comments.create', 'limited'),
      ('Client', 'dashboard.customize', 'full'),
      ('Client', 'settings.profile', 'full'),
      ('Client', 'settings.notifications', 'full')
  ) as grant_data(role_name, permission_key, access_level)
    on grant_data.role_name = r.name
  join public.permissions p on p.key = grant_data.permission_key
  where r.company_id = target_company_id
  on conflict (role_id, permission_id) do update
  set access_level = excluded.access_level;
end;
$$;

select public.assign_client_revision_permissions_for_company(id) from public.companies;

create or replace function public.assign_client_revision_after_company_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.roles (company_id, name, description) values
    (new.id, 'Graphic Designer', 'Visual production role for client artwork and static creative assets.'),
    (new.id, 'Video Editor', 'Video production role for editing, reels, and final video handoffs.'),
    (new.id, 'Client', 'Client-side review role scoped to assigned client profiles and deliverables.')
  on conflict (company_id, name) do update set description = excluded.description;

  perform public.assign_client_revision_permissions_for_company(new.id);
  return new;
end;
$$;

drop trigger if exists zz_assign_client_revision_after_company_insert on public.companies;
create trigger zz_assign_client_revision_after_company_insert
after insert on public.companies
for each row execute function public.assign_client_revision_after_company_insert();

create or replace function public.is_same_company_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_client_id is null or exists (
    select 1
    from public.clients c
    where c.id = target_client_id
      and c.company_id = public.current_company_id()
  );
$$;

create or replace function public.can_access_client_scope(target_client_id uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_same_company(target_company_id)
    and (
      target_client_id is null
      or exists (
        select 1
        from public.clients c
        where c.id = target_client_id
          and c.company_id = target_company_id
          and (
            public.is_current_user_admin()
            or (
              public.current_role_name() = 'Supervisor'
              and public.current_permission_rank('clients.view') >= 2
              and (
                c.assigned_account_manager_id = auth.uid()
                or exists (
                  select 1
                  from public.client_assignments ca
                  where ca.client_id = c.id
                    and ca.user_id = auth.uid()
                )
              )
            )
            or (
              public.current_permission_rank('clients.view') >= 1
              and exists (
                select 1
                from public.client_assignments ca
                where ca.client_id = c.id
                  and ca.user_id = auth.uid()
              )
            )
          )
      )
    );
$$;

create or replace function public.can_access_entity_scope(target_entity_type text, target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case target_entity_type
    when 'task' then exists (
      select 1
      from public.tasks t
      where t.id = target_entity_id
        and public.can_access_task_scope(t.company_id, t.team_id, t.assigned_to, t.created_by)
        and public.can_access_client_scope(t.client_id, t.company_id)
    )
    when 'idea' then exists (
      select 1
      from public.ideas i
      where i.id = target_entity_id
        and public.can_access_idea_scope(i.company_id, i.team_id, i.assigned_to, i.created_by)
        and public.can_access_client_scope(i.client_id, i.company_id)
    )
    when 'content' then exists (
      select 1
      from public.content_items ci
      where ci.id = target_entity_id
        and public.can_access_content_scope(ci.company_id, ci.team_id, ci.creator_id, ci.status::text)
        and public.can_access_client_scope(ci.client_id, ci.company_id)
    )
    when 'report' then exists (
      select 1
      from public.reports r
      where r.id = target_entity_id
        and public.can_access_report_scope(r.company_id, r.user_id, r.team_id)
        and public.can_access_client_scope(r.client_id, r.company_id)
    )
    else false
  end;
$$;

alter table public.clients enable row level security;
alter table public.client_assignments enable row level security;
alter table public.clients force row level security;
alter table public.client_assignments force row level security;

drop policy if exists "Permitted users can read clients" on public.clients;
create policy "Permitted users can read clients"
on public.clients for select to authenticated
using (public.can_access_client_scope(id, company_id));

drop policy if exists "Permitted users can create clients" on public.clients;
create policy "Permitted users can create clients"
on public.clients for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('clients.manage', 'limited')
  and (created_by is null or created_by = auth.uid())
  and (assigned_account_manager_id is null or public.is_same_company_user(assigned_account_manager_id))
);

drop policy if exists "Permitted users can update clients" on public.clients;
create policy "Permitted users can update clients"
on public.clients for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.has_permission('clients.manage', 'full')
    or (
      public.has_permission('clients.manage', 'limited')
      and assigned_account_manager_id = auth.uid()
    )
  )
)
with check (
  public.is_same_company(company_id)
  and (assigned_account_manager_id is null or public.is_same_company_user(assigned_account_manager_id))
);

drop policy if exists "Permitted users can read client assignments" on public.client_assignments;
create policy "Permitted users can read client assignments"
on public.client_assignments for select to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and public.can_access_client_scope(c.id, c.company_id)
  )
);

drop policy if exists "Permitted users can manage client assignments" on public.client_assignments;
create policy "Permitted users can manage client assignments"
on public.client_assignments for all to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and public.is_same_company(c.company_id)
      and (
        public.has_permission('clients.assign', 'full')
        or (
          public.has_permission('clients.assign', 'limited')
          and c.assigned_account_manager_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and public.is_same_company(c.company_id)
      and public.is_same_company_user(user_id)
      and (
        public.has_permission('clients.assign', 'full')
        or (
          public.has_permission('clients.assign', 'limited')
          and c.assigned_account_manager_id = auth.uid()
        )
      )
  )
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
  and public.can_assign_task_scope(company_id, team_id, assigned_to)
  and public.can_access_client_scope(client_id, company_id)
  and (assigned_by is null or assigned_by = auth.uid())
  and (created_by is null or created_by = auth.uid())
  and (final_output_submitted_by is null or public.is_same_company_user(final_output_submitted_by))
);

drop policy if exists "Permitted users can update tasks" on public.tasks;
create policy "Permitted users can update tasks"
on public.tasks for update to authenticated
using (
  public.can_access_task_scope(company_id, team_id, assigned_to, created_by)
  and public.can_access_client_scope(client_id, company_id)
  and (
    public.has_permission('tasks.update_status', 'limited')
    or public.has_permission('tasks.manage', 'limited')
    or public.has_permission('content.final_output', 'limited')
    or assigned_to = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and public.can_assign_task_scope(company_id, team_id, assigned_to)
  and public.can_access_client_scope(client_id, company_id)
  and (final_output_submitted_by is null or public.is_same_company_user(final_output_submitted_by))
);

drop policy if exists "Permitted users can read ideas" on public.ideas;
create policy "Permitted users can read ideas"
on public.ideas for select to authenticated
using (
  (
    public.can_access_idea_scope(company_id, team_id, assigned_to, created_by)
    or public.can_access_client_scope(client_id, company_id)
  )
  and public.can_access_client_scope(client_id, company_id)
);

drop policy if exists "Permitted users can create ideas" on public.ideas;
create policy "Permitted users can create ideas"
on public.ideas for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('ideas.create', 'limited')
  and public.can_access_client_scope(client_id, company_id)
  and (created_by is null or created_by = auth.uid())
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can update ideas" on public.ideas;
create policy "Permitted users can update ideas"
on public.ideas for update to authenticated
using (
  (
    public.can_access_idea_scope(company_id, team_id, assigned_to, created_by)
    or public.can_access_client_scope(client_id, company_id)
  )
  and public.can_access_client_scope(client_id, company_id)
  and (
    public.has_permission('ideas.update', 'limited')
    or public.has_permission('ideas.manage', 'limited')
    or created_by = auth.uid()
    or assigned_to = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and public.can_access_client_scope(client_id, company_id)
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can read content items" on public.content_items;
create policy "Permitted users can read content items"
on public.content_items for select to authenticated
using (
  (
    public.can_access_content_scope(company_id, team_id, creator_id, status::text)
    or public.can_access_client_scope(client_id, company_id)
  )
  and public.can_access_client_scope(client_id, company_id)
);

drop policy if exists "Permitted users can create content items" on public.content_items;
create policy "Permitted users can create content items"
on public.content_items for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('content.create', 'limited')
  and public.can_access_content_scope(company_id, team_id, creator_id, status::text)
  and public.can_access_client_scope(client_id, company_id)
  and public.is_same_company_task(task_id)
  and public.is_same_company_idea(idea_id)
  and (final_output_submitted_by is null or public.is_same_company_user(final_output_submitted_by))
);

drop policy if exists "Permitted users can update content items" on public.content_items;
create policy "Permitted users can update content items"
on public.content_items for update to authenticated
using (
  (
    public.can_access_content_scope(company_id, team_id, creator_id, status::text)
    or public.can_access_client_scope(client_id, company_id)
  )
  and public.can_access_client_scope(client_id, company_id)
  and (
    public.has_permission('content.update', 'limited')
    or public.has_permission('content.manage', 'limited')
    or public.has_permission('content.final_output', 'limited')
    or creator_id = auth.uid()
    or public.can_review_content_scope(id)
  )
)
with check (
  public.is_same_company(company_id)
  and public.can_access_client_scope(client_id, company_id)
  and public.is_same_company_task(task_id)
  and public.is_same_company_idea(idea_id)
  and (creator_id is null or public.is_same_company_user(creator_id))
  and (final_output_submitted_by is null or public.is_same_company_user(final_output_submitted_by))
);

drop policy if exists "Permitted users can read reports" on public.reports;
create policy "Permitted users can read reports"
on public.reports for select to authenticated
using (
  (
    public.can_access_report_scope(company_id, user_id, team_id)
    or public.can_access_client_scope(client_id, company_id)
  )
  and public.can_access_client_scope(client_id, company_id)
);

drop policy if exists "Permitted users can create reports" on public.reports;
create policy "Permitted users can create reports"
on public.reports for insert to authenticated
with check (
  public.is_same_company(company_id)
  and (
    public.has_permission('reports.submit', 'limited')
    or public.has_permission('reports.create', 'limited')
  )
  and public.can_access_client_scope(client_id, company_id)
  and (user_id is null or user_id = auth.uid() or public.has_permission('reports.view_team', 'limited'))
  and (team_id is null or public.is_same_company_team(team_id))
  and (sent_to_client_by is null or public.is_same_company_user(sent_to_client_by))
);

drop policy if exists "Permitted users can read calendar events" on public.calendar_events;
create policy "Permitted users can read calendar events"
on public.calendar_events for select to authenticated
using (
  public.is_same_company(company_id)
  and public.has_permission('calendar.view', 'view')
  and public.can_access_client_scope(client_id, company_id)
  and (
    public.current_permission_rank('calendar.view') >= 3
    or user_id = auth.uid()
    or public.is_current_user_in_team(team_id)
    or public.is_current_user_teammate(user_id)
    or event_type = 'content'
    or public.can_access_client_scope(client_id, company_id)
  )
);

drop policy if exists "Permitted users can create calendar events" on public.calendar_events;
create policy "Permitted users can create calendar events"
on public.calendar_events for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('calendar.schedule_content', 'limited')
  and public.can_access_client_scope(client_id, company_id)
  and (created_by is null or created_by = auth.uid())
  and (content_id is null or public.is_same_company_content(content_id))
  and (user_id is null or public.is_same_company_user(user_id))
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can update calendar events" on public.calendar_events;
create policy "Permitted users can update calendar events"
on public.calendar_events for update to authenticated
using (
  public.is_same_company(company_id)
  and public.has_permission('calendar.reschedule_content', 'limited')
  and public.can_access_client_scope(client_id, company_id)
)
with check (
  public.is_same_company(company_id)
  and public.can_access_client_scope(client_id, company_id)
  and (content_id is null or public.is_same_company_content(content_id))
  and (user_id is null or public.is_same_company_user(user_id))
  and (team_id is null or public.is_same_company_team(team_id))
);

comment on table public.clients is 'Company-scoped client profiles containing brief, branding, contact, and account ownership metadata.';
comment on table public.client_assignments is 'Client-to-user assignments for account, production, and client contact access boundaries.';
comment on column public.tasks.client_id is 'Optional client scope for agency task delivery and filtering.';
comment on column public.tasks.final_drive_link is 'Final production Drive URL submitted by production roles.';
comment on column public.ideas.client_id is 'Optional client scope for idea review and calendar visibility.';
comment on column public.ideas.idea_type is 'Client-facing idea format: post, reel, or story.';
comment on column public.ideas.publishing_at is 'Target publishing datetime for client content planning in Africa/Cairo.';
comment on column public.content_items.client_id is 'Optional client scope for content lifecycle visibility.';
comment on column public.content_items.final_drive_link is 'Final Drive URL for client-ready creative output.';
comment on column public.reports.client_id is 'Optional client scope for report history and client portal visibility.';
comment on function public.can_access_client_scope(uuid, uuid) is 'Client visibility helper for marketing managers, assigned account managers, assigned production users, and client contacts.';

commit;
