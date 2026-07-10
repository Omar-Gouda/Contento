begin;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'task_comments',
    'content_reviews',
    'content_ratings',
    'comments',
    'attachments',
    'client_assignments',
    'team_members'
  ]
  loop
    if to_regclass('public.' || quote_ident(target_table)) is not null then
      execute format('alter table public.%I add column if not exists demo_session_id uuid', target_table);
      execute format('alter table public.%I add column if not exists created_by_demo boolean not null default false', target_table);
      execute format('alter table public.%I add column if not exists demo_expires_at timestamptz', target_table);
      execute format('create index if not exists %I on public.%I(demo_session_id)', target_table || '_demo_session_id_idx', target_table);
      execute format('create index if not exists %I on public.%I(demo_expires_at)', target_table || '_demo_expires_at_idx', target_table);
      execute format('comment on column public.%I.demo_session_id is %L', target_table, 'Scopes temporary public demo records for cleanup.');
    end if;
  end loop;
end;
$$;

commit;
