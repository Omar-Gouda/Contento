begin;

alter table public.companies
  add column if not exists is_demo boolean not null default false;

alter table public.users
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid,
  add column if not exists demo_expires_at timestamptz;

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role_name text,
  status text not null default 'active' check (status in ('active', 'ended', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_demo_sessions_updated_at on public.demo_sessions;
create trigger set_demo_sessions_updated_at
before update on public.demo_sessions
for each row execute function public.set_updated_at();

alter table public.demo_sessions enable row level security;
alter table public.demo_sessions force row level security;

drop policy if exists "Demo users can read own demo sessions" on public.demo_sessions;
create policy "Demo users can read own demo sessions"
on public.demo_sessions for select to authenticated
using (auth_user_id = auth.uid() and public.is_same_company(company_id));

drop policy if exists "Demo users can create own demo sessions" on public.demo_sessions;
create policy "Demo users can create own demo sessions"
on public.demo_sessions for insert to authenticated
with check (auth_user_id = auth.uid() and public.is_same_company(company_id));

drop policy if exists "Demo users can update own demo sessions" on public.demo_sessions;
create policy "Demo users can update own demo sessions"
on public.demo_sessions for update to authenticated
using (auth_user_id = auth.uid() and public.is_same_company(company_id))
with check (auth_user_id = auth.uid() and public.is_same_company(company_id));

drop policy if exists "Demo users can delete own demo sessions" on public.demo_sessions;
create policy "Demo users can delete own demo sessions"
on public.demo_sessions for delete to authenticated
using (auth_user_id = auth.uid() and public.is_same_company(company_id));

create index if not exists companies_is_demo_idx on public.companies(is_demo);
create index if not exists users_is_demo_idx on public.users(is_demo);
create index if not exists users_demo_session_id_idx on public.users(demo_session_id);
create index if not exists users_demo_expires_at_idx on public.users(demo_expires_at);
create index if not exists demo_sessions_auth_user_id_idx on public.demo_sessions(auth_user_id);
create index if not exists demo_sessions_company_id_idx on public.demo_sessions(company_id);
create index if not exists demo_sessions_expires_at_idx on public.demo_sessions(expires_at);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'teams',
    'clients',
    'tasks',
    'ideas',
    'content_items',
    'reports',
    'calendar_events',
    'day_off_requests',
    'notifications',
    'activity_logs'
  ]
  loop
    execute format('alter table public.%I add column if not exists demo_session_id uuid', target_table);
    execute format('alter table public.%I add column if not exists created_by_demo boolean not null default false', target_table);
    execute format('alter table public.%I add column if not exists demo_expires_at timestamptz', target_table);
    execute format('create index if not exists %I on public.%I(demo_session_id)', target_table || '_demo_session_id_idx', target_table);
    execute format('create index if not exists %I on public.%I(demo_expires_at)', target_table || '_demo_expires_at_idx', target_table);
  end loop;
end;
$$;

comment on table public.demo_sessions is 'Public sandbox sessions for the shared Contento demo account. Session records expire and scope temporary seeded data.';
comment on column public.companies.is_demo is 'Marks the isolated public demo workspace.';
comment on column public.users.is_demo is 'Marks the shared public demo user profile.';

commit;
