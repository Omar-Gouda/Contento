alter type public.company_status add value if not exists 'disabled';
alter type public.company_status add value if not exists 'deleted';

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email citext not null unique,
  status public.superior_admin_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_admins (id, auth_user_id, email, status, created_at, updated_at)
select sa.id, sa.id, sa.email, sa.status, sa.created_at, sa.updated_at
from public.superior_admins sa
on conflict (auth_user_id) do update
set email = excluded.email,
    status = excluded.status,
    updated_at = now();

create table if not exists public.platform_activity_logs (
  id uuid primary key default gen_random_uuid(),
  platform_admin_id uuid references public.platform_admins(id) on delete set null,
  action text not null check (action ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  entity_type text not null check (char_length(trim(entity_type)) > 0),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists link_href text,
  add column if not exists read_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'idea', 'content', 'report')),
  entity_id uuid not null,
  uploaded_by uuid references public.users(id) on delete set null,
  file_name text not null check (char_length(trim(file_name)) > 0),
  file_path text not null unique check (char_length(trim(file_path)) > 0),
  file_type text not null default '',
  file_size bigint not null default 0 check (file_size >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'idea', 'content', 'report')),
  entity_id uuid not null,
  author_id uuid references public.users(id) on delete set null,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, mentioned_user_id)
);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  module text not null check (module in ('users', 'teams', 'tasks', 'ideas', 'content', 'calendar', 'reports')),
  filters_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module, name)
);

create table if not exists public.content_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  body text not null default '',
  category text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_preferences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (char_length(trim(role)) > 0),
  widgets_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.content_reviews
  add column if not exists quality_score integer,
  add column if not exists creativity_score integer,
  add column if not exists accuracy_score integer,
  add column if not exists overall_rating integer,
  add column if not exists score_comment text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_reviews_quality_score_range'
      and conrelid = 'public.content_reviews'::regclass
  ) then
    alter table public.content_reviews
      add constraint content_reviews_quality_score_range
      check (quality_score is null or quality_score between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'content_reviews_creativity_score_range'
      and conrelid = 'public.content_reviews'::regclass
  ) then
    alter table public.content_reviews
      add constraint content_reviews_creativity_score_range
      check (creativity_score is null or creativity_score between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'content_reviews_accuracy_score_range'
      and conrelid = 'public.content_reviews'::regclass
  ) then
    alter table public.content_reviews
      add constraint content_reviews_accuracy_score_range
      check (accuracy_score is null or accuracy_score between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'content_reviews_overall_rating_range'
      and conrelid = 'public.content_reviews'::regclass
  ) then
    alter table public.content_reviews
      add constraint content_reviews_overall_rating_range
      check (overall_rating is null or overall_rating between 1 and 5);
  end if;
end $$;

create index if not exists platform_admins_auth_user_id_idx on public.platform_admins(auth_user_id);
create index if not exists platform_admins_status_idx on public.platform_admins(status);
create index if not exists platform_activity_logs_admin_idx on public.platform_activity_logs(platform_admin_id, created_at desc);
create index if not exists platform_activity_logs_entity_idx on public.platform_activity_logs(entity_type, entity_id);
create index if not exists notifications_user_read_created_idx on public.notifications(user_id, read, created_at desc);
create index if not exists notifications_entity_idx on public.notifications(entity_type, entity_id);
create index if not exists attachments_company_entity_idx on public.attachments(company_id, entity_type, entity_id);
create index if not exists attachments_uploaded_by_idx on public.attachments(uploaded_by);
create index if not exists comments_company_entity_idx on public.comments(company_id, entity_type, entity_id, created_at desc);
create index if not exists comments_author_idx on public.comments(author_id);
create index if not exists mentions_mentioned_user_idx on public.mentions(mentioned_user_id, created_at desc);
create index if not exists saved_views_user_module_idx on public.saved_views(user_id, module);
create index if not exists content_templates_company_status_idx on public.content_templates(company_id, status);
create index if not exists dashboard_preferences_user_idx on public.dashboard_preferences(user_id);

drop trigger if exists set_platform_admins_updated_at on public.platform_admins;
create trigger set_platform_admins_updated_at
before update on public.platform_admins
for each row execute function public.set_updated_at();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

