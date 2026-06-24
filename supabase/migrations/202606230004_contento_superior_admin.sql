begin;

create type public.superior_admin_status as enum ('active', 'suspended');

create table public.superior_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  status public.superior_admin_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_superior_admins_updated_at
before update on public.superior_admins
for each row execute function public.set_updated_at();

create or replace function public.is_superior_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.superior_admins sa
    where sa.id = auth.uid()
      and sa.status = 'active'
  );
$$;

create or replace function public.create_organization_with_admin_profile(
  company_name text,
  company_slug text,
  admin_user_id uuid,
  admin_email text,
  admin_first_name text,
  admin_last_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_company_name text := trim(coalesce(company_name, ''));
  normalized_company_slug text := lower(trim(coalesce(company_slug, '')));
  normalized_admin_email citext := lower(trim(coalesce(admin_email, '')))::citext;
  normalized_first_name text := trim(coalesce(admin_first_name, ''));
  normalized_last_name text := trim(coalesce(admin_last_name, ''));
  new_company_id uuid;
  admin_role_id uuid;
begin
  if not public.is_superior_admin() then
    raise exception 'CONTENTO_SUPERIOR_ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  if admin_user_id is null then
    raise exception 'CONTENTO_ORG_ADMIN_AUTH_USER_REQUIRED' using errcode = 'P0001';
  end if;

  if char_length(normalized_company_name) < 2 or char_length(normalized_company_name) > 120 then
    raise exception 'CONTENTO_COMPANY_NAME_REQUIRED' using errcode = 'P0001';
  end if;

  if char_length(normalized_company_slug) < 3
    or char_length(normalized_company_slug) > 64
    or normalized_company_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'CONTENTO_INVALID_COMPANY_SLUG' using errcode = 'P0001';
  end if;

  if normalized_admin_email::text !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'CONTENTO_INVALID_ADMIN_EMAIL' using errcode = 'P0001';
  end if;

  if char_length(normalized_first_name) = 0
    or char_length(normalized_first_name) > 80
    or char_length(normalized_last_name) = 0
    or char_length(normalized_last_name) > 80
  then
    raise exception 'CONTENTO_PROFILE_NAME_REQUIRED' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.users u
    where u.id = admin_user_id
       or u.email = normalized_admin_email
  ) then
    raise exception 'CONTENTO_ORG_ADMIN_PROFILE_EXISTS' using errcode = 'P0001';
  end if;

  insert into public.companies (name, slug, status)
  values (normalized_company_name, normalized_company_slug, 'active')
  returning id into new_company_id;

  select r.id
  into admin_role_id
  from public.roles r
  where r.company_id = new_company_id
    and r.name = 'Admin'
  limit 1;

  if admin_role_id is null then
    raise exception 'CONTENTO_ADMIN_ROLE_NOT_CREATED' using errcode = 'P0001';
  end if;

  insert into public.users (
    id,
    company_id,
    email,
    first_name,
    last_name,
    role_id,
    status
  )
  values (
    admin_user_id,
    new_company_id,
    normalized_admin_email,
    normalized_first_name,
    normalized_last_name,
    admin_role_id,
    'active'
  );

  update public.companies
  set owner_user_id = admin_user_id
  where id = new_company_id;

  insert into public.company_settings (company_id, settings_json)
  values (new_company_id, '{}'::jsonb)
  on conflict (company_id) do nothing;

  return new_company_id;
end;
$$;

alter table public.superior_admins enable row level security;
alter table public.superior_admins force row level security;

create policy "Superior admins can read own account"
on public.superior_admins for select to authenticated
using (id = (select auth.uid()));

revoke all on function public.create_organization_with_admin_profile(text, text, uuid, text, text, text) from public;
grant execute on function public.create_organization_with_admin_profile(text, text, uuid, text, text, text) to authenticated;

comment on table public.superior_admins is 'Platform-level superior admins. They are not company users and only bootstrap organizations and organization Admin accounts.';
comment on function public.is_superior_admin() is 'Returns true when the authenticated user is an active platform superior admin.';
comment on function public.create_organization_with_admin_profile(text, text, uuid, text, text, text) is 'Superior-admin-only organization bootstrap function. Creates a company, default roles, company settings, and active Org Admin profile.';

commit;
