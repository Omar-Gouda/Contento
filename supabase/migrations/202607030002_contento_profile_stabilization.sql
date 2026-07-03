begin;

alter table public.users
add column if not exists phone text,
add column if not exists job_title text,
add column if not exists bio text not null default '',
add column if not exists timezone text not null default 'Africa/Cairo',
add column if not exists notification_preferences jsonb not null default '{"sound": true, "toast": true, "desktop": false}'::jsonb,
add column if not exists last_login_at timestamptz,
add column if not exists profile_completed_at timestamptz;

alter table public.users
drop constraint if exists users_timezone_supported_check;

alter table public.users
add constraint users_timezone_supported_check
check (timezone = 'Africa/Cairo');

update public.users
set
  bio = coalesce(bio, ''),
  timezone = coalesce(timezone, 'Africa/Cairo'),
  notification_preferences = coalesce(notification_preferences, '{"sound": true, "toast": true, "desktop": false}'::jsonb)
where bio is null
   or timezone is null
   or notification_preferences is null;

create or replace function public.update_current_user_profile(
  profile_first_name text,
  profile_last_name text,
  profile_phone text,
  profile_job_title text,
  profile_bio text,
  profile_timezone text,
  profile_notification_preferences jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_first_name text := trim(coalesce(profile_first_name, ''));
  normalized_last_name text := trim(coalesce(profile_last_name, ''));
  normalized_timezone text := trim(coalesce(profile_timezone, 'Africa/Cairo'));
begin
  if current_user_id is null then
    return false;
  end if;

  if normalized_first_name = '' or normalized_last_name = '' then
    return false;
  end if;

  if normalized_timezone <> 'Africa/Cairo' then
    return false;
  end if;

  update public.users
  set
    first_name = normalized_first_name,
    last_name = normalized_last_name,
    phone = nullif(trim(coalesce(profile_phone, '')), ''),
    job_title = nullif(trim(coalesce(profile_job_title, '')), ''),
    bio = trim(coalesce(profile_bio, '')),
    timezone = normalized_timezone,
    notification_preferences = jsonb_strip_nulls(
      coalesce(public.users.notification_preferences, '{}'::jsonb)
      || coalesce(profile_notification_preferences, '{}'::jsonb)
    ),
    profile_completed_at = coalesce(public.users.profile_completed_at, now())
  where id = current_user_id
    and status = 'active';

  return found;
end;
$$;

create or replace function public.update_current_user_avatar(avatar_path text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_company_id uuid;
begin
  if current_user_id is null then
    return false;
  end if;

  select u.company_id
  into current_company_id
  from public.users u
  where u.id = current_user_id
    and u.status = 'active';

  if current_company_id is null then
    return false;
  end if;

  if avatar_path is not null and avatar_path !~ ('^' || current_company_id::text || '/' || current_user_id::text || '/') then
    return false;
  end if;

  update public.users
  set avatar_url = avatar_path
  where id = current_user_id
    and company_id = current_company_id;

  return found;
end;
$$;

create or replace function public.update_current_user_notification_preferences(preferences_input jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return false;
  end if;

  update public.users
  set notification_preferences = jsonb_strip_nulls(
    coalesce(public.users.notification_preferences, '{}'::jsonb)
    || coalesce(preferences_input, '{}'::jsonb)
  )
  where id = current_user_id
    and status = 'active';

  return found;
end;
$$;

create or replace function public.record_current_user_login()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return false;
  end if;

  update public.users
  set last_login_at = now()
  where id = current_user_id
    and status = 'active';

  return found;
end;
$$;

revoke all on function public.update_current_user_profile(text, text, text, text, text, text, jsonb) from public;
revoke all on function public.update_current_user_avatar(text) from public;
revoke all on function public.update_current_user_notification_preferences(jsonb) from public;
revoke all on function public.record_current_user_login() from public;

grant execute on function public.update_current_user_profile(text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.update_current_user_avatar(text) to authenticated;
grant execute on function public.update_current_user_notification_preferences(jsonb) to authenticated;
grant execute on function public.record_current_user_login() to authenticated;

comment on column public.users.phone is 'Optional user profile phone number.';
comment on column public.users.job_title is 'Optional user profile job title.';
comment on column public.users.bio is 'Optional user profile biography.';
comment on column public.users.timezone is 'User display timezone. Contento v1.0 supports Africa/Cairo.';
comment on column public.users.notification_preferences is 'Per-user notification preferences for sound, toast, and future desktop push delivery.';
comment on column public.users.last_login_at is 'Last successful Contento sign-in timestamp.';
comment on column public.users.profile_completed_at is 'Timestamp when the user first completed required profile basics.';
comment on function public.update_current_user_profile(text, text, text, text, text, text, jsonb) is 'Safely updates only the authenticated active user profile fields.';
comment on function public.update_current_user_avatar(text) is 'Safely updates or clears the authenticated active user avatar path scoped to their company/user storage prefix.';
comment on function public.update_current_user_notification_preferences(jsonb) is 'Updates authenticated user notification preferences without broad users-table update privileges.';
comment on function public.record_current_user_login() is 'Records a successful Contento sign-in for the authenticated active user.';

commit;
