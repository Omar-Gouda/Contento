begin;

alter type public.content_status add value if not exists 'submitted_to_team_lead';
alter type public.content_status add value if not exists 'changes_requested_by_team_lead';
alter type public.content_status add value if not exists 'sent_to_supervisor';
alter type public.content_status add value if not exists 'changes_requested_by_supervisor';
alter type public.content_status add value if not exists 'rejected';

create table if not exists public.content_ratings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  reviewer_id uuid references public.users(id) on delete set null,
  rating_value integer not null check (rating_value between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint content_ratings_unique_reviewer unique (content_id, reviewer_id)
);

create index if not exists content_ratings_company_id_idx on public.content_ratings(company_id);
create index if not exists content_ratings_content_id_idx on public.content_ratings(content_id);
create index if not exists content_ratings_reviewer_id_idx on public.content_ratings(reviewer_id);

alter table public.content_ratings enable row level security;
alter table public.content_ratings force row level security;

insert into public.permissions (key, name, description) values
  ('content.rate', 'Rate reviewed content', 'Rate submitted content during team lead, supervisor, or admin review.')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;

with grants(role_name, permission_key, access_level) as (
  values
    ('Admin', 'content.rate', 'full'::public.permission_access_level),
    ('Supervisor', 'content.rate', 'full'::public.permission_access_level),
    ('CC Team Lead', 'content.rate', 'limited'::public.permission_access_level)
)
insert into public.role_permissions (role_id, permission_id, access_level)
select r.id, p.id, grants.access_level
from grants
join public.roles r on r.name = grants.role_name
join public.permissions p on p.key = grants.permission_key
on conflict (role_id, permission_id) do update
set access_level = excluded.access_level;

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

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_role_name() = 'Admin';
$$;

