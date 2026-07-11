import type { Metadata } from "next";
import Link from "next/link";
import { Download, Filter, ScrollText } from "lucide-react";

import { PageHeader, PageActions } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPlatformAuditLogs, sanitizeMetadata } from "@/lib/super-admin/platform-control";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Platform Audit Logs",
};

export default async function PlatformAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; organizationId?: string }>;
}) {
  const params = await searchParams;
  const logs = await getPlatformAuditLogs(params);
  const query = new URLSearchParams();

  if (params.action) query.set("action", params.action);
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.organizationId) query.set("organizationId", params.organizationId);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Audit Logs"
        description="Review Super Admin actions with safe metadata redaction."
        actions={(
          <PageActions>
            <Link href={`/super-admin/audit-logs/export${query.size ? `?${query.toString()}` : ""}`} className={buttonVariants({ variant: "outline" })}>
              <Download />
              Export CSV
            </Link>
          </PageActions>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4 text-primary" />
            Filters
          </CardTitle>
          <CardDescription>Filter by action, entity type, or organization ID.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_12rem_1fr_auto]">
            <Input name="action" placeholder="Action contains..." defaultValue={params.action ?? ""} />
            <Input name="entityType" placeholder="Entity type" defaultValue={params.entityType ?? ""} />
            <Input name="organizationId" placeholder="Organization ID" defaultValue={params.organizationId ?? ""} />
            <Button type="submit" variant="outline">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4 text-primary" />
            Logs
          </CardTitle>
          <CardDescription>{logs.length} recent platform log{logs.length === 1 ? "" : "s"}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {logs.map((log) => (
            <details key={log.id} className="rounded-xl border bg-secondary/25 p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{log.action}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {log.adminEmail ?? "Platform admin"} - {log.organizationName ?? log.entity_type} - {formatCairoDateTime(log.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline">{log.entity_type}</Badge>
                </div>
              </summary>
              <pre className="mt-4 max-h-80 overflow-auto rounded-xl border bg-background p-3 text-xs text-muted-foreground">
                {JSON.stringify(sanitizeMetadata(log.metadata), null, 2)}
              </pre>
            </details>
          ))}
          {!logs.length && <p className="rounded-xl border bg-secondary/25 p-4 text-sm text-muted-foreground">No audit logs match these filters.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
