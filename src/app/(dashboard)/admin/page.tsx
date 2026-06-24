import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardWidgets } from "@/lib/dashboard/preferences";
import { getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Admin dashboard",
};

export default async function AdminDashboardPage() {
  const context = await requireDashboardAccess("admin");
  const [summary, widgets] = await Promise.all([
    getDashboardSummary(context),
    getDashboardWidgets(context),
  ]);

  return <RoleDashboardFoundation dashboard={roleDashboards.admin} summary={summary} widgets={widgets} currentPath="/admin" />;
}