drop trigger if exists set_saved_views_updated_at on public.saved_views;
create trigger set_saved_views_updated_at
before update on public.saved_views
for each row execute function public.set_updated_at();

drop trigger if exists set_content_templates_updated_at on public.content_templates;
create trigger set_content_templates_updated_at
before update on public.content_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_dashboard_preferences_updated_at on public.dashboard_preferences;
create trigger set_dashboard_preferences_updated_at
before update on public.dashboard_preferences
for each row execute function public.set_updated_at();

create or replace function public.current_platform_admin_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select pa.id
  from public.platform_admins pa
  where pa.auth_user_id = auth.uid()
    and pa.status = 'active'
  limit 1;
$$;

create or replace function public.is_current_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_platform_admin_id() is not null
    or public.is_superior_admin();
$$;

create or replace function public.can_access_idea_scope(
  target_company_id uuid,
  target_team_id uuid,
  target_assigned_to uuid,
  target_created_by uuid
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
      or target_assigned_to = auth.uid()
      or target_created_by = auth.uid()
      or (
        public.current_role_name() = 'Supervisor'
        and public.current_permission_rank('ideas.review') >= 2
        and (
          public.is_current_user_in_team(target_team_id)
          or public.is_current_user_teammate(target_assigned_to)
          or public.is_current_user_teammate(target_created_by)
        )
      )
      or (
        public.current_role_name() = 'CC Team Lead'
        and public.current_permission_rank('ideas.review') >= 2
        and (
          public.is_current_user_team_lead_for_team(target_team_id)
          or public.is_current_user_team_lead_for_user(target_assigned_to)
          or public.is_current_user_team_lead_for_user(target_created_by)
        )
      )
    );
$$;

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
      or target_user_id = auth.uid()
      or (
        public.current_role_name() = 'Supervisor'
        and public.current_permission_rank('reports.view') >= 2
        and (
          public.is_current_user_in_team(target_team_id)
          or public.is_current_user_teammate(target_user_id)
        )
      )
      or (
        public.current_role_name() = 'CC Team Lead'
        and public.current_permission_rank('reports.view') >= 2
        and (
          public.is_current_user_team_lead_for_team(target_team_id)
          or public.is_current_user_team_lead_for_user(target_user_id)
        )
      )
    );
$$;

