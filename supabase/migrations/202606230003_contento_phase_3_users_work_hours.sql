begin;

create type public.user_invitation_status as enum ('pending', 'accepted', 'expired', 'cancelled');
create type public.work_day_status as enum ('active', 'completed', 'missing_time', 'absent', 'incomplete');

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email citext not null,
  role_id uuid not null references public.roles(id) on delete restrict,
  team_id uuid references public.teams(id) on delete set null,
  token_hash text not null unique check (char_length(token_hash) = 64),
  status public.user_invitation_status not null default 'pending',
  message text not null default '',
  invited_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_invitations_expiration_after_creation check (expires_at > created_at),
  constraint user_invitations_accepted_timestamp check (
    (status = 'accepted' and accepted_at is not null)
    or (status <> 'accepted' and accepted_at is null)
  )
);

create table public.work_days (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  work_date date not null,
  first_sign_in_at timestamptz,
  last_sign_out_at timestamptz,
  total_worked_minutes integer not null default 0 check (total_worked_minutes >= 0),
  total_break_minutes integer not null default 0 check (total_break_minutes >= 0),
  total_missing_minutes integer not null default 0 check (total_missing_minutes >= 0),
  status public.work_day_status not null default 'incomplete',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id, work_date)
);

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  work_day_id uuid not null references public.work_days(id) on delete cascade,
  sign_in_at timestamptz not null default now(),
  sign_out_at timestamptz,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  created_at timestamptz not null default now(),
  constraint work_sessions_sign_out_after_sign_in check (sign_out_at is null or sign_out_at >= sign_in_at)
);

create table public.break_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  work_day_id uuid not null references public.work_days(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  created_at timestamptz not null default now(),
  constraint break_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);

create trigger set_user_invitations_updated_at
before update on public.user_invitations
for each row execute function public.set_updated_at();

create trigger set_work_days_updated_at
before update on public.work_days
for each row execute function public.set_updated_at();

create index user_invitations_company_id_idx on public.user_invitations(company_id);
create index user_invitations_email_status_idx on public.user_invitations(lower(email::text), status);
create index user_invitations_role_id_idx on public.user_invitations(role_id);
create index user_invitations_team_id_idx on public.user_invitations(team_id);
create index user_invitations_invited_by_idx on public.user_invitations(invited_by);
create index user_invitations_expires_at_idx on public.user_invitations(expires_at);

create index work_days_company_date_idx on public.work_days(company_id, work_date desc);
create index work_days_user_date_idx on public.work_days(user_id, work_date desc);
create index work_days_status_idx on public.work_days(status);

create index work_sessions_work_day_id_idx on public.work_sessions(work_day_id);
create index work_sessions_user_id_idx on public.work_sessions(user_id);
create unique index work_sessions_one_active_per_user_idx
  on public.work_sessions(user_id)
  where sign_out_at is null;

create index break_sessions_work_day_id_idx on public.break_sessions(work_day_id);
create index break_sessions_user_id_idx on public.break_sessions(user_id);
create unique index break_sessions_one_active_per_user_idx
  on public.break_sessions(user_id)
  where ended_at is null;

insert into public.permissions (key, name, description) values
  ('work_hours.view_own', 'View own working hours', 'View personal work day, work session, break, and missing time data.'),
  ('work_hours.view_team', 'View team working hours', 'View assigned team working-hour records.'),
  ('work_hours.view_company', 'View company working hours', 'View company-wide working-hour records.'),
  ('work_hours.manage', 'Manage working hours', 'Manage and audit company working-hour records.')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;

with phase3_matrix(role_name, permission_key, access_level) as (
  values
    ('Admin', 'work_hours.view_own', 'full'::public.permission_access_level),
    ('Admin', 'work_hours.view_team', 'full'::public.permission_access_level),
    ('Admin', 'work_hours.view_company', 'full'::public.permission_access_level),
    ('Admin', 'work_hours.manage', 'full'::public.permission_access_level),
    ('Supervisor', 'work_hours.view_own', 'full'::public.permission_access_level),
    ('Supervisor', 'work_hours.view_team', 'limited'::public.permission_access_level),
    ('CC Team Lead', 'work_hours.view_own', 'full'::public.permission_access_level),
    ('CC Team Lead', 'work_hours.view_team', 'limited'::public.permission_access_level),
    ('Creator', 'work_hours.view_own', 'full'::public.permission_access_level)
)
insert into public.role_permissions (role_id, permission_id, access_level)
select r.id, p.id, m.access_level
from public.roles r
join phase3_matrix m on m.role_name = r.name
join public.permissions p on p.key = m.permission_key
on conflict (role_id, permission_id) do update set access_level = excluded.access_level;

