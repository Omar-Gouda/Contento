import type { Metadata } from "next";

import { RoleDashboardFoundation } from "@/components/dashboard/role-dashboard-foundation";
import { roleDashboards } from "@/config/site";
import { requireDashboardAccess } from "@/lib/auth/context";
import { getDashboardCharts, getDashboardSections, getDashboardSummary } from "@/lib/dashboard/queries";

export const metadata: Metadata = {
  title: "Video Editor dashboard",
};

export default async function VideoEditorDashboardPage() {
  const context = await requireDashboardAccess("video-editor");
  const [summary, charts, sections] = await Promise.all([
    getDashboardSummary(context),
    getDashboardCharts(context),
    getDashboardSections(context),
  ]);

  return (
    <RoleDashboardFoundation
      dashboard={roleDashboards["video-editor"]}
      summary={summary}
      charts={charts}
      sections={sections}
      titleOverride={`${context.displayName}'s Dashboard`}
    />
  );
}