create or replace function public.can_access_entity_scope(target_entity_type text, target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case target_entity_type
    when 'task' then exists (
      select 1
      from public.tasks t
      where t.id = target_entity_id
        and public.can_access_task_scope(t.company_id, t.team_id, t.assigned_to, t.created_by)
    )
    when 'idea' then exists (
      select 1
      from public.ideas i
      where i.id = target_entity_id
        and public.can_access_idea_scope(i.company_id, i.team_id, i.assigned_to, i.created_by)
    )
    when 'content' then exists (
      select 1
      from public.content_items ci
      where ci.id = target_entity_id
        and public.can_access_content_scope(ci.company_id, ci.team_id, ci.creator_id, ci.status::text)
    )
    when 'report' then exists (
      select 1
      from public.reports r
      where r.id = target_entity_id
        and public.can_access_report_scope(r.company_id, r.user_id, r.team_id)
    )
    else false
  end;
$$;

create or replace function public.can_access_comment_scope(target_comment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.comments c
    where c.id = target_comment_id
      and c.deleted_at is null
      and public.is_same_company(c.company_id)
      and public.can_access_entity_scope(c.entity_type, c.entity_id)
  );
$$;

insert into public.permissions (key, name, description)
values
  ('notifications.view', 'View notifications', 'View own in-app notifications.'),
  ('notifications.manage', 'Manage notifications', 'Manage notification read state and delivery preferences.'),
  ('attachments.manage', 'Manage attachments', 'Upload and delete scoped entity attachments.'),
  ('comments.create', 'Create comments', 'Add comments to accessible company records.'),
  ('comments.delete', 'Delete comments', 'Soft-delete accessible comments where permitted.'),
  ('mentions.create', 'Create mentions', 'Mention accessible company users in comments.'),
  ('search.global', 'Use global search', 'Search across accessible company modules.'),
  ('saved_views.manage', 'Manage saved views', 'Save and manage reusable filters.'),
  ('analytics.view', 'View analytics', 'View role-scoped analytics based on real operational data.'),
  ('content.templates.use', 'Use content templates', 'Use active content templates when creating content.'),
  ('content.templates.manage', 'Manage content templates', 'Create, update, and archive company content templates.'),
  ('dashboard.customize', 'Customize dashboard', 'Show, hide, and reset dashboard widgets.')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

create or replace function public.assign_final_permissions_for_company(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.role_permissions (role_id, permission_id, access_level)
  select r.id, p.id, grant_data.access_level::public.permission_access_level
  from public.roles r
  join (
    values
      ('Admin', 'notifications.view', 'full'),
      ('Admin', 'notifications.manage', 'full'),
      ('Admin', 'attachments.manage', 'full'),
      ('Admin', 'comments.create', 'full'),
      ('Admin', 'comments.delete', 'full'),
      ('Admin', 'mentions.create', 'full'),
      ('Admin', 'search.global', 'full'),
      ('Admin', 'saved_views.manage', 'full'),
      ('Admin', 'analytics.view', 'full'),
      ('Admin', 'content.templates.use', 'full'),
      ('Admin', 'content.templates.manage', 'full'),
      ('Admin', 'dashboard.customize', 'full'),
      ('Supervisor', 'notifications.view', 'full'),
      ('Supervisor', 'notifications.manage', 'full'),
      ('Supervisor', 'attachments.manage', 'limited'),
      ('Supervisor', 'comments.create', 'full'),
      ('Supervisor', 'comments.delete', 'limited'),
      ('Supervisor', 'mentions.create', 'limited'),
      ('Supervisor', 'search.global', 'limited'),
      ('Supervisor', 'saved_views.manage', 'full'),
      ('Supervisor', 'analytics.view', 'limited'),
      ('Supervisor', 'content.templates.use', 'full'),
      ('Supervisor', 'content.templates.manage', 'limited'),
      ('Supervisor', 'dashboard.customize', 'full'),
      ('CC Team Lead', 'notifications.view', 'full'),
      ('CC Team Lead', 'notifications.manage', 'full'),
      ('CC Team Lead', 'attachments.manage', 'limited'),
      ('CC Team Lead', 'comments.create', 'full'),
      ('CC Team Lead', 'comments.delete', 'limited'),
      ('CC Team Lead', 'mentions.create', 'limited'),
      ('CC Team Lead', 'search.global', 'limited'),
      ('CC Team Lead', 'saved_views.manage', 'full'),
      ('CC Team Lead', 'analytics.view', 'limited'),
      ('CC Team Lead', 'content.templates.use', 'full'),
      ('CC Team Lead', 'content.templates.manage', 'limited'),
      ('CC Team Lead', 'dashboard.customize', 'full'),
      ('Creator', 'notifications.view', 'full'),
      ('Creator', 'notifications.manage', 'full'),
      ('Creator', 'attachments.manage', 'limited'),
      ('Creator', 'comments.create', 'limited'),
      ('Creator', 'mentions.create', 'limited'),
      ('Creator', 'search.global', 'view'),
      ('Creator', 'saved_views.manage', 'full'),
      ('Creator', 'analytics.view', 'view'),
      ('Creator', 'content.templates.use', 'view'),
      ('Creator', 'dashboard.customize', 'full')
  ) as grant_data(role_name, permission_key, access_level)
    on grant_data.role_name = r.name
  join public.permissions p on p.key = grant_data.permission_key
  where r.company_id = target_company_id
  on conflict (role_id, permission_id) do update
  set access_level = excluded.access_level;
end;
$$;

select public.assign_final_permissions_for_company(id) from public.companies;

create or replace function public.assign_final_permissions_after_company_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assign_final_permissions_for_company(new.id);
  return new;
end;
$$;

drop trigger if exists zz_assign_final_permissions_after_company_insert on public.companies;
create trigger zz_assign_final_permissions_after_company_insert
after insert on public.companies
for each row execute function public.assign_final_permissions_after_company_insert();

alter table public.platform_admins enable row level security;
alter table public.platform_activity_logs enable row level security;
alter table public.attachments enable row level security;
alter table public.comments enable row level security;
alter table public.mentions enable row level security;
alter table public.saved_views enable row level security;
alter table public.content_templates enable row level security;
alter table public.dashboard_preferences enable row level security;

alter table public.platform_admins force row level security;
alter table public.platform_activity_logs force row level security;
alter table public.attachments force row level security;
alter table public.comments force row level security;
alter table public.mentions force row level security;
alter table public.saved_views force row level security;
alter table public.content_templates force row level security;
alter table public.dashboard_preferences force row level security;

drop policy if exists "Platform admins can read own account" on public.platform_admins;
create policy "Platform admins can read own account"
on public.platform_admins for select to authenticated
using (auth_user_id = auth.uid() or public.is_current_platform_admin());

drop policy if exists "Platform admins can read platform activity" on public.platform_activity_logs;
create policy "Platform admins can read platform activity"
on public.platform_activity_logs for select to authenticated
using (public.is_current_platform_admin());

drop policy if exists "Platform admins can create platform activity" on public.platform_activity_logs;
create policy "Platform admins can create platform activity"
on public.platform_activity_logs for insert to authenticated
with check (platform_admin_id = public.current_platform_admin_id());

drop policy if exists "Platform admins can read all companies" on public.companies;
create policy "Platform admins can read all companies"
on public.companies for select to authenticated
using (public.is_current_platform_admin());

drop policy if exists "Platform admins can update company lifecycle" on public.companies;
create policy "Platform admins can update company lifecycle"
on public.companies for update to authenticated
using (public.is_current_platform_admin())
with check (public.is_current_platform_admin());

drop policy if exists "Users can create scoped notifications" on public.notifications;
create policy "Users can create scoped notifications"
on public.notifications for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.is_same_company_user(user_id)
);

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select to authenticated
using (public.is_same_company(company_id) and user_id = auth.uid());

drop policy if exists "Users can update own notification read state" on public.notifications;
create policy "Users can update own notification read state"
on public.notifications for update to authenticated
using (public.is_same_company(company_id) and user_id = auth.uid())
with check (public.is_same_company(company_id) and user_id = auth.uid());

drop policy if exists "Permitted users can read attachments" on public.attachments;
create policy "Permitted users can read attachments"
on public.attachments for select to authenticated
using (
  public.is_same_company(company_id)
  and public.can_access_entity_scope(entity_type, entity_id)
);

drop policy if exists "Permitted users can create attachments" on public.attachments;
create policy "Permitted users can create attachments"
on public.attachments for insert to authenticated
with check (
  public.is_same_company(company_id)
  and uploaded_by = auth.uid()
  and public.has_permission('attachments.manage', 'limited')
  and public.can_access_entity_scope(entity_type, entity_id)
);

drop policy if exists "Permitted users can delete attachments" on public.attachments;
create policy "Permitted users can delete attachments"
on public.attachments for delete to authenticated
using (
  public.is_same_company(company_id)
  and public.can_access_entity_scope(entity_type, entity_id)
  and (uploaded_by = auth.uid() or public.is_current_user_admin())
);

drop policy if exists "Permitted users can read comments" on public.comments;
create policy "Permitted users can read comments"
on public.comments for select to authenticated
using (
  public.is_same_company(company_id)
  and deleted_at is null
  and public.can_access_entity_scope(entity_type, entity_id)
);

drop policy if exists "Permitted users can create comments" on public.comments;
create policy "Permitted users can create comments"
on public.comments for insert to authenticated
with check (
  public.is_same_company(company_id)
  and author_id = auth.uid()
  and public.has_permission('comments.create', 'limited')
  and public.can_access_entity_scope(entity_type, entity_id)
);

drop policy if exists "Permitted users can soft delete comments" on public.comments;
create policy "Permitted users can soft delete comments"
on public.comments for update to authenticated
using (
  public.is_same_company(company_id)
  and public.can_access_entity_scope(entity_type, entity_id)
  and (author_id = auth.uid() or public.has_permission('comments.delete', 'limited'))
)
with check (
  public.is_same_company(company_id)
  and public.can_access_entity_scope(entity_type, entity_id)
);

drop policy if exists "Permitted users can read mentions" on public.mentions;
create policy "Permitted users can read mentions"
on public.mentions for select to authenticated
using (
  public.is_same_company(company_id)
  and (mentioned_user_id = auth.uid() or public.can_access_comment_scope(comment_id))
);

drop policy if exists "Permitted users can create mentions" on public.mentions;
create policy "Permitted users can create mentions"
on public.mentions for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.is_same_company_user(mentioned_user_id)
  and public.has_permission('mentions.create', 'limited')
  and public.can_access_comment_scope(comment_id)
);

