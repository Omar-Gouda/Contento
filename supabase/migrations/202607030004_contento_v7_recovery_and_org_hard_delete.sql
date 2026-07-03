begin;

alter table public.users
  add column if not exists recovery_email citext,
  add column if not exists recovery_email_verified_at timestamptz,
  add column if not exists recovery_email_pending citext,
  add column if not exists recovery_email_token_hash text,
  add column if not exists recovery_email_token_expires_at timestamptz;

create index if not exists users_recovery_email_idx
  on public.users(recovery_email)
  where recovery_email is not null;

create index if not exists users_recovery_email_pending_idx
  on public.users(recovery_email_pending)
  where recovery_email_pending is not null;

create or replace function public.update_current_user_recovery_email(recovery_email_input text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email citext := lower(trim(coalesce(recovery_email_input, '')));
begin
  if auth.uid() is null then
    raise exception 'CONTENTO_AUTH_REQUIRED';
  end if;

  if normalized_email = '' or normalized_email::text !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'CONTENTO_INVALID_RECOVERY_EMAIL';
  end if;

  update public.users
  set
    recovery_email = normalized_email,
    recovery_email_pending = null,
    recovery_email_token_hash = null,
    recovery_email_token_expires_at = null,
    recovery_email_verified_at = null,
    updated_at = now()
  where id = auth.uid()
    and status = 'active';

  return found;
end;
$$;

create or replace function public.clear_current_user_recovery_email()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'CONTENTO_AUTH_REQUIRED';
  end if;

  update public.users
  set
    recovery_email = null,
    recovery_email_pending = null,
    recovery_email_token_hash = null,
    recovery_email_token_expires_at = null,
    recovery_email_verified_at = null,
    updated_at = now()
  where id = auth.uid()
    and status = 'active';

  return found;
end;
$$;

create or replace function public.hard_delete_organization_database(target_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_platform_admin() then
    raise exception 'CONTENTO_PLATFORM_ADMIN_REQUIRED';
  end if;

  if not exists (select 1 from public.companies where id = target_company_id) then
    raise exception 'CONTENTO_ORGANIZATION_NOT_FOUND';
  end if;

  update public.companies
  set owner_user_id = null
  where id = target_company_id;

  delete from public.users
  where company_id = target_company_id;

  delete from public.companies
  where id = target_company_id;

  return true;
end;
$$;

revoke all on function public.update_current_user_recovery_email(text) from public;
revoke all on function public.clear_current_user_recovery_email() from public;
revoke all on function public.hard_delete_organization_database(uuid) from public;

grant execute on function public.update_current_user_recovery_email(text) to authenticated;
grant execute on function public.clear_current_user_recovery_email() to authenticated;
grant execute on function public.hard_delete_organization_database(uuid) to authenticated;

comment on column public.users.recovery_email is 'Optional profile recovery email. Supabase Auth reset links still go to the auth email; internal recovery notifications use this value as a fallback signal.';
comment on column public.users.recovery_email_verified_at is 'Reserved for future recovery-email verification delivery.';
comment on function public.hard_delete_organization_database(uuid) is 'Platform-admin-only transactional tenant database cleanup. Auth users and storage objects are cleaned by server-only application code after this succeeds.';

commit;
