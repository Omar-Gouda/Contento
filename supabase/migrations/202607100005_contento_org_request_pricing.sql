begin;

alter table public.organization_requests
  add column if not exists plan_code text,
  add column if not exists duration_years integer,
  add column if not exists calculated_amount_egp integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_requests_plan_code_check'
      and conrelid = 'public.organization_requests'::regclass
  ) then
    alter table public.organization_requests
      add constraint organization_requests_plan_code_check
      check (plan_code is null or plan_code in ('starter', 'growth', 'business', 'enterprise'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_requests_duration_years_check'
      and conrelid = 'public.organization_requests'::regclass
  ) then
    alter table public.organization_requests
      add constraint organization_requests_duration_years_check
      check (duration_years is null or duration_years in (1, 5, 7));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_requests_calculated_amount_egp_check'
      and conrelid = 'public.organization_requests'::regclass
  ) then
    alter table public.organization_requests
      add constraint organization_requests_calculated_amount_egp_check
      check (calculated_amount_egp is null or calculated_amount_egp >= 0);
  end if;
end $$;

create index if not exists organization_requests_plan_code_idx
  on public.organization_requests(plan_code);

comment on column public.organization_requests.plan_code is 'Selected Contento plan from public demo conversion request.';
comment on column public.organization_requests.duration_years is 'Selected contract duration in years for the public demo request.';
comment on column public.organization_requests.calculated_amount_egp is 'Server-calculated EGP amount for non-custom plans. Enterprise requests remain null.';

commit;