create or replace function public.is_user_in_team(target_user_id uuid, target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_user_id is not null
    and target_team_id is not null
    and exists (
      select 1
      from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = target_user_id
        and tm.team_id = target_team_id
        and t.company_id = public.current_company_id()
    );
$$;

create or replace function public.is_current_user_team_lead_for_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_team_id is not null
    and exists (
      select 1
      from public.teams t
      where t.id = target_team_id
        and t.company_id = public.current_company_id()
        and t.team_lead_id = auth.uid()
    );
$$;

create or replace function public.is_current_user_team_lead_for_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_user_id is not null
    and exists (
      select 1
      from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = target_user_id
        and t.company_id = public.current_company_id()
        and t.team_lead_id = auth.uid()
    );
$$;

create or replace function public.can_access_user_scope(target_user_id uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_same_company(target_company_id)
    and (
      target_user_id = auth.uid()
      or public.is_current_user_admin()
      or (
        public.current_role_name() in ('Supervisor', 'CC Team Lead')
        and public.current_permission_rank('users.view_activity') >= 2
        and (
          public.is_current_user_teammate(target_user_id)
          or public.is_current_user_team_lead_for_user(target_user_id)
        )
      )
    );
$$;

create or replace function public.can_manage_team_member_scope(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_team_id is not null
    and public.is_same_company_team(target_team_id)
    and (
      public.is_current_user_admin()
      or (
        public.current_role_name() = 'Supervisor'
        and public.current_permission_rank('teams.assign_members') >= 2
        and public.is_current_user_in_team(target_team_id)
      )
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
      public.is_current_user_admin()
      or target_assignee_id = auth.uid()
      or target_creator_id = auth.uid()
      or (
        public.current_role_name() = 'Supervisor'
        and public.current_permission_rank('tasks.view') >= 2
        and (
          public.is_current_user_in_team(target_team_id)
          or public.is_current_user_teammate(target_assignee_id)
        )
      )
      or (
        public.current_role_name() = 'CC Team Lead'
        and public.current_permission_rank('tasks.view') >= 2
        and (
          public.is_current_user_team_lead_for_team(target_team_id)
          or public.is_current_user_team_lead_for_user(target_assignee_id)
        )
      )
    );
$$;

create or replace function public.can_assign_task_scope(
  target_company_id uuid,
  target_team_id uuid,
  target_assignee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_same_company(target_company_id)
    and (
      public.is_current_user_admin()
      or (
        public.current_role_name() = 'Supervisor'
        and public.current_permission_rank('tasks.assign') >= 2
        and (
          target_team_id is null
          or public.is_current_user_in_team(target_team_id)
        )
        and (
          target_assignee_id is null
          or public.is_current_user_teammate(target_assignee_id)
        )
        and (
          target_team_id is null
          or target_assignee_id is null
          or public.is_user_in_team(target_assignee_id, target_team_id)
        )
      )
      or (
        public.current_role_name() = 'CC Team Lead'
        and public.current_permission_rank('tasks.assign') >= 2
        and (
          target_team_id is null
          or public.is_current_user_team_lead_for_team(target_team_id)
        )
        and (
          target_assignee_id is null
          or public.is_current_user_team_lead_for_user(target_assignee_id)
        )
        and (
          target_team_id is null
          or target_assignee_id is null
          or public.is_user_in_team(target_assignee_id, target_team_id)
        )
      )
    );
$$;

create or replace function public.can_access_content_scope(
  target_company_id uuid,
  target_team_id uuid,
  target_creator_id uuid,
  target_status text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_same_company(target_company_id)
    and (
      public.is_current_user_admin()
      or target_creator_id = auth.uid()
      or (
        target_status <> 'draft'
        and public.current_role_name() = 'Supervisor'
        and public.current_permission_rank('content.track_pipeline') >= 2
        and (
          public.is_current_user_in_team(target_team_id)
          or public.is_current_user_teammate(target_creator_id)
        )
      )
      or (
        target_status <> 'draft'
        and public.current_role_name() = 'CC Team Lead'
        and public.current_permission_rank('content.track_pipeline') >= 2
        and (
          public.is_current_user_team_lead_for_team(target_team_id)
          or public.is_current_user_team_lead_for_user(target_creator_id)
        )
      )
    );
$$;

create or replace function public.can_review_content_scope(target_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_content_id is not null
    and exists (
      select 1
      from public.content_items ci
      where ci.id = target_content_id
        and ci.company_id = public.current_company_id()
        and ci.status::text <> 'draft'
        and (
          public.is_current_user_admin()
          or (
            public.current_role_name() = 'CC Team Lead'
            and ci.status::text in ('submitted_to_team_lead', 'changes_requested_by_supervisor')
            and (
              public.is_current_user_team_lead_for_team(ci.team_id)
              or public.is_current_user_team_lead_for_user(ci.creator_id)
            )
          )
          or (
            public.current_role_name() = 'Supervisor'
            and ci.status::text = 'sent_to_supervisor'
            and (
              public.is_current_user_in_team(ci.team_id)
              or public.is_current_user_teammate(ci.creator_id)
            )
          )
        )
    );
$$;

create or replace function public.can_rate_content_scope(target_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_content_id is not null
    and exists (
      select 1
      from public.content_items ci
      where ci.id = target_content_id
        and ci.company_id = public.current_company_id()
        and ci.status::text <> 'draft'
        and (
          public.is_current_user_admin()
          or (
            ci.creator_id <> auth.uid()
            and public.can_review_content_scope(ci.id)
          )
        )
    );
$$;

drop policy if exists "Permitted users can read company users" on public.users;
create policy "Permitted users can read company users"
on public.users for select to authenticated
using (public.can_access_user_scope(id, company_id));

drop policy if exists "Permitted users can manage team members" on public.team_members;
create policy "Permitted users can manage team members"
on public.team_members for all to authenticated
using (public.can_manage_team_member_scope(team_id))
with check (
  public.can_manage_team_member_scope(team_id)
  and public.can_access_user_scope(user_id, public.current_company_id())
);

drop policy if exists "Permitted users can read team members" on public.team_members;
create policy "Permitted users can read team members"
on public.team_members for select to authenticated
using (
  public.is_same_company_team(team_id)
  and (
    public.is_current_user_admin()
    or public.is_current_user_in_team(team_id)
    or public.is_current_user_team_lead_for_team(team_id)
  )
);

drop policy if exists "Permitted users can read company teams" on public.teams;
create policy "Permitted users can read company teams"
on public.teams for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.is_current_user_admin()
    or public.is_current_user_in_team(id)
    or public.is_current_user_team_lead_for_team(id)
  )
);

drop policy if exists "Permitted users can update teams" on public.teams;
create policy "Permitted users can update teams"
on public.teams for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.is_current_user_admin()
    or public.can_manage_team_member_scope(id)
  )
)
with check (
  public.is_same_company(company_id)
  and (team_lead_id is null or public.can_access_user_scope(team_lead_id, company_id))
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
  and (assigned_by is null or assigned_by = auth.uid())
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
  and public.can_assign_task_scope(company_id, team_id, assigned_to)
);

drop policy if exists "Permitted users can read content items" on public.content_items;
create policy "Permitted users can read content items"
on public.content_items for select to authenticated
using (public.can_access_content_scope(company_id, team_id, creator_id, status::text));

drop policy if exists "Permitted users can create content items" on public.content_items;
create policy "Permitted users can create content items"
on public.content_items for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('content.create', 'limited')
  and public.can_access_content_scope(company_id, team_id, creator_id, status::text)
  and public.is_same_company_task(task_id)
  and public.is_same_company_idea(idea_id)
);

drop policy if exists "Permitted users can update content items" on public.content_items;
create policy "Permitted users can update content items"
on public.content_items for update to authenticated
using (
  public.can_access_content_scope(company_id, team_id, creator_id, status::text)
  and (
    public.has_permission('content.update', 'limited')
    or public.has_permission('content.manage', 'limited')
    or creator_id = auth.uid()
    or public.can_review_content_scope(id)
  )
)
with check (
  public.is_same_company(company_id)
  and public.can_access_content_scope(company_id, team_id, creator_id, status::text)
  and public.is_same_company_task(task_id)
  and public.is_same_company_idea(idea_id)
);

drop policy if exists "Permitted users can read content reviews" on public.content_reviews;
create policy "Permitted users can read content reviews"
on public.content_reviews for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    reviewer_id = auth.uid()
    or public.can_review_content_scope(content_id)
    or exists (
      select 1
      from public.content_items ci
      where ci.id = content_id
        and public.can_access_content_scope(ci.company_id, ci.team_id, ci.creator_id, ci.status::text)
    )
  )
);

