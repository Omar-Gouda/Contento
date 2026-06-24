import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Admin dashboard",
};

export default async function AdminDashboardPage() {
  const context = await requireDashboardAccess("admin");
  const summary = await getDashboardSummary(context);

  return <RoleDashboardFoundation dashboard={roleDashboards.admin} summary={summary} />;
}
