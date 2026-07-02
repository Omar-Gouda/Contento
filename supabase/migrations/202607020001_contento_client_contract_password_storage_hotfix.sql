begin;

alter table public.clients
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text;

alter table public.clients
  drop constraint if exists clients_status_check;

update public.clients
set
  status = 'disabled',
  disabled_at = coalesce(disabled_at, now()),
  disabled_reason = coalesce(nullif(disabled_reason, ''), 'Migrated from paused client status.')
where status = 'paused';

update public.clients
set
  status = 'expired',
  disabled_at = coalesce(disabled_at, now()),
  disabled_reason = coalesce(nullif(disabled_reason, ''), 'Contract end date has passed.')
where contract_end_date is not null
  and contract_end_date < ((now() at time zone 'Africa/Cairo')::date)
  and status = 'active';

alter table public.clients
  add constraint clients_status_check
  check (status in ('active', 'disabled', 'expired', 'archived'));

create or replace function public.normalize_client_contract_status()
returns trigger
language plpgsql
as $$
begin
  if new.contract_end_date is not null
     and new.contract_end_date < ((now() at time zone 'Africa/Cairo')::date)
     and new.status = 'active' then
    new.status := 'expired';
    new.disabled_at := coalesce(new.disabled_at, now());
    new.disabled_reason := coalesce(nullif(new.disabled_reason, ''), 'Contract end date has passed.');
  end if;

  if new.status = 'active' then
    new.disabled_at := null;
    new.disabled_reason := null;
  elsif new.disabled_at is null then
    new.disabled_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_client_contract_status_trigger on public.clients;
create trigger normalize_client_contract_status_trigger
before insert or update of contract_end_date, status, disabled_at, disabled_reason
on public.clients
for each row
execute function public.normalize_client_contract_status();

create or replace function public.expire_current_company_clients()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  with expired_clients as (
    update public.clients
    set
      status = 'expired',
      disabled_at = coalesce(disabled_at, now()),
      disabled_reason = coalesce(nullif(disabled_reason, ''), 'Contract end date has passed.')
    where company_id = public.current_company_id()
      and contract_end_date is not null
      and contract_end_date < ((now() at time zone 'Africa/Cairo')::date)
      and status = 'active'
    returning id, company_id
  )
  update public.users u
  set
    status = 'disabled'
  from public.client_assignments ca
  join expired_clients ec on ec.id = ca.client_id
  where u.id = ca.user_id
    and u.company_id = ec.company_id
    and ca.assignment_role = 'client_contact';

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

grant execute on function public.expire_current_company_clients() to authenticated;

commit;
