begin;

insert into public.permissions (key, name, description) values
  ('clients.assign', 'Assign client teams', 'Assign account managers and scoped delivery users to client workspaces.')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id, access_level)
select r.id, p.id, grant_data.access_level::public.permission_access_level
from public.roles r
join (
  values
    ('Admin', 'clients.assign', 'full'),
    ('Marketing Manager', 'clients.assign', 'full'),
    ('Supervisor', 'clients.assign', 'limited'),
    ('Account Manager', 'clients.assign', 'limited')
) as grant_data(role_name, permission_key, access_level)
  on grant_data.role_name = r.name
join public.permissions p on p.key = grant_data.permission_key
on conflict (role_id, permission_id) do update
set access_level = excluded.access_level;

create index if not exists client_assignments_client_user_idx
  on public.client_assignments(client_id, user_id);

create index if not exists clients_company_account_manager_idx
  on public.clients(company_id, assigned_account_manager_id);

create or replace function public.is_client_assignable_production_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_user_id is not null and exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = target_user_id
      and u.company_id = public.current_company_id()
      and u.status = 'active'
      and r.name in ('Creator', 'Content Creator', 'Graphic Designer', 'Video Editor')
  );
$$;

create or replace function public.can_manage_client_assignment_scope(
  target_client_id uuid,
  target_user_id uuid,
  target_assignment_role text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = target_client_id
      and public.is_same_company(c.company_id)
      and public.is_same_company_user(target_user_id)
      and (
        public.current_permission_rank('clients.assign') >= 3
        or public.current_permission_rank('clients.assign_account_manager') >= 3
        or (
          public.current_role_name() in ('Supervisor', 'Account Manager')
          and public.current_permission_rank('clients.assign') >= 2
          and c.assigned_account_manager_id = (select auth.uid())
          and target_assignment_role in ('content_creator', 'graphic_designer', 'video_editor')
          and public.is_client_assignable_production_user(target_user_id)
          and public.is_current_user_teammate(target_user_id)
        )
      )
  );
$$;

drop policy if exists "Permitted users can manage client assignments" on public.client_assignments;
create policy "Permitted users can manage client assignments"
on public.client_assignments for all to authenticated
using (
  public.can_manage_client_assignment_scope(client_id, user_id, assignment_role)
)
with check (
  public.can_manage_client_assignment_scope(client_id, user_id, assignment_role)
);

comment on function public.can_manage_client_assignment_scope(uuid, uuid, text) is 'Client assignment write helper: Marketing Managers have company-wide access; Account Managers can manage same-team production users on assigned clients.';
comment on function public.is_client_assignable_production_user(uuid) is 'Checks active same-company production users eligible for scoped Account Manager client assignments.';

commit;
