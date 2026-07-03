import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileDown, Sparkles } from "lucide-react";

import { generateReportAction } from "@/lib/workflows/actions";
import { getClients } from "@/lib/clients/queries";
import {
  getWorkflowReports,
  getWorkflowTeams,
} from "@/lib/workflows/queries";
import { requireAuthContext } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { canOpenReports } from "@/lib/workflows/scope";
import { CONTENTO_TIME_ZONE, formatCairoDateTime, getCairoDate } from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
import { FormSheet } from "@/components/dashboard/form-sheet";
import { FilterPanel } from "@/components/dashboard/filter-panel";
import { PageActions, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { getDefaultDashboardPath, getRoleDisplayName, isInternalUserRole, type UserRole } from "@/types/roles";

export const metadata: Metadata = {
  title: "Reports",
};

const reportTypes = ["daily", "weekly", "monthly", "creator", "team", "company"] as const;
const generatedReportTypes = ["daily", "weekly", "monthly"] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const roleGeneratedSections: Record<UserRole, string[]> = {
  admin: ["Company overview", "Client activity summary", "Reports reviewed/finalized", "Users and teams activity", "Content approval overview", "Key decisions"],
  supervisor: ["Assigned clients summary", "Tasks assigned/reviewed", "Client communication/actions", "Reports reviewed", "Blockers"],
  "team-lead": ["Team progress", "Tasks reviewed", "Content review handoff", "Blockers"],
  creator: ["Ideas created", "Content submitted", "Tasks completed or in progress", "Client feedback handled", "Blockers"],
  "graphic-designer": ["Assigned production tasks", "Final drive links submitted", "Revisions handled", "Pending work", "Blockers"],
  "video-editor": ["Assigned video/reel tasks", "Final drive links submitted", "Revisions handled", "Pending work", "Blockers"],
  client: ["Sent client reports"],
};

function reportAvailability() {
  const today = getCairoDate();
  const dayOfMonth = Number(today.slice(-2));
  const dayOfWeek = new Date(`${today}T00:00:00.000Z`).getUTCDay();

  return {
    daily: { available: true, label: "Daily", helper: "Available every day." },
    weekly: { available: dayOfWeek === 5, label: "Weekly", helper: "Available only on Friday." },
    monthly: { available: dayOfMonth === 27, label: "Monthly", helper: "Available only on day 27 of the month." },
  } as const;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; team?: string; client?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requireAuthContext();

  if (!canOpenReports(context)) {
    redirect(`${getDefaultDashboardPath(context.role)}?error=permission-denied`);
  }

  const [reports, teams, clients] = await Promise.all([
    getWorkflowReports(context, { type: params.type, teamId: params.team, clientId: params.client }),
    getWorkflowTeams(context),
    getClients(context),
  ]);
  const activeTeams = teams.filter((team) => team.status === "active");
  const activeClients = clients.filter((client) => client.status === "active");
  const canSubmit = isInternalUserRole(context.role) && hasPermission(context, "reports.submit", "limited");
  const canExport = hasPermission(context, "exports.reports", "limited");
  const availability = reportAvailability();
  const roleSections = roleGeneratedSections[context.role];

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Submit and review daily, weekly, user, team, and company reports with company-scoped access."
        actions={
          <PageActions>
            {canExport && (
              <a
                href={`/reports/export?type=${encodeURIComponent(params.type ?? "all")}&team=${encodeURIComponent(params.team ?? "all")}&client=${encodeURIComponent(params.client ?? "all")}`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <Download />
                Export CSV
              </a>
            )}
            {canSubmit && (
          <FormSheet
            title="Generate report"
            description={`Contento generates your ${getRoleDisplayName(context.role)} report from live activity, tasks, content, reviews, comments, final links, and work-hours data in ${CONTENTO_TIME_ZONE}.`}
            triggerLabel="Generate report"
          >
            <form action={generateReportAction} className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {generatedReportTypes.map((type) => {
                  const state = availability[type];

                  return (
                    <label
                      key={type}
                      className={`rounded-lg border p-3 text-sm ${state.available ? "bg-secondary/20" : "bg-muted/30 text-muted-foreground"}`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <input type="radio" name="reportType" value={type} defaultChecked={type === "daily"} disabled={!state.available} />
                        {state.label}
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">{state.helper}</span>
                    </label>
                  );
                })}
              </div>
              <div className="rounded-lg border bg-secondary/25 p-4">
                <p className="text-sm font-medium">{getRoleDisplayName(context.role)} report sections</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roleSections.map((section) => (
                    <Badge key={section} variant="secondary">{section}</Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  The saved report is generated from accessible activity logs, tasks, ideas, content, comments, final output links, reviews, work sessions, breaks, and missing-time records.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Internal review note</Label>
                <textarea
                  id="note"
                  name="note"
                  placeholder="Optional note only. Contento fills the report body from recorded activity."
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div>
                <Button type="submit">
                  <Sparkles />
                  Generate report
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Flow: generated by user, reviewed by Account Manager when scoped, then finalized or sent by Marketing Manager.
                </p>
              </div>
            </form>
          </FormSheet>
            )}
            <FilterPanel
              description="Review reports by type, team, or client."
              activeFilters={[
                { label: "Type", value: params.type },
                { label: "Team", value: activeTeams.find((team) => team.id === params.team)?.name ?? params.team },
                { label: "Client", value: activeClients.find((client) => client.id === params.client)?.name ?? params.client },
              ]}
            >
          <form action="/reports" className="grid gap-3 md:grid-cols-[180px_180px_180px_auto]">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" defaultValue={params.type ?? "all"} className={selectClass}>
                <option value="all">All reports</option>
                {reportTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <select id="team" name="team" defaultValue={params.team ?? "all"} className={selectClass}>
                <option value="all">All teams</option>
                {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <select id="client" name="client" defaultValue={params.client ?? "all"} className={selectClass}>
                <option value="all">All clients</option>
                {activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-fit">Apply</Button>
            </div>
          </form>
            </FilterPanel>
          </PageActions>
        }
      />

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Report records</CardTitle>
          <CardDescription>{reports.length} report records found.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:hidden">
            {reports.map((report) => (
              <Link key={report.id} href={`/reports/${report.id}`} className="rounded-xl border bg-secondary/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{report.title || "Untitled report"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatCairoDateTime(report.created_at)}</p>
                  </div>
                  <Badge variant="secondary">{report.report_type}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <span>User: {report.userName ?? "Company"}</span>
                  <span>Team: {report.teamName ?? "No team"}</span>
                  <span>Client: {report.clientName ?? "No client"}</span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{report.body}</p>
              </Link>
            ))}
            {!reports.length && (
              <div className="rounded-xl border border-dashed px-3 py-10 text-center text-muted-foreground">
                <FileDown className="mx-auto mb-3 size-8 text-primary" />
                No reports match this filter.
              </div>
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="border-b px-3 py-2 font-medium">Report</th>
                  <th className="border-b px-3 py-2 font-medium">Type</th>
                  <th className="border-b px-3 py-2 font-medium">User</th>
                  <th className="border-b px-3 py-2 font-medium">Team</th>
                  <th className="border-b px-3 py-2 font-medium">Client</th>
                  <th className="border-b px-3 py-2 font-medium">Range</th>
                  <th className="border-b px-3 py-2 font-medium">Created</th>
                  <th className="border-b px-3 py-2 font-medium">Body</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="align-top">
                    <td className="border-b px-3 py-4 font-medium">
                      <Link href={`/reports/${report.id}`} className="hover:text-primary">
                        {report.title || "Untitled report"}
                      </Link>
                    </td>
                    <td className="border-b px-3 py-4">
                      <Badge variant="secondary">{report.report_type}</Badge>
                    </td>
                    <td className="border-b px-3 py-4">{report.userName ?? "Company"}</td>
                    <td className="border-b px-3 py-4">{report.teamName ?? "No team"}</td>
                    <td className="border-b px-3 py-4">
                      {report.client_id ? (
                        <Link href={routes.clients.detail(report.client_id)} className="font-medium text-primary hover:underline">
                          {report.clientName ?? "Open client"}
                        </Link>
                      ) : (
                        "No client"
                      )}
                    </td>
                    <td className="border-b px-3 py-4">
                      {report.date_range_start || report.date_range_end
                        ? `${report.date_range_start ?? "Start"} to ${report.date_range_end ?? "End"}`
                        : "No range"}
                    </td>
                    <td className="border-b px-3 py-4">{formatCairoDateTime(report.created_at)}</td>
                    <td className="border-b px-3 py-4 text-muted-foreground">{report.body}</td>
                  </tr>
                ))}
                {!reports.length && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                      <FileDown className="mx-auto mb-3 size-8 text-primary" />
                      No reports match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
