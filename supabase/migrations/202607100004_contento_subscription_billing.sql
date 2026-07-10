begin;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(trim(name)) > 0),
  user_limit integer check (user_limit is null or user_limit > 0),
  yearly_price_egp integer check (yearly_price_egp is null or yearly_price_egp >= 0),
  is_custom boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  status text not null default 'trial_pending' check (
    status in (
      'trial_pending',
      'trial_active',
      'grace_period',
      'active',
      'cancelled',
      'expired',
      'scheduled_deletion',
      'deleted'
    )
  ),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  duration_years integer not null default 1 check (duration_years in (1, 5, 7)),
  auto_renew_enabled boolean not null default false,
  payment_method text not null default 'instapay_manual' check (payment_method in ('instapay_manual', 'manual', 'coming_soon')),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_trial_dates check (
    trial_started_at is null
    or trial_ends_at is null
    or trial_ends_at > trial_started_at
  ),
  constraint organization_subscriptions_period_dates check (
    current_period_start is null
    or current_period_end is null
    or current_period_end > current_period_start
  )
);

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  amount_egp integer not null check (amount_egp > 0),
  duration_years integer not null check (duration_years in (1, 5, 7)),
  plan_id uuid references public.subscription_plans(id) on delete set null,
  receipt_file_path text not null check (char_length(trim(receipt_file_path)) > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.platform_admins(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null check (action ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trial_blacklist (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  normalized_email text not null unique,
  reason text not null,
  company_id uuid references public.companies(id) on delete set null,
  blacklisted_at timestamptz not null default now(),
  created_by uuid references public.platform_admins(id) on delete set null
);

drop trigger if exists set_organization_subscriptions_updated_at on public.organization_subscriptions;
create trigger set_organization_subscriptions_updated_at
before update on public.organization_subscriptions
for each row execute function public.set_updated_at();

insert into public.subscription_plans (code, name, user_limit, yearly_price_egp, is_custom, is_active) values
  ('starter', 'Starter', 10, 12000, false, true),
  ('growth', 'Growth', 30, 18000, false, true),
  ('business', 'Business', 75, 30000, false, true),
  ('enterprise', 'Enterprise', null, null, true, true)
on conflict (code) do update set
  name = excluded.name,
  user_limit = excluded.user_limit,
  yearly_price_egp = excluded.yearly_price_egp,
  is_custom = excluded.is_custom,
  is_active = excluded.is_active;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contento-billing-receipts',
  'contento-billing-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.subscription_plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.billing_events enable row level security;
alter table public.trial_blacklist enable row level security;

alter table public.subscription_plans force row level security;
alter table public.organization_subscriptions force row level security;
alter table public.payment_receipts force row level security;
alter table public.billing_events force row level security;
alter table public.trial_blacklist force row level security;

drop policy if exists "Authenticated users can read active subscription plans" on public.subscription_plans;
create policy "Authenticated users can read active subscription plans"
on public.subscription_plans for select to authenticated
using (is_active = true or public.is_current_platform_admin());

drop policy if exists "Company users can read own subscription" on public.organization_subscriptions;
create policy "Company users can read own subscription"
on public.organization_subscriptions for select to authenticated
using (public.is_same_company(company_id) or public.is_current_platform_admin());

drop policy if exists "Company users can read own payment receipts" on public.payment_receipts;
create policy "Company users can read own payment receipts"
on public.payment_receipts for select to authenticated
using (public.is_same_company(company_id) or public.is_current_platform_admin());

drop policy if exists "Company users can read billing events" on public.billing_events;
create policy "Company users can read billing events"
on public.billing_events for select to authenticated
using (public.is_same_company(company_id) or public.is_current_platform_admin());

drop policy if exists "Platform admins can read trial blacklist" on public.trial_blacklist;
create policy "Platform admins can read trial blacklist"
on public.trial_blacklist for select to authenticated
using (public.is_current_platform_admin());

create index if not exists organization_subscriptions_company_id_idx
  on public.organization_subscriptions(company_id);
create index if not exists organization_subscriptions_status_idx
  on public.organization_subscriptions(status);
create index if not exists organization_subscriptions_trial_ends_at_idx
  on public.organization_subscriptions(trial_ends_at);
create index if not exists organization_subscriptions_grace_ends_at_idx
  on public.organization_subscriptions(grace_ends_at);
create index if not exists payment_receipts_company_status_idx
  on public.payment_receipts(company_id, status, created_at desc);
create index if not exists payment_receipts_subscription_id_idx
  on public.payment_receipts(subscription_id);
create index if not exists billing_events_company_created_idx
  on public.billing_events(company_id, created_at desc);
create index if not exists trial_blacklist_normalized_email_idx
  on public.trial_blacklist(normalized_email);

comment on table public.subscription_plans is 'Contento SaaS plan catalog. Manual InstaPay billing uses yearly EGP pricing until online payment launches.';
comment on table public.organization_subscriptions is 'Company subscription lifecycle. Trial starts only when the owner or Marketing Manager first signs in.';
comment on table public.payment_receipts is 'Private manual InstaPay receipt submissions reviewed by Super Admins.';
comment on table public.billing_events is 'Company-scoped subscription audit events.';
comment on table public.trial_blacklist is 'Emails no longer eligible for another free trial after expired grace processing.';
comment on column public.organization_subscriptions.grace_ends_at is 'Grace uses Egypt business days in application logic, excluding Fridays and Saturdays.';

commit;
