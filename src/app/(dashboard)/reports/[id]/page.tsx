import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { sendReportToClientAction } from "@/lib/workflows/actions";
import { getWorkflowReportById } from "@/lib/workflows/queries";
import { formatCairoDateTime } from "@/lib/time";
import { routes } from "@/constants/routes";
import { CollaborationPanel } from "@/components/dashboard/collaboration-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Report detail",
};

function metricEntries(metrics: unknown) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return [];
  }

  return Object.entries(metrics)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .map(([key, value]) => ({
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (letter) => letter.toUpperCase()),
      value,
    }));
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requirePermission("reports.view_own", "view");
  const report = await getWorkflowReportById(context, id);

  if (!report) {
    notFound();
  }
  const metrics = metricEntries(report.metrics_json);
  const canSendToClient = hasPermission(context, "reports.send_to_client", "limited");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Report detail</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{report.title || "Untitled report"}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review the report body, ownership, team context, and coverage range.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Report metadata</CardTitle>
              <CardDescription>Company-scoped report record.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{report.report_type}</Badge>
              {report.clientName && <Badge variant="secondary">{report.clientName}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Client</p>
            {report.client_id ? (
              <Link href={routes.clients.detail(report.client_id)} className="font-medium text-primary hover:underline">
                {report.clientName ?? "Open client"}
              </Link>
            ) : (
              <p className="font-medium">No client</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">User</p>
            <p className="font-medium">{report.userName ?? "Company"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Team</p>
            <p className="font-medium">{report.teamName ?? "No team"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Range</p>
            <p className="font-medium">
              {report.date_range_start || report.date_range_end
                ? `${report.date_range_start ?? "Start"} to ${report.date_range_end ?? "End"}`
                : "No range"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Created</p>
            <p className="font-medium">{formatCairoDateTime(report.created_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Client delivery</p>
            <p className="font-medium">{report.sent_to_client_at ? `Sent ${formatCairoDateTime(report.sent_to_client_at)}` : "Not sent"}</p>
          </div>
          {canSendToClient && report.client_id && !report.sent_to_client_at && (
            <form action={sendReportToClientAction} className="md:col-span-4">
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="redirectTo" value={`/reports/${report.id}`} />
              <Button type="submit">Send to client</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report body</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {report.body}
        </CardContent>
      </Card>

      {metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Structured metrics</CardTitle>
            <CardDescription>Generated report values preserved for client-ready review and export.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border bg-secondary/25 p-3">
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold">{metric.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CollaborationPanel context={context} entityType="report" entityId={report.id} redirectTo={`/reports/${report.id}`} />
    </section>
  );
}
