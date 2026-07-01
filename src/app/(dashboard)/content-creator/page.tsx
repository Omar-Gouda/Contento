import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardCharts, getDashboardSections, getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Content Creator dashboard",
};

export default async function ContentCreatorDashboardPage() {
  const context = await requireDashboardAccess("creator");
  const [summary, charts, sections] = await Promise.all([
    getDashboardSummary(context),
    getDashboardCharts(context),
    getDashboardSections(context),
  ]);

  return (
    <RoleDashboardFoundation
      dashboard={roleDashboards.creator}
      summary={summary}
      charts={charts}
      sections={sections}
      titleOverride={`${context.displayName}'s Dashboard`}
    />
  );
}
