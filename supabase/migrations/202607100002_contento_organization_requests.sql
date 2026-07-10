begin;

create table if not exists public.organization_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived', 'ready_for_onboarding')),
  organization_name text not null check (char_length(trim(organization_name)) between 2 and 120),
  agency_name text not null check (char_length(trim(agency_name)) between 2 and 120),
  owner_full_name text not null check (char_length(trim(owner_full_name)) between 2 and 160),
  business_email citext not null,
  phone text not null check (char_length(trim(phone)) between 5 and 40),
  country text not null check (char_length(trim(country)) between 2 and 80),
  city text not null check (char_length(trim(city)) between 2 and 80),
  agency_size text not null check (char_length(trim(agency_size)) between 2 and 80),
  number_of_employees integer not null check (number_of_employees >= 1 and number_of_employees <= 100000),
  expected_users integer not null check (expected_users >= 1 and expected_users <= 100000),
  expected_clients integer not null check (expected_clients >= 0 and expected_clients <= 100000),
  website text,
  industry text not null check (char_length(trim(industry)) between 2 and 120),
  preferred_contract text not null check (preferred_contract in ('monthly', 'yearly')),
  needs_enterprise_pricing boolean not null default false,
  additional_notes text not null default '',
  source_demo_session_id uuid references public.demo_sessions(id) on delete set null,
  source_user_id uuid references auth.users(id) on delete set null,
  reviewed_by uuid references public.platform_admins(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  archived_at timestamptz,
  approved_company_id uuid references public.companies(id) on delete set null,
  approved_owner_user_id uuid references auth.users(id) on delete set null,
  temporary_password_generated boolean not null default false,
  activation_email_placeholder jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_organization_requests_updated_at on public.organization_requests;
create trigger set_organization_requests_updated_at
before update on public.organization_requests
for each row execute function public.set_updated_at();

alter table public.organization_requests enable row level security;
alter table public.organization_requests force row level security;

drop policy if exists "Platform admins can read organization requests" on public.organization_requests;
create policy "Platform admins can read organization requests"
on public.organization_requests for select to authenticated
using (public.is_current_platform_admin());

drop policy if exists "Platform admins can update organization requests" on public.organization_requests;
create policy "Platform admins can update organization requests"
on public.organization_requests for update to authenticated
using (public.is_current_platform_admin())
with check (public.is_current_platform_admin());

drop policy if exists "Platform admins can delete organization requests" on public.organization_requests;
create policy "Platform admins can delete organization requests"
on public.organization_requests for delete to authenticated
using (public.is_current_platform_admin());

create index if not exists organization_requests_status_submitted_at_idx
  on public.organization_requests(status, submitted_at desc);
create index if not exists organization_requests_business_email_idx
  on public.organization_requests(business_email);
create index if not exists organization_requests_source_demo_session_id_idx
  on public.organization_requests(source_demo_session_id);
create index if not exists organization_requests_source_user_id_idx
  on public.organization_requests(source_user_id);
create index if not exists organization_requests_reviewed_by_idx
  on public.organization_requests(reviewed_by);
create index if not exists organization_requests_approved_company_id_idx
  on public.organization_requests(approved_company_id);
create index if not exists organization_requests_approved_owner_user_id_idx
  on public.organization_requests(approved_owner_user_id);

comment on table public.organization_requests is 'Public demo conversion requests. Super Admins review and approve these into onboarding-ready organizations.';
comment on column public.organization_requests.activation_email_placeholder is 'Prepared activation email metadata. Real email sending and online purchase are intentionally deferred.';

commit;