create or replace function public.assign_phase3_permissions_for_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  with phase3_matrix(role_name, permission_key, access_level) as (
    values
      ('Admin', 'work_hours.view_own', 'full'::public.permission_access_level),
      ('Admin', 'work_hours.view_team', 'full'::public.permission_access_level),
      ('Admin', 'work_hours.view_company', 'full'::public.permission_access_level),
      ('Admin', 'work_hours.manage', 'full'::public.permission_access_level),
      ('Supervisor', 'work_hours.view_own', 'full'::public.permission_access_level),
      ('Supervisor', 'work_hours.view_team', 'limited'::public.permission_access_level),
      ('CC Team Lead', 'work_hours.view_own', 'full'::public.permission_access_level),
      ('CC Team Lead', 'work_hours.view_team', 'limited'::public.permission_access_level),
      ('Creator', 'work_hours.view_own', 'full'::public.permission_access_level)
  )
  insert into public.role_permissions (role_id, permission_id, access_level)
  select r.id, p.id, m.access_level
  from public.roles r
  join phase3_matrix m on m.role_name = r.name
  join public.permissions p on p.key = m.permission_key
  where r.company_id = new.id
  on conflict (role_id, permission_id) do update set access_level = excluded.access_level;

  return new;
end;
$$;

create trigger zz_assign_phase3_permissions_after_company_insert
after insert on public.companies
for each row execute function public.assign_phase3_permissions_for_company();

create or replace function public.recalculate_work_day(target_work_day_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  worked_minutes integer;
  break_minutes integer;
  missing_minutes integer;
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

  missing_minutes := greatest(break_minutes - 90, 0);
  worked_minutes := greatest(worked_minutes - break_minutes, 0);

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
    current_date,
    now(),
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
    values (current_company_id, current_user_id, current_work_day_id, now());
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
    sign_out_at = now(),
    duration_minutes = greatest(0, floor(extract(epoch from (now() - sign_in_at)) / 60)::integer)
  where id = active_work_session_id;

  update public.work_days
  set last_sign_out_at = now()
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
  break_minutes_used integer;
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

  select coalesce(sum(bs.duration_minutes), 0)
  into break_minutes_used
  from public.break_sessions bs
  where bs.work_day_id = current_work_day_id;

  if break_minutes_used >= 90 then
    return 'break_allowance_used';
  end if;

  insert into public.break_sessions (company_id, user_id, work_day_id, started_at)
  values (current_company_id, current_user_id, current_work_day_id, now());

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
    ended_at = now(),
    duration_minutes = greatest(0, floor(extract(epoch from (now() - started_at)) / 60)::integer)
  where id = active_break_id;

  perform public.recalculate_work_day(current_work_day_id);

  return 'ended';
end;
$$;

create or replace function public.accept_pending_invitation_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  authenticated_email citext;
  fallback_first_name text;
  fallback_last_name text;
  pending_invitation public.user_invitations%rowtype;
begin
  if current_user_id is null then
    return null;
  end if;

  if exists (select 1 from public.users u where u.id = current_user_id) then
    return null;
  end if;

  select au.email::citext,
         coalesce(nullif(trim(au.raw_user_meta_data ->> 'first_name'), ''), split_part(au.email, '@', 1)),
         coalesce(nullif(trim(au.raw_user_meta_data ->> 'last_name'), ''), 'Team Member')
  into authenticated_email, fallback_first_name, fallback_last_name
  from auth.users au
  where au.id = current_user_id;

  if authenticated_email is null then
    return null;
  end if;

  select *
  into pending_invitation
  from public.user_invitations ui
  where ui.email = authenticated_email
    and ui.status = 'pending'
    and ui.expires_at > now()
  order by ui.created_at desc
  limit 1
  for update;

  if pending_invitation.id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.roles r
    where r.id = pending_invitation.role_id
      and r.company_id = pending_invitation.company_id
  ) then
    raise exception 'CONTENTO_INVITATION_ROLE_INVALID' using errcode = 'P0001';
  end if;

  if pending_invitation.team_id is not null and not exists (
    select 1
    from public.teams t
    where t.id = pending_invitation.team_id
      and t.company_id = pending_invitation.company_id
  ) then
    raise exception 'CONTENTO_INVITATION_TEAM_INVALID' using errcode = 'P0001';
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
    current_user_id,
    pending_invitation.company_id,
    authenticated_email,
    fallback_first_name,
    fallback_last_name,
    pending_invitation.role_id,
    'active'
  );

  if pending_invitation.team_id is not null then
    insert into public.team_members (team_id, user_id)
    values (pending_invitation.team_id, current_user_id)
    on conflict (team_id, user_id) do nothing;
  end if;

  update public.user_invitations
  set
    status = 'accepted',
    accepted_at = now()
  where id = pending_invitation.id;

  return pending_invitation.company_id;
