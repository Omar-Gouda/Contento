import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardCharts, getDashboardSections, getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "CC Team Lead dashboard",
};

export default async function TeamLeadDashboardPage() {
  const context = await requireDashboardAccess("team-lead");
  const [summary, charts, sections] = await Promise.all([
    getDashboardSummary(context),
    getDashboardCharts(context),
    getDashboardSections(context),
  ]);

  return (
    <RoleDashboardFoundation
      dashboard={roleDashboards["team-lead"]}
      summary={summary}
      charts={charts}
      sections={sections}
      titleOverride={`${context.displayName}'s Dashboard`}
    />
  );
}
