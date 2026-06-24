import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardWidgets } from "@/lib/dashboard/preferences";
import { getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "CC Team Lead dashboard",
};

export default async function TeamLeadDashboardPage() {
  const context = await requireDashboardAccess("team-lead");
  const [summary, widgets] = await Promise.all([
    getDashboardSummary(context),
    getDashboardWidgets(context),
  ]);

  return <RoleDashboardFoundation dashboard={roleDashboards["team-lead"]} summary={summary} widgets={widgets} currentPath="/team-lead" />;
}
