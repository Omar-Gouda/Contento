begin;

insert into public.permissions (key, name, description) values
  ('clients.create', 'Create clients', 'Create client workspaces inside the current company.'),
  ('clients.update', 'Update clients', 'Update assigned or company-wide client profiles.'),
  ('clients.assign_account_manager', 'Assign account manager', 'Assign or self-assign account managers to client profiles.'),
  ('clients.delete', 'Delete clients', 'Archive or delete client profiles inside the current company.'),
  ('clients.view', 'View clients', 'View assigned or company-wide client profiles, briefs, and delivery context.'),
  ('clients.manage', 'Manage clients', 'Manage client workspaces, briefs, and profile details.'),
  ('clients.assign', 'Assign client teams', 'Assign account managers and scoped delivery users to client workspaces.')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

create or replace function public.assign_client_permission_hotfix_for_company(target_company_id uuid)
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
      ('Admin', 'clients.create', 'full'),
      ('Admin', 'clients.update', 'full'),
      ('Admin', 'clients.manage', 'full'),
      ('Admin', 'clients.assign', 'full'),
      ('Admin', 'clients.assign_account_manager', 'full'),
      ('Admin', 'clients.delete', 'full'),
      ('Marketing Manager', 'clients.view', 'full'),
      ('Marketing Manager', 'clients.create', 'full'),
      ('Marketing Manager', 'clients.update', 'full'),
      ('Marketing Manager', 'clients.manage', 'full'),
      ('Marketing Manager', 'clients.assign', 'full'),
      ('Marketing Manager', 'clients.assign_account_manager', 'full'),
      ('Marketing Manager', 'clients.delete', 'full'),
      ('Supervisor', 'clients.view', 'limited'),
      ('Supervisor', 'clients.create', 'limited'),
      ('Supervisor', 'clients.update', 'limited'),
      ('Supervisor', 'clients.manage', 'limited'),
      ('Supervisor', 'clients.assign_account_manager', 'limited'),
      ('Account Manager', 'clients.view', 'limited'),
      ('Account Manager', 'clients.create', 'limited'),
      ('Account Manager', 'clients.update', 'limited'),
      ('Account Manager', 'clients.manage', 'limited'),
      ('Account Manager', 'clients.assign_account_manager', 'limited'),
      ('CC Team Lead', 'clients.view', 'limited'),
      ('Team Lead', 'clients.view', 'limited'),
      ('Creator', 'clients.view', 'limited'),
      ('Content Creator', 'clients.view', 'limited'),
      ('Graphic Designer', 'clients.view', 'limited'),
      ('Video Editor', 'clients.view', 'limited'),
      ('Client', 'clients.view', 'view')
  ) as grant_data(role_name, permission_key, access_level)
    on grant_data.role_name = r.name
  join public.permissions p on p.key = grant_data.permission_key
  where r.company_id = target_company_id
  on conflict (role_id, permission_id) do update
  set access_level = excluded.access_level;
end;
$$;

select public.assign_client_permission_hotfix_for_company(id) from public.companies;

create or replace function public.assign_client_permission_hotfix_after_company_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assign_client_permission_hotfix_for_company(new.id);
  return new;
end;
$$;

drop trigger if exists zzz_assign_client_permission_hotfix_after_company_insert on public.companies;
create trigger zzz_assign_client_permission_hotfix_after_company_insert
after insert on public.companies
for each row execute function public.assign_client_permission_hotfix_after_company_insert();

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_role_name() in ('Admin', 'Marketing Manager'), false);
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
            public.current_permission_rank('clients.view') >= 3
            or (
              public.current_permission_rank('clients.view') >= 1
              and (
                c.assigned_account_manager_id = (select auth.uid())
                or exists (
                  select 1
                  from public.client_assignments ca
                  where ca.client_id = c.id
                    and ca.user_id = (select auth.uid())
                )
              )
            )
          )
      )
    );
$$;

drop policy if exists "Permitted users can read clients" on public.clients;
create policy "Permitted users can read clients"
on public.clients for select to authenticated
using (public.can_access_client_scope(id, company_id));

drop policy if exists "Permitted users can create clients" on public.clients;
create policy "Permitted users can create clients"
on public.clients for insert to authenticated
with check (
  public.is_same_company(company_id)
  and (created_by is null or created_by = (select auth.uid()))
  and (
    (
      (public.current_permission_rank('clients.create') >= 3 or public.current_permission_rank('clients.manage') >= 3)
      and (assigned_account_manager_id is null or public.is_same_company_user(assigned_account_manager_id))
    )
    or (
      (public.current_permission_rank('clients.create') >= 2 or public.current_permission_rank('clients.manage') >= 2)
      and assigned_account_manager_id = (select auth.uid())
    )
  )
);

drop policy if exists "Permitted users can update clients" on public.clients;
create policy "Permitted users can update clients"
on public.clients for update to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.current_permission_rank('clients.update') >= 3
    or public.current_permission_rank('clients.manage') >= 3
    or (
      (public.current_permission_rank('clients.update') >= 2 or public.current_permission_rank('clients.manage') >= 2)
      and assigned_account_manager_id = (select auth.uid())
    )
  )
)
with check (
  public.is_same_company(company_id)
  and (
    (
      (public.current_permission_rank('clients.update') >= 3 or public.current_permission_rank('clients.manage') >= 3)
      and (assigned_account_manager_id is null or public.is_same_company_user(assigned_account_manager_id))
    )
    or (
      (public.current_permission_rank('clients.update') >= 2 or public.current_permission_rank('clients.manage') >= 2)
      and assigned_account_manager_id = (select auth.uid())
    )
  )
);

drop policy if exists "Permitted users can delete clients" on public.clients;
create policy "Permitted users can delete clients"
on public.clients for delete to authenticated
using (
  public.is_same_company(company_id)
  and public.current_permission_rank('clients.delete') >= 3
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
        public.current_permission_rank('clients.assign') >= 3
        or public.current_permission_rank('clients.assign_account_manager') >= 3
        or (
          public.current_permission_rank('clients.assign_account_manager') >= 2
          and c.assigned_account_manager_id = (select auth.uid())
          and user_id = (select auth.uid())
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
        public.current_permission_rank('clients.assign') >= 3
        or public.current_permission_rank('clients.assign_account_manager') >= 3
        or (
          public.current_permission_rank('clients.assign_account_manager') >= 2
          and c.assigned_account_manager_id = (select auth.uid())
          and user_id = (select auth.uid())
        )
      )
  )
);

comment on function public.assign_client_permission_hotfix_for_company(uuid) is 'Backfills client create/update/delete and account-manager assignment permissions for existing and future companies.';
comment on function public.can_access_client_scope(uuid, uuid) is 'Client visibility helper: Marketing Managers see company clients; other roles see only assigned clients.';

commit;
