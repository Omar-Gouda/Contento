begin;

alter table public.users
add column if not exists must_change_password boolean not null default false;

update public.users
set must_change_password = false
where must_change_password is null;

alter table public.users
alter column must_change_password set default false,
alter column must_change_password set not null;

create or replace function public.contento_cairo_work_date(input_timestamp timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (input_timestamp at time zone 'Africa/Cairo')::date;
$$;

create or replace function public.clear_current_user_must_change_password()
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
  set must_change_password = false
  where id = current_user_id
    and status = 'active';

  return found;
end;
$$;

create or replace function public.recalculate_work_day(target_work_day_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_work_minutes constant integer := 480;
  worked_minutes integer;
  break_minutes integer;
  missing_minutes integer;
  excess_break_minutes integer;
  target_missing_minutes integer;
  has_active_work_session boolean;
  has_active_break boolean;
  has_sign_out boolean;
begin
  select coalesce(sum(ws.duration_minutes), 0)
  into worked_minutes
  from public.work_sessions ws
  where ws.work_day_id = target_work_day_id;

  select coalesce(sum(bs.duration_minutes), 0)
  into break_minutes
  from public.break_sessions bs
  where bs.work_day_id = target_work_day_id;

  select exists (
    select 1 from public.work_sessions ws
    where ws.work_day_id = target_work_day_id
      and ws.sign_out_at is null
  )
  into has_active_work_session;

  select exists (
    select 1 from public.break_sessions bs
    where bs.work_day_id = target_work_day_id
      and bs.ended_at is null
  )
  into has_active_break;

  select exists (
    select 1 from public.work_sessions ws
    where ws.work_day_id = target_work_day_id
      and ws.sign_out_at is not null
  )
  into has_sign_out;

  worked_minutes := greatest(worked_minutes - break_minutes, 0);
  excess_break_minutes := greatest(break_minutes - 90, 0);
  target_missing_minutes := case
    when has_sign_out and not has_active_work_session then greatest(expected_work_minutes - worked_minutes, 0)
    else 0
  end;
  missing_minutes := greatest(target_missing_minutes, excess_break_minutes);

  update public.work_days
  set
    total_worked_minutes = worked_minutes,
    total_break_minutes = break_minutes,
    total_missing_minutes = missing_minutes,
    status = case
      when has_active_work_session or has_active_break then 'active'::public.work_day_status
      when missing_minutes > 0 then 'missing_time'::public.work_day_status
      when has_sign_out then 'completed'::public.work_day_status
      else 'incomplete'::public.work_day_status
    end
  where id = target_work_day_id;
end;
$$;

create or replace function public.record_work_sign_in()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_company_id uuid;
  current_work_day_id uuid;
  current_timestamp_value timestamptz := now();
  cairo_work_date date := public.contento_cairo_work_date(current_timestamp_value);
begin
  select u.company_id
  into current_company_id
  from public.users u
  where u.id = current_user_id
    and u.status = 'active';

  if current_company_id is null then
    return false;
  end if;

  insert into public.work_days (
    company_id,
    user_id,
    work_date,
    first_sign_in_at,
    status
  )
  values (
    current_company_id,
    current_user_id,
    cairo_work_date,
    current_timestamp_value,
    'active'
  )
  on conflict (company_id, user_id, work_date) do update
  set
    first_sign_in_at = coalesce(public.work_days.first_sign_in_at, excluded.first_sign_in_at),
    status = 'active'
  returning id into current_work_day_id;

  if not exists (
    select 1 from public.work_sessions ws
    where ws.user_id = current_user_id
      and ws.sign_out_at is null
  ) then
    insert into public.work_sessions (company_id, user_id, work_day_id, sign_in_at)
    values (current_company_id, current_user_id, current_work_day_id, current_timestamp_value)
    on conflict do nothing;
  end if;

  perform public.recalculate_work_day(current_work_day_id);

  return true;
end;
$$;

create or replace function public.record_work_sign_out()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  active_work_session_id uuid;
  current_work_day_id uuid;
  active_break_exists boolean;
  current_timestamp_value timestamptz := now();
begin
  select exists (
    select 1 from public.break_sessions bs
    where bs.user_id = current_user_id
      and bs.ended_at is null
  )
  into active_break_exists;

  if active_break_exists then
    return 'active_break';
  end if;

  select ws.id, ws.work_day_id
  into active_work_session_id, current_work_day_id
  from public.work_sessions ws
  where ws.user_id = current_user_id
    and ws.sign_out_at is null
  order by ws.sign_in_at desc
  limit 1;

  if active_work_session_id is null then
    return 'no_active_session';
  end if;

  update public.work_sessions
  set
    sign_out_at = current_timestamp_value,
    duration_minutes = greatest(0, floor(extract(epoch from (current_timestamp_value - sign_in_at)) / 60)::integer)
  where id = active_work_session_id;

  update public.work_days
  set last_sign_out_at = current_timestamp_value
  where id = current_work_day_id;

  perform public.recalculate_work_day(current_work_day_id);

  return 'signed_out';
end;
$$;

create or replace function public.start_break_session()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_work_day_id uuid;
  current_company_id uuid;
  current_timestamp_value timestamptz := now();
begin
  select ws.work_day_id, ws.company_id
  into current_work_day_id, current_company_id
  from public.work_sessions ws
  where ws.user_id = current_user_id
    and ws.sign_out_at is null
  order by ws.sign_in_at desc
  limit 1;

  if current_work_day_id is null then
    return 'no_active_work_session';
  end if;

  if exists (
    select 1 from public.break_sessions bs
    where bs.user_id = current_user_id
      and bs.ended_at is null
  ) then
    return 'break_already_active';
  end if;

  insert into public.break_sessions (company_id, user_id, work_day_id, started_at)
  values (current_company_id, current_user_id, current_work_day_id, current_timestamp_value)
  on conflict do nothing;

  perform public.recalculate_work_day(current_work_day_id);

  return 'started';
end;
$$;

create or replace function public.end_break_session()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  active_break_id uuid;
  current_work_day_id uuid;
  current_timestamp_value timestamptz := now();
begin
  select bs.id, bs.work_day_id
  into active_break_id, current_work_day_id
  from public.break_sessions bs
  where bs.user_id = current_user_id
    and bs.ended_at is null
  order by bs.started_at desc
  limit 1;

  if active_break_id is null then
    return 'no_active_break';
  end if;

  update public.break_sessions
  set
    ended_at = current_timestamp_value,
    duration_minutes = greatest(0, floor(extract(epoch from (current_timestamp_value - started_at)) / 60)::integer)
  where id = active_break_id;

  perform public.recalculate_work_day(current_work_day_id);

  return 'ended';
end;
$$;

create unique index if not exists work_sessions_one_active_per_user_day_idx
  on public.work_sessions(user_id, work_day_id)
  where sign_out_at is null;

create unique index if not exists break_sessions_one_active_per_user_day_idx
  on public.break_sessions(user_id, work_day_id)
  where ended_at is null;

revoke all on function public.clear_current_user_must_change_password() from public;
revoke all on function public.contento_cairo_work_date(timestamptz) from public;

grant execute on function public.clear_current_user_must_change_password() to authenticated;
grant execute on function public.contento_cairo_work_date(timestamptz) to authenticated;

comment on column public.users.must_change_password is 'Forces Admin-created users to change their temporary password before accessing protected dashboards.';
comment on function public.clear_current_user_must_change_password() is 'Clears the authenticated active user password-change requirement after Supabase Auth password update succeeds.';
comment on function public.contento_cairo_work_date(timestamptz) is 'Returns the Africa/Cairo calendar date for Contento work-hours grouping.';
comment on function public.recalculate_work_day(uuid) is 'Recalculates saved worked, break, and missing minutes. Missing time uses a documented 480-minute default target and flags break time over 90 minutes.';
comment on function public.record_work_sign_in() is 'Starts or resumes current Cairo-date working-hours tracking after successful sign-in.';

commit;