drop policy if exists "Permitted users can create content reviews" on public.content_reviews;
create policy "Permitted users can create content reviews"
on public.content_reviews for insert to authenticated
with check (
  public.is_same_company(company_id)
  and reviewer_id = auth.uid()
  and public.has_permission('reviews.add_feedback', 'limited')
  and public.can_review_content_scope(content_id)
);

create policy "Permitted users can read content ratings"
on public.content_ratings for select to authenticated
using (
  public.is_same_company(company_id)
  and exists (
    select 1
    from public.content_items ci
    where ci.id = content_id
      and public.can_access_content_scope(ci.company_id, ci.team_id, ci.creator_id, ci.status::text)
  )
);

create policy "Permitted users can create content ratings"
on public.content_ratings for insert to authenticated
with check (
  public.is_same_company(company_id)
  and reviewer_id = auth.uid()
  and public.has_permission('content.rate', 'limited')
  and public.can_rate_content_scope(content_id)
);

create policy "Permitted users can update own content ratings"
on public.content_ratings for update to authenticated
using (
  public.is_same_company(company_id)
  and reviewer_id = auth.uid()
  and public.can_rate_content_scope(content_id)
)
with check (
  public.is_same_company(company_id)
  and reviewer_id = auth.uid()
  and public.can_rate_content_scope(content_id)
);

create policy "Admins can delete content ratings"
on public.content_ratings for delete to authenticated
using (public.is_same_company(company_id) and public.is_current_user_admin());

comment on table public.content_ratings is 'Company-scoped ratings attached to reviewed content submissions.';
comment on function public.can_access_user_scope(uuid, uuid) is 'User visibility helper for own profile, admin company scope, and supervisor/team lead team scope.';
comment on function public.can_assign_task_scope(uuid, uuid, uuid) is 'Task assignment helper preventing team leads from assigning outside their led teams.';
comment on function public.can_access_content_scope(uuid, uuid, uuid, text) is 'Content visibility helper that hides private drafts from reviewers outside ownership.';
comment on function public.can_review_content_scope(uuid) is 'Review helper for team lead and supervisor handoff states.';
comment on function public.can_rate_content_scope(uuid) is 'Rating helper for submitted content that blocks private drafts and self-rating outside admin override.';

commit;
