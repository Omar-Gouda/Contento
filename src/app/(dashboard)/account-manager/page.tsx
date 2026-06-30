import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardCharts, getDashboardSections, getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Account Manager dashboard",
};

export default async function AccountManagerDashboardPage() {
  const context = await requireDashboardAccess("supervisor");
  const [summary, charts, sections] = await Promise.all([
    getDashboardSummary(context),
    getDashboardCharts(context),
    getDashboardSections(context),
  ]);

  return <RoleDashboardFoundation dashboard={roleDashboards.supervisor} summary={summary} charts={charts} sections={sections} />;
}
