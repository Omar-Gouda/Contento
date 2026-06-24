import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardWidgets } from "@/lib/dashboard/preferences";
import { getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Creator dashboard",
};

export default async function CreatorDashboardPage() {
  const context = await requireDashboardAccess("creator");
  const [summary, widgets] = await Promise.all([
    getDashboardSummary(context),
    getDashboardWidgets(context),
  ]);

  return <RoleDashboardFoundation dashboard={roleDashboards.creator} summary={summary} widgets={widgets} currentPath="/creator" />;
}
