import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/context";
import { getWorkflowReportById } from "@/lib/workflows/queries";
import { formatCairoDateTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
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
            <Badge>{report.report_type}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
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
    </section>
  );
}
