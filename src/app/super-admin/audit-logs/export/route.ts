import { getPlatformAuditLogs, sanitizeMetadata } from "@/lib/super-admin/platform-control";

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const logs = await getPlatformAuditLogs({
    action: url.searchParams.get("action") ?? undefined,
    entityType: url.searchParams.get("entityType") ?? undefined,
    organizationId: url.searchParams.get("organizationId") ?? undefined,
  });
  const rows = [
    ["created_at", "admin_email", "action", "entity_type", "entity_id", "organization", "metadata"],
    ...logs.map((log) => [
      log.created_at,
      log.adminEmail ?? "",
      log.action,
      log.entity_type,
      log.entity_id ?? "",
      log.organizationName ?? "",
      JSON.stringify(sanitizeMetadata(log.metadata)),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="contento-platform-audit-logs.csv"`,
    },
  });
}
