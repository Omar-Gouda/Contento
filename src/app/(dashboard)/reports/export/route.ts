import { NextResponse } from "next/server";

import { resolveAuthProfile } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkflowReports } from "@/lib/workflows/queries";

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export async function GET(request: Request) {
  const resolution = await resolveAuthProfile();

  if (resolution.state !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(resolution.context, "exports.reports", "limited")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "all";
  const teamId = url.searchParams.get("team") ?? "all";
  const reports = await getWorkflowReports(resolution.context, { type, teamId });
  const header = ["id", "type", "user", "team", "title", "range_start", "range_end", "body", "created_at"];
  const rows = reports.map((report) => [
    report.id,
    report.report_type,
    report.userName ?? "",
    report.teamName ?? "",
    report.title,
    report.date_range_start ?? "",
    report.date_range_end ?? "",
    report.body,
    report.created_at,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const supabase = await createSupabaseServerClient();
  await supabase.from("activity_logs").insert({
    company_id: resolution.context.companyId,
    user_id: resolution.context.userId,
    action: "reports.exported",
    entity_type: "report",
    entity_id: null,
    metadata: { type, team_id: teamId, row_count: reports.length },
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="contento-reports-${type}.csv"`,
    },
  });
}
