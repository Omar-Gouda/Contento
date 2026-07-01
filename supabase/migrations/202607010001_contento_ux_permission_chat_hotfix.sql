begin;

create or replace function public.can_access_report_scope(
  target_company_id uuid,
  target_user_id uuid,
  target_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_same_company(target_company_id)
    and (
      public.is_current_user_admin()
      or target_user_id = (select auth.uid())
      or (
        public.current_role_name() in ('Supervisor', 'Account Manager')
        and public.current_permission_rank('reports.view_team') >= 1
        and (
          public.is_current_user_in_team(target_team_id)
          or public.is_current_user_teammate(target_user_id)
        )
      )
      or (
        public.current_role_name() in ('CC Team Lead', 'Team Lead')
        and public.current_permission_rank('reports.view_team') >= 1
        and (
          public.is_current_user_team_lead_for_team(target_team_id)
          or public.is_current_user_team_lead_for_user(target_user_id)
        )
      )
    );
$$;

drop policy if exists "Permitted users can read reports" on public.reports;
create policy "Permitted users can read reports"
on public.reports for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    public.can_access_report_scope(company_id, user_id, team_id)
    or (
      public.current_role_name() in ('Supervisor', 'Account Manager')
      and client_id is not null
      and public.current_permission_rank('reports.send_to_client') >= 2
      and public.can_access_client_scope(client_id, company_id)
    )
    or (
      public.current_role_name() = 'Client'
      and client_id is not null
      and sent_to_client_at is not null
      and public.can_access_client_scope(client_id, company_id)
    )
  )
);

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  participant_one_id uuid not null references public.users(id) on delete cascade,
  participant_two_id uuid not null references public.users(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_conversations_distinct_participants check (participant_one_id <> participant_two_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_conversations_company_participant_one_idx
  on public.chat_conversations(company_id, participant_one_id, updated_at desc);
create index if not exists chat_conversations_company_participant_two_idx
  on public.chat_conversations(company_id, participant_two_id, updated_at desc);
create index if not exists chat_conversations_client_idx
  on public.chat_conversations(company_id, client_id);
create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages(conversation_id, created_at);
create index if not exists chat_messages_sender_idx
  on public.chat_messages(company_id, sender_id);

drop trigger if exists set_chat_conversations_updated_at on public.chat_conversations;
create trigger set_chat_conversations_updated_at
before update on public.chat_conversations
for each row execute function public.set_updated_at();

create or replace function public.current_user_shares_client_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.clients c
    where c.company_id = public.current_company_id()
      and (
        c.assigned_account_manager_id = (select auth.uid())
        or exists (
          select 1
          from public.client_assignments self_ca
          where self_ca.client_id = c.id
            and self_ca.user_id = (select auth.uid())
        )
      )
      and (
        c.assigned_account_manager_id = target_user_id
        or exists (
          select 1
          from public.client_assignments target_ca
          where target_ca.client_id = c.id
            and target_ca.user_id = target_user_id
        )
      )
  );
$$;

create or replace function public.can_chat_with_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.users target_user
      left join public.roles target_role on target_role.id = target_user.role_id
      where target_user.id = target_user_id
        and target_user.company_id = public.current_company_id()
        and target_user.status = 'active'
        and (
          (
            coalesce(public.current_role_name(), '') <> 'Client'
            and (
              coalesce(target_role.name, '') <> 'Client'
              or public.current_user_shares_client_with(target_user_id)
            )
          )
          or (
            public.current_role_name() = 'Client'
            and public.current_user_shares_client_with(target_user_id)
          )
        )
    );
$$;

create or replace function public.can_access_chat_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.chat_conversations cc
    where cc.id = target_conversation_id
      and cc.company_id = public.current_company_id()
      and (select auth.uid()) in (cc.participant_one_id, cc.participant_two_id)
      and (
        cc.client_id is null
        or public.can_access_client_scope(cc.client_id, cc.company_id)
      )
  );
$$;

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_conversations force row level security;
alter table public.chat_messages force row level security;

drop policy if exists "Chat users can read chat recipients" on public.users;
create policy "Chat users can read chat recipients"
on public.users for select to authenticated
using (
  id = (select auth.uid())
  or public.can_chat_with_user(id)
  or (
    public.is_same_company(company_id)
    and public.has_permission('users.view_activity', 'view')
  )
);

drop policy if exists "Chat participants can read conversations" on public.chat_conversations;
create policy "Chat participants can read conversations"
on public.chat_conversations for select to authenticated
using (public.can_access_chat_conversation(id));

drop policy if exists "Chat participants can create conversations" on public.chat_conversations;
create policy "Chat participants can create conversations"
on public.chat_conversations for insert to authenticated
with check (
  public.is_same_company(company_id)
  and created_by = (select auth.uid())
  and (select auth.uid()) in (participant_one_id, participant_two_id)
  and public.can_chat_with_user(
    case
      when participant_one_id = (select auth.uid()) then participant_two_id
      else participant_one_id
    end
  )
  and (
    client_id is null
    or public.can_access_client_scope(client_id, company_id)
  )
);

drop policy if exists "Chat participants can update conversations" on public.chat_conversations;
create policy "Chat participants can update conversations"
on public.chat_conversations for update to authenticated
using (public.can_access_chat_conversation(id))
with check (public.can_access_chat_conversation(id));

drop policy if exists "Chat participants can read messages" on public.chat_messages;
create policy "Chat participants can read messages"
on public.chat_messages for select to authenticated
using (
  public.is_same_company(company_id)
  and public.can_access_chat_conversation(conversation_id)
);

drop policy if exists "Chat participants can create messages" on public.chat_messages;
create policy "Chat participants can create messages"
on public.chat_messages for insert to authenticated
with check (
  public.is_same_company(company_id)
  and sender_id = (select auth.uid())
  and public.can_access_chat_conversation(conversation_id)
);

comment on function public.can_access_report_scope(uuid, uuid, uuid) is 'Report visibility helper for Marketing Manager, own reports, Account Manager assigned team/users, and Team Lead team scope.';
comment on table public.chat_conversations is 'Company-scoped direct chat conversations between two users, optionally tied to a client workspace.';
comment on table public.chat_messages is 'Messages for company-scoped chat conversations.';
comment on function public.can_chat_with_user(uuid) is 'Checks whether the active user can start a chat with another active company user while respecting client scope.';
comment on function public.can_access_chat_conversation(uuid) is 'RLS helper for direct chat conversation visibility and message access.';

commit;