end;
$$;

alter table public.user_invitations enable row level security;
alter table public.work_days enable row level security;
alter table public.work_sessions enable row level security;
alter table public.break_sessions enable row level security;

alter table public.user_invitations force row level security;
alter table public.work_days force row level security;
alter table public.work_sessions force row level security;
alter table public.break_sessions force row level security;

create policy "Admins can read company invitations"
on public.user_invitations for select to authenticated
using (public.is_same_company(company_id) and public.has_permission('users.invite', 'limited'));

create policy "Admins can create company invitations"
on public.user_invitations for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('users.invite', 'limited')
  and public.is_same_company_role(role_id)
  and (team_id is null or public.is_same_company_team(team_id))
  and invited_by = (select auth.uid())
);

create policy "Admins can update company invitations"
on public.user_invitations for update to authenticated
using (public.is_same_company(company_id) and public.has_permission('users.invite', 'limited'))
with check (
  public.is_same_company(company_id)
  and public.has_permission('users.invite', 'limited')
  and public.is_same_company_role(role_id)
  and (team_id is null or public.is_same_company_team(team_id))
);

create policy "Users can read own work days"
on public.work_days for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    user_id = (select auth.uid())
    or public.has_permission('work_hours.view_company', 'view')
    or public.has_permission('work_hours.view_team', 'view')
  )
);

create policy "Users can read own work sessions"
on public.work_sessions for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    user_id = (select auth.uid())
    or public.has_permission('work_hours.view_company', 'view')
    or public.has_permission('work_hours.view_team', 'view')
  )
);

create policy "Users can read own break sessions"
on public.break_sessions for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    user_id = (select auth.uid())
    or public.has_permission('work_hours.view_company', 'view')
    or public.has_permission('work_hours.view_team', 'view')
  )
);

revoke all on function public.record_work_sign_in() from public;
revoke all on function public.record_work_sign_out() from public;
revoke all on function public.start_break_session() from public;
revoke all on function public.end_break_session() from public;
revoke all on function public.accept_pending_invitation_for_current_user() from public;

grant execute on function public.record_work_sign_in() to authenticated;
grant execute on function public.record_work_sign_out() to authenticated;
grant execute on function public.start_break_session() to authenticated;
grant execute on function public.end_break_session() to authenticated;
grant execute on function public.accept_pending_invitation_for_current_user() to authenticated;

comment on table public.user_invitations is 'Company-scoped user invitations created by Admins. Tokens are stored only as hashes.';
comment on table public.work_days is 'Company-scoped daily working-hours summary per user.';
comment on table public.work_sessions is 'Individual sign-in/sign-out work sessions.';
comment on table public.break_sessions is 'Break sessions for a work day. The app enforces one active break and a 90 minute daily allowance.';
comment on function public.accept_pending_invitation_for_current_user() is 'Accepts a pending invitation matching the authenticated user email and creates the Contento profile inside that company.';
comment on function public.record_work_sign_in() is 'Starts or resumes today working-hours tracking after successful sign-in.';
comment on function public.record_work_sign_out() is 'Closes the active work session unless a break is active.';

commit;
