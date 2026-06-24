import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileDown, Plus } from "lucide-react";

import { createReportAction } from "@/lib/workflows/actions";
import {
  getWorkflowReports,
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
import { SavedViewsPanel } from "@/components/dashboard/saved-views-panel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Reports",
};

const reportTypes = ["daily", "weekly", "creator", "team", "company"] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; team?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("reports.view_own", "view");
  const [reports, users, teams] = await Promise.all([
    getWorkflowReports(context, { type: params.type, teamId: params.team }),
    getWorkflowUsers(context),
    getWorkflowTeams(context),
  ]);
  const activeUsers = users.filter((user) => user.status === "active");
  const activeTeams = teams.filter((team) => team.status === "active");
  const canSubmit = hasPermission(context, "reports.submit", "limited");
  const canSubmitForTeam = hasPermission(context, "reports.view_team", "limited");
  const canExport = hasPermission(context, "exports.reports", "limited");

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Reports</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Reports</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Submit and review daily, weekly, user, team, and company reports with company-scoped access.
          </p>
        </div>
        {canExport && (
          <a
            href={`/reports/export?type=${encodeURIComponent(params.type ?? "all")}&team=${encodeURIComponent(params.team ?? "all")}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download />
            Export CSV
          </a>
        )}
      </div>

      <PageMessage error={params.error} status={params.notice} />

      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle>Create report</CardTitle>
            <CardDescription>Reports are stored as structured company records and can be exported as CSV.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createReportAction} className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="reportType">Type</Label>
                <select id="reportType" name="reportType" className={selectClass}>
                  {reportTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userId">User</Label>
                <select id="userId" name="userId" defaultValue={context.userId} className={selectClass}>
                  {canSubmitForTeam
                    ? activeUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)
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
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateRangeStart">Range start</Label>
                <Input id="dateRangeStart" name="dateRangeStart" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateRangeEnd">Range end</Label>
                <Input id="dateRangeEnd" name="dateRangeEnd" type="date" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="body">Report body</Label>
                <Input id="body" name="body" required />
              </div>
              <div className="lg:col-span-3">
                <Button type="submit">
                  <Plus />
                  Save report
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Review reports by type.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/reports" className="grid gap-3 md:grid-cols-[180px_180px_auto]">
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
            <div className="flex items-end">
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <SavedViewsPanel
        context={context}
        module="reports"
        basePath="/reports"
        currentFilters={{
          type: params.type,
          team: params.team,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Report records</CardTitle>
          <CardDescription>{reports.length} report records found.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="border-b px-3 py-2 font-medium">Report</th>
                  <th className="border-b px-3 py-2 font-medium">Type</th>
                  <th className="border-b px-3 py-2 font-medium">User</th>
                  <th className="border-b px-3 py-2 font-medium">Team</th>
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
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
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
