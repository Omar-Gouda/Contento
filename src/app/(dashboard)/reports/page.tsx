import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileDown, Sparkles } from "lucide-react";

import { generateReportAction } from "@/lib/workflows/actions";
import { getClients } from "@/lib/clients/queries";
import {
  getWorkflowReports,
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";
import { requireAuthContext } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { canOpenReports } from "@/lib/workflows/scope";
import { formatCairoDateTime } from "@/lib/time";
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
import { getDefaultDashboardPath } from "@/types/roles";

export const metadata: Metadata = {
  title: "Reports",
};

const reportTypes = ["daily", "weekly", "creator", "team", "company"] as const;
const generatedReportTypes = ["daily", "weekly"] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const generatedSections = [
  ["Completed tasks", "tasks.status + updated_at"],
  ["Pending tasks", "tasks.status"],
  ["Submitted content", "content_items.submitted_at"],
  ["Approved / declined content", "content_items.status"],
  ["Revision count", "content_items change-request statuses"],
  ["Client comments", "task and entity comments"],
  ["Work-hours summary", "work_days totals"],
  ["Missing hours", "work_days.total_missing_minutes"],
] as const;
const manualMetrics = [
  ["reachGrowth", "Reach growth %"],
  ["engagementRate", "Engagement rate %"],
  ["followerGrowth", "Follower growth"],
  ["totalAdSpend", "Total ad spend"],
  ["reach", "Reach"],
  ["impressions", "Impressions"],
  ["clicks", "Clicks"],
  ["ctr", "CTR"],
  ["cpc", "CPC"],
  ["cpm", "CPM"],
  ["leadsGenerated", "Leads generated"],
  ["conversions", "Conversions"],
  ["roas", "ROAS"],
] as const;

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

  const [reports, users, teams, clients] = await Promise.all([
    getWorkflowReports(context, { type: params.type, teamId: params.team, clientId: params.client }),
    getWorkflowUsers(context),
    getWorkflowTeams(context),
    getClients(context),
  ]);
  const activeUsers = users.filter((user) => user.status === "active");
  const activeTeams = teams.filter((team) => team.status === "active");
  const activeClients = clients.filter((client) => client.status === "active");
  const canSubmit = hasPermission(context, "reports.submit", "limited");
  const canSubmitForTeam = hasPermission(context, "reports.view_team", "limited");
  const canExport = hasPermission(context, "exports.reports", "limited");

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
            title="Generated report builder"
            description="Contento generates the operational report from live records. Add optional notes and editable marketing metrics before saving."
            triggerLabel="Generate report"
          >
            <form action={generateReportAction} className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="reportType">Type</Label>
                <select id="reportType" name="reportType" className={selectClass}>
                  {generatedReportTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userId">User scope</Label>
                <select id="userId" name="userId" defaultValue={context.userId} className={selectClass}>
                  {canSubmitForTeam
                    ? (
                      <>
                        <option value="">Team summary when a team is selected</option>
                        {activeUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
                      </>
                    )
                    : <option value={context.userId}>{context.email}</option>}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamId">Team</Label>
                <select id="teamId" name="teamId" className={selectClass}>
                  <option value="">No team</option>
                  {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientId">Client</Label>
                <select id="clientId" name="clientId" className={selectClass}>
                  <option value="">No client scope</option>
                  {activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div className="grid gap-3 lg:col-span-4 md:grid-cols-2">
                {generatedSections.map(([label, source]) => (
                  <div key={label} className="rounded-lg border bg-secondary/25 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Source: {source}</p>
                      </div>
                      <Badge variant="secondary">Auto</Badge>
                    </div>
                    <p className="mt-3 rounded-md bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                      Generated from the selected report range when saved.
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:col-span-4 lg:grid-cols-3">
                {manualMetrics.map(([name, label]) => (
                  <div key={name} className="space-y-2">
                    <Label htmlFor={name}>{label}</Label>
                    <input id={name} name={name} className={selectClass} />
                  </div>
                ))}
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="keyAchievements">Key achievements</Label>
                <textarea
                  id="keyAchievements"
                  name="keyAchievements"
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="mainChallenges">Main challenges</Label>
                <textarea
                  id="mainChallenges"
                  name="mainChallenges"
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="nextMonthFocus">Next month&apos;s focus</Label>
                <textarea
                  id="nextMonthFocus"
                  name="nextMonthFocus"
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="customSection">Custom section</Label>
                <textarea
                  id="customSection"
                  name="customSection"
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2 lg:col-span-4">
                <Label htmlFor="note">Internal review note</Label>
                <textarea
                  id="note"
                  name="note"
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="lg:col-span-4">
                <Button type="submit">
                  <Sparkles />
                  Generate draft
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Flow: Generated Draft / Account Manager Review / Marketing Manager Final / Sent to Client.
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