drop policy if exists "Users can manage own saved views" on public.saved_views;
create policy "Users can manage own saved views"
on public.saved_views for all to authenticated
using (
  public.is_same_company(company_id)
  and user_id = auth.uid()
  and public.has_permission('saved_views.manage', 'limited')
)
with check (
  public.is_same_company(company_id)
  and user_id = auth.uid()
  and public.has_permission('saved_views.manage', 'limited')
);

drop policy if exists "Users can read content templates" on public.content_templates;
create policy "Users can read content templates"
on public.content_templates for select to authenticated
using (
  public.is_same_company(company_id)
  and (
    status = 'active'
    or public.has_permission('content.templates.manage', 'limited')
  )
  and public.has_permission('content.templates.use', 'view')
);

drop policy if exists "Permitted users can create content templates" on public.content_templates;
create policy "Permitted users can create content templates"
on public.content_templates for insert to authenticated
with check (
  public.is_same_company(company_id)
  and created_by = auth.uid()
  and public.has_permission('content.templates.manage', 'limited')
);

drop policy if exists "Permitted users can update content templates" on public.content_templates;
create policy "Permitted users can update content templates"
on public.content_templates for update to authenticated
using (
  public.is_same_company(company_id)
  and public.has_permission('content.templates.manage', 'limited')
)
with check (
  public.is_same_company(company_id)
  and public.has_permission('content.templates.manage', 'limited')
);

