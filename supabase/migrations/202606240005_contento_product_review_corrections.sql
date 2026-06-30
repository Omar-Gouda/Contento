begin;

alter table public.day_off_requests
add column if not exists request_type text not null default 'day_off',
add column if not exists reviewed_by uuid references public.users(id) on delete set null,
add column if not exists reviewed_at timestamptz,
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'day_off_requests_request_type_check'
      and conrelid = 'public.day_off_requests'::regclass
  ) then
    alter table public.day_off_requests
      add constraint day_off_requests_request_type_check
      check (request_type in ('day_off', 'sick_leave'));
  end if;
end $$;

create index if not exists day_off_requests_request_type_idx on public.day_off_requests(request_type);
create index if not exists day_off_requests_reviewed_by_idx on public.day_off_requests(reviewed_by);
create index if not exists day_off_requests_company_dates_idx on public.day_off_requests(company_id, start_date, end_date);

drop trigger if exists set_day_off_requests_updated_at on public.day_off_requests;
create trigger set_day_off_requests_updated_at
before update on public.day_off_requests
for each row execute function public.set_updated_at();

create or replace function public.can_access_time_off_scope(
  target_company_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_same_company(target_company_id)
    and (
      target_user_id = (select auth.uid())
      or public.is_current_user_admin()
      or (
        public.current_role_name() = 'Supervisor'
        and public.current_permission_rank('day_off.view_availability') >= 2
        and (
          public.is_current_user_teammate(target_user_id)
          or public.is_current_user_team_lead_for_user(target_user_id)
        )
      )
      or (
        public.current_role_name() = 'CC Team Lead'
        and public.current_permission_rank('day_off.view_availability') >= 2
        and public.is_current_user_team_lead_for_user(target_user_id)
      )
    );
$$;

drop policy if exists "Permitted users can read day off requests" on public.day_off_requests;
create policy "Permitted users can read day off requests"
on public.day_off_requests for select to authenticated
using (public.can_access_time_off_scope(company_id, user_id));

drop policy if exists "Users can update permitted day off requests" on public.day_off_requests;
create policy "Users can update permitted day off requests"
on public.day_off_requests for update to authenticated
using (
  public.can_access_time_off_scope(company_id, user_id)
  and (
    user_id = (select auth.uid())
    or public.current_permission_rank('day_off.approve') >= 2
  )
)
with check (public.can_access_time_off_scope(company_id, user_id));

comment on column public.day_off_requests.request_type is 'Scheduling request type: day_off or sick_leave.';
comment on column public.day_off_requests.reviewed_by is 'User who approved or rejected the request.';
comment on column public.day_off_requests.reviewed_at is 'Timestamp when the request was approved or rejected.';
comment on function public.can_access_time_off_scope(uuid, uuid) is 'Time-off visibility helper for own, Admin company, Supervisor assigned-team, and CC Team Lead own-team access.';

commit;
