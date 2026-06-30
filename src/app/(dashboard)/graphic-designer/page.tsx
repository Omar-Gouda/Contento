import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardCharts, getDashboardSections, getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Graphic Designer dashboard",
};

export default async function GraphicDesignerDashboardPage() {
  const context = await requireDashboardAccess("graphic-designer");
  const [summary, charts, sections] = await Promise.all([
    getDashboardSummary(context),
    getDashboardCharts(context),
    getDashboardSections(context),
  ]);

  return <RoleDashboardFoundation dashboard={roleDashboards["graphic-designer"]} summary={summary} charts={charts} sections={sections} />;
}
