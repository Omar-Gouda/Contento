begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint_hash text not null,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint_hash)
);

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

create index if not exists push_subscriptions_company_user_idx
  on public.push_subscriptions(company_id, user_id, status);

create index if not exists push_subscriptions_endpoint_hash_idx
  on public.push_subscriptions(endpoint_hash);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions"
on public.push_subscriptions for select to authenticated
using (
  user_id = auth.uid()
  and public.is_same_company(company_id)
);

drop policy if exists "Users can create own push subscriptions" on public.push_subscriptions;
create policy "Users can create own push subscriptions"
on public.push_subscriptions for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_same_company(company_id)
);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
on public.push_subscriptions for update to authenticated
using (
  user_id = auth.uid()
  and public.is_same_company(company_id)
)
with check (
  user_id = auth.uid()
  and public.is_same_company(company_id)
);

comment on table public.push_subscriptions is 'Future Web Push subscription storage for authenticated company users. Delivery is server-side future work.';
comment on column public.push_subscriptions.endpoint_hash is 'Stable hash of the browser push endpoint used for deduplication without querying long endpoints.';
comment on column public.push_subscriptions.endpoint is 'Browser PushSubscription endpoint. Treat as sensitive application data.';
comment on column public.push_subscriptions.p256dh is 'Push subscription public key.';
comment on column public.push_subscriptions.auth_secret is 'Push subscription auth secret. Treat as sensitive application data.';

commit;
