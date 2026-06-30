begin;

drop policy if exists "Permitted users can read reports" on public.reports;
create policy "Permitted users can read reports"
on public.reports for select to authenticated
using (
  (
    public.can_access_report_scope(company_id, user_id, team_id)
    or public.can_access_client_scope(client_id, company_id)
  )
  and public.can_access_client_scope(client_id, company_id)
  and (
    coalesce(public.current_role_name(), '') <> 'Client'
    or sent_to_client_at is not null
  )
);

comment on column public.reports.sent_to_client_at is 'Timestamp set when a permitted internal user explicitly shares this client-scoped report with the client workspace.';
comment on column public.reports.sent_to_client_by is 'Company user who shared the report with the client workspace.';

commit;
