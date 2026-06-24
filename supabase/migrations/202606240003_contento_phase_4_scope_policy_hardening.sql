begin;

drop policy if exists "Permitted users can manage team members" on public.team_members;
create policy "Permitted users can manage team members"
on public.team_members for all to authenticated
using (public.can_manage_team_member_scope(team_id))
with check (
  public.can_manage_team_member_scope(team_id)
  and public.is_same_company_user(user_id)
);

drop policy if exists "Permitted users can create tasks" on public.tasks;
create policy "Permitted users can create tasks"
on public.tasks for insert to authenticated
with check (
  public.is_same_company(company_id)
  and (
    public.has_permission('tasks.create', 'limited')
    or public.has_permission('tasks.manage', 'limited')
  )
  and public.can_assign_task_scope(company_id, team_id, assigned_to)
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (assigned_by is null or assigned_by = auth.uid())
  and (team_id is null or public.is_same_company_team(team_id))
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Permitted users can update tasks" on public.tasks;
create policy "Permitted users can update tasks"
on public.tasks for update to authenticated
using (
  public.can_access_task_scope(company_id, team_id, assigned_to, created_by)
  and (
    public.has_permission('tasks.update_status', 'limited')
    or public.has_permission('tasks.manage', 'limited')
    or assigned_to = auth.uid()
  )
)
with check (
  public.is_same_company(company_id)
  and public.can_assign_task_scope(company_id, team_id, assigned_to)
  and (assigned_to is null or public.is_same_company_user(assigned_to))
  and (assigned_by is null or assigned_by = auth.uid() or public.is_same_company_user(assigned_by))
  and (team_id is null or public.is_same_company_team(team_id))
);

drop policy if exists "Permitted users can create content items" on public.content_items;
create policy "Permitted users can create content items"
on public.content_items for insert to authenticated
with check (
  public.is_same_company(company_id)
  and public.has_permission('content.create', 'limited')
  and public.can_access_content_scope(company_id, team_id, creator_id, status::text)
  and (creator_id is null or public.is_same_company_user(creator_id))
  and (team_id is null or public.is_same_company_team(team_id))
  and public.is_same_company_task(task_id)
  and public.is_same_company_idea(idea_id)
);

drop policy if exists "Permitted users can update content items" on public.content_items;
create policy "Permitted users can update content items"
on public.content_items for update to authenticated
using (
  public.can_access_content_scope(company_id, team_id, creator_id, status::text)
  and (
    public.has_permission('content.update', 'limited')
    or public.has_permission('content.manage', 'limited')
    or creator_id = auth.uid()
    or public.can_review_content_scope(id)
  )
)
with check (
  public.is_same_company(company_id)
  and public.can_access_content_scope(company_id, team_id, creator_id, status::text)
  and (creator_id is null or public.is_same_company_user(creator_id))
  and (team_id is null or public.is_same_company_team(team_id))
  and public.is_same_company_task(task_id)
  and public.is_same_company_idea(idea_id)
);

comment on policy "Permitted users can manage team members" on public.team_members is 'Requires both scoped team management and same-company member rows.';
comment on policy "Permitted users can create tasks" on public.tasks is 'Requires scoped assignment plus explicit same-company assignee/team checks.';
comment on policy "Permitted users can update tasks" on public.tasks is 'Preserves scoped task updates while preventing cross-company assignee/team links.';
comment on policy "Permitted users can create content items" on public.content_items is 'Requires scoped content access plus same-company creator/team/task/idea links.';
comment on policy "Permitted users can update content items" on public.content_items is 'Preserves review flow updates while preventing cross-company content links.';

commit;
