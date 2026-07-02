import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardCharts, getDashboardSections, getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Client dashboard",
};

export default async function ClientDashboardPage() {
  const context = await requireDashboardAccess("client");
  const [summary, charts, sections] = await Promise.all([
    getDashboardSummary(context),
    getDashboardCharts(context),
    getDashboardSections(context),
  ]);

  if (!sections.clients.length) {
    redirect("/account-inactive?error=client-expired");
  }

  return (
    <RoleDashboardFoundation
      dashboard={roleDashboards.client}
      summary={summary}
      charts={charts}
      sections={sections}
      titleOverride={sections.clients[0]?.name ? `${sections.clients[0].name} Portal` : `${context.displayName}'s Dashboard`}
    />
  );
}