drop policy if exists "Users can manage own dashboard preferences" on public.dashboard_preferences;
create policy "Users can manage own dashboard preferences"
on public.dashboard_preferences for all to authenticated
using (
  public.is_same_company(company_id)
  and user_id = auth.uid()
  and public.has_permission('dashboard.customize', 'limited')
)
with check (
  public.is_same_company(company_id)
  and user_id = auth.uid()
  and public.has_permission('dashboard.customize', 'limited')
);

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('contento-attachments', 'contento-attachments', false, 10485760),
  ('contento-avatars', 'contento-avatars', false, 5242880)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Company users can read attachment objects" on storage.objects;
create policy "Company users can read attachment objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'contento-attachments'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);

drop policy if exists "Company users can upload attachment objects" on storage.objects;
create policy "Company users can upload attachment objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'contento-attachments'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);

drop policy if exists "Company users can delete attachment objects" on storage.objects;
create policy "Company users can delete attachment objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'contento-attachments'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);

drop policy if exists "Company users can read avatar objects" on storage.objects;
create policy "Company users can read avatar objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'contento-avatars'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);

drop policy if exists "Company users can upload avatar objects" on storage.objects;
create policy "Company users can upload avatar objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'contento-avatars'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);

drop policy if exists "Company users can delete avatar objects" on storage.objects;
create policy "Company users can delete avatar objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'contento-avatars'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);

comment on table public.platform_admins is 'Platform-level administrators outside tenant membership. They manage organization lifecycle and platform analytics.';
comment on table public.platform_activity_logs is 'Audit log for platform admin actions against organizations and platform resources.';
comment on table public.attachments is 'Company-scoped metadata for files stored in Supabase Storage under company-prefixed paths.';
comment on table public.comments is 'Generic comments attached to accessible task, idea, content, and report records.';
comment on table public.mentions is 'Comment mentions that create notifications for same-company users who can access the entity.';
comment on table public.saved_views is 'User-owned saved filters for operational list pages.';
comment on table public.content_templates is 'Company-scoped reusable content templates.';
comment on table public.dashboard_preferences is 'User-owned dashboard widget preferences by role.';
comment on function public.can_access_entity_scope(text, uuid) is 'Shared RLS helper for generic comments, attachments, and mentions across scoped modules.';
comment on column public.companies.status is 'Organization lifecycle state. Active organizations can use dashboards; disabled and deleted organizations are blocked from tenant access.';
