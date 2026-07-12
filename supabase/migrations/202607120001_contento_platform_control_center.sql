begin;

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  message text not null check (char_length(trim(message)) between 3 and 2000),
  target_type text not null default 'all' check (target_type in ('all', 'organization')),
  target_company_id uuid references public.companies(id) on delete cascade,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.platform_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_announcements_target_company_check check (
    (target_type = 'all' and target_company_id is null)
    or (target_type = 'organization' and target_company_id is not null)
  ),
  constraint platform_announcements_date_range_check check (
    ends_at is null or ends_at > starts_at
  )
);

create table if not exists public.platform_support_items (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'other' check (
    type in ('organization_request', 'password_reset', 'billing_issue', 'demo_request', 'contact_message', 'other')
  ),
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text not null default '',
  company_id uuid references public.companies(id) on delete set null,
  requester_email citext,
  source_entity_type text,
  source_entity_id text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references public.platform_admins(id) on delete set null,
  internal_note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.platform_admins(id) on delete set null
);

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'info' check (severity in ('info', 'warning', 'error', 'critical')),
  source text not null default 'platform' check (char_length(trim(source)) between 2 and 120),
  event_type text not null check (char_length(trim(event_type)) between 2 and 160),
  title text not null check (char_length(trim(title)) between 2 and 180),
  message text not null default '',
  company_id uuid references public.companies(id) on delete set null,
  related_entity_type text,
  related_entity_id text,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.platform_admins(id) on delete set null,
  internal_note text not null default ''
);

drop trigger if exists set_platform_announcements_updated_at on public.platform_announcements;
create trigger set_platform_announcements_updated_at
before update on public.platform_announcements
for each row execute function public.set_updated_at();

drop trigger if exists set_platform_support_items_updated_at on public.platform_support_items;
create trigger set_platform_support_items_updated_at
before update on public.platform_support_items
for each row execute function public.set_updated_at();

alter table public.platform_announcements enable row level security;
alter table public.platform_support_items enable row level security;
alter table public.platform_events enable row level security;

alter table public.platform_announcements force row level security;
alter table public.platform_support_items force row level security;
alter table public.platform_events force row level security;

drop policy if exists "Platform admins can manage announcements" on public.platform_announcements;
create policy "Platform admins can manage announcements"
on public.platform_announcements for all to authenticated
using (public.is_current_platform_admin())
with check (public.is_current_platform_admin());

drop policy if exists "Authenticated users can read active targeted announcements" on public.platform_announcements;
create policy "Authenticated users can read active targeted announcements"
on public.platform_announcements for select to authenticated
using (
  status = 'active'
  and starts_at <= now()
  and (ends_at is null or ends_at >= now())
  and (
    target_type = 'all'
    or (target_type = 'organization' and target_company_id is not null and public.is_same_company(target_company_id))
  )
);

drop policy if exists "Platform admins can manage support items" on public.platform_support_items;
create policy "Platform admins can manage support items"
on public.platform_support_items for all to authenticated
using (public.is_current_platform_admin())
with check (public.is_current_platform_admin());

drop policy if exists "Platform admins can manage platform events" on public.platform_events;
create policy "Platform admins can manage platform events"
on public.platform_events for all to authenticated
using (public.is_current_platform_admin())
with check (public.is_current_platform_admin());

create index if not exists platform_announcements_active_target_idx
  on public.platform_announcements(status, starts_at, ends_at, target_type, target_company_id);
create index if not exists platform_announcements_company_idx
  on public.platform_announcements(target_company_id)
  where target_company_id is not null;
create index if not exists platform_support_items_status_type_idx
  on public.platform_support_items(status, type, created_at desc);
create index if not exists platform_support_items_company_idx
  on public.platform_support_items(company_id)
  where company_id is not null;
create index if not exists platform_events_status_severity_idx
  on public.platform_events(status, severity, created_at desc);
create index if not exists platform_events_company_idx
  on public.platform_events(company_id)
  where company_id is not null;

comment on table public.platform_announcements is 'Super Admin announcements shown to all or selected Contento organizations.';
comment on table public.platform_support_items is 'Platform support inbox items managed by Super Admins.';
comment on table public.platform_events is 'Platform health and operational events for Super Admin system-health views.';

commit;
