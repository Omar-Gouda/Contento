begin;

alter type public.report_type add value if not exists 'monthly';

create or replace function public.assign_critical_ux_rbac_reports_hotfix_for_company(target_company_id uuid)
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
      ('Admin', 'work_hours.view_own', 'full'),
      ('Supervisor', 'work_hours.view_own', 'full'),
      ('Creator', 'work_hours.view_own', 'full'),
      ('Graphic Designer', 'work_hours.view_own', 'full'),
      ('Video Editor', 'work_hours.view_own', 'full'),
      ('Admin', 'reports.submit', 'full'),
      ('Admin', 'reports.view_own', 'full'),
      ('Supervisor', 'reports.submit', 'limited'),
      ('Supervisor', 'reports.view_own', 'full'),
      ('Creator', 'reports.submit', 'full'),
      ('Creator', 'reports.view_own', 'full'),
      ('Graphic Designer', 'reports.submit', 'full'),
      ('Graphic Designer', 'reports.view_own', 'full'),
      ('Video Editor', 'reports.submit', 'full'),
      ('Video Editor', 'reports.view_own', 'full')
  ) as grant_data(role_name, permission_key, access_level)
    on grant_data.role_name = r.name
  join public.permissions p on p.key = grant_data.permission_key
  where r.company_id = target_company_id
  on conflict (role_id, permission_id) do update
  set access_level = excluded.access_level;
end;
$$;

select public.assign_critical_ux_rbac_reports_hotfix_for_company(id)
from public.companies;

create or replace function public.assign_critical_ux_rbac_reports_hotfix_after_company_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assign_critical_ux_rbac_reports_hotfix_for_company(new.id);
  return new;
end;
$$;

drop trigger if exists zzzz_assign_critical_ux_rbac_reports_hotfix_after_company_insert on public.companies;
create trigger zzzz_assign_critical_ux_rbac_reports_hotfix_after_company_insert
after insert on public.companies
for each row execute function public.assign_critical_ux_rbac_reports_hotfix_after_company_insert();

comment on function public.assign_critical_ux_rbac_reports_hotfix_for_company(uuid) is
  'Seeds corrected own work-hours and internal report-generation permissions for Contento internal roles.';

commit;
