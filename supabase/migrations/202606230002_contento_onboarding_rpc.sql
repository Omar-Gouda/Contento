begin;

create or replace function public.create_company_with_admin_profile(
  company_name text,
  company_slug text,
  first_name text,
  last_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  authenticated_user_id uuid := auth.uid();
  authenticated_email text;
  normalized_company_name text := trim(coalesce(company_name, ''));
  normalized_company_slug text := lower(trim(coalesce(company_slug, '')));
  normalized_first_name text := trim(coalesce(first_name, ''));
  normalized_last_name text := trim(coalesce(last_name, ''));
  new_company_id uuid;
  admin_role_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'CONTENTO_AUTH_REQUIRED' using errcode = 'P0001';
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
    where u.id = authenticated_user_id
  ) then
    raise exception 'CONTENTO_PROFILE_EXISTS' using errcode = 'P0001';
  end if;

  select au.email
  into authenticated_email
  from auth.users au
  where au.id = authenticated_user_id;

  if authenticated_email is null or char_length(trim(authenticated_email)) = 0 then
    raise exception 'CONTENTO_AUTH_USER_NOT_FOUND' using errcode = 'P0001';
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
    authenticated_user_id,
    new_company_id,
    authenticated_email,
    normalized_first_name,
    normalized_last_name,
    admin_role_id,
    'active'
  );

  update public.companies
  set owner_user_id = authenticated_user_id
  where id = new_company_id;

  insert into public.company_settings (company_id, settings_json)
  values (new_company_id, '{}'::jsonb)
  on conflict (company_id) do nothing;

  return new_company_id;
end;
$$;

revoke all on function public.create_company_with_admin_profile(text, text, text, text) from public;
grant execute on function public.create_company_with_admin_profile(text, text, text, text) to authenticated;

comment on function public.create_company_with_admin_profile(text, text, text, text)
is 'Bootstraps the first company workspace for an authenticated user with no Contento profile. SECURITY DEFINER is intentional so onboarding can create the tenant root while RLS remains closed to direct table inserts.';

commit;
